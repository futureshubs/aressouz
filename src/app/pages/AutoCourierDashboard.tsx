import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Car, LogOut, MapPin, Package, Phone, RefreshCw, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import {
  API_BASE_URL,
  DEV_API_BASE_URL,
  publicAnonKey,
} from '../../../utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import {
  RentalCourierDeliveryJobCard,
  RentalCourierDepositBlock,
} from '../components/rental/RentalCourierDeliveryJobCard';
import { RentalLiveCountdown } from '../components/rental/RentalLiveCountdown';
import { normalizeRentalProductImageUrl } from '../utils/rentalProductImage';
import { computeRentalCourierHandoffUzs } from '../utils/rentalCashHandoff';

type QueueOrder = {
  id: string;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  totalPrice?: number;
  productWeightKg?: number;
  createdAt?: string;
};

type RentalDeliveryJob = Record<string, unknown> & {
  id: string;
  branchId?: string;
};

type ActiveRentalOrder = Record<string, unknown> & { id: string };

function readSession(): {
  token: string;
  courier?: { firstName?: string; vehiclePlate?: string; branchId?: string };
} | null {
  try {
    const raw = localStorage.getItem('autoCourierSession');
    if (!raw) return null;
    const s = JSON.parse(raw);
    const token = String(s?.token || '').trim();
    if (!token) return null;
    if (typeof s.expiresAt === 'number' && Date.now() > s.expiresAt) {
      localStorage.removeItem('autoCourierSession');
      return null;
    }
    return { token, courier: s.courier };
  } catch {
    return null;
  }
}

