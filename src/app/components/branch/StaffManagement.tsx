import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'sonner';
import { projectId } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import {
  Users,
  Plus,
  Search,
  Filter,
  Trash2,
  Key,
  User,
  Phone,
  MapPin,
  Shield,
  Calendar,
  Edit2,
  Clock,
  DollarSign,
  Loader2,
  X,
} from 'lucide-react';

type StaffRole = 'warehouse' | 'operator' | 'cashier' | 'accountant' | 'support';

const roleLabel: Record<StaffRole, string> = {
  warehouse: '1. Omborchi',
  operator: '2. Operator',
  cashier: '3. Kassa',
  accountant: '4. Bogalter',
  support: '5. Support',
};

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Du' },
  { key: 'tue', label: 'Se' },
  { key: 'wed', label: 'Ch' },
  { key: 'thu', label: 'Pa' },
  { key: 'fri', label: 'Ju' },
  { key: 'sat', label: 'Sha' },
  { key: 'sun', label: 'Ya' },
];

type StaffWorkSchedule = { start: string; end: string; days: string[] };

type StaffRecord = {
  id: string;
  branchId: string;
  role: StaffRole;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  login?: string;
  gender?: string;
  birthDate?: string;
  monthlySalary?: number;
  workSchedule?: StaffWorkSchedule;
  createdAt?: string;
  updatedAt?: string;
};

const defaultWorkDays = () => ['mon', 'tue', 'wed', 'thu', 'fri'];

