import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ClipboardList,
  Download,
  Loader2,
  Phone,
  QrCode,
  RefreshCw,
  Package,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerShopOrder, DillerShopOrderStatus } from '../../utils/dillerData';
import {
  ensureOrderToken,
  findStoresByPhone,
  formatMoney,
  getQrcodeOrderUrl,
  mergeShopOrders,
  getDillerBrandLabel,
  updateDillerProfile,
  acceptShopOrder,
  rejectShopOrder,
  loadDillerData,
} from '../../utils/dillerData';
import {
  dillerApiFetchShopOrders,
  dillerApiPatchShopOrderStatus,
  isOfflineDillerToken,
} from '../../utils/dillerApi';
import { readDillerSession } from '../../utils/dillerSession';
import { downloadDillerQrPoster } from '../../utils/dillerQrPoster';
import { pushDillerLocalNow } from '../../utils/dillerSync';
import { dillerListClass } from './dillerMobileLayout';
import { DillerShopOrderDetailSheet } from './DillerShopOrderDetailSheet';
import { DillerShopOrderSaleSheet } from './DillerShopOrderSaleSheet';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
  isDark: boolean;
};

function Card({
  children,
  isDark,
  className = '',
}: {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${className}`.trim()}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </div>
  );
}

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

const statusLabel: Record<DillerShopOrderStatus, string> = {
  pending: 'Kutilmoqda',
  accepted: 'Qabul qilindi',
  rejected: 'Rad etildi',
  done: 'Bajarildi',
};

const statusColor: Record<DillerShopOrderStatus, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  rejected: '#ef4444',
  done: '#10b981',
};

function resolveOrderStore(data: DillerData, order: DillerShopOrder) {
  if (order.storeId) {
    return data.stores.find((s) => s.id === order.storeId) ?? null;
  }
  const matches = findStoresByPhone(data, order.customerPhone);
  if (order.storeName) {
    return matches.find((s) => s.name === order.storeName) ?? matches[0] ?? null;
  }
  return matches[0] ?? null;
}

export function DillerBuyurtmaSection({ data, onDataChange, isDark }: Props) {
  const { accentColor } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [saleOrderId, setSaleOrderId] = useState<string | null>(null);
  const tokenInitRef = useRef(false);

  const dataWithToken = useMemo(() => ensureOrderToken(data), [data]);
  const orderToken = dataWithToken.profile.orderToken ?? '';

  useEffect(() => {
    if (tokenInitRef.current) return;
    if (dataWithToken.profile.orderToken && dataWithToken.profile.orderToken !== data.profile.orderToken) {
      tokenInitRef.current = true;
      onDataChange(dataWithToken);
    }
  }, [data.profile.orderToken, dataWithToken, onDataChange]);

  const orderUrl = orderToken ? getQrcodeOrderUrl(orderToken) : '';

  const [phone, setPhone] = useState(data.profile.orderPhone ?? data.profile.phone ?? '');
  const [telegram, setTelegram] = useState(data.profile.telegram ?? '');
  const [instagram, setInstagram] = useState(data.profile.instagram ?? '');

  useEffect(() => {
    setPhone(data.profile.orderPhone ?? data.profile.phone ?? '');
    setTelegram(data.profile.telegram ?? '');
    setInstagram(data.profile.instagram ?? '');
  }, [data.profile.orderPhone, data.profile.phone, data.profile.telegram, data.profile.instagram]);

  const saveContacts = () => {
    const next = updateDillerProfile(dataWithToken, {
      orderPhone: phone.trim(),
      telegram: telegram.trim(),
      instagram: instagram.trim(),
    });
    onDataChange(next);
    toast.success('Aloqa ma’lumotlari saqlandi');
  };

  const refreshOrders = useCallback(async () => {
    const sess = readDillerSession();
    if (!sess?.token || isOfflineDillerToken(sess.token)) return;
    setRefreshing(true);
    const res = await dillerApiFetchShopOrders(sess.token);
    setRefreshing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onDataChange(mergeShopOrders(loadDillerData(), res.orders));
  }, [onDataChange]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshOrders();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refreshOrders]);

  const pendingCount = (data.shopOrders ?? []).filter((o) => o.status === 'pending').length;

  const detailOrder = useMemo(
    () => (data.shopOrders ?? []).find((o) => o.id === detailOrderId) ?? null,
    [data.shopOrders, detailOrderId],
  );

  const saleOrder = useMemo(
    () => (data.shopOrders ?? []).find((o) => o.id === saleOrderId) ?? null,
    [data.shopOrders, saleOrderId],
  );

  const patchServerStatus = async (orderId: string, status: DillerShopOrderStatus) => {
    const sess = readDillerSession();
    if (!sess?.token || isOfflineDillerToken(sess.token)) return false;
    const res = await dillerApiPatchShopOrderStatus(sess.token, orderId, status);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    return true;
  };

  const setStatus = async (order: DillerShopOrder, status: DillerShopOrderStatus) => {
    if (status === 'done') return;

    let nextData = data;
    if (status === 'accepted') {
      const result = acceptShopOrder(data, order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      nextData = result.data;
    } else if (status === 'rejected') {
      const result = rejectShopOrder(data, order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      nextData = result.data;
    } else {
      return;
    }

    onDataChange(nextData);

    const ok = await patchServerStatus(order.id, status);
    if (!ok) {
      toast.warning('Mahalliy saqlandi — server holati keyinroq yangilanadi');
    }
    if (status === 'accepted') {
      toast.success('Qabul qilindi — ombordan ayirildi');
    } else {
      toast.success(statusLabel[status]);
    }
  };

  const openSaleConfirm = (order: DillerShopOrder) => {
    setSaleOrderId(order.id);
  };

  const onSaleComplete = async (nextData: DillerData) => {
    const orderId = saleOrderId;
    onDataChange(nextData);
    setSaleOrderId(null);
    setDetailOrderId(null);

    const push = await pushDillerLocalNow();
    if (push.status !== 'synced') {
      toast.warning('Sotuv saqlandi — statistika mahalliy, bulut keyinroq yangilanadi');
    }

    if (!orderId) return;
    const ok = await patchServerStatus(orderId, 'done');
    if (!ok) {
      toast.warning('Server buyurtma holati keyinroq yangilanadi');
    }
  };

  const downloadPoster = async () => {
    if (!orderToken) return;
    setDownloading(true);
    try {
      const sync = await pushDillerLocalNow();
      if (sync.status !== 'synced') {
        toast.error('QR yuborish uchun avval internet va bulutga ulanish kerak');
        return;
      }
      await downloadDillerQrPoster({
        orderUrl,
        companyName: getDillerBrandLabel(data.profile.companyName),
        phone: phone.trim() || data.profile.phone,
        telegram: telegram.trim(),
        instagram: instagram.trim(),
        filename: `buyurtma-qr-${orderToken.slice(0, 8)}.png`,
      });
      toast.success('QR yuklab olindi (10×7 sm)');
    } catch {
      toast.error('QR yuklab olinmadi');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <DillerShopOrderSaleSheet
        open={!!saleOrder}
        order={saleOrder}
        data={data}
        onClose={() => setSaleOrderId(null)}
        onComplete={(next) => void onSaleComplete(next)}
      />

      <DillerShopOrderDetailSheet
        open={!!detailOrder}
        order={detailOrder}
        data={data}
        onClose={() => setDetailOrderId(null)}
        onSetStatus={(order, status) => void setStatus(order, status)}
        onCompleteOrder={openSaleConfirm}
      />

      <Card isDark={isDark}>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="font-bold text-base">Buyurtma paneli</h3>
            <p className="text-[10px] opacity-55">Do‘konlar QR skaner qilib buyurtma beradi</p>
          </div>
        </div>

        <div
          className="rounded-xl p-3 mb-3 text-[11px] break-all opacity-70"
          style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
        >
          {orderUrl || '—'}
        </div>

        <div className="space-y-2 mb-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon (QR va panelda)"
            className={inputCls(isDark)}
          />
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="Telegram (@username)"
            className={inputCls(isDark)}
          />
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="Instagram (@username)"
            className={inputCls(isDark)}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveContacts}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold border"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
          >
            Saqlash
          </button>
          <button
            type="button"
            onClick={() => void downloadPoster()}
            disabled={downloading || !orderToken}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-900 flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: accentColor.gradient }}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Download className="w-4 h-4" />
                QR yuklash (10×7)
              </>
            )}
          </button>
        </div>

        <p className="text-[10px] opacity-45 mt-2 flex items-center gap-1">
          <QrCode className="w-3.5 h-3.5" />
          Karobkaga yopishtiring — skaner /qrcode sahifasiga olib boradi
        </p>
      </Card>

      <Card isDark={isDark}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            Buyurtmalar
            {pendingCount > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                {pendingCount} yangi
              </span>
            ) : null}
          </h3>
          <button
            type="button"
            onClick={() => void refreshOrders()}
            disabled={refreshing}
            className="p-2 rounded-lg opacity-60 hover:opacity-100"
            aria-label="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {(data.shopOrders ?? []).length === 0 ? (
          <p className="text-sm opacity-50 text-center py-8">Hali buyurtma yo‘q</p>
        ) : (
          <ul className={dillerListClass}>
            {(data.shopOrders ?? []).map((order) => {
              const store = resolveOrderStore(data, order);
              const storeMatches = findStoresByPhone(data, order.customerPhone);
              const totalItems = order.items.reduce((s, it) => s + it.qty, 0);
              const previewName = store?.name ?? order.storeName ?? order.customerName;
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setDetailOrderId(order.id)}
                    className="w-full text-left p-3.5 rounded-xl border active:scale-[0.99] transition-transform"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{previewName}</div>
                        <div className="text-xs opacity-60 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{order.customerPhone}</span>
                        </div>
                        {storeMatches.length > 1 ? (
                          <div className="text-[10px] text-sky-500/90 mt-0.5">
                            {storeMatches.length} ta do‘kon mos keldi
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className="text-[10px] font-bold px-2 py-1 rounded-full"
                          style={{
                            background: `${statusColor[order.status]}22`,
                            color: statusColor[order.status],
                          }}
                        >
                          {statusLabel[order.status]}
                        </span>
                        <ChevronRight className="w-4 h-4 opacity-30" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="opacity-55">
                        {totalItems} ta · {order.items.length} tur
                      </span>
                      <span className="font-black text-emerald-500">{formatMoney(order.total)}</span>
                    </div>

                    <div className="text-[10px] opacity-40 mt-2">
                      {new Date(order.createdAt).toLocaleString('uz-UZ')} · Batafsil
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
