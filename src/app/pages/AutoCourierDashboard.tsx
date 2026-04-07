import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Car, LogOut, MapPin, Package, Phone, RefreshCw, User } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import {
  API_BASE_URL,
  DEV_API_BASE_URL,
  publicAnonKey,
} from '../../../utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';

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

type RentalDeliveryJob = {
  id: string;
  branchId?: string;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
};

type ActiveRentalOrder = {
  id: string;
  branchId?: string;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  rentalPeriodEndsAt?: string;
  pickupAlert?: string;
};

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
  const visibilityTick = useVisibilityTick();

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

        {myDeliveryJobs.length > 0 ? (
          <div
            className="rounded-3xl border p-5 space-y-3 mb-4"
            style={{
              borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.35)',
              background: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)',
            }}
          >
            <p className="font-bold text-amber-600 dark:text-amber-400">Sizning ijara yetkazishingiz</p>
            <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
              Ijara beruvchidan olib mijozga yetkazing. «Mijozga yetkazildi» — ijara hisobi shundan boshlanadi.
            </p>
            {myDeliveryJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border p-4 space-y-2"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  background: isDark ? 'rgba(0,0,0,0.25)' : '#fff',
                }}
              >
                <p className="font-semibold">{job.productName || 'Ijara'}</p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 opacity-50" />
                  {job.customerName || '—'}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 opacity-50" />
                  {job.customerPhone || '—'}
                </div>
                {job.address ? (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 opacity-50 shrink-0 mt-0.5" />
                    <span>{job.address}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={markingDelivered === job.id}
                  onClick={() => void markDeliveredToCustomer(job)}
                  className="w-full py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
                  style={{ background: '#d97706' }}
                >
                  {markingDelivered === job.id ? 'Yuborilmoqda…' : 'Mijozga yetkazildi'}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {activeRentals.length > 0 ? (
          <div
            className="rounded-3xl border p-5 space-y-3 mb-4"
            style={{
              borderColor: isDark ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.35)',
              background: isDark ? 'rgba(20,184,166,0.08)' : 'rgba(20,184,166,0.06)',
            }}
          >
            <p className="font-bold" style={{ color: '#0d9488' }}>
              Ijara — mijozdan qaytarib olish
            </p>
            <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
              Siz mijozga yetkazgan buyurtmalar. Muddat tugagach mahsulotni mijozdan olib, ijara beruvchiga qaytaring.
              «Qaytarildim» — ombor va buyurtma holati yangilanadi.
            </p>
            {activeRentals.map((ro) => (
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
                <p className="font-semibold">{ro.productName || 'Ijara'}</p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 opacity-50" />
                  {ro.customerName || '—'}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 opacity-50" />
                  {ro.customerPhone || '—'}
                </div>
                {ro.address ? (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 opacity-50 shrink-0 mt-0.5" />
                    <span>{ro.address}</span>
                  </div>
                ) : null}
                {ro.rentalPeriodEndsAt ? (
                  <p className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}>
                    Tugash: {new Date(ro.rentalPeriodEndsAt).toLocaleString('uz-UZ')}
                  </p>
                ) : null}
                {ro.pickupAlert === 'overdue' ? (
                  <p className="text-sm font-bold text-red-500">Qaytarish muddati o‘tgan</p>
                ) : ro.pickupAlert === 'due_soon' ? (
                  <p className="text-xs font-semibold text-amber-600">24 soat ichida tugaydi</p>
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
            ))}
          </div>
        ) : null}

        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-10 h-10 animate-spin opacity-30" />
          </div>
        ) : orders.length === 0 ? (
          <div
            className="rounded-3xl border p-10 text-center"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            }}
          >
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Navbat bo‘sh</p>
            <p
              className="text-sm mt-1"
              style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
            >
              Yangi buyurtma tushganda shu yerda ko‘rinadi.
            </p>
          </div>
        ) : (
          orders.map((o) => (
            <div
              key={o.id}
              className="rounded-3xl border p-5 space-y-3"
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
          ))
        )}
      </main>
    </div>
  );
}
