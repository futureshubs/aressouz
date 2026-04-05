import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Store, Lock, User, ArrowLeft, Building2, ChevronRight } from 'lucide-react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

type StaffRole = 'warehouse' | 'operator' | 'cashier' | 'accountant' | 'support';

const roleToDashboardPath: Partial<Record<StaffRole, string>> = {
  warehouse: '/omborchi/dashboard',
  // Operator panel olib tashlandi: operator user support UI'da ishlaydi.
  operator: '/support/dashboard',
  support: '/support/dashboard',
  // accountant handled by existing bogalter flow
  cashier: '/kassa/dashboard',
};

export default function StaffLogin({ requiredRole }: { requiredRole?: StaffRole }) {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [needsBranchSelect, setNeedsBranchSelect] = useState(false);
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useVisibilityRefetch(() => {
    const acc = localStorage.getItem('accountantSession');
    if (acc) {
      if (!requiredRole || requiredRole === 'accountant') {
        navigate('/bogalter/dashboard');
      }
      return;
    }
    const staffRaw = localStorage.getItem('staffSession');
    if (!staffRaw) return;
    try {
      const parsed = JSON.parse(staffRaw);
      const role = parsed.role as StaffRole;
      if (requiredRole && role !== requiredRole) return;
      const dash = roleToDashboardPath[role] || '/xodim/dashboard';
      navigate(dash);
    } catch {
      /* ignore */
    }
  });

  const submit = async (branchId?: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/staff/login`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ login, password, branchId: branchId || '' }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data?.success) {
        // Bogalter flow uchun 200(success:true) qaytarilishi mumkin
        if (data?.needsBranchSelect) {
          setNeedsBranchSelect(true);
          setBranchOptions(data.branchOptions || []);
          setSelectedBranchId((data.branchOptions?.[0]?.id as string) || '');
          return;
        }

        toast.error(data?.error || 'Kirishda xatolik');
        return;
      }

      const role = data.role as StaffRole;

      if (requiredRole && role !== requiredRole) {
        toast.error(`Siz ${requiredRole} emas, ${role} rol bilan kirdingiz. Shu panel uchun login/parol boshqa bo'lishi kerak.`);
        return;
      }

      if (role === 'accountant') {
        localStorage.setItem(
          'accountantSession',
          JSON.stringify({
            token: data.token,
            branchId: data.branch?.id,
          })
        );
        toast.success('Bogalter paneliga kirdingiz');
        navigate('/bogalter/dashboard');
        return;
      }

      // Other staff roles
      localStorage.setItem(
        'staffSession',
        JSON.stringify({
          token: data.token || null,
          role: data.role,
          staffId: data.staff?.id,
          firstName: data.staff?.firstName,
          lastName: data.staff?.lastName,
          phone: data.staff?.phone,
          branchId: data.branch?.id,
        })
      );

      // Make branchSession available so branch components work (X-Branch-Token)
      localStorage.setItem(
        'branchSession',
        JSON.stringify({
          ...(data.branch || {}),
          token: data.branchToken,
        })
      );

      const dash = roleToDashboardPath[role] || '/xodim/dashboard';
      navigate(dash);
    } catch (e) {
      console.error(e);
      toast.error('Serverga ulanishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!needsBranchSelect) submit();
  };

  const handleBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) {
      toast.error('Filial tanlang');
      return;
    }
    submit(selectedBranchId);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: isDark ? '#000000' : '#f9fafb' }}
    >
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Ortga
        </button>

        <div
          className="rounded-3xl p-8 border"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            boxShadow: isDark ? '0 25px 50px rgba(0, 0, 0, 0.5)' : '0 25px 50px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="text-center mb-8">
            <div
              className="inline-flex p-5 rounded-3xl mb-4"
              style={{ background: `${accentColor.color}20` }}
            >
              <Store className="w-12 h-12" style={{ color: accentColor.color }} />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {requiredRole === 'cashier' ? 'Kassa kirish' : 'Xodim paneli'}
            </h1>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              {requiredRole === 'cashier'
                ? 'Filialda ro‘yxatdan o‘tgan kassa login va paroli (noto‘g‘ri bo‘lsa kira olmaysiz)'
                : 'Omborchi, support, bogalter va boshqa rollar'}
            </p>
          </div>

          {!needsBranchSelect ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Login</label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                  />
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Login"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Parol</label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Parol"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold transition-all active:scale-98 disabled:opacity-50"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 10px 30px ${accentColor.color}40`,
                }}
              >
                {loading ? 'Kutilmoqda...' : 'Kirish'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleBranchSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Building2 />
                  <div>
                    <div className="font-semibold">Filial tanlang</div>
                    <div className="text-xs" style={{ opacity: 0.7 }}>Bogalter paneli uchun</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Filial</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-4 py-4 rounded-2xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                >
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold transition-all active:scale-98 disabled:opacity-50"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 10px 30px ${accentColor.color}40`,
                }}
              >
                {loading ? 'Kutilmoqda...' : 'Davom etish'}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

