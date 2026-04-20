import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, Loader2, CheckCircle2, CloudOff, RefreshCw, X, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { offlineSalesAdd, type OfflineSale, type OfflineSaleItem } from '../../utils/offlineSalesDb';
import { startOfflineSalesSyncWorker, syncPendingOfflineSales } from '../../utils/offlineSalesSync';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInfiniteQuery } from '@tanstack/react-query';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useIntersectionSentinel } from '../../hooks/useIntersectionSentinel';

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
  const [lastReceipt, setLastReceipt] = useState<{
    saleId: string;
    createdAt: string;
    items: Array<{ name: string; qty: number; priceUzs: number; totalUzs: number }>;
    subtotalUzs: number;
    discountUzs: number;
    totalUzs: number;
    payMethod: 'cash' | 'card';
  } | null>(null);

  const [posPrinterPort, setPosPrinterPort] = useState<SerialPort | null>(null);
  const [posPrinterReady, setPosPrinterReady] = useState(false);

  // Auto-print support: open window on click to avoid popup blocker, then fill after save.
  const pendingPrintWindowRef = useRef<Window | null>(null);

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

  const makeEscposReceiptBytes = (receipt: NonNullable<typeof lastReceipt>) => {
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
    async (receipt: NonNullable<typeof lastReceipt>) => {
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

  const openPrintWindow58 = () => {
    const w = window.open('', '', `width=240,height=900`);
    if (!w) return null;
    try {
      w.document.open();
      w.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>Chek</title></head><body style="margin:0;padding:8px;font-family:monospace;">Yuklanmoqda...</body></html>`,
      );
      w.document.close();
    } catch {
      // ignore
    }
    return w;
  };

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
    setSubmitting(true);
    // Auto print (XP-58C 58mm): open print window NOW (sync) to avoid popup blocker
    if (!pendingPrintWindowRef.current) {
      pendingPrintWindowRef.current = openPrintWindow58();
    }
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
        payment: { method: payMethod },
        source: 'offline',
        status: 'pending_sync',
      };
      await offlineSalesAdd(sale);
      toast.success('Offline sotuv saqlandi. Internet bo‘lsa avtomatik yuboriladi.');
      const receiptObj = {
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
      } as const;
      setLastReceipt(receiptObj);

      // Preferred: ESC/POS direct receipt (no A4/print dialog)
      if (posPrinterReady && posPrinterPort) {
        void printReceiptEscpos(receiptObj);
        if (pendingPrintWindowRef.current) {
          try {
            pendingPrintWindowRef.current.close();
          } catch {
            // ignore
          }
          pendingPrintWindowRef.current = null;
        }
      } else {
        // Fallback: browser print window
        if (pendingPrintWindowRef.current) {
          printReceiptInWindow(pendingPrintWindowRef.current, receiptObj, 58);
          pendingPrintWindowRef.current = null;
        } else {
          toast.message('Printer ulanmagan. “Printerga ulash” yoki “Chek chiqarish” tugmasini bosing.');
        }
      }
      clearCart();
      onAfterSale?.(); // optimistic UI refresh (inventory/products panels)

      // try quick sync if online
      if (navigator.onLine) {
        setSyncBusy(true);
        const r = await syncPendingOfflineSales({ token, shopId, limit: 10 });
        setSyncInfo((p) => ({ ...p, last: r, error: undefined }));
        onAfterSale?.(); // server stock decreased -> refresh again
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sotuvni saqlab bo‘lmadi');
      if (pendingPrintWindowRef.current) {
        try {
          pendingPrintWindowRef.current.close();
        } catch {
          // ignore
        }
        pendingPrintWindowRef.current = null;
      }
    } finally {
      setSyncBusy(false);
      setSubmitting(false);
    }
  };

  const buildReceiptHtml = (receipt: NonNullable<typeof lastReceipt>, paperWidthMm: 58 | 80 = 58) => {
    const created = new Date(receipt.createdAt);
    const payLabel = receipt.payMethod === 'cash' ? 'Naqd' : 'Karta';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Chek #${receipt.saleId}</title>
  <style>
    :root {
      --paper-width: ${paperWidthMm}mm;
      --font-size: ${paperWidthMm === 58 ? '10px' : '11px'};
      --pad-x: ${paperWidthMm === 58 ? '1.5mm' : '2.5mm'};
      --pad-y: 0mm;
    }
    @page { size: var(--paper-width) auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: var(--paper-width) !important;
      height: auto !important;
      background: #fff;
      color: #000;
      font-family: "Courier New", monospace;
      font-size: var(--font-size);
      line-height: 1.32;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt { width: 100%; margin: 0; padding: var(--pad-y) var(--pad-x); }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .header h1 { margin: 0 0 3px; font-size: ${paperWidthMm === 58 ? '13px' : '15px'}; font-weight: 700; }
    .header p { margin: 1px 0; font-size: ${paperWidthMm === 58 ? '9px' : '10px'}; }
    .section { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .item { margin: 5px 0; }
    .item-name { font-weight: 700; margin-bottom: 1px; word-break: break-word; }
    .muted { opacity: 0.85; }
    .total { border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; font-weight: 700; font-size: ${paperWidthMm === 58 ? '12px' : '14px'}; }
    .footer { text-align: center; margin-top: 6px; font-size: ${paperWidthMm === 58 ? '9px' : '10px'}; }
    @media print { @page { size: var(--paper-width) auto; margin: 0 !important; } }
  </style>
</head>
<body>
  <div class="receipt" id="receipt">
    <div class="header">
      <h1>${String(shopName || 'Do‘kon')}</h1>
      <p class="muted">Offline sotuv (POS)</p>
      <p class="muted">Printer: XP-58C (58mm)</p>
    </div>
    <div class="section">
      <div class="row"><span>Chek №:</span><strong>${receipt.saleId}</strong></div>
      <div class="row"><span>Sana:</span><span>${created.toLocaleDateString('uz-UZ')}</span></div>
      <div class="row"><span>Vaqt:</span><span>${created.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="row"><span>To‘lov:</span><span>${payLabel}</span></div>
    </div>
    <div class="section">
      ${receipt.items
        .map(
          (it) => `
        <div class="item">
          <div class="item-name">${it.name}</div>
          <div class="row muted">
            <span>${it.qty} × ${it.priceUzs.toLocaleString('uz-UZ')}</span>
            <span>${it.totalUzs.toLocaleString('uz-UZ')} so'm</span>
          </div>
        </div>
      `,
        )
        .join('')}
    </div>
    <div class="section">
      <div class="row"><span>Subtotal:</span><span>${receipt.subtotalUzs.toLocaleString('uz-UZ')} so'm</span></div>
      <div class="row"><span>Chegirma:</span><span>${receipt.discountUzs.toLocaleString('uz-UZ')} so'm</span></div>
      <div class="row total"><span>JAMI:</span><span>${receipt.totalUzs.toLocaleString('uz-UZ')} so'm</span></div>
    </div>
    <div class="footer">Rahmat!</div>
  </div>
  <script>
    (function () {
      function pxToMm(px) { return (px * 25.4) / 96; }
      function computeAndInjectPageSize() {
        const receiptEl = document.getElementById('receipt');
        if (!receiptEl) return;
        // Ensure we measure *content* height, not viewport
        document.documentElement.style.height = 'auto';
        document.body.style.height = 'auto';
        const contentHeightMm = Math.max(18, pxToMm(receiptEl.scrollHeight) + 2);
        const dynamicPageStyle = document.createElement('style');
        dynamicPageStyle.textContent =
          '@media print { @page { size: ${paperWidthMm}mm ' +
          contentHeightMm.toFixed(2) +
          'mm !important; margin: 0 !important; } }';
        document.head.appendChild(dynamicPageStyle);
      }

      async function waitImages() {
        const imgs = Array.from(document.images || []);
        if (!imgs.length) return;
        await Promise.all(
          imgs.map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())),
        );
      }

      (async function run() {
        try { await waitImages(); } catch {}
        // Give layout a tick before measuring
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            computeAndInjectPageSize();
            window.focus();
            setTimeout(() => { window.print(); window.close(); }, 240);
          });
        });
      })();
    })();
  </script>
</body>
</html>`;
  };

  const printReceiptInWindow = (printWindow: Window, receipt: NonNullable<typeof lastReceipt>, paperWidthMm: 58 | 80 = 58) => {
    const receiptHTML = buildReceiptHtml(receipt, paperWidthMm);
    try {
      printWindow.document.open();
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
    } catch {
      // ignore
    }
  };

  const printReceipt = (receipt: NonNullable<typeof lastReceipt>, paperWidthMm: 58 | 80 = 58) => {
    const popupWidth = paperWidthMm === 58 ? 240 : 320;
    const printWindow = window.open('', '', `width=${popupWidth},height=900`);
    if (!printWindow) {
      toast.error('Chek chiqarishda xatolik! Popup blocker tekshiring.');
      return;
    }
    printReceiptInWindow(printWindow, receipt, paperWidthMm);
  };

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  return (
    <div className="space-y-4">
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
          <div className="flex items-center gap-2">
            {'serial' in navigator ? (
              posPrinterReady ? (
                <>
                  <button
                    type="button"
                    onClick={() => void printReceiptEscpos(lastReceipt)}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold text-white transition active:scale-95"
                    style={{ background: accentColor.gradient }}
                  >
                    Chek yuborish (POS)
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
                    Printer ulangan
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
                  Printerga ulash (USB)
                </button>
              )
            ) : null}

            <button
              type="button"
              onClick={() => printReceipt(lastReceipt, 58)}
              className="px-3 py-2 rounded-xl border text-xs font-bold transition active:scale-95"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              }}
            >
              Chek chiqarish (XP-58C 58mm)
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
          className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setIsPOSOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl border p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
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

            <div className="relative mb-4">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mahsulot nomini yoki shtrix kodini kiriting..."
                className="w-full px-4 py-3 rounded-2xl border outline-none transition-all"
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

            <div className="space-y-3 mb-4">
              <div className="rounded-3xl border p-4" style={cardStyle}>
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
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span style={{ opacity: 0.7 }}>Chegirma</span>
                      <input
                        type="number"
                        min={0}
                        value={discountUzs}
                        onChange={(e) => setDiscountUzs(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        className="w-28 text-right rounded-xl border px-3 py-2 text-sm font-bold tabular-nums"
                        style={{
                          background: isDark ? '#111' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          color: isDark ? '#fff' : '#111',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-base">
                      <span className="font-bold">To‘lov</span>
                      <span className="font-extrabold tabular-nums" style={{ color: accentColor.color }}>
                        {totalUzs.toLocaleString('uz-UZ')} so‘m
                      </span>
                    </div>

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

            {query.trim() && filtered.length > 0 ? (
              <div className="mb-4 space-y-2">
                <h4 className="font-semibold mb-2">Mahsulotlar</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
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
                      className="p-3 rounded-xl border text-left transition-all active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {p.image ? <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover" /> : null}
                        <div className="flex-1 min-w-0">
                          <h5 className="font-semibold text-sm truncate">{p.name}</h5>
                          <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                            {p.variantsCount > 1 ? `${p.variantsCount} variant` : 'Standart'}
                          </p>
                          <p className="text-sm font-bold" style={{ color: accentColor.color }}>
                            {p.priceUzs.toLocaleString('uz-UZ')} so'm
                          </p>
                        </div>
                        <Plus className="w-5 h-5" style={{ color: accentColor.color }} />
                      </div>
                    </button>
                  ))}
                  {searchQuery.hasNextPage ? (
                    <div ref={searchSentinel} className="h-1 w-full md:col-span-2" aria-hidden />
                  ) : null}
                  {searchQuery.isFetchingNextPage ? (
                    <div className="text-xs opacity-70 md:col-span-2 py-2 text-center">
                      <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                      Yuklanmoqda...
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
    </div>
  );
}

