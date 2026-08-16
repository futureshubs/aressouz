import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Phone,
  QrCode,
  RefreshCw,
  Package,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerShopOrder, DillerShopOrderStatus } from '../../utils/dillerData';
import {
  ensureOrderToken,
  findStoresByPhone,
  formatMoney,
  mergeShopOrders,
  acceptShopOrder,
  rejectShopOrder,
  loadDillerData,
  cancelDealerOrder,
  DILLER_PRODUCT_UNITS,
  getWarehouseQty,
} from '../../utils/dillerData';
import {
  dillerApiFetchShopOrders,
  dillerApiPatchShopOrderStatus,
  isOfflineDillerToken,
} from '../../utils/dillerApi';
import { readDillerSession } from '../../utils/dillerSession';
import { pushDillerLocalNow } from '../../utils/dillerSync';
import { formatDillerDateTime } from '../../utils/dillerTime';
import { dillerListClass } from './dillerMobileLayout';
import { iosAccentFillStyle, iosGlassCardStyle } from './dillerIosGlass';
import { DillerShopOrderDetailSheet } from './DillerShopOrderDetailSheet';
import { DillerShopOrderSaleSheet } from './DillerShopOrderSaleSheet';
import { DillerDealerOrderPaySheet } from './DillerDealerOrderPaySheet';
import { DillerDealerOrderDetailSheet } from './DillerDealerOrderDetailSheet';
import { DillerSaleSheet } from './DillerSaleSheet';
import { DillerQrPanelSheet } from './DillerQrPanelSheet';

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
    <div className={`rounded-[22px] p-4 ${className}`.trim()} style={iosGlassCardStyle(isDark)}>
      {children}
    </div>
  );
}

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

type QrOrderFilter = 'all' | 'pending' | 'accepted' | 'done';

