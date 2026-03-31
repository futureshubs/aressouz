import { useNavigate } from 'react-router';
import { ArrowLeft, Package } from 'lucide-react';
import ProfileView from '../components/ProfileView';
import { useTheme } from '../context/ThemeContext';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-black">
      <div
        className="min-h-screen"
        style={{
          background: isDark
            ? 'radial-gradient(1200px 600px at 20% 10%, rgba(20,184,166,0.12), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(59,130,246,0.10), transparent 50%), #000'
            : 'radial-gradient(1200px 600px at 20% 10%, rgba(20,184,166,0.12), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(59,130,246,0.08), transparent 50%), #f9fafb',
        }}
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="sticky top-0 z-50 px-4 pt-4">
            <div
              className="rounded-2xl border backdrop-blur-xl p-3 flex items-center gap-3"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-xl active:scale-95 transition"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.08)',
                }}
                aria-label="Back"
              >
                <ArrowLeft className="size-5" style={{ color: isDark ? '#fff' : '#111827' }} />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="size-9 rounded-xl flex items-center justify-center border"
                  style={{
                    background: `${accentColor.color}1a`,
                    borderColor: `${accentColor.color}33`,
                  }}
                >
                  <Package className="size-5" style={{ color: accentColor.color }} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate" style={{ color: isDark ? '#fff' : '#111827' }}>
                    Buyurtmalar
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
                  >
                    Status va tarix
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reuse existing profile Orders UI */}
          <div className="pt-2">
            <ProfileView />
          </div>
        </div>
      </div>
    </div>
  );
}

