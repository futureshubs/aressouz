import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ClipboardList,
  Download,
  Loader2,
  MapPin,
  Phone,
  QrCode,
  RefreshCw,
  Store,
  CheckCircle2,
  XCircle,
  Package,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerShopOrder, DillerShopOrderStatus } from '../../utils/dillerData';
import {
  ensureOrderToken,
  findStoreByPhone,
  formatMoney,
  getQrcodeOrderUrl,
  mergeShopOrders,
  updateDillerProfile,
  updateShopOrderStatus,
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

export function DillerBuyurtmaSection({ data, onDataChange, isDark }: Props) {
  const { accentColor } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const dataWithToken = useMemo(() => ensureOrderToken(data), [data]);
  const orderToken = dataWithToken.profile.orderToken ?? '';

  useEffect(() => {
    if (dataWithToken.profile.orderToken && dataWithToken.profile.orderToken !== data.profile.orderToken) {
      onDataChange(dataWithToken);
      void pushDillerLocalNow();
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
    onDataChange(mergeShopOrders(dataWithToken, res.orders));
  }, [dataWithToken, onDataChange]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const pendingCount = (data.shopOrders ?? []).filter((o) => o.status === 'pending').length;

  const setStatus = async (order: DillerShopOrder, status: DillerShopOrderStatus) => {
    const sess = readDillerSession();
    if (sess?.token && !isOfflineDillerToken(sess.token)) {
      const res = await dillerApiPatchShopOrderStatus(sess.token, order.id, status);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    }
    onDataChange(updateShopOrderStatus(data, order.id, status));
    toast.success(statusLabel[status]);
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
        companyName: data.profile.companyName || 'Buyurtma',
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
              const store = findStoreByPhone(data, order.customerPhone);
              return (
                <li
                  key={order.id}
                  className="p-3 rounded-xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{order.customerName}</div>
                      <div className="text-xs opacity-60 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {order.customerPhone}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full"
                      style={{
                        background: `${statusColor[order.status]}22`,
                        color: statusColor[order.status],
                      }}
                    >
                      {statusLabel[order.status]}
                    </span>
                  </div>

                  {store ? (
                    <div
                      className="rounded-xl px-3 py-2 mb-2 text-xs"
                      style={{
                        background: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
                        border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(16,185,129,0.15)',
                      }}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-emerald-500 mb-1">
                        <Store className="w-3.5 h-3.5" />
                        {store.name}
                      </div>
                      {store.address ? (
                        <div className="opacity-60 flex items-start gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                          {store.address}
                        </div>
                      ) : null}
                      {store.contactName ? (
                        <div className="opacity-55 mt-0.5">{store.contactName}</div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[10px] opacity-45 mb-2">Do‘konlar ro‘yxatida topilmadi</p>
                  )}

                  <ul className="text-xs space-y-1 mb-2 opacity-80">
                    {order.items.map((it) => (
                      <li key={`${order.id}-${it.productId}`} className="flex justify-between gap-2">
                        <span className="truncate">
                          {it.productName} × {it.qty}
                        </span>
                        <span className="shrink-0 font-semibold">{formatMoney(it.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex justify-between items-center text-sm font-black text-emerald-500 mb-2">
                    <span>Jami</span>
                    <span>{formatMoney(order.total)}</span>
                  </div>

                  {order.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void setStatus(order, 'accepted')}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Qabul
                      </button>
                      <button
                        type="button"
                        onClick={() => void setStatus(order, 'rejected')}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rad
                      </button>
                    </div>
                  ) : order.status === 'accepted' ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(order, 'done')}
                      className="w-full py-2 rounded-xl text-xs font-bold text-slate-900"
                      style={{ background: accentColor.gradient }}
                    >
                      Bajarildi deb belgilash
                    </button>
                  ) : null}

                  <div className="text-[10px] opacity-40 mt-2">
                    {new Date(order.createdAt).toLocaleString('uz-UZ')}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
