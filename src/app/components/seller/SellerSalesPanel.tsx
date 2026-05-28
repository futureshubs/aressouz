import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, Loader2, CheckCircle2, CloudOff, RefreshCw, X, ShoppingCart, User, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { offlineSalesAdd, type OfflineSale, type OfflineSaleItem } from '../../utils/offlineSalesDb';
import { startOfflineSalesSyncWorker, syncPendingOfflineSales } from '../../utils/offlineSalesSync';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInfiniteQuery } from '@tanstack/react-query';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useIntersectionSentinel } from '../../hooks/useIntersectionSentinel';
import SellerReceiptModal from './SellerReceiptModal';
import {
  dispatchPosReceiptAfterSale,
  printPosReceipt,
  type PosReceiptData,
  isMobilePosDevice,
} from '../../utils/posReceipt';
import UzPhoneInput from '../shared/UzPhoneInput';

type ProductRow = {
  id: string;
  name?: string;
  barcode?: string;
  price?: number;
  variants?: Array<{
    id?: string;
    name?: string;
    price?: number;
    costPrice?: number;
    images?: string[];
    barcode?: string;
    stock?: number;
    stockQuantity?: number;
  }>;
  image?: string;
};

type CartLine = {
  key: string; // productId::variantId
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  priceUzs: number;
  costUzs?: number;
  qty: number;
  image?: string;
};

type Props = {
  token: string;
  shopId: string;
  shopName: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  products: ProductRow[];
  /** Called after sale is finished/synced attempt (to refetch products/inventory). */
  onAfterSale?: () => void;
};

