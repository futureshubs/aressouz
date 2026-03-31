import { useNavigate } from 'react-router';
import { FileImage, Home } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/** PWA file_handlers — OS faylni ilova bilan ochganda (Edge / Chrome) */
export default function OpenFilePage() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: isDark
          ? 'radial-gradient(1100px 600px at 20% 10%, rgba(20,184,166,0.12), transparent 55%), #000'
          : 'radial-gradient(1100px 600px at 20% 10%, rgba(20,184,166,0.10), transparent 55%), #f9fafb',
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl border p-6 backdrop-blur-xl"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="size-14 rounded-3xl flex items-center justify-center border"
          style={{ background: `${accentColor.color}1a`, borderColor: `${accentColor.color}33` }}
        >
          <FileImage className="size-7" style={{ color: accentColor.color }} />
        </div>

        <h1 className="text-2xl font-bold mt-4" style={{ color: isDark ? '#fff' : '#111827' }}>
          Fayl bilan ochish
        </h1>
        <p className="mt-2 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          ARESSO rasm fayllarini qabul qila oladi. To‘liq tahrir yoki yuklash keyingi versiyalarda qo‘shiladi —
          hozircha asosiy ilovaga o‘ting.
        </p>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white"
          style={{ backgroundImage: accentColor.gradient }}
        >
          <Home className="size-5" />
          Bosh sahifa
        </button>
      </div>
    </div>
  );
}
