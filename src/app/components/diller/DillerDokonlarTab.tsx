import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  Map,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Search,
  Store,
  User,
  Wallet,
} from 'lucide-react';
import { useDillerUserLocation } from '../../hooks/useDillerUserLocation';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import { deleteStore, formatMoney } from '../../utils/dillerData';
import {
  formatDillerDateTime,
  formatStoreDistance,
  getStoreDistanceKm,
  getStoreStats,
} from '../../utils/dillerStoreStats';
import { DillerStoreDetailSheet } from './DillerStoreDetailSheet';
import { DillerStoreAddSheet } from './DillerStoreAddSheet';
import { DillerStoreDeleteDialog, type StoreDeleteCandidate } from './DillerStoreDeleteDialog';
import { DillerStoresMapSheet } from './DillerStoresMapSheet';
import { DillerSaleSheet } from './DillerSaleSheet';
import { dillerTabContentClass } from './dillerMobileLayout';
import { iosAccentFillStyle, iosGlassCardStyle, iosGlassInputStyle } from './dillerIosGlass';
import { resolveDillerImage } from '../../utils/dillerMedia';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
};

type StoreFilter = 'all' | 'debt' | 'near';

export function DillerDokonlarTab({ data, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [addOpen, setAddOpen] = useState(false);
  const [editStore, setEditStore] = useState<DillerStore | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StoreFilter>('all');
  const [detailStore, setDetailStore] = useState<DillerStore | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StoreDeleteCandidate | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleStoreId, setSaleStoreId] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderStoreId, setOrderStoreId] = useState<string | null>(null);
  const { location: userLoc } = useDillerUserLocation(true);

  const storeMeta = useMemo(() => {
    return data.stores.map((store) => {
      const stats = getStoreStats(data, store.id);
      const distanceKm = getStoreDistanceKm(store, userLoc);
      return { store, stats, distanceKm };
    });
  }, [data, userLoc]);

  const debtStoreCount = storeMeta.filter((x) => x.stats.openDebt > 0).length;
  const openDebtTotal = storeMeta.reduce((s, x) => s + x.stats.openDebt, 0);

  const sortedStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...storeMeta];
    if (q) {
      list = list.filter(({ store }) => {
        const hay = `${store.name} ${store.address} ${store.phone} ${store.contactName}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (filter === 'debt') list = list.filter((x) => x.stats.openDebt > 0);
    if (filter === 'near') list = list.filter((x) => x.distanceKm != null && x.distanceKm < 1);

    return list.sort((a, b) => {
      const distA = a.distanceKm ?? Infinity;
      const distB = b.distanceKm ?? Infinity;
      if (distA !== distB) return distA - distB;
      const da = a.stats.openDebt;
      const db = b.stats.openDebt;
      if (da > 0 && db <= 0) return -1;
      if (da <= 0 && db > 0) return 1;
      if (da !== db) return da - db;
      const ta = a.stats.lastSaleAt ? new Date(a.stats.lastSaleAt).getTime() : 0;
      const tb = b.stats.lastSaleAt ? new Date(b.stats.lastSaleAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.store.name.localeCompare(b.store.name, 'uz');
    });
  }, [storeMeta, search, filter]);

  const nearestId = sortedStores.find((x) => x.distanceKm != null)?.store.id;

  const requestDelete = (store: DillerStore) => {
    const stats = getStoreStats(data, store.id);
    setDeleteCandidate({
      id: store.id,
      name: store.name,
      saleCount: stats.saleCount,
    });
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const { id } = deleteCandidate;
    onDataChange(deleteStore(data, id));
    if (detailStore?.id === id) setDetailStore(null);
    if (editStore?.id === id) setEditStore(null);
    setDeleteCandidate(null);
    toast.success('Do‘kon o‘chirildi');
  };

  const openAdd = () => {
    setEditStore(null);
    setAddOpen(true);
  };

  const openEdit = (store: DillerStore) => {
    setEditStore(store);
    setAddOpen(true);
    setDetailStore(null);
  };

  const startOrder = (store: DillerStore) => {
    if (data.products.length === 0) {
      toast.error('Avval mahsulot qo‘shing');
      return;
    }
    setOrderStoreId(store.id);
    setOrderOpen(true);
    setDetailStore(null);
  };

  const startSale = (store: DillerStore) => {
    if (data.products.length === 0) {
      toast.error('Avval mahsulot qo‘shing');
      return;
    }
    setSaleStoreId(store.id);
    setSaleOpen(true);
    setDetailStore(null);
  };

  const activeDetail = detailStore
    ? data.stores.find((s) => s.id === detailStore.id) ?? detailStore
    : null;

  const filters: { id: StoreFilter; label: string }[] = [
    { id: 'all', label: 'Barchasi' },
    { id: 'debt', label: debtStoreCount > 0 ? `Qarzdor (${debtStoreCount})` : 'Qarzdor' },
    { id: 'near', label: 'Yaqin' },
  ];

  return (
    <div className={dillerTabContentClass}>
      <DillerStoreDeleteDialog
        open={deleteCandidate != null}
        candidate={deleteCandidate}
        isDark={isDark}
        onOpenChange={(next) => {
          if (!next) setDeleteCandidate(null);
        }}
        onConfirm={confirmDelete}
      />

      <DillerSaleSheet
        open={saleOpen}
        initialStoreId={saleStoreId}
        data={data}
        onClose={() => {
          setSaleOpen(false);
          setSaleStoreId(null);
        }}
        onComplete={onDataChange}
      />

      <DillerSaleSheet
        open={orderOpen}
        mode="order"
        initialStoreId={orderStoreId}
        data={data}
        onClose={() => {
          setOrderOpen(false);
          setOrderStoreId(null);
        }}
        onComplete={onDataChange}
      />

      <DillerStoresMapSheet
        open={mapOpen}
        data={data}
        onClose={() => setMapOpen(false)}
        onStoreClick={(store) => {
          setMapOpen(false);
          setDetailStore(store);
        }}
      />

      <DillerStoreAddSheet
        open={addOpen}
        data={data}
        editStore={editStore}
        onClose={() => {
          setAddOpen(false);
          setEditStore(null);
        }}
        onSave={onDataChange}
      />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={openAdd}
          className="relative overflow-hidden rounded-[22px] px-4 py-3.5 text-left active:scale-[0.985] transition-transform"
          style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background:
                'radial-gradient(120% 90% at 100% -20%, rgba(255,255,255,0.55), transparent 55%)',
            }}
          />
          <span className="relative flex items-center gap-2.5 text-white">
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-white/30">
              <Plus className="w-5 h-5" strokeWidth={2.6} />
            </span>
            <span>
              <span className="block text-[15px] font-black leading-tight">Do‘kon qo‘shish</span>
              <span className="block text-[11px] font-medium opacity-70">Rasm, GPS, telefon</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="w-[72px] rounded-[22px] flex flex-col items-center justify-center gap-1 active:scale-[0.96]"
          style={iosGlassCardStyle(isDark)}
        >
          <Map className="w-5 h-5" style={{ color: accentColor.color }} />
          <span className="text-[10px] font-bold" style={{ color: accentColor.color }}>
            Xarita
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[20px] px-3.5 py-3" style={iosGlassCardStyle(isDark)}>
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-45">Do‘konlar</div>
          <div className="text-[20px] font-black mt-0.5 tabular-nums" style={{ color: accentColor.color }}>
            {data.stores.length}
          </div>
          <div className="text-[10px] opacity-50">tarqatish nuqtasi</div>
        </div>
        <div className="rounded-[20px] px-3.5 py-3" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-45">
            <Wallet className="w-3 h-3" />
            Ochiq qarz
          </div>
          <div className="text-[20px] font-black mt-0.5 tabular-nums text-amber-400">
            {formatMoney(openDebtTotal)}
          </div>
          <div className="text-[10px] opacity-50">{debtStoreCount} ta do‘kon</div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-[18px] px-3 py-2.5" style={iosGlassInputStyle(isDark)}>
        <Search className="w-4 h-4 opacity-40 shrink-0" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Do‘kon, manzil, telefon..."
          className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:opacity-40"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {filters.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-bold active:scale-[0.96]"
              style={
                on
                  ? iosAccentFillStyle(accentColor.gradient, accentColor.color)
                  : iosGlassCardStyle(isDark)
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {data.stores.length === 0 ? (
        <div className="rounded-[24px] px-5 py-12 text-center" style={iosGlassCardStyle(isDark)}>
          <Store className="w-8 h-8 mx-auto mb-3 opacity-40" style={{ color: accentColor.color }} />
          <p className="font-bold text-sm">Hali do‘kon yo‘q</p>
          <p className="text-xs opacity-55 mt-1">«Do‘kon qo‘shish» ni bosing</p>
        </div>
      ) : sortedStores.length === 0 ? (
        <div className="rounded-[24px] px-5 py-10 text-center" style={iosGlassCardStyle(isDark)}>
          <p className="font-bold text-sm">Mos do‘kon topilmadi</p>
          <p className="text-xs opacity-55 mt-1">Qidiruv yoki filterni o‘zgartiring</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sortedStores.map(({ store, stats, distanceKm }) => (
            <StoreGlassCard
              key={store.id}
              store={store}
              stats={stats}
              distanceLabel={formatStoreDistance(distanceKm)}
              isNearest={store.id === nearestId && distanceKm != null && distanceKm < 0.8}
              isDark={isDark}
              accentColor={accentColor.color}
              onOpen={() => setDetailStore(store)}
            />
          ))}
        </ul>
      )}

      <DillerStoreDetailSheet
        open={activeDetail != null}
        store={activeDetail}
        data={data}
        onClose={() => setDetailStore(null)}
        onEdit={() => activeDetail && openEdit(activeDetail)}
        onDeleteRequest={() => activeDetail && requestDelete(activeDetail)}
        onStartSale={() => activeDetail && startSale(activeDetail)}
        onStartOrder={() => activeDetail && startOrder(activeDetail)}
      />
    </div>
  );
}

function StoreGlassCard({
  store,
  stats,
  distanceLabel,
  isNearest,
  isDark,
  accentColor,
  onOpen,
}: {
  store: DillerStore;
  stats: ReturnType<typeof getStoreStats>;
  distanceLabel: string | null;
  isNearest: boolean;
  isDark: boolean;
  accentColor: string;
  onOpen: () => void;
}) {
  const hasDebt = stats.openDebt > 0;
  const img = resolveDillerImage(store.imageUrl);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="relative w-full text-left rounded-[22px] px-3.5 py-3 overflow-hidden active:scale-[0.985] transition-transform touch-manipulation"
        style={iosGlassCardStyle(isDark)}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-10 opacity-40"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.18), transparent)',
          }}
        />
        <div className="relative flex items-start gap-3">
          <div
            className="shrink-0 w-11 h-11 rounded-[14px] overflow-hidden flex items-center justify-center"
            style={{
              background: hasDebt ? 'rgba(245,158,11,0.18)' : `${accentColor}22`,
              color: hasDebt ? '#f59e0b' : accentColor,
            }}
          >
            {img ? (
              <img src={img} alt="" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-5 h-5" strokeWidth={2.2} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[15px] tracking-tight truncate">{store.name}</span>
                  {isNearest ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                      YAQIN
                    </span>
                  ) : null}
                </div>
                {store.contactName ? (
                  <div className="flex items-center gap-1 text-[12px] opacity-60 mt-0.5 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    {store.contactName}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {distanceLabel ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                    <Navigation className="w-3 h-3" />
                    {distanceLabel}
                  </span>
                ) : null}
                {hasDebt ? (
                  <span className="text-[13px] font-black tabular-nums text-amber-400">
                    {formatMoney(stats.openDebt)}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 opacity-30" />
                )}
              </div>
            </div>

            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-start gap-1.5 text-[11px] opacity-55">
                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                <span className="truncate">{store.address || 'Manzil kiritilmagan'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] opacity-55">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{store.phone}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {stats.saleCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                  {stats.saleCount} sotuv
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full opacity-40">
                  Sotuv yo‘q
                </span>
              )}
              {hasDebt ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/18 text-amber-400">
                  Qarz qoldi
                </span>
              ) : stats.saleCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400/80">
                  Qarz yo‘q
                </span>
              ) : null}
              {stats.lastSaleAt ? (
                <span className="text-[10px] opacity-40 ml-auto">
                  {formatDillerDateTime(stats.lastSaleAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}
