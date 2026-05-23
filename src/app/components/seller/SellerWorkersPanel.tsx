import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import {
  Users,
  Plus,
  Search,
  Trash2,
  Key,
  User,
  Phone,
  Edit2,
  DollarSign,
  Percent,
  Loader2,
  X,
  TrendingUp,
  UserCheck,
  Briefcase,
  BadgeCheck,
} from 'lucide-react';

type PayType = 'monthly' | 'commission';

type StaffStats = {
  saleCount: number;
  totalUzs: number;
  todayCount: number;
  todayUzs: number;
  commissionEarned?: number;
};

type ShopStaff = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  gender: 'male' | 'female';
  payType: PayType;
  monthlySalary?: number;
  commissionPercent?: number;
  startDate?: string;
  login: string;
  active: boolean;
  createdAt?: string;
  stats?: StaffStats;
};

type StaffSummary = {
  total: number;
  active: number;
  monthly: number;
  commission: number;
  todaySalesUzs: number;
};

type Props = {
  token: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
};

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  phone: '',
  age: '',
  gender: 'male' as 'male' | 'female',
  payType: 'monthly' as PayType,
  monthlySalary: '',
  commissionPercent: '',
  startDate: '',
  login: '',
  password: '',
});

function formatUzs(n: number) {
  return `${Math.round(n || 0).toLocaleString('uz-UZ')} so'm`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('uz-UZ');
  } catch {
    return iso;
  }
}

