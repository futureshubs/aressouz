import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  MapPin,
  Navigation,
  Save,
  Search,
  Store,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import {
  createStore,
  deleteStore,
  formatMoney,
  formatStoreCoords,
} from '../../utils/dillerData';
import { formatDillerDateTime, getStoreStats } from '../../utils/dillerStoreStats';
import { CheckoutMapPickerModal } from '../CheckoutMapPickerModal';
import { reverseGeocodeDisplayLine } from '../../utils/geolocationDetect';
import { DillerStoreDetailSheet } from './DillerStoreDetailSheet';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
};

function Card({ children, isDark, className = '' }: { children: ReactNode; isDark: boolean; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${className}`.trim()}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </div>
  );
}

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

export function DillerDokonlarTab({ data, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [detailStore, setDetailStore] = useState<DillerStore | null>(null);

  const sortedStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...data.stores];
    if (q) {
      list = list.filter((s) => {
        const hay = `${s.name} ${s.address} ${s.phone} ${s.contactName}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list.sort((a, b) => {
      const sa = getStoreStats(data, a.id);
      const sb = getStoreStats(data, b.id);
      const ta = sa.lastSaleAt ? new Date(sa.lastSaleAt).getTime() : 0;
      const tb = sb.lastSaleAt ? new Date(sb.lastSaleAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, 'uz');
    });
  }, [data.stores, data.sales, search, data]);

  const resetForm = () => {
    setName('');
    setAddress('');
    setPhone('');
    setContactName('');
    setLat(null);
    setLng(null);
  };

  const applyCoords = async (newLat: number, newLng: number, fillAddressIfEmpty = true) => {
    setLat(newLat);
    setLng(newLng);
    if (fillAddressIfEmpty && !address.trim()) {
      const line = await reverseGeocodeDisplayLine(newLat, newLng);
      if (line) setAddress(line);
    }
  };

  const detectGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolokatsiya qo‘llab-quvvatlanmaydi');
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyCoords(pos.coords.latitude, pos.coords.longitude);
        setLocBusy(false);
        toast.success('Koordinata aniqlandi');
      },
      () => {
        setLocBusy(false);
        toast.error('Joylashuvni olish mumkin emas — xaritadan tanlang');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const add = () => {
    const result = createStore(data, {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      contactName: contactName.trim(),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDataChange(result.data);
    resetForm();
    toast.success('Do‘kon saqlandi');
  };

  const remove = (id: string) => {
    onDataChange(deleteStore(data, id));
    toast.success('Do‘kon o‘chirildi');
  };

  const coordsText =
    lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null;

  const activeDetail = detailStore
    ? data.stores.find((s) => s.id === detailStore.id) ?? detailStore
    : null;

  return (
    <div className="space-y-4">
      <Card isDark={isDark}>
        <div className="flex items-center gap-2 mb-1">
          <Store className="w-5 h-5" style={{ color: accentColor.color }} />
          <h3 className="font-bold text-base">Do‘kon qo‘shish</h3>
        </div>
        <p className="text-xs opacity-70 mb-4">
          Tarqatish nuqtasi: nom, manzil, GPS (ixtiyoriy), telefon va mas‘ul.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Do‘kon nomi *</label>
            <input
              placeholder="Masalan: Mini market «Oqtepa»"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls(isDark)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Manzil</label>
            <input
              placeholder="Toshkent, Chilonzor..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputCls(isDark)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Koordinata (ixtiyoriy)</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-mono truncate ${
                  coordsText ? 'text-emerald-400' : 'opacity-50'
                }`}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                }}
              >
                {coordsText ?? 'Aniqlanmagan'}
              </div>
              <button
                type="button"
                onClick={detectGps}
                disabled={locBusy}
                className="shrink-0 px-3 rounded-xl border flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
              >
                <Navigation className={`w-4 h-4 ${locBusy ? 'animate-pulse' : ''}`} />
                GPS
              </button>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="shrink-0 px-3 rounded-xl border flex items-center gap-1 text-xs font-bold"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', color: accentColor.color }}
              >
                <MapPin className="w-4 h-4" />
                Xarita
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Telefon *</label>
            <input
              type="tel"
              placeholder="+998901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls(isDark)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Mas‘ul ism *</label>
            <input
              placeholder="Masalan: Jasur"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={inputCls(isDark)}
            />
          </div>
          <button
            type="button"
            onClick={add}
            className="w-full py-3 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-2"
            style={{ background: accentColor.gradient }}
          >
            <Save className="w-4 h-4" />
            Do‘konni saqlash
          </button>
        </div>
      </Card>

      <CheckoutMapPickerModal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        initialCenter={lat != null && lng != null ? { lat, lng } : null}
        isDark={isDark}
        accentColor={accentColor}
        onConfirm={async (coords) => {
          await applyCoords(coords.lat, coords.lng);
          setMapOpen(false);
          toast.success('Xaritadan koordinata olindi');
        }}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Do‘kon, manzil, telefon..."
          className={`${inputCls(isDark)} pl-9`}
        />
      </div>

      <Card isDark={isDark}>
        <h3 className="font-bold text-sm mb-3">Tarqatish nuqtalari ({data.stores.length})</h3>
        {data.stores.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-4">Hali do‘kon yo‘q</p>
        ) : sortedStores.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-4">Qidiruv bo‘yicha topilmadi</p>
        ) : (
          <ul className="space-y-2">
            {sortedStores.map((s) => (
              <StoreListCard
                key={s.id}
                store={s}
                data={data}
                isDark={isDark}
                accentColor={accentColor}
                onOpen={() => setDetailStore(s)}
              />
            ))}
          </ul>
        )}
      </Card>

      <DillerStoreDetailSheet
        open={activeDetail != null}
        store={activeDetail}
        data={data}
        onClose={() => setDetailStore(null)}
        onDelete={remove}
      />
    </div>
  );
}

function StoreListCard({
  store,
  data,
  isDark,
  accentColor,
  onOpen,
}: {
  store: DillerStore;
  data: DillerData;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  onOpen: () => void;
}) {
  const stats = getStoreStats(data, store.id);
  const coords = formatStoreCoords(store);
  const hasDebt = stats.openDebt > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl border overflow-hidden transition-all active:scale-[0.99] group"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="h-1" style={{ background: hasDebt ? '#f59e0b' : accentColor.gradient }} />
        <div className="p-3.5 flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}
          >
            <Store className="w-5 h-5 opacity-70" style={{ color: accentColor.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {stats.saleCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                  {stats.saleCount} sotuv
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full opacity-40 border border-current">
                  Sotuv yo‘q
                </span>
              )}
              {hasDebt ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                  Qarz {formatMoney(stats.openDebt)}
                </span>
              ) : null}
            </div>
            <div className="font-bold text-sm mt-1 truncate">{store.name}</div>
            <div className="text-xs opacity-70 truncate mt-0.5">
              {store.address || 'Manzil kiritilmagan'}
            </div>
            {coords ? (
              <div className="text-[10px] font-mono text-emerald-500/70 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {coords}
              </div>
            ) : null}
            <div className="text-xs opacity-60 mt-1 truncate">
              {store.phone} · {store.contactName}
            </div>
            {stats.lastSaleAt ? (
              <div className="text-[10px] opacity-45 mt-1">
                Oxirgi: {formatDillerDateTime(stats.lastSaleAt)}
              </div>
            ) : null}
          </div>
          <ChevronRight className="w-5 h-5 opacity-30 shrink-0 group-hover:opacity-60 mt-2" />
        </div>
        {stats.totalRevenue > 0 ? (
          <div
            className="px-3.5 pb-3 flex justify-between text-[10px] border-t pt-2 mx-3.5"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
          >
            <span className="opacity-50">Jami berilgan</span>
            <span className="font-bold" style={{ color: accentColor.color }}>
              {formatMoney(stats.totalRevenue)}
            </span>
          </div>
        ) : null}
      </button>
    </li>
  );
}
