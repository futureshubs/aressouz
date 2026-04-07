import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Star } from 'lucide-react';
import { API_BASE_URL, publicAnonKey } from '/utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { OrderReviewPageSkeleton } from '../components/skeletons';

type Payload = {
  rating: number;
  comment: string;
  authorName: string;
  orderNumber: string;
  updatedAt?: string;
};

export function OrderReviewSharePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError('Havola noto‘g‘ri');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${API_BASE_URL}/public/order-review/${encodeURIComponent(token)}`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              apikey: publicAnonKey,
            },
          },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Maʼlumot topilmadi');
        }
        setPayload(data.payload as Payload);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Xatolik');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token, visibilityRefetchTick]);

  if (loading) {
    return <OrderReviewPageSkeleton isDark={isDark} />;
  }

  if (error || !payload) {
    return (
      <div
        className={`fixed inset-0 flex items-center justify-center px-6 ${isDark ? 'bg-[#0a0a0a]' : 'bg-background'}`}
      >
        <div className="max-w-md text-center">
          <h1 className={`mb-2 text-2xl font-bold ${isDark ? 'text-white' : 'text-foreground'}`}>
            Sharx topilmadi
          </h1>
          <p className={`mb-6 ${isDark ? 'text-white/60' : 'text-muted-foreground'}`}>
            {error || 'Havola yaroqsiz'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl bg-[#14b8a6] px-6 py-3 font-semibold text-white"
          >
            Bosh sahifa
          </button>
        </div>
      </div>
    );
  }

  const starEmpty = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';

  return (
    <div
      className={`min-h-screen px-4 py-10 app-safe-pt ${
        isDark ? 'bg-gradient-to-b from-[#0f172a] to-[#0a0a0a]' : 'bg-gradient-to-b from-slate-50 to-gray-100'
      }`}
    >
      <div className="mx-auto max-w-md">
        <p className={`mb-2 text-center text-sm ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
          Doʻstingizning buyurtma sharhi
        </p>
        <div
          className={`rounded-2xl border p-6 backdrop-blur-sm ${
            isDark
              ? 'border-white/10 bg-white/5'
              : 'border-gray-200 bg-white shadow-xl'
          }`}
          style={{ boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.45)' : '0 12px 40px rgba(0,0,0,0.08)' }}
        >
          <p className={`mb-1 text-center text-xs uppercase tracking-wide ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            Buyurtma
          </p>
          <p className={`mb-4 text-center text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            #{payload.orderNumber}
          </p>
          <div className="mb-4 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className="size-7"
                fill={n <= payload.rating ? '#fbbf24' : 'transparent'}
                stroke={n <= payload.rating ? '#fbbf24' : starEmpty}
              />
            ))}
          </div>
          <p className={`mb-3 text-center text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
            {payload.authorName}
          </p>
          {payload.comment ? (
            <p
              className={`whitespace-pre-wrap text-center text-base leading-relaxed ${
                isDark ? 'text-white/90' : 'text-gray-800'
              }`}
            >
              {payload.comment}
            </p>
          ) : (
            <p className={`text-center ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Matn qoldirilmagan</p>
          )}
          {payload.updatedAt ? (
            <p className={`mt-6 text-center text-xs ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
              {new Date(payload.updatedAt).toLocaleString('uz-UZ')}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`mx-auto mt-8 block rounded-xl border px-6 py-3 text-sm font-semibold transition ${
            isDark
              ? 'border-white/15 text-white/80 hover:bg-white/5'
              : 'border-gray-300 text-gray-800 hover:bg-gray-100'
          }`}
        >
          Doʻkonga o‘tish
        </button>
      </div>
    </div>
  );
}
