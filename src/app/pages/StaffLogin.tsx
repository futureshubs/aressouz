import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { publicAnonKey } from '../../../utils/supabase/info';
import { edgeFunctionBaseUrl } from '../utils/edgeFunctionBaseUrl';
import { Lock, User, Building2, ChevronRight, Loader2 } from 'lucide-react';
import PanelLoginShell from '../components/brand/PanelLoginShell';
import type { AressoPanelVariant } from '../components/brand/AressoPanelBrand';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

type StaffRole = 'warehouse' | 'operator' | 'cashier' | 'accountant' | 'support';

function staffLoginVariant(role?: StaffRole): AressoPanelVariant {
  if (role === 'cashier') return 'kassa';
  if (role === 'warehouse') return 'omborchi';
  if (role === 'operator' || role === 'support') return 'support';
  if (role === 'accountant') return 'bogalter';
  return 'xodim';
}

function staffLoginSubtitle(role?: StaffRole): string {
  if (role === 'cashier') return 'Filial kassasi — login va parol';
  if (role === 'warehouse') return 'Ombor operatsiyalari';
  if (role === 'operator' || role === 'support') return 'Mijozlar bilan support chat';
  return 'Omborchi, support, bogalter va boshqa rollar';
}

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

  const tryRedirectExistingStaffSession = useCallback(() => {
    const acc = localStorage.getItem('accountantSession');
    if (acc) {
      if (!requiredRole || requiredRole === 'accountant') {
        navigate('/bogalter/dashboard', { replace: true });
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
      navigate(dash, { replace: true });
    } catch {
      /* ignore */
    }
  }, [navigate, requiredRole]);

  useEffect(() => {
    tryRedirectExistingStaffSession();
  }, [tryRedirectExistingStaffSession]);

  useVisibilityRefetch(() => {
    tryRedirectExistingStaffSession();
  });

  const submit = async (branchId?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${edgeFunctionBaseUrl()}/staff/login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, password, branchId: branchId || '' }),
      });

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
      const branchToken = String(data.branchToken || '').trim();
      const staffToken = String(data.token || data.staffToken || '').trim();

      localStorage.setItem(
        'staffSession',
        JSON.stringify({
          token: staffToken || null,
          staffToken: staffToken || null,
          branchToken: branchToken || null,
          role: data.role,
          staffId: data.staff?.id,
          firstName: data.staff?.firstName,
          lastName: data.staff?.lastName,
          phone: data.staff?.phone,
          branchId: data.branch?.id || data.branch?.branchId,
        })
      );

      // Filial komponentlari (kassa, ombor) — X-Branch-Token + X-Staff-Token
      localStorage.setItem(
        'branchSession',
        JSON.stringify({
          ...(data.branch || {}),
          id: data.branch?.id || data.branch?.branchId,
          branchId: data.branch?.branchId || data.branch?.id,
          token: branchToken,
          branchToken,
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
    <PanelLoginShell
      variant={staffLoginVariant(requiredRole)}
      isDark={isDark}
      accentColor={accentColor.color}
      subtitle={staffLoginSubtitle(requiredRole)}
    >
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
                className="w-full py-4 rounded-2xl font-bold transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 10px 30px ${accentColor.color}40`,
                }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
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
                className="w-full py-4 rounded-2xl font-bold transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 10px 30px ${accentColor.color}40`,
                }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                {loading ? 'Kutilmoqda...' : 'Davom etish'}
                {!loading && <ChevronRight className="w-4 h-4 shrink-0" />}
              </button>
            </form>
          )}
    </PanelLoginShell>
  );
}

