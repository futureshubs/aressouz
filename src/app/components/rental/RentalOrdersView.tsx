import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Clock, CheckCircle, XCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import {
  API_BASE_URL,
  DEV_API_BASE_URL,
} from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { buildBranchHeaders, buildRentalPanelHeaders } from '../../utils/requestAuth';
import { RentalNextPaymentInfo } from './RentalNextPaymentInfo';

export function RentalOrdersView({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<Array<{ id: string; name: string }>>([]);
  const [couriersLoading, setCouriersLoading] = useState(true);
  const [deliveryCourierByOrder, setDeliveryCourierByOrder] = useState<Record<string, string>>({});
  const [confirmDeliveryBusyId, setConfirmDeliveryBusyId] = useState<string | null>(null);
  const [acceptBranchBusyId, setAcceptBranchBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    'all' | 'pending_new' | 'active' | 'returned' | 'extended' | 'cancelled'
  >('all');
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadOrders();
    loadProducts();
  }, [branchId, visibilityTick]);

  useEffect(() => {
    let cancelled = false;
    setCouriersLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/couriers?branchId=${encodeURIComponent(branchId)}`,
          { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok || !data?.success || !Array.isArray(data.couriers)) {
          if (!cancelled) setCouriers([]);
          return;
        }
        if (!cancelled) {
          setCouriers(
            data.couriers.map((c: any) => ({
              id: c.id,
              name: String(c.name || c.login || c.phone || c.id),
            })),
          );
        }
      } catch {
        if (!cancelled) setCouriers([]);
      } finally {
        if (!cancelled) setCouriersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, visibilityTick, apiBaseUrl]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      console.log('🏠 Loading rental orders for branch:', branchId);
      const response = await fetch(
        `${apiBaseUrl}/rentals/orders/${encodeURIComponent(branchId)}`,
        {
          headers: buildRentalPanelHeaders(),
        },
      );

      const data = await response.json().catch(() => ({}));
      console.log('📊 Branch rental orders response:', { status: response.status, data });
      if (response.ok && data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        console.warn('❌ Branch rental orders:', data?.error || data);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Buyurtmalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/rentals/products/${encodeURIComponent(branchId)}`,
        {
          headers: buildRentalPanelHeaders(),
        },
      );

      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Noma\'lum mahsulot';
  };

  const acceptBranchOrder = async (order: any) => {
    const oid = String(order.id || '');
    if (!oid) return;
    setAcceptBranchBusyId(oid);
    try {
      const res = await fetch(`${apiBaseUrl}/rentals/orders/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...buildRentalPanelHeaders(),
        },
        body: JSON.stringify({
          branchId,
          acceptByBranch: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('Qabul qilindi — ijara beruvchi va kuryerlarga xabar yuborildi');
        await loadOrders();
      } else {
        toast.error(data.error || 'Qabul qilishda xatolik');
      }
    } catch {
      toast.error('Tarmoq xatosi');
    } finally {
      setAcceptBranchBusyId(null);
    }
  };

  /** Kuryerni biriktirish (ijara muddati mijoz/kuryer «yetkazildi» bilan boshlanadi) */
  const assignCourierToOrder = async (order: any) => {
    const oid = String(order.id || '');
    const pick = deliveryCourierByOrder[oid] || String(order.deliveryCourierId || '').trim();
    if (!pick) {
      toast.error('Kuryerni tanlang');
      return;
    }
    setConfirmDeliveryBusyId(oid);
    try {
      const res = await fetch(`${apiBaseUrl}/rentals/orders/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...buildRentalPanelHeaders(),
        },
        body: JSON.stringify({
          branchId,
          assignDeliveryCourier: true,
          deliveryCourierId: pick,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('Kuryer biriktirildi — mijoz yoki kuryer yetkazilgach muddat boshlanadi');
        await loadOrders();
      } else {
        toast.error(data.error || 'Biriktirishda xatolik');
      }
    } catch {
      toast.error('Tarmoq xatosi');
    } finally {
      setConfirmDeliveryBusyId(null);
    }
  };

  const recordPeriodicPayment = async (orderId: string) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/rentals/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...buildRentalPanelHeaders(),
          },
          body: JSON.stringify({
            branchId,
            recordPayment: true,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success('To‘lov qayd etildi. Keyingi sana yangilandi');
        loadOrders();
      } else {
        toast.error(data.error || 'Xatolik');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('To‘lovni qayd etishda xatolik');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string, additionalData?: any) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/rentals/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...buildRentalPanelHeaders(),
          },
          body: JSON.stringify({
            branchId,
            status,
            ...additionalData,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Holat yangilandi');
        loadOrders();
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Holatni yangilashda xatolik');
    }
  };

  const filteredOrders =
    filter === 'all'
      ? orders
      : filter === 'pending_new'
        ? orders.filter((o) => o.needsBranchAcceptance === true)
        : orders.filter((order) => order.status === filter);

  const stats = {
    all: orders.length,
    pending_new: orders.filter((o) => o.needsBranchAcceptance === true).length,
    active: orders.filter((o) => o.status === 'active').length,
    returned: orders.filter((o) => o.status === 'returned').length,
    extended: orders.filter((o) => o.status === 'extended').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="w-5 h-5" style={{ color: accentColor.color }} />;
      case 'returned': return <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />;
      case 'extended': return <ArrowRight className="w-5 h-5" style={{ color: '#f59e0b' }} />;
      case 'cancelled': return <XCircle className="w-5 h-5" style={{ color: '#ef4444' }} />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ijarada';
      case 'returned': return 'Qaytib keldi';
      case 'extended': return 'Muddat cho\'zildi';
      case 'cancelled': return 'Bekor qilindi';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return accentColor.color;
      case 'returned': return '#10b981';
      case 'extended': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" 
               style={{ 
                 borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                 borderTopColor: accentColor.color 
               }}
          />
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Ijarada</h2>
        <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          Barcha ijara buyurtmalari
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'Hammasi', count: stats.all },
          { key: 'pending_new', label: 'Yangi', count: stats.pending_new, icon: Sparkles },
          { key: 'active', label: 'Ijarada', count: stats.active },
          { key: 'returned', label: 'Qaytib keldi', count: stats.returned },
          { key: 'extended', label: 'Cho\'zildi', count: stats.extended },
          { key: 'cancelled', label: 'Bekor qilindi', count: stats.cancelled },
        ].map((item) => {
          const TabIcon = 'icon' in item ? item.icon : null;
          return (
          <button
            key={item.key}
            onClick={() => setFilter(item.key as any)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-medium whitespace-nowrap transition-all"
            style={{
              background: filter === item.key 
                ? accentColor.color 
                : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: filter === item.key ? '#ffffff' : undefined,
            }}
          >
            {TabIcon ? <TabIcon className="w-4 h-4 shrink-0 opacity-90" /> : null}
            {item.label} ({item.count})
          </button>
          );
        })}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div 
          className="text-center py-12 rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Clock className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-xl font-bold mb-2">Buyurtmalar yo'q</h3>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            {filter === 'all'
              ? 'Hali buyurtmalar yo\'q'
              : filter === 'pending_new'
                ? 'Yangi (filial qabuli kutilayotgan) buyurtmalar yo‘q'
                : `${getStatusText(filter)} buyurtmalar yo'q`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-3xl p-6 border"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(order.status)}
                    <h3 className="text-lg font-bold">
                      {order.productName || getProductName(order.productId)}
                    </h3>
                  </div>
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Mijoz: {order.customerName} • Tel: {order.customerPhone}
                  </p>
                </div>
                <div 
                  className="px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={{ 
                    background: `${getStatusColor(order.status)}20`,
                    color: getStatusColor(order.status)
                  }}
                >
                  {getStatusText(order.status)}
                </div>
              </div>

              {order.status === 'active' && (
                <div
                  className="mb-4 flex flex-wrap gap-1.5 text-[10px] sm:text-xs font-semibold"
                  aria-label="Buyurtma bosqichlari"
                >
                  {(
                    [
                      { id: 'b', label: 'Filial qabuli', done: !order.needsBranchAcceptance, warn: false },
                      {
                        id: 'c',
                        label: order.requiresAutoCourier ? 'Avto-kuryer' : 'Kuryer',
                        done: Boolean(String(order.deliveryCourierId || '').trim()),
                        warn: false,
                      },
                      {
                        id: 'd',
                        label: 'Mijozga yetkazildi (hisob boshlanadi)',
                        done: Boolean(order.rentalPeriodStartedAt),
                        warn: false,
                      },
                      {
                        id: 'p',
                        label:
                          order.pickupAlert === 'overdue'
                            ? 'Qaytarish (majburiy)'
                            : order.pickupAlert === 'due_soon'
                              ? 'Qaytarish (tez orada)'
                              : 'Qaytarish (muddati tugagach)',
                        done: false,
                        warn: order.pickupAlert === 'overdue',
                      },
                    ] as const
                  ).map((step, idx, arr) => {
                    const inactive =
                      !step.done &&
                      step.id !== 'p' &&
                      (step.id === 'c'
                        ? order.needsBranchAcceptance
                        : step.id === 'd'
                          ? !String(order.deliveryCourierId || '').trim()
                          : false);
                    return (
                      <span key={step.id} className="inline-flex items-center gap-1.5">
                        <span
                          className="px-2 py-1 rounded-lg"
                          style={{
                            background: step.warn
                              ? 'rgba(239,68,68,0.2)'
                              : step.done
                                ? `${accentColor.color}28`
                                : inactive
                                  ? isDark
                                    ? 'rgba(255,255,255,0.04)'
                                    : 'rgba(0,0,0,0.04)'
                                  : isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'rgba(0,0,0,0.06)',
                            color: step.warn
                              ? '#ef4444'
                              : step.done
                                ? accentColor.color
                                : isDark
                                  ? 'rgba(255,255,255,0.45)'
                                  : 'rgba(0,0,0,0.45)',
                          }}
                        >
                          {step.label}
                        </span>
                        {idx < arr.length - 1 ? (
                          <span style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }}>→</span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              )}

              {order.productWeightKg != null && Number(order.productWeightKg) > 0 ? (
                <p className="text-xs mb-3 font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                  Og‘irlik: {order.productWeightKg} kg
                  {order.requiresAutoCourier ? ' · avto-kuryer navbati yoki filial tanlovi' : ''}
                </p>
              ) : null}

              {order.status === 'active' && order.pickupAlert === 'overdue' && order.rentalPeriodStartedAt && (
                <div
                  className="mb-4 p-3 rounded-2xl border text-sm font-semibold"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    borderColor: 'rgba(239,68,68,0.45)',
                    color: '#b91c1c',
                  }}
                >
                  Ijara muddati tugadi — biriktirilgan kuryer buyurtmani mijozdan qaytarib olishi kerak.
                </div>
              )}

              {order.status === 'active' && order.needsBranchAcceptance === true && (
                <div
                  className="mb-4 p-4 rounded-2xl border space-y-3"
                  style={{
                    background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                    borderColor: isDark ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.28)',
                  }}
                >
                  <p className="text-sm font-bold" style={{ color: '#1d4ed8' }}>
                    Yangi buyurtma — filial qabuli
                  </p>
                  <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
                    «Qabul qilish» dan keyin ijara beruvchiga Telegram va (kerak bo‘lsa) avto-kuryerga xabar ketadi; keyin kuryer biriktiriladi.
                  </p>
                  <button
                    type="button"
                    disabled={acceptBranchBusyId === order.id}
                    onClick={() => acceptBranchOrder(order)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: '#2563eb' }}
                  >
                    {acceptBranchBusyId === order.id ? 'Yuborilmoqda...' : 'Qabul qilish'}
                  </button>
                </div>
              )}

              {order.status === 'active' &&
                order.needsBranchAcceptance !== true &&
                order.awaitingCourierAssignment === true && (
                  <div
                    className="mb-4 p-4 rounded-2xl border space-y-3"
                    style={{
                      background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
                      borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.3)',
                    }}
                  >
                    <p className="text-sm font-bold" style={{ color: '#b45309' }}>
                      {order.requiresAutoCourier
                        ? 'Katta yuk — avto-kuryer navbati'
                        : 'Oddiy kuryer biriktirish'}
                    </p>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
                      {order.requiresAutoCourier
                        ? 'Avto-kuryer o‘z panelida «Olish» bosguncha kuting. Biriktirilgach, u ijara beruvchi manzilidan olib mijozga yetkazadi.'
                        : 'Pastdan filial kuryerini tanlang — u ijara beruvchidan olib mijozga yetkazadi. Ijara muddati mijoz yoki kuryer «yetkazildi» tasdig‘idan keyin boshlanadi.'}
                    </p>
                    {!order.requiresAutoCourier ? (
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <select
                          className="flex-1 px-3 py-2 rounded-xl border text-sm bg-transparent disabled:opacity-60"
                          style={{
                            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                            color: isDark ? '#fff' : '#111',
                          }}
                          disabled={couriersLoading}
                          value={
                            deliveryCourierByOrder[order.id] ||
                            String(order.deliveryCourierId || '')
                          }
                          onChange={(e) =>
                            setDeliveryCourierByOrder((prev) => ({ ...prev, [order.id]: e.target.value }))
                          }
                        >
                          <option value="">
                            {couriersLoading ? 'Kuryerlar yuklanmoqda...' : 'Kuryerni tanlang'}
                          </option>
                          {couriers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {couriersLoading ? (
                          <Loader2
                            className="size-5 animate-spin shrink-0 self-center"
                            style={{ color: accentColor.color }}
                            aria-hidden
                          />
                        ) : null}
                        <button
                          type="button"
                          disabled={confirmDeliveryBusyId === order.id}
                          onClick={() => assignCourierToOrder(order)}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0 disabled:opacity-50"
                          style={{ background: accentColor.color }}
                        >
                          {confirmDeliveryBusyId === order.id ? 'Yuborilmoqda...' : 'Kuryerni biriktirish'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

              {order.status === 'active' && order.awaitingDeliveryConfirmation === true && (
                <div
                  className="mb-4 p-4 rounded-2xl border space-y-2"
                  style={{
                    background: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)',
                    borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.28)',
                  }}
                >
                  <p className="text-sm font-bold" style={{ color: '#047857' }}>
                    Yetkazish jarayonida
                  </p>
                  <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
                    Kuryer tayinlangan. Ijara muddati mijoz ilovada «Mahsulotni oldim» yoki kuryer «Mijozga yetkazildi» bosganda
                    boshlanadi; shundan keyin tugash vaqti va «Ijara» bo‘limidagi qaytarish ochiladi.
                  </p>
                  {order.deliveryCourierId ? (
                    <p className="text-[11px] font-mono" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                      Kuryer ID: {order.deliveryCourierId}
                    </p>
                  ) : null}
                </div>
              )}

              {order.rentalPeriodStartedAt && order.deliveryCourierId && (
                <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                  Yetkazuvchi kuryer ID:{' '}
                  <span className="font-mono font-medium">{order.deliveryCourierId}</span>
                </p>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Miqdori
                  </p>
                  <p className="font-semibold">{order.quantity} ta</p>
                </div>

                <div>
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Muddat
                  </p>
                  <p className="font-semibold">{order.duration || `${order.rentalDuration ?? ''}`}</p>
                </div>

                <div>
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Narx
                  </p>
                  <p className="font-semibold">{parseInt(order.totalPrice || 0).toLocaleString()} so'm</p>
                </div>

                <div>
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Sana
                  </p>
                  <p className="font-semibold">{new Date(order.createdAt).toLocaleDateString('uz-UZ')}</p>
                </div>
              </div>

              {/* Keyingi to‘lov: sana, qolgan vaqt, navbatdagi summa (profil bilan bir xil ma’lumot) */}
              {(order.status === 'active' || order.status === 'extended') && (
                <div
                  className="mb-4 p-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(20,184,166,0.12)' : 'rgba(20,184,166,0.08)',
                    borderColor: isDark ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.25)',
                  }}
                >
                  <p className="text-sm font-bold mb-1" style={{ color: accentColor.color }}>
                    Keyingi to‘lov va qolgan vaqt
                  </p>
                  <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                    Reja:{' '}
                    {order.paymentSchedule === 'weekly'
                      ? 'Har hafta'
                      : order.paymentSchedule === 'monthly'
                        ? 'Har oy'
                        : 'Bir martalik / muddatlik'}
                  </p>
                  <RentalNextPaymentInfo
                    paymentSchedule={order.paymentSchedule}
                    nextPaymentDue={order.nextPaymentDue}
                    pricePerPeriod={order.pricePerPeriod}
                    quantity={order.quantity}
                    contractStartDate={order.contractStartDate}
                    rentalPeriodStartedAt={order.rentalPeriodStartedAt}
                    rentalPeriodEndsAt={order.rentalPeriodEndsAt}
                    rentalPeriod={order.rentalPeriod}
                    awaitingCourierDelivery={order.awaitingCourierDelivery === true}
                    isDark={isDark}
                    accentColor={accentColor.color}
                  />
                  {order.pickupAlert === 'due_soon' && order.rentalPeriodStartedAt && (
                    <p className="text-xs text-amber-600 font-medium mt-2">
                      24 soat ichida ijara tugaydi — kuryer tayyor turishi mumkin.
                    </p>
                  )}
                  {order.paymentAlert === 'overdue' && (
                    <p className="text-xs text-red-500 font-semibold mt-2">⚠️ Muddati o‘tgan</p>
                  )}
                  {order.paymentAlert === 'due_soon' && (
                    <p className="text-xs text-amber-500 mt-2">3 kun ichida to‘lov kutilmoqda</p>
                  )}
                </div>
              )}

              {/* Dates */}
              {(order.startDate || order.endDate) && (
                <div className="mb-4 p-3 rounded-2xl" 
                     style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center gap-4 text-sm">
                    {order.startDate && (
                      <div>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                          Boshlandi: 
                        </span>
                        <span className="ml-2 font-medium">
                          {new Date(order.startDate).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                    )}
                    {order.endDate && (
                      <div>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                          Tugaydi: 
                        </span>
                        <span className="ml-2 font-medium">
                          {new Date(order.endDate).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {order.status === 'active' && (
                <div className="flex flex-col gap-2">
                  {(order.paymentSchedule === 'weekly' || order.paymentSchedule === 'monthly') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Mijoz to‘lovini qabul qildingizmi? Keyingi to‘lov sanasi avtomatik suriladi.')) {
                          recordPeriodicPayment(order.id);
                        }
                      }}
                      className="w-full px-4 py-2 rounded-xl font-medium transition-all"
                      style={{
                        background: `${accentColor.color}`,
                        color: '#fff',
                      }}
                    >
                      Davriy to‘lov qabul qilindi
                    </button>
                  )}
                  <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => updateOrderStatus(order.id, 'returned', { 
                      returnDate: new Date().toISOString() 
                    })}
                    className="flex-1 px-4 py-2 rounded-xl font-medium transition-all"
                    style={{ 
                      background: `${accentColor.color}20`,
                      color: accentColor.color
                    }}
                  >
                    Qaytib keldi
                  </button>
                  <button
                    onClick={() => {
                      const days = prompt('Necha kun cho\'zilsin?');
                      if (days) {
                        const newEndDate = new Date(order.endDate);
                        newEndDate.setDate(newEndDate.getDate() + parseInt(days));
                        updateOrderStatus(order.id, 'extended', { 
                          extendedUntil: newEndDate.toISOString() 
                        });
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-xl font-medium transition-all"
                    style={{ 
                      background: 'rgba(245,158,11,0.1)',
                      color: '#f59e0b'
                    }}
                  >
                    Muddatni cho'zish
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Buyurtmani bekor qilishni tasdiqlaysizmi?')) {
                        updateOrderStatus(order.id, 'cancelled');
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-xl font-medium transition-all"
                    style={{ 
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444'
                    }}
                  >
                    Bekor qilish
                  </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
