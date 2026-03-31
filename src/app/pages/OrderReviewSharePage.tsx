import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Loader2, Star } from 'lucide-react';
import { API_BASE_URL, publicAnonKey } from '/utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';

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
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 size-12 animate-spin text-[#14b8a6]" />
          <p className="text-white/60">Yuklanmoqda…</p>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a] px-6">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">Sharx topilmadi</h1>
          <p className="mb-6 text-white/60">{error || 'Havola yaroqsiz'}</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#0a0a0a] px-4 py-10">
      <div className="mx-auto max-w-md">
        <p className="mb-2 text-center text-sm text-white/50">Doʻstingizning buyurtma sharhi</p>
        <div
          className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
          style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}
        >
          <p className="mb-1 text-center text-xs uppercase tracking-wide text-white/40">Buyurtma</p>
          <p className="mb-4 text-center text-lg font-bold text-white">#{payload.orderNumber}</p>
          <div className="mb-4 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className="size-7"
                fill={n <= payload.rating ? '#fbbf24' : 'transparent'}
                stroke={n <= payload.rating ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
              />
            ))}
          </div>
          <p className="mb-3 text-center text-sm text-white/70">{payload.authorName}</p>
          {payload.comment ? (
            <p className="whitespace-pre-wrap text-center text-base leading-relaxed text-white/90">
              {payload.comment}
            </p>
          ) : (
            <p className="text-center text-white/40">Matn qoldirilmagan</p>
          )}
          {payload.updatedAt ? (
            <p className="mt-6 text-center text-xs text-white/35">
              {new Date(payload.updatedAt).toLocaleString('uz-UZ')}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mx-auto mt-8 block rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5"
        >
          Doʻkonga o‘tish
        </button>
      </div>
    </div>
  );
}