/** `<input type="time">` ba’zi brauzerlarda bo‘sh yoki `HH:mm:ss` qaytarishi mumkin */
function normalizeWorkTimeHHMM(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return '';
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function formatWorkScheduleShort(ws?: StaffWorkSchedule) {
  if (!ws?.start || !ws?.end) return '—';
  const dayLabels = (ws.days || [])
    .map((d) => WEEKDAYS.find((w) => w.key === d)?.label || d)
    .join(', ');
  return `${ws.start}–${ws.end}${dayLabels ? ` · ${dayLabels}` : ''}`;
}

export function StaffManagement({ branchId }: { branchId: string; branchInfo?: any }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const visibilityRefetchTick = useVisibilityTick();

  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    gender: 'male',
    birthDate: '',
    role: 'warehouse' as StaffRole,
    login: '',
    password: '',
    monthlySalary: '',
    workStart: '09:00',
    workEnd: '18:00',
    workDays: defaultWorkDays(),
  });

  const [editing, setEditing] = useState<StaffRecord | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    gender: 'male',
    birthDate: '',
    role: 'warehouse' as StaffRole,
    login: '',
    newPassword: '',
    monthlySalary: '',
    workStart: '09:00',
    workEnd: '18:00',
    workDays: defaultWorkDays(),
  });

  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff
      .filter((s) => (roleFilter === 'all' ? true : s.role === roleFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q) ||
          (s.address || '').toLowerCase().includes(q) ||
          (s.login || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0));
  }, [staff, search, roleFilter]);

  const loadStaff = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/staff?branchId=${encodeURIComponent(branchId)}`,
        { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) },
      );
      const raw = await res.text().catch(() => '');
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        const preview = raw ? raw.slice(0, 200) : 'empty response';
        throw new Error(`Server javobi JSON emas. status=${res.status}, preview=${preview}`);
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Staff list fetch failed');
      }
      setStaff((data.staff || []) as StaffRecord[]);
    } catch (e: any) {
      console.error(e);
      toast.error(dataErrorMessage(e, 'Xodimlarni yuklashda xatolik'));
      setStaff([]);
    } finally {
      setIsLoading(false);
    }
  };

  const dataErrorMessage = (err: any, fallback: string) => {
    if (!err) return fallback;
    return err?.message || err?.error || fallback;
  };

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, visibilityRefetchTick]);

  const toggleWorkDay = (days: string[], key: string) =>
    days.includes(key) ? days.filter((d) => d !== key) : [...days, key].sort(
      (a, b) => WEEKDAYS.findIndex((w) => w.key === a) - WEEKDAYS.findIndex((w) => w.key === b),
    );

  const openEdit = (s: StaffRecord) => {
    const ws = s.workSchedule;
    setEditing(s);
    setEditForm({
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      address: s.address || '',
      gender: s.gender || 'male',
      birthDate: s.birthDate || '',
      role: s.role,
      login: s.login || '',
      newPassword: '',
      monthlySalary: String(s.monthlySalary ?? ''),
      workStart: ws?.start || '09:00',
      workEnd: ws?.end || '18:00',
      workDays: ws?.days?.length ? [...ws.days] : defaultWorkDays(),
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setSavingEditId(null);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    const required = ['firstName', 'lastName', 'phone', 'address', 'birthDate', 'login'] as const;
    for (const key of required) {
      if (!String(editForm[key] || '').trim()) {
        toast.error('Iltimos, barcha majburiy maydonlarni to‘ldiring');
        return;
      }
    }
    if (!editForm.workDays.length) {
      toast.error('Kamida bitta ish kuni tanlang');
      return;
    }
    const editWorkStart = normalizeWorkTimeHHMM(editForm.workStart) || '09:00';
    const editWorkEnd = normalizeWorkTimeHHMM(editForm.workEnd) || '18:00';
    const salaryNum = Number(String(editForm.monthlySalary).replace(/\s/g, '').replace(/,/g, '.'));
    if (!Number.isFinite(salaryNum) || salaryNum < 0) {
      toast.error('Oylik maosh noto‘g‘ri');
      return;
    }

    setSavingEditId(editing.id);
    try {
      const body: Record<string, unknown> = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        gender: editForm.gender,
        birthDate: editForm.birthDate,
        role: editForm.role,
        login: editForm.login.trim(),
        monthlySalary: salaryNum,
        workStart: editWorkStart,
        workEnd: editWorkEnd,
        workSchedule: {
          start: editWorkStart,
          end: editWorkEnd,
          days: editForm.workDays,
        },
      };
      if (editForm.newPassword.trim()) {
        body.password = editForm.newPassword.trim();
      }

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/staff/${encodeURIComponent(editing.id)}`,
        {
          method: 'PUT',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Yangilash muvaffaqiyatsiz');
      }
      toast.success('Xodim yangilandi');
      closeEdit();
      await loadStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(dataErrorMessage(err, 'Saqlashda xatolik'));
    } finally {
      setSavingEditId(null);
    }
  };

  const removeStaff = async (s: StaffRecord) => {
    const ok = window.confirm(
      `${s.firstName} ${s.lastName} — rostdan ham o‘chirilsinmi? Login bilan kirish ham to‘xtaydi.`,
    );
    if (!ok) return;

    setDeletingId(s.id);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/staff/${encodeURIComponent(s.id)}`,
        {
          method: 'DELETE',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'O‘chirish muvaffaqiyatsiz');
      }
      toast.success('Xodim o‘chirildi');
      if (editing?.id === s.id) closeEdit();
      await loadStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(dataErrorMessage(err, 'O‘chirishda xatolik'));
    } finally {
      setDeletingId(null);
    }
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();

    const required = ['firstName', 'lastName', 'phone', 'address', 'birthDate', 'login', 'password'] as const;
    for (const key of required) {
      if (!String(form[key] || '').trim()) {
        toast.error('Iltimos, barcha majburiy maydonlarni to‘ldiring');
        return;
      }
    }
    if (!form.workDays.length) {
      toast.error('Kamida bitta ish kuni tanlang');
      return;
    }
    const workStart = normalizeWorkTimeHHMM(form.workStart) || '09:00';
    const workEnd = normalizeWorkTimeHHMM(form.workEnd) || '18:00';
    const salaryNum = Number(String(form.monthlySalary).replace(/\s/g, '').replace(/,/g, '.'));
    if (!Number.isFinite(salaryNum) || salaryNum < 0) {
      toast.error('Oylik maoshni kiriting (0 yoki musbat son)');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/staff/register`, {
        method: 'POST',
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          role: form.role,
          login: form.login.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          gender: form.gender,
          birthDate: form.birthDate,
          monthlySalary: salaryNum,
          workStart,
          workEnd,
          workSchedule: {
            start: workStart,
            end: workEnd,
            days: form.workDays,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Register failed');
      }

      toast.success('Xodim qabul qilindi');
      setForm({
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        birthDate: '',
        gender: 'male',
        role: 'warehouse',
        login: '',
        password: '',
        monthlySalary: '',
        workStart: '09:00',
        workEnd: '18:00',
        workDays: defaultWorkDays(),
      });
      await loadStaff();
    } catch (e: any) {
      console.error(e);
      toast.error(dataErrorMessage(e, 'Xodim ro‘yxatga olishda xatolik'));
    } finally {
      setSubmittingAdd(false);
    }
  };

  const muted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1" style={{ color: isDark ? '#ffffff' : '#111827' }}>
            Xodimlar bo‘limi
          </h3>
          <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
            Omborchi, Operator, Kassa, Bogalter va Support — maosh va ish vaqti bilan
          </p>
        </div>
      </div>

      <form onSubmit={register} className="p-6 rounded-3xl border" style={{ background: cardBg, borderColor: border }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl" style={{ background: `${accentColor.color}20` }}>
            <Plus />
          </div>
          <div>
            <div className="font-semibold">Yangi xodim qo‘shish</div>
            <div className="text-xs" style={{ color: muted }}>
              Ma’lumotlar, oylik maosh va ish jadvali — serverga yoziladi
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Rol</span>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as StaffRole }))}
              className="w-full px-4 py-3 rounded-2xl border outline-none"
              style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
            >
              <option value="warehouse">1. Omborchi</option>
              <option value="operator">2. Operator</option>
              <option value="cashier">3. Kassa</option>
              <option value="accountant">4. Bogalter</option>
              <option value="support">5. Support</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Oylik maosh (so‘m)</span>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                type="text"
                inputMode="decimal"
                value={form.monthlySalary}
                onChange={(e) => setForm((p) => ({ ...p, monthlySalary: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none"
                placeholder="masalan: 3500000"
                style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>

          <label className="text-sm font-medium md:col-span-2">
            <span style={{ display: 'block', marginBottom: 6 }}>Ish vaqti</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[120px]">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
                <input
                  type="time"
                  value={form.workStart}
                  onChange={(e) => setForm((p) => ({ ...p, workStart: e.target.value }))}
                  className="w-full pl-10 pr-3 py-3 rounded-2xl border outline-none"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                />
              </div>
              <span className="text-sm" style={{ color: muted }}>
                dan
              </span>
              <div className="relative flex-1 min-w-[120px]">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
                <input
                  type="time"
                  value={form.workEnd}
                  onChange={(e) => setForm((p) => ({ ...p, workEnd: e.target.value }))}
                  className="w-full pl-10 pr-3 py-3 rounded-2xl border outline-none"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                />
              </div>
              <span className="text-sm" style={{ color: muted }}>
                gacha
              </span>
            </div>
          </label>

          <div className="text-sm font-medium md:col-span-2">
            <span style={{ display: 'block', marginBottom: 6 }}>Ish kunlari</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = form.workDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, workDays: toggleWorkDay(p.workDays, d.key) }))}
                    className="px-3 py-2 rounded-xl text-sm font-semibold border transition-colors"
                    style={{
                      background: on ? accentColor.gradient : inputBg,
                      color: on ? '#fff' : isDark ? '#fff' : '#111827',
                      borderColor: on ? 'transparent' : border,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Login</span>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                value={form.login}
                onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none"
                placeholder="login"
                style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Parol</span>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none"
                placeholder="parol"
                style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Ism</span>
            <input
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border outline-none"
              placeholder="ism"
              style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
            />
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Familya</span>
            <input
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border outline-none"
              placeholder="familya"
              style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
            />
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Telefon</span>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none"
                placeholder="+998 ..."
                style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Manzil</span>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none"
                placeholder="manzil"
                style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Jins</span>
            <select
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border outline-none"
              style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
            >
              <option value="male">Erkak</option>
              <option value="female">Ayol</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Tug‘ilgan kun</span>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((p) => ({ ...p, birthDate: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none"
                style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={submittingAdd}
            className="w-full py-4 rounded-2xl font-semibold transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: accentColor.gradient, color: '#ffffff' }}
          >
            {submittingAdd ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {submittingAdd ? 'Yuborilmoqda...' : 'Ro‘yxatga qabul qilish'}
          </button>
        </div>
      </form>

      <div className="p-6 rounded-3xl border" style={{ background: cardBg, borderColor: border }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl" style={{ background: `${accentColor.color}20` }}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold">Xodimlar ro‘yxati ({filteredStaff.length})</div>
              <div className="text-xs" style={{ color: muted }}>
                Filial bo‘yicha
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="qidirish..."
                className="w-[220px] pl-12 pr-4 py-2 rounded-xl border outline-none"
                style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | StaffRole)}
              className="px-4 py-2 rounded-xl border outline-none"
              style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
            >
              <option value="all">Barchasi</option>
              <option value="warehouse">Omborchi</option>
              <option value="operator">Operator</option>
              <option value="cashier">Kassa</option>
              <option value="accountant">Bogalter</option>
              <option value="support">Support</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: muted }}>Yuklanmoqda...</div>
        ) : filteredStaff.length === 0 ? (
          <div style={{ color: muted }}>Hali xodim yo‘q</div>
        ) : (
          <div className="space-y-3">
            {filteredStaff.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">
                    {s.firstName} {s.lastName}
                  </div>
                  <div className="text-xs mt-1" style={{ color: muted }}>
                    {roleLabel[s.role]} • {s.phone}
                    {s.login ? ` • login: ${s.login}` : ''}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs" style={{ color: muted }}>
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 shrink-0" />
                      {Number(s.monthlySalary ?? 0).toLocaleString('uz-UZ')} so‘m / oy
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {formatWorkScheduleShort(s.workSchedule)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    disabled={deletingId === s.id || savingEditId !== null}
                    className="p-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                    style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                  >
                    <Edit2 className="w-4 h-4" />
                    Tahrirlash
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeStaff(s)}
                    disabled={deletingId !== null || savingEditId !== null}
                    className="p-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 text-red-600 disabled:opacity-50"
                    style={{
                      background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                      borderColor: 'rgba(239,68,68,0.35)',
                    }}
                  >
                    {deletingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-edit-title"
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border p-5 shadow-xl"
            style={{ background: isDark ? '#1a1b1e' : '#ffffff', borderColor: border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h4 id="staff-edit-title" className="text-lg font-bold">
                Xodimni tahrirlash
              </h4>
              <button
                type="button"
                onClick={closeEdit}
                className="p-2 rounded-xl border"
                style={{ borderColor: border }}
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4">
              <label className="text-sm font-medium block">
                <span className="block mb-1">Rol</span>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as StaffRole }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                >
                  <option value="warehouse">Omborchi</option>
                  <option value="operator">Operator</option>
                  <option value="cashier">Kassa</option>
                  <option value="accountant">Bogalter</option>
                  <option value="support">Support</option>
                </select>
              </label>

              <label className="text-sm font-medium block">
                <span className="block mb-1">Oylik maosh (so‘m)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editForm.monthlySalary}
                  onChange={(e) => setEditForm((p) => ({ ...p, monthlySalary: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                />
              </label>

              <div className="text-sm font-medium">
                <span className="block mb-2">Ish vaqti</span>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="time"
                    value={editForm.workStart}
                    onChange={(e) => setEditForm((p) => ({ ...p, workStart: e.target.value }))}
                    className="px-3 py-2 rounded-xl border outline-none"
                    style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                  />
                  <span style={{ color: muted }}>—</span>
                  <input
                    type="time"
                    value={editForm.workEnd}
                    onChange={(e) => setEditForm((p) => ({ ...p, workEnd: e.target.value }))}
                    className="px-3 py-2 rounded-xl border outline-none"
                    style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                  />
                </div>
              </div>

              <div className="text-sm font-medium">
                <span className="block mb-2">Ish kunlari</span>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => {
                    const on = editForm.workDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() =>
                          setEditForm((p) => ({ ...p, workDays: toggleWorkDay(p.workDays, d.key) }))
                        }
                        className="px-3 py-2 rounded-xl text-sm font-semibold border"
                        style={{
                          background: on ? accentColor.gradient : inputBg,
                          color: on ? '#fff' : isDark ? '#fff' : '#111827',
                          borderColor: on ? 'transparent' : border,
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="text-sm font-medium block">
                <span className="block mb-1">Login</span>
                <input
                  value={editForm.login}
                  onChange={(e) => setEditForm((p) => ({ ...p, login: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                />
              </label>

              <label className="text-sm font-medium block">
                <span className="block mb-1">Yangi parol (ixtiyoriy)</span>
                <input
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  placeholder="Bo‘sh qoldiring — parol o‘zgarmaydi"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  <span className="block mb-1">Ism</span>
                  <input
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                  />
                </label>
                <label className="text-sm font-medium">
                  <span className="block mb-1">Familya</span>
                  <input
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                  />
                </label>
              </div>

              <label className="text-sm font-medium block">
                <span className="block mb-1">Telefon</span>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                />
              </label>

              <label className="text-sm font-medium block">
                <span className="block mb-1">Manzil</span>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  <span className="block mb-1">Jins</span>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                  >
                    <option value="male">Erkak</option>
                    <option value="female">Ayol</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  <span className="block mb-1">Tug‘ilgan kun</span>
                  <input
                    type="date"
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, birthDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{ background: inputBg, borderColor: border, color: isDark ? '#fff' : '#111827' }}
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 py-3 rounded-2xl font-semibold border"
                  style={{ borderColor: border }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={savingEditId !== null}
                  className="flex-1 py-3 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: accentColor.gradient }}
                >
                  {savingEditId ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
