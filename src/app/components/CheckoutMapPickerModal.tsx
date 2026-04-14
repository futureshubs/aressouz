import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { ArrowLeft, Home, Navigation, Search, Loader2 } from 'lucide-react';
import { reverseGeocodeDisplayLine } from '../utils/geolocationDetect';

const DEFAULT_CENTER: [number, number] = [41.2995, 69.2401];
const NOMINATIM_HEADERS = { 'User-Agent': 'AresSouz/1.0 (marketplace)' } as const;

type SearchHit = { lat: string; lon: string; display_name: string };

async function nominatimSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=json` +
    `&q=${encodeURIComponent(q)}&limit=6&countrycodes=uz&accept-language=uz,ru,en`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  const data = (await res.json()) as SearchHit[];
  return Array.isArray(data) ? data : [];
}

export type CheckoutMapPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  initialCenter?: { lat: number; lng: number } | null;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
};

export function CheckoutMapPickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialCenter,
  isDark,
  accentColor,
}: CheckoutMapPickerModalProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [previewLine, setPreviewLine] = useState<string | null>(null);
  const [previewSub, setPreviewSub] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);

  const scheduleReverse = useCallback((lat: number, lng: number) => {
    if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
    reverseTimerRef.current = setTimeout(async () => {
      const line = await reverseGeocodeDisplayLine(lat, lng);
      setPreviewLine(line);
      if (line && line.includes(',')) {
        const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
        setPreviewSub(parts.length > 1 ? parts[parts.length - 1] : null);
      } else {
        setPreviewSub(null);
      }
    }, 420);
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const el = containerRef.current;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const lat0 =
      initialCenter && Number.isFinite(initialCenter.lat) ? initialCenter.lat : DEFAULT_CENTER[0];
    const lng0 =
      initialCenter && Number.isFinite(initialCenter.lng) ? initialCenter.lng : DEFAULT_CENTER[1];

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
    }).setView([lat0, lng0], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    const onMoveEnd = () => {
      const c = map.getCenter();
      scheduleReverse(c.lat, c.lng);
    };
    map.on('moveend', onMoveEnd);
    scheduleReverse(lat0, lng0);

    const resize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', resize);
    requestAnimationFrame(resize);

    return () => {
      window.removeEventListener('resize', resize);
      map.off('moveend', onMoveEnd);
      map.remove();
      mapRef.current = null;
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
    };
  }, [isOpen, initialCenter?.lat, initialCenter?.lng, scheduleReverse]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQ('');
      setSearchHits([]);
      setSearchOpen(false);
      setPreviewLine(null);
      setPreviewSub(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (searchWrapRef.current?.contains(e.target as Node)) return;
      setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen || searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchBusy(true);
      try {
        const hits = await nominatimSearch(searchQ);
        setSearchHits(hits);
      } catch {
        setSearchHits([]);
      } finally {
        setSearchBusy(false);
      }
    }, 480);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQ, searchOpen]);

  const flyToHit = (hit: SearchHit) => {
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    mapRef.current?.setView([lat, lng], 18, { animate: true });
    setSearchOpen(false);
    setSearchHits([]);
  };

  const goMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Brauzer geolokatsiyani qo‘llab-quvvatlamaydi');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapRef.current?.setView([lat, lng], 17, { animate: true });
      },
      () => {
        toast.error('Joriy joylashuvni olish mumkin emas');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handleConfirm = () => {
    const m = mapRef.current;
    if (!m) return;
    const c = m.getCenter();
    onConfirm({ lat: c.lat, lng: c.lng });
  };

  if (!isOpen) return null;

  const panelBg = isDark ? '#0a0a0a' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)';

  return (
    <div
      className="fixed inset-0 z-[125] flex flex-col h-dvh max-h-dvh min-h-0 overflow-hidden app-safe-pad"
      style={{ background: panelBg }}
      role="dialog"
      aria-modal="true"
      aria-label="Manzilni xaritada tanlash"
    >
      <div
        className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-2 border-b"
        style={{ borderColor: border }}
      >
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-2.5 rounded-xl"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          }}
          aria-label="Orqaga"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div ref={searchWrapRef} className="flex-1 min-w-0 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: muted }}
          />
          <input
            type="search"
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Qidiruv"
            className="w-full pl-10 pr-3 py-3 rounded-2xl border outline-none text-sm"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              borderColor: border,
              color: isDark ? '#fff' : '#111',
            }}
            autoComplete="off"
          />
          {searchOpen && (searchHits.length > 0 || searchBusy) && (
            <div
              className="absolute left-0 right-0 top-full mt-1 z-[500] max-h-48 overflow-y-auto rounded-2xl border shadow-xl"
              style={{
                background: panelBg,
                borderColor: border,
              }}
            >
              {searchBusy && searchHits.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm" style={{ color: muted }}>
                  <Loader2 className="size-4 shrink-0 animate-spin" style={{ color: accentColor.color }} />
                  Qidirilmoqda…
                </div>
              ) : null}
              {searchHits.map((h, i) => (
                <button
                  key={`${h.lat},${h.lon},${i}`}
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm border-b last:border-b-0"
                  style={{
                    borderColor: border,
                    color: isDark ? '#f3f4f6' : '#111827',
                  }}
                  onClick={() => flyToHit(h)}
                >
                  {h.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        <div className="pointer-events-none absolute inset-0 z-[410] flex items-center justify-center">
          <div className="flex flex-col items-center" style={{ marginBottom: '28px' }}>
            <div
              className="mb-1 max-w-[min(92vw,320px)] rounded-2xl px-3 py-2 text-center text-xs leading-snug shadow-lg border"
              style={{
                background: isDark ? 'rgba(20,20,20,0.95)' : '#ffffff',
                borderColor: border,
                color: isDark ? 'rgba(255,255,255,0.92)' : '#1f2937',
              }}
            >
              Hammasi to‘g‘rimi? Marker kirish joyida ekanligiga ishonch hosil qiling va manzilni
              tasdiqlang.
            </div>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg border"
              style={{
                background: isDark ? '#374151' : '#4b5563',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              }}
            >
              <Home className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <div
              className="h-3 w-0.5 rounded-full"
              style={{ background: isDark ? '#9ca3af' : '#6b7280' }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={goMyLocation}
          className="absolute bottom-4 right-4 z-[420] flex h-12 w-12 items-center justify-center rounded-full shadow-lg border"
          style={{
            background: isDark ? 'rgba(20,20,20,0.92)' : '#ffffff',
            borderColor: border,
          }}
          aria-label="Joriy joylashuv"
        >
          <Navigation className="w-6 h-6" style={{ color: accentColor.color }} />
        </button>
      </div>

      <div
        className="shrink-0 border-t rounded-t-3xl px-4 pt-4 pb-[max(1rem,var(--app-safe-bottom,0px))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        style={{
          background: isDark ? '#111111' : '#ffffff',
          borderColor: border,
        }}
      >
        <h3 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Qayerga yetkazib berilsin?
        </h3>
        <div className="flex gap-3 mb-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${accentColor.color}18` }}
          >
            <Home className="w-5 h-5" style={{ color: accentColor.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-semibold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              {previewLine || 'Xaritani siljiting — manzil yuklanmoqda…'}
            </p>
            {previewSub ? (
              <p className="text-xs mt-0.5" style={{ color: muted }}>
                {previewSub}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-4 rounded-2xl font-bold text-white active:scale-[0.99] transition-transform"
          style={{ background: accentColor.gradient }}
        >
          Manzilni tasdiqlash
        </button>
      </div>
    </div>
  );
}
