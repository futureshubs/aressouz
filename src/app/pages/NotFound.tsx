import { useNavigate } from 'react-router';
import { ArrowLeft, Home, SearchX } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{
        background: isDark
          ? 'radial-gradient(1100px 600px at 20% 10%, rgba(20,184,166,0.12), transparent 55%), #000'
          : 'radial-gradient(1100px 600px at 20% 10%, rgba(20,184,166,0.10), transparent 55%), #f9fafb',
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl border p-6 backdrop-blur-xl"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="size-14 rounded-3xl flex items-center justify-center border"
          style={{ background: `${accentColor.color}1a`, borderColor: `${accentColor.color}33` }}
        >
          <SearchX className="size-7" style={{ color: accentColor.color }} />
        </div>

        <h1 className="text-2xl font-bold mt-4" style={{ color: isDark ? '#fff' : '#111827' }}>
          Sahifa topilmadi
        </h1>
        <p className="mt-2 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          Siz qidirgan manzil mavjud emas yoki o‘zgargan bo‘lishi mumkin.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-6">
          <button
            onClick={() => navigate(-1)}
            className="py-3 rounded-2xl font-bold active:scale-[0.99] transition flex items-center justify-center gap-2"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
              color: isDark ? '#fff' : '#111827',
            }}
          >
            <ArrowLeft className="size-4" />
            Orqaga
          </button>
          <button
            onClick={() => navigate('/')}
            className="py-3 rounded-2xl font-bold active:scale-[0.99] transition flex items-center justify-center gap-2"
            style={{ background: accentColor.gradient, color: '#fff' }}
          >
            <Home className="size-4" />
            Bosh sahifa
          </button>
        </div>
      </div>
    </div>
  );
}