function safeMoney(n: unknown): number {
  const x = Math.round(Number(n) || 0);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

function safeInt(n: unknown): number {
  const x = Math.floor(Number(n) || 0);
  return Number.isFinite(x) ? x : 0;
}

function makeId(): string {
  // good enough for offline ids; server stores as-is
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
}

export default function SellerSalesPanel({ token, shopId, shopName, isDark, accentColor, products, onAfterSale }: Props) {
  const [isPOSOpen, setIsPOSOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountUzs, setDiscountUzs] = useState(0);
  const [paidUzs, setPaidUzs] = useState(0);
  const [debtCustomerName, setDebtCustomerName] = useState('');
  const [debtCustomerPhone, setDebtCustomerPhone] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'card'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ last?: { synced: number; failed: number }; error?: string }>({});
  const [variantPicker, setVariantPicker] = useState<{
    productId: string;
    productName: string;
    image?: string;
    variants: Array<{
      variantId?: string;
      variantLabel?: string;
      priceUzs: number;
      costUzs?: number;
      stock: number;
      image?: string;
    }>;
  } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<PosReceiptData | null>(null);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  const [posPrinterPort, setPosPrinterPort] = useState<SerialPort | null>(null);
  const [posPrinterReady, setPosPrinterReady] = useState(false);

  const escposSafeText = (s: string) => {
    // XP-58C ESC/POS codepages often don't support full UTF-8 reliably.
    // We keep it readable by normalizing Uzbek quotes and stripping non-ASCII.
    return String(s ?? '')
      .replace(/[ʻʼ’‘`]/g, "'")
      .replace(/[“”]/g, '"')
      .normalize('NFKD')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
  };

  const wrapLine = (text: string, width: number) => {
    const t = escposSafeText(text).trim();
    if (!t) return [''];
    const out: string[] = [];
    let cur = '';
    for (const word of t.split(/\s+/g)) {
      if (!cur) {
        cur = word;
        continue;
      }
      if ((cur + ' ' + word).length <= width) {
        cur = cur + ' ' + word;
      } else {
        out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  };

  const makeEscposReceiptBytes = (receipt: PosReceiptData) => {
    const encoder = new TextEncoder(); // UTF-8 (we already strip to ASCII-ish)
    const chunks: Uint8Array[] = [];
    const pushText = (t: string) => chunks.push(encoder.encode(t));
    const pushBytes = (...b: number[]) => chunks.push(new Uint8Array(b));

    const WIDTH = 32; // typical 58mm chars on default font
    const created = new Date(receipt.createdAt);
    const payLabel = receipt.payMethod === 'cash' ? 'Naqd' : 'Karta';

    // Init
    pushBytes(0x1b, 0x40); // ESC @
    pushBytes(0x1b, 0x61, 0x01); // ESC a 1 (center)
    pushText(escposSafeText(shopName || 'Do`kon') + '\n');
    pushText('Offline sotuv (POS)\n');
    pushBytes(0x1b, 0x61, 0x00); // left
    pushText('-------------------------------\n');
    pushText(`Chek: ${escposSafeText(receipt.saleId)}\n`);
    pushText(`Sana: ${created.toLocaleDateString('uz-UZ')} ${created.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n`);
    pushText(`Tolov: ${escposSafeText(payLabel)}\n`);
    pushText('-------------------------------\n');

    for (const it of receipt.items) {
      const nameLines = wrapLine(it.name, WIDTH);
      for (const nl of nameLines) pushText(nl + '\n');
      const left = `${it.qty}x ${it.priceUzs.toLocaleString('uz-UZ')}`;
      const right = `${it.totalUzs.toLocaleString('uz-UZ')}`;
      const space = Math.max(1, WIDTH - left.length - right.length);
      pushText(left + ' '.repeat(space) + right + '\n');
      pushText('\n');
    }

    pushText('-------------------------------\n');
    const lineSum = (label: string, value: number) => {
      const l = escposSafeText(label);
      const r = `${value.toLocaleString('uz-UZ')}`;
      const space = Math.max(1, WIDTH - l.length - r.length);
      pushText(l + ' '.repeat(space) + r + '\n');
    };
    lineSum('Subtotal', receipt.subtotalUzs);
    lineSum('Chegirma', receipt.discountUzs);
    pushText('-------------------------------\n');
    pushBytes(0x1b, 0x45, 0x01); // bold on
    lineSum('JAMI', receipt.totalUzs);
    pushBytes(0x1b, 0x45, 0x00); // bold off
    pushText('\n');
    pushBytes(0x1b, 0x61, 0x01); // center
    pushText('Rahmat!\n');
    pushBytes(0x1b, 0x61, 0x00); // left

    // Feed & cut
    pushBytes(0x1b, 0x64, 0x04); // ESC d n (feed n lines)
    pushBytes(0x1d, 0x56, 0x01); // GS V 1 (partial cut)

    const totalLen = chunks.reduce((s, a) => s + a.length, 0);
    const buf = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.length;
    }
    return buf;
  };

  const connectPosPrinter = useCallback(async () => {
    if (!('serial' in navigator)) {
      toast.error('Bu brauzer POS printer ulashni qo‘llamaydi. Chrome/Edge kerak.');
      return;
    }
    try {
      // @ts-expect-error - WebSerial type
      const port: SerialPort = await (navigator as any).serial.requestPort();
      if (!port) return;
      try {
        // Most POS printers work on 9600/115200. Try 9600 first.
        // @ts-expect-error - WebSerial type
        await port.open({ baudRate: 9600 });
      } catch {
        // @ts-expect-error - WebSerial type
        await port.open({ baudRate: 115200 });
      }
      setPosPrinterPort(port);
      setPosPrinterReady(true);
      toast.success('Printer ulandi (ESC/POS). Endi chek bevosita chiqadi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Printer ulashda xatolik');
    }
  }, []);

  const disconnectPosPrinter = useCallback(async () => {
    const port = posPrinterPort;
    setPosPrinterReady(false);
    setPosPrinterPort(null);
    if (!port) return;
    try {
      // @ts-expect-error - WebSerial type
      await port.close();
    } catch {
      // ignore
    }
  }, [posPrinterPort]);

  const printReceiptEscpos = useCallback(
    async (receipt: PosReceiptData) => {
      const port = posPrinterPort;
      if (!port) {
        toast.error('Printer ulanmagan. Avval “Printerga ulash”ni bosing.');
        return;
      }
      try {
        // @ts-expect-error - WebSerial type
        const writer = port.writable?.getWriter?.();
        if (!writer) {
          toast.error('Printer yozish rejimida emas');
          return;
        }
        const data = makeEscposReceiptBytes(receipt);
        await writer.write(data);
        writer.releaseLock();
        toast.success('Chek printerga yuborildi');
      } catch (e) {
        setPosPrinterReady(false);
        toast.error(e instanceof Error ? e.message : 'Chek yuborishda xatolik');
      }
    },
    [posPrinterPort],
  );

  useEffect(() => {
    if (!token || !shopId) return;
    const stop = startOfflineSalesSyncWorker({
      token,
      shopId,
      intervalMs: 15000,
      onStatus: (s) => {
        if (s.last) setSyncInfo((p) => ({ ...p, last: s.last, error: s.error }));
        if (s.error) setSyncInfo((p) => ({ ...p, error: s.error }));
      },
    });
    return () => stop();
  }, [token, shopId]);

  const debouncedQuery = useDebouncedValue(query.trim(), 140);

  const searchQuery = useInfiniteQuery({
    queryKey: ['seller-pos-search', token, debouncedQuery],
    enabled: Boolean(token) && Boolean(debouncedQuery) && Boolean(isPOSOpen),
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const page = Number(pageParam) || 1;
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products?token=${encodeURIComponent(token)}&q=${encodeURIComponent(
        debouncedQuery,
      )}&page=${page}&limit=40`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Seller-Token': token,
        },
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(String(data?.error || `HTTP ${res.status}`));
      return data as { success: boolean; products: any[]; page: number; limit: number; total: number; hasMore: boolean };
    },
    getNextPageParam: (last) => (last?.hasMore ? (last.page ?? 1) + 1 : undefined),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const searchSentinel = useIntersectionSentinel({
    enabled: Boolean(searchQuery.hasNextPage && !searchQuery.isFetchingNextPage) && Boolean(debouncedQuery) && Boolean(isPOSOpen),
    onIntersect: () => {
      if (searchQuery.hasNextPage) void searchQuery.fetchNextPage();
    },
    rootMargin: '900px 0px',
  });

  const productSource = useMemo(() => {
    const base = Array.isArray(products) ? products : [];
    if (!debouncedQuery) return base;

    // Instant local matches while server is fetching (perceived speed)
    const q = debouncedQuery.toLowerCase();
    const local = base.filter((p: any) => {
      const name = String(p?.name ?? '').toLowerCase();
      const barcode = String(p?.barcode ?? '').toLowerCase();
      const vars = Array.isArray(p?.variants) ? p.variants : [];
      if (`${name} ${barcode}`.includes(q)) return true;
      return vars.some((v: any) => `${String(v?.name ?? '')} ${String(v?.barcode ?? '')}`.toLowerCase().includes(q));
    });

    const server = searchQuery.data?.pages?.flatMap((p: any) => (Array.isArray(p?.products) ? p.products : [])) ?? [];
    if (server.length === 0) return local;

    // Merge unique by id
    const out: any[] = [];
    const seen = new Set<string>();
    for (const p of [...local, ...server]) {
      const id = String(p?.id ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(p);
    }
    return out;
  }, [debouncedQuery, products, searchQuery.data]);

  const normalizedProducts = useMemo(() => {
    const list = Array.isArray(productSource) ? productSource : [];
    return list.map((p) => {
      const pid = String(p.id);
      const pname = String(p.name ?? 'Mahsulot');
      const rawVars = Array.isArray(p.variants) ? p.variants : [];
      const normalizedVariants =
        rawVars.length > 0
          ? rawVars.map((v) => {
              const vImg = String(v?.images?.[0] ?? p.image ?? '').trim();
              const vPrice = safeMoney(v?.price ?? p.price);
              const vCost = Math.max(0, Math.floor(Number(v?.costPrice ?? 0)));
              const vStock = Math.max(0, safeInt(v?.stock ?? v?.stockQuantity ?? 0));
              const vBarcode = String(v?.barcode ?? p.barcode ?? '').trim();
              return {
                variantId: v?.id != null && String(v.id).trim() !== '' ? String(v.id) : undefined,
                variantLabel: v?.name != null && String(v.name).trim() !== '' ? String(v.name) : undefined,
                barcode: vBarcode,
                priceUzs: vPrice,
                costUzs: vCost,
                stock: vStock,
                image: vImg,
              };
            })
          : [
              {
                variantId: undefined,
                variantLabel: undefined,
                barcode: String(p.barcode ?? '').trim(),
                priceUzs: safeMoney(p.price),
                costUzs: undefined,
                stock: Math.max(0, safeInt((p as any)?.stock ?? (p as any)?.stockQuantity ?? 0)),
                image: String(p.image ?? '').trim(),
              },
            ];

      const first = normalizedVariants[0];
      const searchHay = `${pname} ${String(first?.barcode ?? '')} ${pid} ${normalizedVariants
        .map((v) => `${String(v?.variantLabel ?? '')} ${String(v?.barcode ?? '')}`)
        .join(' ')}`.toLowerCase();
      return {
        id: pid,
        name: pname,
        barcode: String(first?.barcode ?? '').trim(),
        image: String(first?.image ?? '').trim(),
        variants: normalizedVariants,
        // card display
        priceUzs: safeMoney(first?.priceUzs ?? 0),
        stock: Math.max(0, safeInt(first?.stock ?? 0)),
        variantsCount: normalizedVariants.length,
        searchHay,
      };
    });
  }, [productSource]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedProducts.slice(0, 24);
    const out = normalizedProducts.filter((p) => {
      return String((p as any)?.searchHay ?? '').includes(q);
    });
    return out;
  }, [normalizedProducts, query]);

  const subtotalUzs = useMemo(() => cart.reduce((s, l) => s + safeMoney(l.priceUzs) * Math.max(1, l.qty), 0), [cart]);
  const discount = Math.min(Math.max(0, Math.floor(Number(discountUzs) || 0)), subtotalUzs);
  const totalUzs = Math.max(0, subtotalUzs - discount);
  const paid = Math.min(totalUzs, Math.max(0, Math.floor(Number(paidUzs) || 0)));
  const debtRemainingUzs = Math.max(0, totalUzs - paid);
  const hasDebt = debtRemainingUzs > 0;

  useEffect(() => {
    setPaidUzs((prev) => {
      const p = Math.floor(Number(prev) || 0);
      if (p === 0 || p > totalUzs) return totalUzs;
      return p;
    });
  }, [totalUzs]);

  const addToCart = (p: (typeof normalizedProducts)[number], v?: (typeof normalizedProducts)[number]['variants'][number]) => {
    const productId = p.id;
    const variantId = v?.variantId;
    const variantLabel = v?.variantLabel;
    const priceUzs = safeMoney(v?.priceUzs ?? p.priceUzs);
    const costUzs = v?.costUzs;
    const image = String(v?.image ?? p.image ?? '').trim();
    const stock = Math.max(0, safeInt(v?.stock ?? 0));
    const key = `${productId}::${variantId || ''}`;
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      const nextQty = idx >= 0 ? prev[idx].qty + 1 : 1;
      if (stock > 0 && nextQty > stock) {
        toast.error(`Omborda faqat ${stock} ta bor. Ortiqcha qo‘shib bo‘lmaydi.`);
        return prev;
      }
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key,
          productId,
          productName: p.name,
          variantId,
          variantLabel,
          priceUzs,
          ...(costUzs != null ? { costUzs } : {}),
          qty: 1,
          image,
        },
      ];
    });
    toast.success('Savatga qo‘shildi');
  };

  const updateQty = (key: string, nextQty: number) => {
    const q = Math.max(1, Math.floor(Number(nextQty) || 1));
    setCart((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      const [pid, vid] = String(key).split('::');
      const p = normalizedProducts.find((x) => x.id === pid);
      const v = p?.variants?.find((vv) => String(vv.variantId || '') === String(vid || '')) ?? p?.variants?.[0];
      const stock = Math.max(0, safeInt(v?.stock ?? 0));
      if (stock > 0 && q > stock) {
        toast.error(`Omborda faqat ${stock} ta bor.`);
        return prev;
      }
      return prev.map((l) => (l.key === key ? { ...l, qty: q } : l));
    });
  };

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));
  const clearCart = () => {
    setCart([]);
    setDiscountUzs(0);
    setPaidUzs(0);
    setDebtCustomerName('');
    setDebtCustomerPhone('');
    setDebtDueDate('');
  };

  const submitSale = async () => {
    if (submitting) return;
    if (!shopId) {
      toast.error('Do‘kon ID topilmadi');
      return;
    }
    if (cart.length === 0) {
      toast.error('Savat bo‘sh');
      return;
    }
    if (hasDebt) {
      if (!debtCustomerName.trim()) {
        toast.error('Qarz uchun mijoz ismini kiriting');
        return;
      }
      if (debtCustomerPhone.replace(/\D/g, '').length < 12) {
        toast.error('Telefon raqamini to\'liq kiriting (+998 va 9 ta raqam)');
        return;
      }
    }
    setSubmitting(true);
    try {
      const saleId = makeId();
      const createdAt = new Date().toISOString();
      const items: OfflineSaleItem[] = cart.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        variantLabel: l.variantLabel,
        qty: Math.max(1, Math.floor(l.qty)),
        priceUzs: safeMoney(l.priceUzs),
        ...(l.costUzs != null ? { costUzs: Math.max(0, Math.floor(Number(l.costUzs) || 0)) } : {}),
      }));
      const sale: OfflineSale = {
        saleId,
        shopId,
        createdAt,
        items,
        totals: {
          subtotalUzs,
          discountUzs: discount,
          totalUzs,
        },
        payment: { method: payMethod, paidUzs: paid },
        ...(hasDebt
          ? {
              debt: {
                customerName: debtCustomerName.trim(),
                customerPhone: debtCustomerPhone.trim(),
                remainingUzs: debtRemainingUzs,
                dueDate: debtDueDate || null,
              },
            }
          : {}),
        source: 'offline',
        status: 'pending_sync',
      };
      await offlineSalesAdd(sale);
      toast.success(
        hasDebt
          ? 'Sotuv saqlandi. Qarz yozildi — SMS internet bilan yuboriladi.'
          : 'Sotuv saqlandi. Internet bo‘lsa avtomatik yuboriladi.',
      );

      const receiptObj: PosReceiptData = {
        saleId,
        createdAt,
        items: cart.map((l) => ({
          name: l.variantLabel ? `${l.productName} (${l.variantLabel})` : l.productName,
          qty: Math.max(1, Math.floor(l.qty)),
          priceUzs: safeMoney(l.priceUzs),
          totalUzs: safeMoney(l.priceUzs) * Math.max(1, Math.floor(l.qty)),
        })),
        subtotalUzs,
        discountUzs: discount,
        totalUzs,
        payMethod,
      };
      setLastReceipt(receiptObj);

      const dispatch = dispatchPosReceiptAfterSale({
        receipt: receiptObj,
        shopName,
        posPrinterReady,
        printEscpos: printReceiptEscpos,
      });

      if (dispatch.mode === 'escpos') {
        toast.success('Chek termal printerga yuborildi');
      } else if (dispatch.mode === 'browser_print' && dispatch.success) {
        toast.success('Chek chop etish oynasi ochildi');
      } else if (dispatch.mode === 'preview' || !dispatch.success) {
        setReceiptPreviewOpen(true);
        if (isMobilePosDevice()) {
          toast.message('Chek tayyor — PDF yoki chop etishni tanlang');
        } else if (!dispatch.success) {
          toast.message('Chek oynasi ochilmadi — quyidagi tugmalardan foydalaning');
        }
      }

      clearCart();
      onAfterSale?.();

      // try quick sync if online
      if (navigator.onLine) {
        setSyncBusy(true);
        const r = await syncPendingOfflineSales({ token, shopId, limit: 10 });
        setSyncInfo((p) => ({ ...p, last: r, error: undefined }));
        if (hasDebt && r.synced > 0) {
          toast.message('Qarz ro\'yxatga qo\'shildi, mijozga SMS yuborildi');
        }
        onAfterSale?.(); // server stock decreased -> refresh again
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sotuvni saqlab bo‘lmadi');
    } finally {
      setSyncBusy(false);
      setSubmitting(false);
    }
  };

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  return (
    <div className="space-y-4 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Savdo (POS)</h2>
          <p className="text-xs mt-1" style={{ opacity: 0.7 }}>
            {shopName || 'Do‘kon'} — offline sotuv: internet bo‘lmasa ham saqlanadi, keyin sync bo‘ladi.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPOSOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition active:scale-95"
            style={{ background: accentColor.gradient, color: '#fff' }}
          >
            <ShoppingCart className="w-4 h-4" />
            Sotuv
          </button>
          <button
            type="button"
            disabled={syncBusy}
            onClick={() => {
              setSyncBusy(true);
              void syncPendingOfflineSales({ token, shopId, limit: 50 })
                .then((r) => setSyncInfo((p) => ({ ...p, last: r, error: undefined })))
                .catch((e) => setSyncInfo((p) => ({ ...p, error: e instanceof Error ? e.message : 'Sync xatosi' })))
                .finally(() => setSyncBusy(false));
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition active:scale-95 disabled:opacity-55"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            }}
          >
            {syncBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync
          </button>
        </div>
      </div>

      {syncInfo.last ? (
        <div className="rounded-2xl border p-3 text-sm flex items-center gap-2" style={cardStyle}>
          {syncInfo.last.failed > 0 ? (
            <CloudOff className="w-4 h-4" style={{ color: '#f59e0b' }} />
          ) : (
            <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
          )}
          <span style={{ opacity: 0.8 }}>
            Sync: {syncInfo.last.synced} ta yuborildi, {syncInfo.last.failed} ta xato
          </span>
        </div>
      ) : syncInfo.error ? (
        <div className="rounded-2xl border p-3 text-sm" style={cardStyle}>
          <span style={{ color: '#f59e0b' }}>{syncInfo.error}</span>
        </div>
      ) : null}

      {lastReceipt ? (
        <div className="rounded-2xl border p-3 text-sm flex flex-wrap items-center justify-between gap-2" style={cardStyle}>
          <div className="min-w-0">
            <div className="font-semibold truncate">Chek tayyor: №{lastReceipt.saleId}</div>
            <div className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
              {new Date(lastReceipt.createdAt).toLocaleString('uz-UZ')}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setReceiptPreviewOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-extrabold text-white transition active:scale-95"
              style={{ background: accentColor.gradient }}
            >
              Chekni ko'rish
            </button>
            {'serial' in navigator ? (
              posPrinterReady ? (
                <>
                  <button
                    type="button"
                    onClick={() => void printReceiptEscpos(lastReceipt)}
                    className="px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    POS printer
                  </button>
                  <button
                    type="button"
                    onClick={() => void disconnectPosPrinter()}
                    className="px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    Ulangan
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void connectPosPrinter()}
                  className="px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  Printerga ulash
                </button>
              )
            ) : null}
            <button
              type="button"
              onClick={() => {
                const ok = printPosReceipt(lastReceipt, shopName, 58);
                if (!ok) setReceiptPreviewOpen(true);
              }}
              className="px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              }}
            >
              Qayta chop etish
            </button>
            <button
              type="button"
              onClick={() => setLastReceipt(null)}
              className="px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              }}
            >
              Yopish
            </button>
          </div>
        </div>
      ) : null}

      {/* POS Modal (filial panel MarketView -> Ombor -> Sotuv UX) */}
      {isPOSOpen ? (
        <div
          className="fixed inset-0 app-safe-pad z-50 flex items-start justify-center overflow-hidden p-3 pb-[max(1rem,var(--app-safe-bottom,0px))] pt-[max(0.5rem,var(--app-safe-top,0px))] sm:items-center sm:p-4 lg:p-6 xl:p-8"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setIsPOSOpen(false)}
        >
          <div
            className="w-full max-w-[calc(100vw-1.5rem)] sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[min(92rem,calc(100vw-18rem))] shrink-0 rounded-3xl border p-4 sm:p-6 lg:p-8 max-h-[min(calc(100dvh-var(--app-safe-top,0px)-var(--app-safe-bottom,0px)-1rem),92vh)] overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6 sticky top-0 z-10 pb-2 -mx-1 px-1 sm:static sm:pb-0 sm:mx-0 sm:px-0" style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}>
              <h3 className="text-xl font-bold">POS Sistemi</h3>
              <button
                type="button"
                onClick={() => setIsPOSOpen(false)}
                className="p-2 rounded-xl transition-all active:scale-90"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-4 min-w-0 w-full">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mahsulot nomini yoki shtrix kodini kiriting..."
                className="w-full min-w-0 px-4 py-3 rounded-2xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#111827',
                  boxShadow: isDark
                    ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                    : '0 2px 6px rgba(0, 0, 0, 0.06)',
                }}
              />
              <Search
                className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              />
            </div>

            <div className="min-w-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,32rem)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,28rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(400px,26rem)] gap-4 lg:gap-6 items-start">
              {query.trim() && filtered.length > 0 ? (
                <div className="min-w-0 order-2 lg:order-1 space-y-2 mb-0 lg:mb-0">
                  <h4 className="font-semibold mb-2">Mahsulotlar</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 max-h-52 sm:max-h-60 lg:max-h-[min(calc(92vh-14rem),520px)] overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
                    {filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if ((p.variantsCount || 0) > 1) {
                            setVariantPicker({
                              productId: p.id,
                              productName: p.name,
                              image: p.image,
                              variants: p.variants,
                            });
                            return;
                          }
                          addToCart(p, p.variants?.[0]);
                        }}
                        className="p-3 rounded-xl border text-left transition-all active:scale-95 min-w-0 w-full"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {p.image ? <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" /> : null}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-sm truncate">{p.name}</h5>
                            <p className="text-xs truncate" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                              {p.variantsCount > 1 ? `${p.variantsCount} variant` : 'Standart'}
                            </p>
                            <p className="text-sm font-bold" style={{ color: accentColor.color }}>
                              {p.priceUzs.toLocaleString('uz-UZ')} so'm
                            </p>
                          </div>
                          <Plus className="w-5 h-5 shrink-0" style={{ color: accentColor.color }} />
                        </div>
                      </button>
                    ))}
                    {searchQuery.hasNextPage ? (
                      <div ref={searchSentinel} className="h-1 w-full sm:col-span-2 xl:col-span-3 2xl:col-span-4" aria-hidden />
                    ) : null}
                    {searchQuery.isFetchingNextPage ? (
                      <div className="text-xs opacity-70 sm:col-span-2 xl:col-span-3 2xl:col-span-4 py-2 text-center">
                        <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                        Yuklanmoqda...
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="hidden lg:block min-w-0 order-2 lg:order-1 rounded-2xl border p-6 text-center text-sm" style={{ ...cardStyle, opacity: 0.85 }}>
                  Qidiruv orqali mahsulot qo‘shing
                </div>
              )}

              <div className="min-w-0 order-1 lg:order-2 lg:sticky lg:top-0 space-y-3">
              <div className="rounded-3xl border p-4 min-w-0 w-full" style={cardStyle}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-bold">Savat</h3>
                    {cart.length ? (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-xs font-semibold px-3 py-2 rounded-xl border transition active:scale-95"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                        }}
                      >
                        Tozalash
                      </button>
                    ) : null}
                  </div>

                  {cart.length === 0 ? (
                    <p className="text-sm" style={{ opacity: 0.65 }}>
                      Mahsulot tanlang.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((l) => (
                        <div key={l.key} className="flex items-center gap-2">
                          <div
                            className="w-10 h-10 rounded-xl border overflow-hidden shrink-0"
                            style={{
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                            }}
                          >
                            {String(l.image || '').trim() ? (
                              <img
                                src={String(l.image)}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{l.productName}</div>
                            <div className="text-[11px]" style={{ opacity: 0.65 }}>
                              {safeMoney(l.priceUzs).toLocaleString('uz-UZ')} so‘m
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQty(l.key, l.qty - 1)}
                              disabled={l.qty <= 1}
                              className="p-2 rounded-lg border disabled:opacity-50 transition active:scale-95"
                              style={{
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                              }}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={l.qty}
                              onChange={(e) => updateQty(l.key, Number(e.target.value))}
                              className="w-12 text-center rounded-lg border py-2 text-sm font-bold tabular-nums"
                              style={{
                                background: isDark ? '#111' : '#fff',
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                                color: isDark ? '#fff' : '#111',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => updateQty(l.key, l.qty + 1)}
                              className="p-2 rounded-lg border transition active:scale-95"
                              style={{
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLine(l.key)}
                              className="p-2 rounded-lg border transition active:scale-95"
                              style={{
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                                color: '#ef4444',
                              }}
                              aria-label="O‘chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ opacity: 0.7 }}>Jami</span>
                      <span className="font-bold tabular-nums">{subtotalUzs.toLocaleString('uz-UZ')} so‘m</span>
                    </div>
                    <div className="flex items-center justify-between text-sm gap-2 min-w-0">
                      <span className="shrink-0" style={{ opacity: 0.7 }}>Chegirma</span>
                      <input
                        type="number"
                        min={0}
                        value={discountUzs}
                        onChange={(e) => setDiscountUzs(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        className="w-full max-w-[9rem] min-w-0 text-right rounded-xl border px-3 py-2 text-sm font-bold tabular-nums"
                        style={{
                          background: isDark ? '#111' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          color: isDark ? '#fff' : '#111',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-base">
                      <span className="font-bold">Jami to‘lov</span>
                      <span className="font-extrabold tabular-nums" style={{ color: accentColor.color }}>
                        {totalUzs.toLocaleString('uz-UZ')} so‘m
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm gap-2 min-w-0">
                      <span className="shrink-0" style={{ opacity: 0.7 }}>Hozir to‘langan</span>
                      <input
                        type="number"
                        min={0}
                        max={totalUzs}
                        value={paid}
                        onChange={(e) => setPaidUzs(Math.min(totalUzs, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
                        className="w-full max-w-[9rem] min-w-0 text-right rounded-xl border px-3 py-2 text-sm font-bold tabular-nums"
                        style={{
                          background: isDark ? '#111' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          color: isDark ? '#fff' : '#111',
                        }}
                      />
                    </div>
                    {hasDebt ? (
                      <div
                        className="rounded-2xl border p-3 space-y-2 text-sm"
                        style={{
                          borderColor: `${accentColor.color}44`,
                          background: isDark ? `${accentColor.color}12` : `${accentColor.color}08`,
                        }}
                      >
                        <div className="font-bold" style={{ color: accentColor.color }}>
                          Qarz: {debtRemainingUzs.toLocaleString('uz-UZ')} so‘m
                        </div>
                        <label className="block">
                          <span className="opacity-70 flex items-center gap-1 mb-1 text-xs"><User className="w-3.5 h-3.5" /> Ism</span>
                          <input
                            value={debtCustomerName}
                            onChange={(e) => setDebtCustomerName(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm"
                            style={{
                              background: isDark ? '#111' : '#fff',
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="opacity-70 flex items-center gap-1 mb-1 text-xs"><Phone className="w-3.5 h-3.5" /> Telefon</span>
                          <UzPhoneInput
                            value={debtCustomerPhone}
                            onChange={setDebtCustomerPhone}
                            isDark={isDark}
                          />
                        </label>
                        <label className="block">
                          <span className="opacity-70 flex items-center gap-1 mb-1 text-xs"><Calendar className="w-3.5 h-3.5" /> Qaytarish sanasi (ixtiyoriy)</span>
                          <input
                            type="date"
                            value={debtDueDate}
                            onChange={(e) => setDebtDueDate(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 text-sm"
                            style={{
                              background: isDark ? '#111' : '#fff',
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {([
                        { id: 'cash', label: 'Naqd' },
                        { id: 'card', label: 'Karta' },
                      ] as const).map((m) => {
                        const on = payMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPayMethod(m.id)}
                            className="py-2.5 rounded-2xl border text-sm font-bold transition active:scale-95"
                            style={{
                              background: on ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                              borderColor: on ? 'transparent' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                              color: on ? '#fff' : undefined,
                            }}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={submitting || cart.length === 0}
                      onClick={() => void submitSale()}
                      className="mt-3 w-full py-3 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-55 transition active:scale-95"
                      style={{
                        background: accentColor.gradient,
                        boxShadow: `0 10px 28px ${accentColor.color}55`,
                      }}
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      Sotuvni yakunlash
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {variantPicker ? (
        <div className="fixed inset-0 app-safe-pad z-[140] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setVariantPicker(null)}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            aria-label="Yopish"
          />
          <div
            className="relative w-full max-w-lg rounded-3xl border p-4 sm:p-5 shadow-2xl"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-sm" style={{ opacity: 0.7 }}>
                  Variant tanlang
                </div>
                <div className="text-lg font-bold truncate">{variantPicker.productName}</div>
              </div>
              <button
                type="button"
                onClick={() => setVariantPicker(null)}
                className="px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              >
                Yopish
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
              {variantPicker.variants.map((v, idx) => (
                <button
                  key={`${variantPicker.productId}::${v.variantId || idx}`}
                  type="button"
                  onClick={() => {
                    const p = normalizedProducts.find((pp) => pp.id === variantPicker.productId);
                    if (!p) return;
                    addToCart(p, v);
                    setVariantPicker(null);
                  }}
                  className="w-full text-left rounded-2xl border p-3 transition active:scale-[0.99]"
                  style={cardStyle}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{v.variantLabel || 'Variant'}</div>
                      <div className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
                        {safeMoney(v.priceUzs).toLocaleString('uz-UZ')} so‘m
                        {v.stock > 0 ? (
                          <span className="ml-2" style={{ opacity: 0.8 }}>
                            · ombor: {v.stock} ta
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: accentColor.gradient, color: '#fff' }}
                    >
                      <Plus className="w-5 h-5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {receiptPreviewOpen && lastReceipt ? (
        <SellerReceiptModal
          receipt={lastReceipt}
          shopName={shopName}
          isDark={isDark}
          accentColor={accentColor}
          posPrinterReady={posPrinterReady}
          onPrintEscpos={() => printReceiptEscpos(lastReceipt)}
          onClose={() => setReceiptPreviewOpen(false)}
          autoOpened
        />
      ) : null}
    </div>
  );
}

