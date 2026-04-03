import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'sonner';
import { projectId } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { Users, Plus, LogOut, Search, Filter, Trash2, Key, User, Phone, MapPin, Shield, Calendar } from 'lucide-react';

type StaffRole = 'warehouse' | 'operator' | 'cashier' | 'accountant' | 'support';

const roleLabel: Record<StaffRole, string> = {
  warehouse: '1. Omborchi',
  operator: '2. Operator',
  cashier: '3. Kassa',
  accountant: '4. Bogalter',
  support: '5. Support',
};

type StaffRecord = {
  id: string;
  branchId: string;
  role: StaffRole;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  login?: string;
  createdAt?: string;
};

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
  });

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
        { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) }
      );
      const raw = await res.text().catch(() => '');
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        // HTML/oddiy text qaytsa, parse qilib bo'lmaydi.
        // Status/preview bilan aniqroq xabar beramiz.
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

  const register = async (e: React.FormEvent) => {
    e.preventDefault();

    const required = ['firstName', 'lastName', 'phone', 'address', 'birthDate', 'login', 'password'];
    for (const key of required) {
      // @ts-ignore
      if (!String(form[key] || '').trim()) {
        toast.error('Iltimos, barcha majburiy maydonlarni to‘ldiring');
        return;
      }
    }

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/staff/register`,
        {
          method: 'POST',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            role: form.role,
            login: form.login,
            password: form.password,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            address: form.address,
            gender: form.gender,
            birthDate: form.birthDate,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Register failed');
      }

      toast.success('Xodim qabul qilindi');
      setForm((p) => ({
        ...p,
        login: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        birthDate: '',
      }));
      await loadStaff();
    } catch (e: any) {
      console.error(e);
      toast.error(dataErrorMessage(e, 'Xodim ro‘yxatga olishda xatolik'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1" style={{ color: isDark ? '#ffffff' : '#111827' }}>
            Xodimlar bo‘limi
          </h3>
          <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
            Omborchi, Operator, Kassa, Bogalter va Support
          </p>
        </div>
      </div>

      <form onSubmit={register} className="p-6 rounded-3xl border" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl" style={{ background: `${accentColor.color}20` }}>
            <Plus />
          </div>
          <div>
            <div className="font-semibold">Yangi xodim qo‘shish</div>
            <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              Ma’lumotlarni to‘ldiring va ro‘yxatga qabul qiling
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
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
            >
              <option value="warehouse">1. Omborchi</option>
              <option value="operator">2. Operator</option>
              <option value="cashier">3. Kassa</option>
              <option value="accountant">4. Bogalter</option>
              <option value="support">5. Support</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Login</span>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ opacity: 0.5 }} />
              <input
                value={form.login}
                onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none"
                placeholder="login"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
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
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
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
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
            />
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Familya</span>
            <input
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border outline-none"
              placeholder="familya"
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
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
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
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
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>

          <label className="text-sm font-medium">
            <span style={{ display: 'block', marginBottom: 6 }}>Jins</span>
            <select
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border outline-none"
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
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
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
              />
            </div>
          </label>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            className="w-full py-4 rounded-2xl font-semibold transition-all active:scale-95"
            style={{ background: accentColor.gradient, color: '#ffffff' }}
          >
            Ro‘yxatga qabul qilish
          </button>
        </div>
      </form>

      <div className="p-6 rounded-3xl border" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl" style={{ background: `${accentColor.color}20` }}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold">Xodimlar ro‘yxati ({filteredStaff.length})</div>
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
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
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-4 py-2 rounded-xl border outline-none"
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', color: isDark ? '#fff' : '#111827' }}
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
          <div style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Yuklanmoqda...</div>
        ) : filteredStaff.length === 0 ? (
          <div style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Hali xodim yo‘q</div>
        ) : (
          <div className="space-y-3">
            {filteredStaff.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl border"
                style={{ background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {s.firstName} {s.lastName}
                  </div>
                  <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
                    {roleLabel[s.role]} • {s.phone}
                  </div>
                </div>

                <div className="text-right text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                  {s.login ? `login: ${s.login}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