const QR_STATUS_RANK: Record<DillerShopOrderStatus, number> = {
  pending: 0,
  accepted: 1,
  done: 2,
  rejected: 3,
};

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

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
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [saleOrderId, setSaleOrderId] = useState<string | null>(null);
  const [dealerPayId, setDealerPayId] = useState<string | null>(null);
  const [dealerDetailId, setDealerDetailId] = useState<string | null>(null);
  const [dealerEditId, setDealerEditId] = useState<string | null>(null);
  const [qrPanelOpen, setQrPanelOpen] = useState(false);
  const [qrFilter, setQrFilter] = useState<QrOrderFilter>('all');
  const tokenInitRef = useRef(false);

  const dataWithToken = useMemo(() => ensureOrderToken(data), [data]);

  useEffect(() => {
    if (tokenInitRef.current) return;
    if (dataWithToken.profile.orderToken && dataWithToken.profile.orderToken !== data.profile.orderToken) {
      tokenInitRef.current = true;
      onDataChange(dataWithToken);
    }
  }, [data.profile.orderToken, dataWithToken, onDataChange]);

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
  const qrOrders = useMemo(() => {
    const list = [...(data.shopOrders ?? [])].sort((a, b) => {
      const r = QR_STATUS_RANK[a.status] - QR_STATUS_RANK[b.status];
      if (r !== 0) return r;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    if (qrFilter === 'all') return list;
    return list.filter((o) => o.status === qrFilter);
  }, [data.shopOrders, qrFilter]);

  const detailOrder = useMemo(
    () => (data.shopOrders ?? []).find((o) => o.id === detailOrderId) ?? null,
    [data.shopOrders, detailOrderId],
  );

  const saleOrder = useMemo(
    () => (data.shopOrders ?? []).find((o) => o.id === saleOrderId) ?? null,
    [data.shopOrders, saleOrderId],
  );

  const dealerPayOrder = useMemo(
    () => (data.dealerOrders ?? []).find((o) => o.id === dealerPayId) ?? null,
    [data.dealerOrders, dealerPayId],
  );
  const dealerDetailOrder = useMemo(
    () => (data.dealerOrders ?? []).find((o) => o.id === dealerDetailId) ?? null,
    [data.dealerOrders, dealerDetailId],
  );
  const dealerEditOrder = useMemo(
    () => (data.dealerOrders ?? []).find((o) => o.id === dealerEditId) ?? null,
    [data.dealerOrders, dealerEditId],
  );

  const openDealerOrders = useMemo(
    () => (data.dealerOrders ?? []).filter((o) => o.status === 'open'),
    [data.dealerOrders],
  );
  const doneDealerOrders = useMemo(
    () => (data.dealerOrders ?? []).filter((o) => o.status === 'done'),
    [data.dealerOrders],
  );
  const cancelledDealerOrders = useMemo(
    () => (data.dealerOrders ?? []).filter((o) => o.status === 'cancelled'),
    [data.dealerOrders],
  );

  const neededFromOpen = useMemo(() => {
    const map = new Map<
      string,
      { productId: string; name: string; qty: number; unit: string; orders: number }
    >();
    for (const order of openDealerOrders) {
      const seen = new Set<string>();
      for (const it of order.items) {
        const key = it.productId || it.productName;
        const row = map.get(key) ?? {
          productId: it.productId,
          name: it.productName,
          qty: 0,
          unit: String(it.unit || 'dona'),
          orders: 0,
        };
        row.qty += it.qty || 0;
        if (!seen.has(key)) {
          row.orders += 1;
          seen.add(key);
        }
        map.set(key, row);
      }
    }
    return [...map.values()]
      .map((row) => ({
        ...row,
        stock: row.productId ? getWarehouseQty(data, row.productId) : 0,
      }))
      .sort((a, b) => b.qty - a.qty);
  }, [openDealerOrders, data]);

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

  return (
    <>
      <DillerDealerOrderPaySheet
        open={!!dealerPayOrder}
        order={dealerPayOrder}
        data={data}
        onClose={() => setDealerPayId(null)}
        onComplete={onDataChange}
      />

      <DillerDealerOrderDetailSheet
        open={!!dealerDetailOrder}
        order={dealerDetailOrder}
        data={data}
        onClose={() => setDealerDetailId(null)}
        onEdit={(order) => {
          setDealerDetailId(null);
          setDealerEditId(order.id);
        }}
        onCancel={(order) => {
          const result = cancelDealerOrder(data, order.id);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          onDataChange(result.data);
          setDealerDetailId(null);
          toast.success('Buyurtma bekor qilindi');
        }}
        onDeliver={(order) => {
          setDealerDetailId(null);
          setDealerPayId(order.id);
        }}
      />

      <DillerSaleSheet
        open={!!dealerEditOrder}
        onClose={() => setDealerEditId(null)}
        data={data}
        onComplete={(next) => {
          onDataChange(next);
          const id = dealerEditId;
          setDealerEditId(null);
          if (id) setDealerDetailId(id);
        }}
        mode="order"
        editOrder={dealerEditOrder}
      />

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

      <DillerQrPanelSheet
        open={qrPanelOpen}
        data={data}
        onClose={() => setQrPanelOpen(false)}
        onDataChange={onDataChange}
      />

      <button
        type="button"
        onClick={() => setQrPanelOpen(true)}
        className="relative w-full overflow-hidden rounded-[26px] px-5 py-4 text-left active:scale-[0.985] transition-transform touch-manipulation"
        style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
      >
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              'radial-gradient(120% 80% at 100% -10%, rgba(255,255,255,0.55), transparent 55%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <span
            className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.28)', color: '#fff' }}
          >
            <QrCode className="w-6 h-6" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 text-white">
            <span className="block text-[17px] font-black leading-tight">QR kod yaratish</span>
            <span className="block text-[12px] font-medium opacity-75 mt-0.5">
              Ko‘rsatish · yuklab olish · do‘konlar shu orqali buyurtma beradi
            </span>
          </span>
        </div>
      </button>

      <Card isDark={isDark}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-400" />
            QR buyurtmalar
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

        {(data.shopOrders ?? []).length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch] pb-2.5">
            {(
              [
                { id: 'all' as const, label: 'Barchasi' },
                { id: 'pending' as const, label: 'Yangi' },
                { id: 'accepted' as const, label: 'Qabul' },
                { id: 'done' as const, label: 'Bajarildi' },
              ]
            ).map((f) => {
              const on = qrFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQrFilter(f.id)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold active:scale-[0.96]"
                  style={
                    on
                      ? iosAccentFillStyle(accentColor.gradient, accentColor.color)
                      : iosGlassCardStyle(isDark)
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {(data.shopOrders ?? []).length === 0 ? (
          <div className="text-center py-8">
            <QrCode className="w-8 h-8 mx-auto mb-2 opacity-35" />
            <p className="text-sm font-semibold">Hali QR buyurtma yo‘q</p>
            <p className="text-[11px] opacity-50 mt-1 leading-relaxed px-4">
              Yuqoridagi «QR kod yaratish» ni bosing, posterni yuklab do‘konga yopishtiring. Skaner
              orqali tushgan buyurtmalar shu yerda ochiladi.
            </p>
          </div>
        ) : qrOrders.length === 0 ? (
          <p className="text-sm opacity-50 text-center py-8">Bu filterda buyurtma yo‘q</p>
        ) : (
          <ul className={dillerListClass}>
            {qrOrders.map((order) => {
              const store = resolveOrderStore(data, order);
              const storeMatches = findStoresByPhone(data, order.customerPhone);
              const totalItems = order.items.reduce((s, it) => s + it.qty, 0);
              const previewName = store?.name ?? order.storeName ?? order.customerName;
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setDetailOrderId(order.id)}
                    className="w-full text-left p-3.5 rounded-[20px] active:scale-[0.985] transition-transform"
                    style={iosGlassCardStyle(isDark)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{previewName}</div>
                        <div className="text-xs opacity-60 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{order.customerPhone}</span>
                        </div>
                        <div className="text-[11px] opacity-50 mt-0.5 truncate">
                          {order.items
                            .slice(0, 2)
                            .map((it) => `${it.productName} ×${it.qty}`)
                            .join(', ')}
                          {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
                        </div>
                        {storeMatches.length > 1 ? (
                          <div className="text-[10px] text-sky-500/90 mt-0.5">
                            {storeMatches.length} ta do‘kon mos keldi
                          </div>
                        ) : null}
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                        style={{
                          background: `${statusColor[order.status]}22`,
                          color: statusColor[order.status],
                        }}
                      >
                        {statusLabel[order.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="opacity-55">
                        {totalItems} ta · {order.items.length} tur
                      </span>
                      <span className="font-black text-emerald-500">{formatMoney(order.total)}</span>
                    </div>
                    <div className="text-[10px] opacity-40 mt-2 flex items-center justify-between">
                      <span>{formatDillerDateTime(order.createdAt)}</span>
                      <span className="inline-flex items-center gap-0.5">
                        Batafsil
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {neededFromOpen.length > 0 ? (
        <Card isDark={isDark}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                Omborga kerak
              </h3>
              <p className="text-[11px] opacity-50 mt-0.5">
                Faqat ochiq (hali topshirilmagan) buyurtmalar
              </p>
            </div>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
              {neededFromOpen.length} tur · {neededFromOpen.reduce((s, r) => s + r.qty, 0)} dona
            </span>
          </div>
          <ul className="space-y-1.5">
            {neededFromOpen.map((row) => {
              const short = row.stock < row.qty;
              const label = unitLabel(row.unit);
              return (
                <li
                  key={row.productId || row.name}
                  className="rounded-[16px] px-3 py-2.5 flex items-center justify-between gap-3"
                  style={iosGlassCardStyle(isDark)}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{row.name}</div>
                    <div className={`text-[10px] mt-0.5 ${short ? 'text-amber-400' : 'opacity-45'}`}>
                      {row.orders} ta buyurtmada
                      {row.productId ? ` · omborda ${row.stock} ${label}` : ''}
                      {short ? ' · yetishmaydi' : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-[15px] font-black tabular-nums ${
                        short ? 'text-amber-400' : ''
                      }`}
                      style={!short ? { color: accentColor.color } : undefined}
                    >
                      {row.qty}
                    </div>
                    <div className="text-[10px] opacity-45">{label}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          {neededFromOpen.some((r) => r.stock < r.qty) ? (
            <p className="text-[10px] text-amber-400/90 mt-2.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Sariq — omborda yetarli emas
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card isDark={isDark}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            Do‘kon buyurtmalari
            {openDealerOrders.length > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                {openDealerOrders.length} ochiq
              </span>
            ) : null}
          </h3>
        </div>
        {(data.dealerOrders ?? []).length === 0 ? (
          <p className="text-sm opacity-50 text-center py-6">
            Do‘kon kartasidan «Buyurtma olish» — mahsulot tanlab yaratiladi
          </p>
        ) : (
          <ul className={dillerListClass}>
            {[...openDealerOrders, ...doneDealerOrders, ...cancelledDealerOrders].map((order) => {
              const store = data.stores.find((s) => s.id === order.storeId);
              const totalItems = order.items.reduce((s, it) => s + it.qty, 0);
              const open = order.status === 'open';
              const cancelled = order.status === 'cancelled';
              return (
                <li key={order.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setDealerDetailId(order.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setDealerDetailId(order.id);
                    }}
                    className={`w-full text-left p-3.5 rounded-[20px] active:scale-[0.99] ${
                      cancelled ? 'opacity-55' : ''
                    }`}
                    style={iosGlassCardStyle(isDark)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{store?.name ?? 'Do‘kon'}</div>
                        <div className="text-[11px] opacity-50 mt-0.5 truncate">
                          {order.items
                            .slice(0, 2)
                            .map((it) => `${it.productName} ×${it.qty}`)
                            .join(', ')}
                          {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                        style={{
                          background: cancelled
                            ? 'rgba(239,68,68,0.16)'
                            : open
                              ? 'rgba(245,158,11,0.18)'
                              : 'rgba(16,185,129,0.16)',
                          color: cancelled ? '#ef4444' : open ? '#f59e0b' : '#10b981',
                        }}
                      >
                        {cancelled ? 'Bekor' : open ? 'Ochiq' : 'Topshirildi'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-emerald-500">{formatMoney(order.total)}</span>
                      {open ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDealerPayId(order.id);
                          }}
                          className="px-3 py-2 rounded-xl text-[12px] font-bold text-white"
                          style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
                        >
                          Topshirdim
                        </button>
                      ) : (
                        <span className="text-[10px] opacity-40 inline-flex items-center gap-1">
                          {order.completedAt
                            ? formatDillerDateTime(order.completedAt)
                            : cancelled && order.cancelledAt
                              ? formatDillerDateTime(order.cancelledAt)
                              : `${totalItems} dona`}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] opacity-40 mt-2 flex items-center justify-between">
                      <span>{formatDillerDateTime(order.createdAt)}</span>
                      <span>Batafsil</span>
                    </div>
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
