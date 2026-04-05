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
    try {
      const session = JSON.parse(localStorage.getItem('accountantSession') || 'null');
      if (!session?.token) {
        navigate('/bogalter');
        return;
      }
    } catch {
      navigate('/bogalter');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accountantSession');
    toast.success('Bogalterdan chiqildi');
    navigate('/bogalter');
  };

  return (
    <div
      className="app-panel-viewport app-safe-pad"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <div className="app-panel-main-scroll p-4 lg:p-8 max-w-6xl mx-auto min-h-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
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

