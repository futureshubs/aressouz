import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Package, Sparkles } from 'lucide-react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import {
  fetchMarketOrdersForPreview,
  formatOrderTimeAgoUz,
} from '../utils/fetchMarketOrdersPreview';
import { customerOrderStatusFromOrder } from '../utils/customerOrderStatusUz';

type Props = {
  onViewAll: () => void;
};

function orderLineTitle(order: any): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    const n = order.orderNumber != null ? String(order.orderNumber) : '';
    return n ? `Buyurtma #${n}` : 'Market buyurtmasi';
  }
  const first = String(
    items[0].name || items[0].productName || items[0].title || 'Mahsulot',
  ).trim();
  const rest = items.length - 1;
  return rest > 0 ? `${first} +${rest} ta mahsulot` : first;
}

function orderTotalAmount(order: any): number {
  const v =
    order.finalTotal ??
    order.total ??
    order.totalAmount ??
    order.total_amount ??
    order.totalPrice;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizePreviewImageUrl(u: unknown): string | null {
  const s = typeof u === 'string' ? u.trim() : '';
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return s;
  if (s.startsWith('/')) return s;
  if (s.startsWith('data:image')) return s;
  return null;
}

function thumbUrls(order: any): string[] {
  const fromApi = Array.isArray(order.previewImageUrls) ? order.previewImageUrls : [];
  const fromPreviewLines = Array.isArray(order.previewLines)
    ? order.previewLines.map((l: { imageUrl?: string }) => l?.imageUrl)
    : [];

  const candidates: string[] = [
    ...fromApi,
    ...fromPreviewLines,
  ];

  const items = Array.isArray(order.items) ? order.items : [];
  for (const it of items.slice(0, 3)) {
    candidates.push(
      it?.image,
      it?.imageUrl,
      it?.photo,
      it?.thumbnail,
      it?.productImage,
      it?.variantImage,
      typeof it?.variant === 'object' && it.variant?.image,
      it?.product && typeof it.product === 'object' && (it.product as { image?: string }).image,
    );
  }

  const out: string[] = [];
  for (const raw of candidates) {
    if (out.length >= 2) break;
    const n = normalizePreviewImageUrl(raw);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

function statusStyle(order: any): { bg: string; text: string } {
  if (order.awaitingCustomerReceipt) {
    return { bg: 'rgba(245, 158, 11, 0.2)', text: '#d97706' };
  }
  if (order.orderStatus === 'completed') {
    return { bg: 'rgba(16, 185, 129, 0.18)', text: '#059669' };
  }
  if (order.orderStatus === 'cancelled') {
    return { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626' };
  }
  const k = String(order.customerStatusKey || '').toLowerCase();
  if (k === 'delivered' || k === 'completed') {
    return { bg: 'rgba(16, 185, 129, 0.18)', text: '#059669' };
  }
  if (k === 'cancelled' || k === 'canceled' || k === 'rejected') {
    return { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626' };
  }
  if (k === 'preparing' || k === 'ready') {
    return { bg: 'rgba(139, 92, 246, 0.18)', text: '#7c3aed' };
  }
  if (k === 'delivering' || k === 'with_courier') {
    return { bg: 'rgba(6, 182, 212, 0.18)', text: '#0891b2' };
  }
  if (k === 'processing') {
    return { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb' };
  }
  return { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb' };
}

type OrderCardProps = {
  order: any;
  isDark: boolean;
  accentHex: string;
  onOpen: () => void;
  className?: string;
};

function OrderPreviewCard({
  order,
  isDark,
  accentHex,
  onOpen,
  className = '',
}: OrderCardProps) {
  const title = orderLineTitle(order);
  const total = orderTotalAmount(order);
  const thumbs = thumbUrls(order);
  const st = statusStyle(order);
  const label = customerOrderStatusFromOrder(order);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left rounded-2xl border p-3 transition-shadow active:scale-[0.99] ${className}`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className="size-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${accentHex}22` }}
          >
            <Package className="size-4" style={{ color: accentHex }} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold leading-tight line-clamp-2"
              style={{ color: isDark ? '#fff' : '#111827' }}
            >
              {title}
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
            >
              {formatOrderTimeAgoUz(order.createdAt)}
            </p>
          </div>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0 max-w-[100px] truncate"
          style={{ background: st.bg, color: st.text }}
        >
          {label}
        </span>
      </div>

      <div className="flex gap-2 mb-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="size-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
            style={{
              background: isDark ? 'rgba(30,41,59,0.9)' : 'linear-gradient(145deg,#1e3a5f,#0f172a)',
            }}
          >
            {thumbs[i] ? (
              <img src={thumbs[i]} alt="" className="size-full object-cover" />
            ) : (
              <Sparkles className="size-6 text-white/90" strokeWidth={1.8} />
            )}
          </div>
        ))}
      </div>
      <div
        className="pt-2 border-t flex items-center justify-between gap-2"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      >
        <span
          className="text-xs"
          style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
        >
          Jami summa:
        </span>
        <span className="text-sm font-bold" style={{ color: accentHex }}>
          {total.toLocaleString('uz-UZ')} so&apos;m
        </span>
      </div>
    </button>
  );
}

export function MarketOrdersPreview({ onViewAll }: Props) {
  const { isAuthenticated, accessToken, session } = useAuth();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const tick = useVisibilityTick();

  const token = accessToken || session?.access_token || null;
  const accentHex = accentColor.color;

  const swiperKey = useMemo(
    () => orders.map((o) => String(o?.id ?? o?.orderNumber ?? '')).join('|'),
    [orders],
  );

  const load = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchMarketOrdersForPreview(token);
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  if (!isAuthenticated) return null;
  if (!loading && orders.length === 0) return null;

  return (
    <section className="mb-3 sm:mb-4">
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <h3
          className="text-sm font-bold tracking-tight"
          style={{ color: isDark ? '#fff' : '#111827' }}
        >
          Mening buyurtmalarim
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold shrink-0 px-2 py-1 rounded-lg transition-opacity active:opacity-70"
          style={{ color: accentHex }}
        >
          Barchasi
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div
          className="h-24 rounded-2xl animate-pulse"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
        />
      ) : (
        <div
          className="w-full min-w-0 rounded-2xl pb-8 pt-0.5"
          style={
            {
              ['--swiper-pagination-color' as string]: accentHex,
              ['--swiper-pagination-bullet-size' as string]: '8px',
              ['--swiper-pagination-bullet-horizontal-gap' as string]: '5px',
              ['--swiper-pagination-bullet-inactive-color' as string]: isDark
                ? 'rgba(255,255,255,0.35)'
                : 'rgba(0,0,0,0.25)',
              ['--swiper-pagination-bullet-inactive-opacity' as string]: '1',
            } as CSSProperties
          }
        >
          <Swiper
            key={swiperKey}
            modules={[Pagination, Autoplay]}
            slidesPerView={1}
            spaceBetween={14}
            pagination={{
              dynamicBullets: true,
              clickable: true,
              dynamicMainBullets: 3,
            }}
            autoplay={
              orders.length > 1
                ? {
                    delay: 4500,
                    disableOnInteraction: true,
                    pauseOnMouseEnter: true,
                  }
                : false
            }
            watchOverflow
            className="market-orders-preview-swiper !pb-9"
            onSwiper={(s) => {
              try {
                s.update();
              } catch {
                /* ignore */
              }
            }}
          >
            {orders.map((order, i) => (
              <SwiperSlide key={String(order?.id ?? order?.orderNumber ?? i)} className="!h-auto">
                <OrderPreviewCard
                  order={order}
                  isDark={isDark}
                  accentHex={accentHex}
                  onOpen={onViewAll}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </section>
  );
}
