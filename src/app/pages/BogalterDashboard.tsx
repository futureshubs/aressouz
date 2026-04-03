import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { BogalterMarketView } from '../components/branch/BogalterMarketView';

export default function BogalterDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    // Ba'zi modallar "body" overflow-ni `hidden` qilib qo'yishi mumkin.
    // Bogalter panelga kirilganda scroll doim ishlashi uchun reset qilamiz.
    const prevOverflow = document.body.style.overflow;
    const prevOverflowY = (document.body.style as any).overflowY;
    document.body.style.overflow = 'auto';
    (document.body.style as any).overflowY = 'auto';

    try {
      const session = JSON.parse(localStorage.getItem('accountantSession') || 'null');
      if (!session?.token) {
        navigate('/bogalter');
        return;
      }
    } catch {
      navigate('/bogalter');
    }

    return () => {
      document.body.style.overflow = prevOverflow || '';
      (document.body.style as any).overflowY = prevOverflowY || '';
    };
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accountantSession');
    toast.success('Bogalterdan chiqildi');
    navigate('/bogalter');
  };

  return (
    <div
      className="min-h-dvh"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}
    >
      <div className="p-4 lg:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Bogalter panel</h1>
            <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
              Oxirgi 1 soatlik savdo va ombor operatsiyalarini aniqlik bilan ko'ring
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl font-semibold transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              color: isDark ? '#fff' : '#111827',
            }}
          >
            Chiqish
          </button>
        </div>

        <BogalterMarketView />
      </div>
    </div>
  );
}