export default function SellerWorkersPanel({ token, isDark, accentColor }: Props) {
  const visibilityTick = useVisibilityTick();

  const [staff, setStaff] = useState<ShopStaff[]>([]);
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState<'all' | PayType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShopStaff | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Seller-Token': token,
    }),
    [token],
  );

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/staff`;

  const loadStaff = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}?token=${encodeURIComponent(token)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Ishchilarni yuklashda xatolik');
      }
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setSummary(data.summary || null);
    } catch (e: any) {
      toast.error(e?.message || 'Ishchilarni yuklashda xatolik');
      setStaff([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers, token]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff, visibilityTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff
      .filter((s) => (payFilter === 'all' ? true : s.payType === payFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q) ||
          s.login.toLowerCase().includes(q)
        );
      });
  }, [staff, search, payFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (s: ShopStaff) => {
    setEditing(s);
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      age: String(s.age || ''),
      gender: s.gender || 'male',
      payType: s.payType,
      monthlySalary: s.monthlySalary ? String(s.monthlySalary) : '',
      commissionPercent: s.commissionPercent ? String(s.commissionPercent) : '',
      startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      login: s.login,
      password: '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const validateForm = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      toast.error('Ism, familiya va telefon majburiy');
      return false;
    }
    if (!form.login.trim()) {
      toast.error('Login kiriting');
      return false;
    }
    if (!editing && !form.password.trim()) {
      toast.error('Parol kiriting');
      return false;
    }
    const age = Math.floor(Number(form.age));
    if (!Number.isFinite(age) || age <= 0) {
      toast.error('Yosh to\'g\'ri kiriting');
      return false;
    }
    if (form.payType === 'monthly') {
      if (!form.startDate) {
        toast.error('Ish boshlangan sanani kiriting');
        return false;
      }
      if (Math.floor(Number(form.monthlySalary)) <= 0) {
        toast.error('Oylik maosh kiriting');
        return false;
      }
    }
    if (form.payType === 'commission' && Math.floor(Number(form.commissionPercent)) <= 0) {
      toast.error('Savdodan foiz kiriting');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        age: Math.floor(Number(form.age)),
        gender: form.gender,
        payType: form.payType,
        login: form.login.trim(),
      };
      if (form.payType === 'monthly') {
        payload.monthlySalary = Math.floor(Number(form.monthlySalary));
        payload.startDate = form.startDate;
      } else {
        payload.commissionPercent = Math.floor(Number(form.commissionPercent));
      }
      if (form.password.trim()) payload.password = form.password.trim();

      const url = editing ? `${apiBase}/${encodeURIComponent(editing.id)}?token=${encodeURIComponent(token)}` : `${apiBase}?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Saqlashda xatolik');
      }
      toast.success(data.message || (editing ? 'Yangilandi' : 'Ishchi qo\'shildi'));
      closeModal();
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'Saqlashda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ishchini o\'chirmoqchimisiz?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'O\'chirishda xatolik');
      }
      toast.success('Ishchi o\'chirildi');
      await loadStaff();
    } catch (err: any) {
      toast.error(err?.message || 'O\'chirishda xatolik');
    } finally {
      setDeletingId(null);
    }
  };

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)';

  const statCards = [
    { label: 'Jami ishchilar', value: summary?.total ?? 0, icon: Users, color: accentColor.color },
    { label: 'Faol', value: summary?.active ?? 0, icon: UserCheck, color: '#22c55e' },
    { label: 'Oylik maosh', value: summary?.monthly ?? 0, icon: Briefcase, color: '#3b82f6' },
    { label: 'Ishbay (foiz)', value: summary?.commission ?? 0, icon: Percent, color: '#f59e0b' },
    { label: 'Bugungi savdo', value: formatUzs(summary?.todaySalesUzs ?? 0), icon: TrendingUp, color: '#8b5cf6', isText: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Ishchilar</h2>
          <p className="text-sm mt-1" style={{ color: muted }}>
            Do'kon ishchilarini boshqaring — login/parol bilan faqat Savdo va Buyurtmalar
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg"
          style={{ background: accentColor.gradient }}
        >
          <Plus className="w-4 h-4" />
          Ishchi qo'shish
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border p-4"
              style={{ background: cardBg, borderColor: border }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: muted }}>{card.label}</span>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <div className="text-lg font-bold truncate" style={{ color: card.isText ? card.color : undefined }}>
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-2xl border p-4 flex flex-col sm:flex-row gap-3"
        style={{ background: cardBg, borderColor: border }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: muted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, telefon yoki login..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
              borderColor: border,
              color: isDark ? '#fff' : '#111827',
            }}
          />
        </div>
        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value as 'all' | PayType)}
          className="px-4 py-2.5 rounded-xl border text-sm"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
            borderColor: border,
            color: isDark ? '#fff' : '#111827',
          }}
        >
          <option value="all">Barcha turi</option>
          <option value="monthly">Oylik maosh</option>
          <option value="commission">Ishbay (foiz)</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{ background: cardBg, borderColor: border }}
        >
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Ishchilar topilmadi</p>
          <p className="text-sm mt-1" style={{ color: muted }}>Yangi ishchi qo'shing</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border p-4 sm:p-5"
              style={{ background: cardBg, borderColor: border }}
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <User className="w-6 h-6" style={{ color: accentColor.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base">
                        {s.firstName} {s.lastName}
                      </h3>
                      <span
                        className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: s.active !== false ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: s.active !== false ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {s.active !== false ? 'Faol' : 'Nofaol'}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                      >
                        {s.payType === 'monthly' ? 'Oylik' : 'Ishbay'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm" style={{ color: muted }}>
                      <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{s.phone}</span>
                      <span>{s.gender === 'female' ? 'Ayol' : 'Erkak'} · {s.age} yosh</span>
                      <span className="inline-flex items-center gap-1"><Key className="w-3.5 h-3.5" />{s.login}</span>
                    </div>
                    <div className="mt-2 text-sm">
                      {s.payType === 'monthly' ? (
                        <span className="inline-flex items-center gap-1" style={{ color: accentColor.color }}>
                          <DollarSign className="w-3.5 h-3.5" />
                          {formatUzs(s.monthlySalary || 0)} / oy
                          {s.startDate ? (
                            <span style={{ color: muted }}> · {formatDate(s.startDate)} dan</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1" style={{ color: '#f59e0b' }}>
                          <Percent className="w-3.5 h-3.5" />
                          Savdodan {s.commissionPercent}%
                          {s.stats?.commissionEarned ? (
                            <span style={{ color: muted }}> · Jami: {formatUzs(s.stats.commissionEarned)}</span>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 w-full lg:w-auto">
                    <MiniStat label="Savdolar" value={String(s.stats?.saleCount ?? 0)} isDark={isDark} />
                    <MiniStat label="Jami" value={formatUzs(s.stats?.totalUzs ?? 0)} isDark={isDark} small />
                    <MiniStat label="Bugun" value={String(s.stats?.todayCount ?? 0)} isDark={isDark} />
                    <MiniStat label="Bugun summa" value={formatUzs(s.stats?.todayUzs ?? 0)} isDark={isDark} small />
                  </div>
                  <div className="flex gap-2 w-full lg:w-auto">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm"
                      style={{ borderColor: border }}
                    >
                      <Edit2 className="w-4 h-4" />
                      Tahrirlash
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(s.id)}
                      disabled={deletingId === s.id}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm text-red-500"
                      style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      {deletingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 app-modal-overlay" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div
            className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border p-5 sm:p-6"
            style={{ background: isDark ? '#111' : '#fff', borderColor: border }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{editing ? 'Ishchini tahrirlash' : 'Yangi ishchi'}</h3>
              <button type="button" onClick={closeModal} className="p-2 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ism" value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} isDark={isDark} border={border} />
                <Field label="Familiya" value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} isDark={isDark} border={border} />
              </div>
              <Field label="Telefon" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} isDark={isDark} border={border} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Yosh" type="number" value={form.age} onChange={(v) => setForm((f) => ({ ...f, age: v }))} isDark={isDark} border={border} />
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: muted }}>Jins</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as 'male' | 'female' }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderColor: border, color: isDark ? '#fff' : '#111' }}
                  >
                    <option value="male">Erkak</option>
                    <option value="female">Ayol</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: muted }}>To'lov turi</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['monthly', 'commission'] as PayType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, payType: type }))}
                      className="px-3 py-2.5 rounded-xl border text-sm font-medium"
                      style={{
                        borderColor: form.payType === type ? accentColor.color : border,
                        background: form.payType === type ? `${accentColor.color}18` : 'transparent',
                        color: form.payType === type ? accentColor.color : muted,
                      }}
                    >
                      {type === 'monthly' ? 'Oylik maosh' : 'Ishbay (foiz)'}
                    </button>
                  ))}
                </div>
              </div>

              {form.payType === 'monthly' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Oylik maosh (so'm)" type="number" value={form.monthlySalary} onChange={(v) => setForm((f) => ({ ...f, monthlySalary: v }))} isDark={isDark} border={border} />
                  <Field label="Ish boshlangan sana" type="date" value={form.startDate} onChange={(v) => setForm((f) => ({ ...f, startDate: v }))} isDark={isDark} border={border} />
                </div>
              ) : (
                <Field label="Savdodan foiz (%)" type="number" value={form.commissionPercent} onChange={(v) => setForm((f) => ({ ...f, commissionPercent: v }))} isDark={isDark} border={border} />
              )}

              <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: border, background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BadgeCheck className="w-4 h-4" style={{ color: accentColor.color }} />
                  Seller panel kirish
                </div>
                <Field label="Login" value={form.login} onChange={(v) => setForm((f) => ({ ...f, login: v }))} isDark={isDark} border={border} />
                <Field
                  label={editing ? 'Yangi parol (ixtiyoriy)' : 'Parol'}
                  type="password"
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                  isDark={isDark}
                  border={border}
                />
                <p className="text-xs" style={{ color: muted }}>
                  Ishchi shu login/parol bilan /seller ga kiradi — faqat Savdo va Buyurtmalar ko'rinadi
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
                style={{ background: accentColor.gradient, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {editing ? 'Saqlash' : 'Ishchi qo\'shish'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value, isDark, small }: { label: string; value: string; isDark: boolean; small?: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-2 border text-center"
      style={{
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
      }}
    >
      <div className="text-[10px] uppercase tracking-wide opacity-60">{label}</div>
      <div className={`font-semibold ${small ? 'text-xs' : 'text-sm'} truncate`}>{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  isDark,
  border,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
  border: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
          borderColor: border,
          color: isDark ? '#fff' : '#111827',
        }}
      />
    </div>
  );
}
