import { useState, useEffect } from 'react';
import { X, Star, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { publicAnonKey } from '/utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { shareTitleTextUrl } from '../utils/marketplaceNativeBridge';

function parseJsonFromResponse(raw: string): { ok: boolean; data: Record<string, unknown> } {
  if (!raw.trim()) return { ok: true, data: {} };
  try {
    return { ok: true, data: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return { ok: false, data: {} };
  }
}

export interface OrderReviewModalOrder {
  id: string;
  orderNumber?: string;
  status?: string;
  orderStatus?: string;
  relational?: boolean;
}

interface OrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderReviewModalOrder | null;
  accessToken: string;
  apiBaseUrl: string;
  isDark: boolean;
  accentHex: string;
  onSaved?: () => void;
}

export function OrderReviewModal({
  isOpen,
  onClose,
  order,
  accessToken,
  apiBaseUrl,
  isDark,
  accentHex,
  onSaved,
}: OrderReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [courierRating, setCourierRating] = useState(5);
  const [courierComment, setCourierComment] = useState('');
  const [courierAvailable, setCourierAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [lastShareUrl, setLastShareUrl] = useState('');

  const orderId = order?.id ? String(order.id) : '';
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    if (!isOpen) {
      setLastShareUrl('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !orderId || !accessToken) return;

    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      try {
        // Load order to check if courier rating should be shown.
        try {
          const orderRes = await fetch(`${apiBaseUrl}/orders/${encodeURIComponent(orderId)}`, {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              apikey: publicAnonKey,
              'X-Access-Token': accessToken,
            },
          });
          const ordJson = await orderRes.json().catch(() => ({}));
          const o = (ordJson?.order || ordJson) as Record<string, unknown>;
          const courierId = String((o as any)?.assignedCourierId || (o as any)?.deliveryCourierId || '').trim();
          if (!cancelled) setCourierAvailable(Boolean(courierId));
        } catch {
          if (!cancelled) setCourierAvailable(false);
        }

        const res = await fetch(
          `${apiBaseUrl}/user/order-reviews?orderId=${encodeURIComponent(orderId)}`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              apikey: publicAnonKey,
              'X-Access-Token': accessToken,
            },
          },
        );
        const raw = await res.text();
        const parsed = parseJsonFromResponse(raw);
        if (cancelled) return;
        if (!parsed.ok) {
          setRating(5);
          setComment('');
          setCourierRating(5);
          setCourierComment('');
          return;
        }
        const data = parsed.data;
        const rev = data.review as Record<string, unknown> | null | undefined;
        const cRev = data.courierReview as Record<string, unknown> | null | undefined;
        if (res.ok && rev && typeof rev === 'object') {
          setRating(Number(rev.rating) || 5);
          setComment(String(rev.comment || ''));
        } else {
          setRating(5);
          setComment('');
        }
        if (res.ok && cRev && typeof cRev === 'object') {
          setCourierRating(Number(cRev.rating) || 5);
          setCourierComment(String(cRev.comment || ''));
        } else {
          setCourierRating(5);
          setCourierComment('');
        }
      } catch {
        if (!cancelled) {
          setRating(5);
          setComment('');
          setCourierRating(5);
          setCourierComment('');
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, orderId, accessToken, apiBaseUrl, visibilityRefetchTick]);

  if (!isOpen || !order) return null;

  const save = async () => {
    if (!accessToken || !orderId) {
      toast.error('Tizimga kiring');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/user/order-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify({ orderId, rating, comment }),
      });
      const raw = await res.text();
      const parsed = parseJsonFromResponse(raw);
      const data = parsed.data;
      if (!res.ok) {
        throw new Error(String(data.error || 'Saqlashda xatolik'));
      }
      toast.success('Sharx saqlandi');
      onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  const saveWithCourier = async () => {
    if (!accessToken || !orderId) {
      toast.error('Tizimga kiring');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/user/order-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify({ orderId, rating, comment, courierRating, courierComment }),
      });
      const raw = await res.text();
      const parsed = parseJsonFromResponse(raw);
      const data = parsed.data;
      if (!res.ok) {
        throw new Error(String(data.error || 'Saqlashda xatolik'));
      }
      toast.success('Baholash saqlandi');
      onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = async () => {
    if (!accessToken || !orderId) {
      toast.error('Tizimga kiring');
      return;
    }
    setShareBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/user/order-reviews/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify({ orderId }),
      });
      const raw = await res.text();
      const parsed = parseJsonFromResponse(raw);
      if (!parsed.ok) {
        throw new Error('Server javobi noto‘g‘ri');
      }
      const data = parsed.data;
      if (!res.ok) {
        throw new Error(String(data.error || 'Havola yaratishda xatolik'));
      }
      const path = String(data.path || `/order-review/${data.token || ''}`);
      const url = `${window.location.origin}${path}`;
      setLastShareUrl(url);

      await shareTitleTextUrl({
        title: 'Buyurtma sharhi',
        text: 'Mening sharhimni o‘qing',
        url,
        toast,
        clipboardSuccessMessage: 'Havola nusxalandi — doʻstlaringizga yuboring',
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 app-safe-pad z-[80] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border p-5 shadow-xl"
        style={{
          background: isDark ? '#141414' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
              Buyurtmaga sharx
            </h2>
            <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}>
              #{order.orderNumber || order.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-2"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }}
            aria-label="Yopish"
          >
            <X className="size-5" />
          </button>
        </div>

        {loadingExisting ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-8 animate-spin" style={{ color: accentHex }} />
          </div>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
              Baholang
            </p>
            <div className="mb-4 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform active:scale-90"
                  aria-label={`${n} yulduz`}
                >
                  <Star
                    className="size-9"
                    fill={n <= rating ? accentHex : 'transparent'}
                    stroke={n <= rating ? accentHex : isDark ? '#6b7280' : '#9ca3af'}
                  />
                </button>
              ))}
            </div>

            <label className="mb-1 block text-sm font-medium" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
              Sharxingiz
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 4000))}
              rows={4}
              className="mb-4 w-full resize-none rounded-xl border px-3 py-2 text-sm"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                color: isDark ? '#fff' : '#111827',
              }}
              placeholder="Yetkazib berish, sifat, tavsiyalar…"
            />

            {courierAvailable ? (
              <div
                className="mb-4 rounded-xl border p-3"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                }}
              >
                <p className="mb-2 text-sm font-medium" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                  Kuryerni baholang
                </p>
                <div className="mb-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCourierRating(n)}
                      className="p-1 transition-transform active:scale-90"
                      aria-label={`${n} yulduz (kuryer)`}
                    >
                      <Star
                        className="size-8"
                        fill={n <= courierRating ? accentHex : 'transparent'}
                        stroke={n <= courierRating ? accentHex : isDark ? '#6b7280' : '#9ca3af'}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={courierComment}
                  onChange={(e) => setCourierComment(e.target.value.slice(0, 4000))}
                  rows={3}
                  className="w-full resize-none rounded-xl border px-3 py-2 text-sm"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#fff' : '#111827',
                  }}
                  placeholder="Kuryer haqida sharh (ixtiyoriy)"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  color: isDark ? '#fff' : '#111827',
                }}
              >
                Bekor
              </button>
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => void copyShareLink()}
                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  color: isDark ? '#fff' : '#111827',
                }}
              >
                {shareBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                Havolani nusxalash
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void (courierAvailable ? saveWithCourier() : save())}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: accentHex }}
              >
                {loading ? 'Saqlanmoqda…' : 'Saqlash'}
              </button>
            </div>
            {lastShareUrl ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Havolangiz (nusxalash uchun bosing)
                </p>
                <input
                  readOnly
                  value={lastShareUrl}
                  className="w-full cursor-text rounded-xl border px-3 py-2 text-xs"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#fff' : '#111827',
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            ) : null}
            <p className="mt-3 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
              Havola faqat sharx saqlangach ishlaydi. Doʻstlaringiz ochganda baho va matn ko‘rinadi.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
