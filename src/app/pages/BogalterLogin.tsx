import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Store, Lock, User, ArrowLeft, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

export default function BogalterLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({ login: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [needsBranchSelect, setNeedsBranchSelect] = useState(false);
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useVisibilityRefetch(() => {
    const session = localStorage.getItem('accountantSession');
    if (session) {
      navigate('/bogalter/dashboard');
    }
  });

  const handleSubmit = async (branchId?: string) => {
    if (!formData.login || !formData.password) {
      toast.error('Login va parol majburiy!');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/staff/login`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            login: formData.login,
            password: formData.password,
            branchId: branchId || '',
          }),
        }
      );

      const data = await response.json();

      if (data?.needsBranchSelect) {
        setNeedsBranchSelect(true);
        setBranchOptions(data.branchOptions || []);
        setSelectedBranchId((data.branchOptions?.[0]?.id as string) || '');
        return;
      }

      if (response.ok && data.success && data.token) {
        localStorage.setItem(
          'accountantSession',
          JSON.stringify({
            token: data.token,
            branchId: data.branch?.id,
            branchName: data.branch?.branchName || data.branch?.name || '',
          })
        );

        toast.success(data.message || 'Bogalter muvaffaqiyatli kirildi');
        navigate('/bogalter/dashboard');
        return;
      }

      toast.error(data.error || 'Kirishda xatolik');
    } catch (error) {
      console.error('Bogalter login error:', error);
      toast.error('Serverga ulanishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
      }}
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
            color: isDark ? '#ffffff' : '#111827',
          }}
        >
          <div className="text-center mb-8">
            <div
              className="inline-flex p-5 rounded-3xl mb-4"
              style={{ background: `${accentColor.color}20` }}
            >
              <Store className="w-12 h-12" style={{ color: accentColor.color }} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Bogalter Panel</h1>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Filial sotuv/ombor tarixini ko'rish
            </p>
          </div>

          {!needsBranchSelect ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Login</label>
              <div className="relative">
                <User
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData((p) => ({ ...p, login: e.target.value }))}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                  placeholder="Login"
                  disabled={isLoading}
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
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                  placeholder="Parol"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl font-bold transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 10px 30px ${accentColor.color}40`,
              }}
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
              {isLoading ? 'Kutilmoqda...' : 'Kirish'}
            </button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(selectedBranchId); }} className="space-y-4">
              <div className="p-4 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Building2 />
                  <div>
                    <div className="font-semibold">Filial tanlang</div>
                    <div className="text-xs" style={{ opacity: 0.7 }}>Bogalter paneli uchun</div>
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium">Filial</label>
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl font-bold transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 10px 30px ${accentColor.color}40`,
                }}
              >
                {isLoading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                {isLoading ? 'Kutilmoqda...' : 'Davom etish'}
                {!isLoading && <ChevronRight className="w-4 h-4 shrink-0" />}
              </button>
            </form>
          )}

          <div
            className="mt-6 p-4 rounded-2xl text-sm text-center"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
            }}
          >
            Bogalter login/parioldan foydalaning.
          </div>
        </div>
      </div>
    </div>
  );
}