export default function AutoCourierDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [session, setSession] = useState<ReturnType<typeof readSession>>(null);
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [myDeliveryJobs, setMyDeliveryJobs] = useState<RentalDeliveryJob[]>([]);
  const [activeRentals, setActiveRentals] = useState<ActiveRentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [markingDelivered, setMarkingDelivered] = useState<string | null>(null);
  const [pickupBusyId, setPickupBusyId] = useState<string | null>(null);
  const [depositBusyId, setDepositBusyId] = useState<string | null>(null);
  /** Yangi navbat vs sizning ijara ishlaringiz */
  const [autoCourierRentalTab, setAutoCourierRentalTab] = useState<'new' | 'active'>('new');
  const visibilityTick = useVisibilityTick();
  const tabTeal = '#0d9488';
  const mutedTextColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const textColor = isDark ? '#ffffff' : '#111827';
  const edgeBaseUrl = useMemo(
    () =>
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? DEV_API_BASE_URL
        : API_BASE_URL,
    [],
  );

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigate('/avtokuryer');
      return;
    }
    setSession(s);
  }, [navigate]);

  const loadQueue = useCallback(async () => {
    const s = readSession();
    if (!s) {
      navigate('/avtokuryer');
      return;
    }
    try {
      setLoading(true);
      const u = new URLSearchParams({ token: s.token });
      const [res, jobsRes, activeRes] = await Promise.all([
        fetch(`${baseUrl}/auto-courier/rental-queue?${u}`, {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Auto-Courier-Token': s.token,
          },
        }),
        fetch(`${baseUrl}/rentals/courier/rental-delivery-jobs?${u}`, {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Auto-Courier-Token': s.token,
          },
        }),
        fetch(`${baseUrl}/rentals/courier/active-rentals?${u}`, {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Auto-Courier-Token': s.token,
          },
        }),
      ]);
      const data = await res.json();
      const jobsData = await jobsRes.json().catch(() => ({}));
      const activeData = await activeRes.json().catch(() => ({}));
      if (res.status === 401 || !data.success) {
        if (res.status === 401) {
          localStorage.removeItem('autoCourierSession');
          toast.error('Sessiya tugadi');
          navigate('/avtokuryer');
        }
        setOrders([]);
        setMyDeliveryJobs([]);
        setActiveRentals([]);
        return;
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      if (jobsRes.ok && jobsData.success && Array.isArray(jobsData.orders)) {
        setMyDeliveryJobs(jobsData.orders);
      } else {
        setMyDeliveryJobs([]);
      }
      if (activeRes.ok && activeData.success && Array.isArray(activeData.orders)) {
        setActiveRentals(activeData.orders);
      } else {
        setActiveRentals([]);
      }
    } catch {
      setOrders([]);
      setMyDeliveryJobs([]);
      setActiveRentals([]);
      toast.error('Navbatni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, navigate]);

  useEffect(() => {
    if (session?.token) void loadQueue();
  }, [session?.token, loadQueue, visibilityTick]);

  const claim = async (orderId: string) => {
    const s = readSession();
    if (!s) return;
    setClaiming(orderId);
    try {
      const res = await fetch(`${baseUrl}/auto-courier/claim-rental`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'X-Auto-Courier-Token': s.token,
        },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Olishda xatolik');
        return;
      }
      toast.success('Buyurtma sizga biriktirildi');
      setAutoCourierRentalTab('active');
      await loadQueue();
    } catch {
      toast.error('So‘rov yuborilmadi');
    } finally {
      setClaiming(null);
    }
  };

  const markDeliveredToCustomer = async (job: RentalDeliveryJob) => {
    const s = readSession();
    const branchId = String(job.branchId || s?.courier?.branchId || '').trim();
    if (!s || !branchId) {
      toast.error('Filial ma’lumoti yo‘q');
      return;
    }
    setMarkingDelivered(job.id);
    try {
      const res = await fetch(`${baseUrl}/rentals/orders/${encodeURIComponent(job.id)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'X-Auto-Courier-Token': s.token,
        },
        body: JSON.stringify({
          branchId,
          courierMarkDeliveredToCustomer: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Xatolik');
        return;
      }
      toast.success('Mijozga yetkazildi — ijara muddati boshlandi');
      await loadQueue();
    } catch {
      toast.error('So‘rov yuborilmadi');
    } finally {
      setMarkingDelivered(null);
    }
  };

  const confirmPickupFromCustomer = async (ro: ActiveRentalOrder) => {
    const s = readSession();
    const branchId = String(ro.branchId || s?.courier?.branchId || '').trim();
    const oid = String(ro.id || '').trim();
    if (!s || !branchId || !oid) {
      toast.error('Ma’lumot to‘liq emas');
      return;
    }
    if (!window.confirm('Mahsulotni mijozdan oldingiz va ijara beruvchiga qaytaryapsizmi?')) return;
    setPickupBusyId(oid);
    try {
      const res = await fetch(`${baseUrl}/rentals/orders/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'X-Auto-Courier-Token': s.token,
        },
        body: JSON.stringify({
          branchId,
          confirmPickupReturn: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Qaytarishda xatolik');
        return;
      }
      toast.success('Qaytarish qayd etildi');
      await loadQueue();
    } catch {
      toast.error('So‘rov yuborilmadi');
    } finally {
      setPickupBusyId(null);
    }
  };

  const uploadDepositPhoto = async (order: Record<string, unknown>, file: File) => {
    const s = readSession();
    const branchId = String(order.branchId || s?.courier?.branchId || '').trim();
    const oid = String(order.id || '').trim();
    if (!s || !branchId || !oid) {
      toast.error('Ma’lumot to‘liq emas');
      return;
    }
    setDepositBusyId(oid);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('read'));
        r.readAsDataURL(file);
      });
      if (!dataUrl.startsWith('data:image/')) {
        toast.error('Faqat rasm fayli');
        return;
      }
      const res = await fetch(`${baseUrl}/rentals/orders/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'X-Auto-Courier-Token': s.token,
        },
        body: JSON.stringify({
          branchId,
          courierUploadDepositPhoto: true,
          depositPhotoDataUrl: dataUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Yuklashda xatolik');
        return;
      }
      toast.success('Garov rasmi saqlandi');
      await loadQueue();
    } catch {
      toast.error('Rasm o‘qilmadi');
    } finally {
      setDepositBusyId(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('autoCourierSession');
    navigate('/avtokuryer');
  };

  return (
    <div
      className="min-h-screen app-safe-pad"
      style={{
        background: isDark ? '#050505' : '#f3f4f6',
        color: isDark ? '#fff' : '#111',
      }}
    >
      <header
        className="sticky top-0 z-20 border-b px-4 py-4 flex flex-wrap items-center justify-between gap-3"
        style={{
          background: isDark ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.95)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          paddingTop: 'max(1rem, var(--app-safe-top))',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl" style={{ background: `${accentColor.color}22` }}>
            <Car className="w-7 h-7" style={{ color: accentColor.color }} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Avto-kuryer</h1>
            <p
              className="text-xs"
              style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
            >
              {session?.courier?.firstName || '—'} · {session?.courier?.vehiclePlate || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="p-2.5 rounded-xl border"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            }}
            aria-label="Yangilash"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
          >
            <LogOut className="w-4 h-4" />
            Chiqish
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
        <p
          className="text-sm rounded-2xl px-4 py-3 border"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
          }}
        >
          Bu yerda faqat <b>katta yuk</b> belgilangan ijara buyurtmalari chiqadi. «Olish» bosgach,
          boshqa avto-kuryerlar ko‘rmaydi. Telegram uchun alohida bot tokeni:{' '}
          <span className="font-mono text-xs">TELEGRAM_AUTO_COURIER_BOT_TOKEN</span>.
        </p>

        <div
          className="flex gap-1.5 p-1.5 rounded-full"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}
          role="tablist"
          aria-label="Ijara bo‘limlari"
        >
          <button
            type="button"
            role="tab"
            aria-selected={autoCourierRentalTab === 'new'}
            onClick={() => setAutoCourierRentalTab('new')}
            className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-full text-sm font-semibold transition-colors"
            style={
              autoCourierRentalTab === 'new'
                ? { background: tabTeal, color: '#fff', boxShadow: '0 1px 8px rgba(13,148,136,0.35)' }
                : {
                    background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.85)',
                    color: isDark ? 'rgba(255,255,255,0.9)' : '#1f2937',
                  }
            }
          >
            <Sparkles className="w-4 h-4 shrink-0 opacity-95" aria-hidden />
            Yangi ({orders.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={autoCourierRentalTab === 'active'}
            onClick={() => setAutoCourierRentalTab('active')}
            className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-full text-sm font-semibold transition-colors"
            style={
              autoCourierRentalTab === 'active'
                ? { background: tabTeal, color: '#fff', boxShadow: '0 1px 8px rgba(13,148,136,0.35)' }
                : {
                    background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.85)',
                    color: isDark ? 'rgba(255,255,255,0.9)' : '#1f2937',
                  }
            }
          >
            Ijarada ({myDeliveryJobs.length + activeRentals.length})
          </button>
        </div>

        {autoCourierRentalTab === 'new' ? (
          <div
            className="rounded-3xl border p-5 space-y-4"
            style={{
              borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(217,119,6,0.28)',
              background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(251,191,36,0.06)',
            }}
          >
            <p className="text-xs" style={{ color: mutedTextColor }}>
              Filial qabul qilgan, lekin hali kuryer olmagan ijara. «O‘zimga olish» — keyin «Ijarada» varag‘ida
              yetkazish ochiladi.
            </p>
            {loading && orders.length === 0 ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-9 h-9 animate-spin opacity-35 text-amber-600" />
              </div>
            ) : orders.length === 0 ? (
              <div
                className="rounded-2xl border px-4 py-8 text-center"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
                }}
              >
                <Package className="w-10 h-10 mx-auto mb-2 opacity-35 text-amber-700 dark:text-amber-500" />
                <p className="font-medium text-sm">Navbat bo‘sh</p>
                <p className="text-xs mt-1" style={{ color: mutedTextColor }}>
                  Yangi buyurtma tushganda shu yerda ko‘rinadi.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-2xl border p-4 space-y-3"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      background: isDark
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
                        : '#fff',
                    }}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <div>
                        <p className="font-bold">{o.productName || 'Mahsulot'}</p>
                        <p
                          className="text-xs font-mono mt-1"
                          style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                        >
                          {o.id}
                        </p>
                      </div>
                      {o.productWeightKg != null ? (
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{ background: `${accentColor.color}28` }}
                        >
                          {o.productWeightKg} kg
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 opacity-50" />
                        {o.customerName || '—'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 opacity-50" />
                        {o.customerPhone || '—'}
                      </div>
                      {o.address ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 opacity-50 shrink-0 mt-0.5" />
                          <span>{o.address}</span>
                        </div>
                      ) : null}
                    </div>
                    {o.totalPrice != null ? (
                      <p className="text-sm font-semibold">
                        {Number(o.totalPrice).toLocaleString()} so'm
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={claiming === o.id}
                      onClick={() => void claim(o.id)}
                      className="w-full py-3 rounded-2xl font-semibold transition-opacity disabled:opacity-50"
                      style={{ background: accentColor.color, color: '#fff' }}
                    >
                      {claiming === o.id ? 'Biriktirilmoqda…' : 'O‘zimga olish'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-3xl border p-5 space-y-6"
            style={{
              borderColor: isDark ? 'rgba(13,148,136,0.35)' : 'rgba(13,148,136,0.28)',
              background: isDark ? 'rgba(13,148,136,0.06)' : 'rgba(13,148,136,0.05)',
            }}
          >
          <div className="space-y-3">
            <p className="font-bold text-amber-600 dark:text-amber-400">Yetkazish — mijozga olib borish</p>
            <p className="text-xs" style={{ color: mutedTextColor }}>
              «Yangi»dan olingan buyurtmalar. Garov rasmini yuklang, keyin «Mijozga yetkazildi» — shundan ijara muddati
              boshlanadi.
            </p>
            {myDeliveryJobs.length > 0 ? (
              myDeliveryJobs.map((job) => (
                <RentalCourierDeliveryJobCard
                  key={job.id}
                  job={job}
                  isDark={isDark}
                  mutedTextColor={mutedTextColor}
                  deliverBusyId={markingDelivered}
                  depositBusyId={depositBusyId}
                  onDelivered={(j) => void markDeliveredToCustomer(j)}
                  onDepositPhoto={(j, f) => void uploadDepositPhoto(j, f)}
                />
              ))
            ) : (
              <p className="text-sm rounded-xl px-3 py-2.5 border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: mutedTextColor }}>
                Hozircha sizga biriktirilgan ijara yetkazish yo‘q. «Yangi» varag‘idan buyurtma oling.
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            <p className="font-bold" style={{ color: '#0d9488' }}>
              Faol ijaralar — mijozdan qaytarib olish
            </p>
            <p className="text-xs" style={{ color: mutedTextColor }}>
              Mijozga yetkazilgach bu yerda tugash vaqti, garov rasmlari va naqd/kassa ma’lumoti ko‘rinadi. Muddat tugagach
              mahsulotni mijozdan olib qaytaring.
            </p>
            {activeRentals.length > 0 ? (
              activeRentals.map((ro) => {
                const endMs = ro.rentalPeriodEndsAt ? new Date(ro.rentalPeriodEndsAt as string).getTime() : NaN;
                const endOk = !Number.isNaN(endMs);
                const rentImg = normalizeRentalProductImageUrl(String(ro.productImage || '').trim(), edgeBaseUrl);
                const rentMoney = computeRentalCourierHandoffUzs(ro as Record<string, unknown>);
                return (
                  <div
                    key={ro.id}
                    className="rounded-2xl border p-4 space-y-2"
                    style={{
                      borderColor:
                        ro.pickupAlert === 'overdue'
                          ? 'rgba(239,68,68,0.45)'
                          : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.08)',
                      background: isDark ? 'rgba(0,0,0,0.25)' : '#fff',
                    }}
                  >
                    <div className="flex gap-3 items-start">
                      <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-black/10">
                        {rentImg &&
                        (rentImg.startsWith('http') ||
                          rentImg.startsWith('//') ||
                          rentImg.startsWith('/') ||
                          rentImg.startsWith('data:')) ? (
                          <img src={rentImg} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-7 h-7 opacity-40" style={{ color: mutedTextColor }} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold leading-snug">{String(ro.productName || 'Ijara')}</p>
                        <p className="text-[10px] font-mono opacity-45 break-all">ID: {String(ro.id)}</p>
                        <p className="text-xs" style={{ color: mutedTextColor }}>
                          Mijoz: {String(ro.customerName || '—')} · {String(ro.customerPhone || '—')}
                        </p>
                      </div>
                    </div>
                    {ro.pickupAddress ? (
                      <div className="flex items-start gap-2 text-xs font-medium" style={{ color: '#0d9488' }}>
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Olib ketilgan joy: {String(ro.pickupAddress)}</span>
                      </div>
                    ) : null}
                    {ro.deliveryAddress || ro.address ? (
                      <div className="flex items-start gap-2 text-xs" style={{ color: mutedTextColor }}>
                        <MapPin className="w-3.5 h-3.5 opacity-50 shrink-0 mt-0.5" />
                        <span>Mijoz manzili: {String(ro.deliveryAddress || ro.address)}</span>
                      </div>
                    ) : null}
                    <RentalCourierDepositBlock
                      job={ro}
                      isDark={isDark}
                      mutedTextColor={mutedTextColor}
                      depositBusyId={depositBusyId}
                      onDepositPhoto={(j, f) => void uploadDepositPhoto(j, f)}
                    />
                    {endOk && ro.rentalPeriodEndsAt ? (
                      <div className="space-y-1">
                        <RentalLiveCountdown
                          rentalPeriodEndsAt={String(ro.rentalPeriodEndsAt)}
                          isDark={isDark}
                          accentColor={accentColor.color}
                          prominent
                        />
                        <p className="text-[11px]" style={{ color: mutedTextColor }}>
                          Tugash (mahalliy): {new Date(String(ro.rentalPeriodEndsAt)).toLocaleString('uz-UZ')}
                        </p>
                      </div>
                    ) : null}
                    {ro.pickupAlert === 'overdue' ? (
                      <p className="text-sm font-bold text-red-500">Qaytarish muddati o‘tgan</p>
                    ) : ro.pickupAlert === 'due_soon' ? (
                      <p className="text-xs font-semibold text-amber-600">24 soat ichida tugaydi</p>
                    ) : null}
                    {rentMoney.totalUzs > 0 ? (
                      <div
                        className="rounded-xl border p-3 space-y-1"
                        style={{
                          background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                          borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.3)',
                        }}
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Buyurtma / pul
                        </p>
                        <p className="text-xs" style={{ color: mutedTextColor }}>
                          Jami:{' '}
                          <span className="font-bold tabular-nums" style={{ color: textColor }}>
                            {rentMoney.totalUzs.toLocaleString('uz-UZ')}
                          </span>{' '}
                          so‘m
                          {rentMoney.deliveryKeptUzs > 0 ? (
                            <>
                              {' '}
                              · Yetkazish (sizda):{' '}
                              <span className="font-semibold tabular-nums">
                                {rentMoney.deliveryKeptUzs.toLocaleString('uz-UZ')}
                              </span>{' '}
                              so‘m
                            </>
                          ) : null}
                        </p>
                        {rentMoney.isCashLike && rentMoney.toCashierUzs > 0 ? (
                          <p className="text-lg font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
                            Kassaga: {rentMoney.toCashierUzs.toLocaleString('uz-UZ')} so‘m
                          </p>
                        ) : (
                          <p className="text-sm font-semibold" style={{ color: mutedTextColor }}>
                            Onlayn/karta — kassaga naqd topshiruv yo‘q
                          </p>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={pickupBusyId === ro.id}
                      onClick={() => void confirmPickupFromCustomer(ro)}
                      className="w-full py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
                      style={{ background: ro.pickupAlert === 'overdue' ? '#dc2626' : '#0d9488' }}
                    >
                      {pickupBusyId === ro.id ? 'Yuborilmoqda…' : 'Qaytarildim (mijozdan oldim)'}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm rounded-xl px-3 py-2.5 border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: mutedTextColor }}>
                Faol ijara yo‘q. Mijozga yetkazib, muddat boshlangach shu ro‘yxatga tushadi.
              </p>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
