import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  Car,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  X,
  Phone,
  KeyRound,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  API_BASE_URL,
  DEV_API_BASE_URL,
  publicAnonKey,
} from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

type AutoCourierRow = {
  id: string;
  branchId: string;
  firstName: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  phone: string;
  vehiclePlate: string;
  vehicleBrand?: string;
  vehicleWidthM?: number;
  login: string;
  telegramChatId?: string;
  status?: string;
  createdAt?: string;
};

interface AutoCouriersProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export function AutoCouriers({ branchId }: AutoCouriersProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [list, setList] = useState<AutoCourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AutoCourierRow | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const visibilityTick = useVisibilityTick();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
    phone: '',
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleWidthM: '',
    login: '',
    password: '',
    telegramChatId: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      const u = new URLSearchParams({ branchId });
      const res = await fetch(`${baseUrl}/auto-couriers?${u}`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setList([]);
        toast.error(data.error || 'Yuklashda xatolik');
        return;
      }
      setList(Array.isArray(data.couriers) ? data.couriers : []);
    } catch {
      setList([]);
      toast.error('Serverga ulanishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [branchId, visibilityTick]);

  const openNew = () => {
    setEditing(null);
    setForm({
      firstName: '',
      lastName: '',
      birthDate: '',
      gender: '',
      phone: '',
      vehiclePlate: '',
      vehicleBrand: '',
      vehicleWidthM: '',
      login: '',
      password: '',
      telegramChatId: '',
    });
    setModal(true);
  };

  const openEdit = (c: AutoCourierRow) => {
    setEditing(c);
    setForm({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      birthDate: c.birthDate || '',
      gender: c.gender || '',
      phone: c.phone || '',
      vehiclePlate: c.vehiclePlate || '',
      vehicleBrand: c.vehicleBrand || '',
      vehicleWidthM:
        c.vehicleWidthM !== undefined && c.vehicleWidthM !== null
          ? String(c.vehicleWidthM)
          : '',
      login: c.login || '',
      password: '',
      telegramChatId: c.telegramChatId || '',
    });
    setModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.phone.trim() || !form.vehiclePlate.trim()) {
      toast.error('Ism, telefon va davlat raqami majburiy');
      return;
    }
    if (!editing && (!form.login.trim() || !form.password.trim())) {
      toast.error('Yangi kuryer uchun login va parol majburiy');
      return;
    }

    setSubmitBusy(true);
    try {
      const body: Record<string, unknown> = {
        branchId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthDate: form.birthDate.trim(),
        gender: form.gender.trim(),
        phone: form.phone.trim(),
        vehiclePlate: form.vehiclePlate.trim(),
        vehicleBrand: form.vehicleBrand.trim(),
        vehicleWidthM: Math.max(0, Number(form.vehicleWidthM) || 0),
        login: form.login.trim(),
        telegramChatId: form.telegramChatId.trim(),
      };
      if (editing) {
        if (form.password.trim()) body.password = form.password.trim();
      } else {
        body.password = form.password.trim();
      }

      const url = editing
        ? `${baseUrl}/auto-couriers/${editing.id}`
        : `${baseUrl}/auto-couriers`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Saqlashda xatolik');
        return;
      }
      toast.success(editing ? 'Yangilandi' : 'Qo‘shildi');
      setModal(false);
      void load();
    } catch {
      toast.error('So‘rov yuborilmadi');
    } finally {
      setSubmitBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Avto-kuryerni o‘chirishni tasdiqlaysizmi?')) return;
    setDeleteBusyId(id);
    try {
      const u = new URLSearchParams({ branchId });
      const res = await fetch(`${baseUrl}/auto-couriers/${id}?${u}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'O‘chirishda xatolik');
        return;
      }
      toast.success('O‘chirildi');
      void load();
    } catch {
      toast.error('So‘rov yuborilmadi');
    } finally {
      setDeleteBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-7 h-7" style={{ color: accentColor.color }} />
            Avto-kuryerlar
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
          >
            Katta yuk / og‘ir ijara buyurtmalari. Kirish:{' '}
            <span className="font-mono">/avtokuryer</span> — alohida bot uchun{' '}
            <span className="font-mono">TELEGRAM_AUTO_COURIER_BOT_TOKEN</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl flex items-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            }}
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            Yangilash
          </button>
          <button
            type="button"
            onClick={openNew}
            disabled={loading || deleteBusyId !== null}
            className="px-5 py-2.5 rounded-2xl font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accentColor.color, color: '#fff' }}
          >
            <Plus className="w-5 h-5" />
            Qo‘shish
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-10 h-10 animate-spin opacity-40" />
        </div>
      ) : list.length === 0 ? (
        <div
          className="rounded-3xl border p-10 text-center"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
          }}
        >
          <p>Hali avto-kuryer yo‘q. «Qo‘shish» orqali yarating.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl border p-5 space-y-3 transition hover:scale-[1.01]"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
                  : 'linear-gradient(145deg, #fff, #f9fafb)',
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-bold text-lg">
                    {c.firstName} {c.lastName || ''}
                  </p>
                  <p
                    className="text-xs font-mono mt-0.5"
                    style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                  >
                    {c.login}
                  </p>
                </div>
                <span
                  className="text-[10px] uppercase px-2 py-0.5 rounded-lg font-semibold"
                  style={{
                    background:
                      c.status === 'active'
                        ? 'rgba(16,185,129,0.2)'
                        : 'rgba(148,163,184,0.25)',
                  }}
                >
                  {c.status || '—'}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 opacity-60" />
                  {c.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 opacity-60" />
                  {c.vehiclePlate}
                  {c.vehicleBrand ? ` · ${c.vehicleBrand}` : ''}
                </div>
                {c.telegramChatId ? (
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 opacity-60" />
                    <span className="font-mono text-xs">{c.telegramChatId}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  disabled={deleteBusyId !== null}
                  className="flex-1 py-2 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    color: accentColor.color,
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                  Tahrirlash
                </button>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  disabled={deleteBusyId !== null}
                  className="py-2 px-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                >
                  {deleteBusyId === c.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => {
            if (!submitBusy) setModal(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6 border"
            style={{
              background: isDark ? '#141414' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <KeyRound className="w-5 h-5" style={{ color: accentColor.color }} />
                {editing ? 'Tahrirlash' : 'Yangi avto-kuryer'}
              </h3>
              <button
                type="button"
                onClick={() => setModal(false)}
                disabled={submitBusy}
                className="p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {[
                ['firstName', 'Ism *'],
                ['lastName', 'Familiya'],
                ['birthDate', 'Tug‘ilgan kun', 'date'],
                ['gender', 'Jins'],
                ['phone', 'Telefon *'],
                ['vehiclePlate', 'Davlat raqami *'],
                ['vehicleBrand', 'Marka / model'],
                ['vehicleWidthM', 'Kenglik (m)'],
                ['login', 'Login *'],
                ['password', editing ? 'Yangi parol (bo‘sh = o‘zgartirmaslik)' : 'Parol *', 'password'],
                ['telegramChatId', 'Telegram chat ID'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input
                    type={(type as string) || 'text'}
                    value={form[key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    disabled={submitBusy}
                    className="w-full px-3 py-2.5 rounded-xl outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    }}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  disabled={submitBusy}
                  className="flex-1 py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                >
                  Bekor
                </button>
                <button
                  type="submit"
                  disabled={submitBusy}
                  className="flex-1 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: accentColor.color, color: '#fff' }}
                >
                  {submitBusy && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                  {submitBusy ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
