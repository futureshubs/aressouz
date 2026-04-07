import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Share2, Home } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/** PWA share_target (GET) — tizim ulash oynasidan kelgan ma’lumot */
export default function ShareTargetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const shared = useMemo(
    () => ({
      title: params.get('title')?.trim() || '',
      text: params.get('text')?.trim() || '',
      url: params.get('url')?.trim() || '',
    }),
    [params],
  );

  const hasContent = shared.title || shared.text || shared.url;

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
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="size-14 rounded-3xl flex items-center justify-center border"
          style={{ background: `${accentColor.color}1a`, borderColor: `${accentColor.color}33` }}
        >
          <Share2 className="size-7" style={{ color: accentColor.color }} />
        </div>

        <h1 className="text-2xl font-bold mt-4" style={{ color: isDark ? '#fff' : '#111827' }}>
          Ulashilgan kontent
        </h1>
        <p className="mt-2 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          ARESSO orqali qabul qilingan ma’lumot. Keyinroq bu yerda qidiruv yoki saqlash qo‘shish mumkin.
        </p>

        {hasContent ? (
          <div
            className="mt-4 space-y-2 rounded-2xl p-4 text-sm"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              color: isDark ? '#e5e7eb' : '#374151',
            }}
          >
            {shared.title ? (
              <p>
                <span className="font-semibold opacity-70">Sarlavha: </span>
                {shared.title}
              </p>
            ) : null}
            {shared.text ? (
              <p>
                <span className="font-semibold opacity-70">Matn: </span>
                {shared.text}
              </p>
            ) : null}
            {shared.url ? (
              <p className="break-all">
                <span className="font-semibold opacity-70">Havola: </span>
                <a href={shared.url} className="underline" style={{ color: accentColor.color }}>
                  {shared.url}
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
            Bo‘sh ulash — asosiy ilovaga o‘ting.
          </p>
        )}

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
