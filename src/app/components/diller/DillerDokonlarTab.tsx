import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  Map,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Navigation,
} from 'lucide-react';
import { useDillerUserLocation } from '../../hooks/useDillerUserLocation';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import {
  deleteStore,
  formatMoney,
  formatStoreCoords,
} from '../../utils/dillerData';
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
  const [addOpen, setAddOpen] = useState(false);
  const [editStore, setEditStore] = useState<DillerStore | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [detailStore, setDetailStore] = useState<DillerStore | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StoreDeleteCandidate | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleStoreId, setSaleStoreId] = useState<string | null>(null);
  const { location: userLoc } = useDillerUserLocation(true);

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
      const distA = getStoreDistanceKm(a, userLoc) ?? Infinity;
      const distB = getStoreDistanceKm(b, userLoc) ?? Infinity;
      if (distA !== distB) return distA - distB;

      const sa = getStoreStats(data, a.id);
      const sb = getStoreStats(data, b.id);
      const da = sa.openDebt;
      const db = sb.openDebt;
      if (da > 0 && db <= 0) return -1;
      if (da <= 0 && db > 0) return 1;
      if (da !== db) return da - db;

      const ta = sa.lastSaleAt ? new Date(sa.lastSaleAt).getTime() : 0;
      const tb = sb.lastSaleAt ? new Date(sb.lastSaleAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, 'uz');
    });
  }, [data.stores, data.sales, search, data, userLoc]);

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

      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border active:scale-[0.99] transition-transform"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          color: accentColor.color,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        }}
      >
        <Map className="w-6 h-6" strokeWidth={2.25} />
        Xaritada ko‘rish
      </button>

      <button
        type="button"
        onClick={() => openAdd()}
        className="w-full py-4 rounded-2xl font-bold text-slate-900 flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform"
        style={{ background: accentColor.gradient }}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
        Do‘kon qo‘shish
      </button>

      <DillerStoresMapSheet
        open={mapOpen}
        data={data}
        onClose={() => setMapOpen(false)}
        onStoreClick={(store) => setDetailStore(store)}
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
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-sm">Tarqatish nuqtalari ({data.stores.length})</h3>
          <button
            type="button"
            onClick={() => openAdd()}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
            style={{
              background: `${accentColor.color}22`,
              color: accentColor.color,
            }}
            aria-label="Do‘kon qo‘shish"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {data.stores.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-4">Hali do‘kon yo‘q — «+» tugmasini bosing</p>
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
                userLoc={userLoc}
                onOpen={() => setDetailStore(s)}
                onEdit={() => openEdit(s)}
                onDelete={() => requestDelete(s)}
                onStartSale={() => startSale(s)}
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
        onEdit={() => activeDetail && openEdit(activeDetail)}
        onDeleteRequest={() => activeDetail && requestDelete(activeDetail)}
        onStartSale={() => activeDetail && startSale(activeDetail)}
      />
    </div>
  );
}

function StoreListCard({
  store,
  data,
  isDark,
  accentColor,
  userLoc,
  onOpen,
  onEdit,
  onDelete,
  onStartSale,
}: {
  store: DillerStore;
  data: DillerData;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  userLoc: { lat: number; lng: number } | null;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStartSale: () => void;
}) {
  const stats = getStoreStats(data, store.id);
  const coords = formatStoreCoords(store);
  const hasDebt = stats.openDebt > 0;
  const distanceLabel = formatStoreDistance(getStoreDistanceKm(store, userLoc));
  const debtSettledPercent =
    stats.totalRevenue > 0
      ? Math.min(100, Math.round((stats.totalPaid / stats.totalRevenue) * 100))
      : 0;

  return (
    <li>
      <div
        className="rounded-2xl border overflow-hidden transition-all group"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          borderColor: hasDebt
            ? isDark
              ? 'rgba(245,158,11,0.28)'
              : 'rgba(245,158,11,0.22)'
            : isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="h-1" style={{ background: hasDebt ? '#f59e0b' : accentColor.gradient }} />
        {hasDebt ? (
          <div
            className="px-3.5 pt-3 pb-2"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(217,119,6,0.05))'
                : 'linear-gradient(135deg, rgba(245,158,11,0.1), #fffbeb)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold opacity-60 uppercase tracking-wide">
                  Do‘konda qoldiq
                </div>
                <div className="text-lg font-black text-amber-500 truncate">
                  {formatMoney(stats.openDebt)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {distanceLabel ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">
                    <Navigation className="w-3 h-3" />
                    {distanceLabel}
                  </span>
                ) : null}
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-500">
                  {stats.openDebtSaleCount} ta ochiq
                </span>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-[10px] opacity-55 mb-1">
                <span>Undirilgan {debtSettledPercent}%</span>
                <span>
                  {formatMoney(stats.totalPaid)} / {formatMoney(stats.totalRevenue)}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
              >
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${debtSettledPercent}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}
        <div className="p-3.5 flex items-start gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
          >
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
                  Qarz qoldi
                </span>
              ) : stats.saleCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500/80">
                  Qarz yo‘q
                </span>
              ) : null}
            </div>
            <div className="font-bold text-sm mt-1 truncate flex items-center gap-2">
              <span className="truncate">{store.name}</span>
              {!hasDebt && distanceLabel ? (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                  <Navigation className="w-3 h-3" />
                  {distanceLabel}
                </span>
              ) : null}
            </div>
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
          </button>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartSale();
              }}
              className="p-2 rounded-lg active:scale-95 text-emerald-400"
              aria-label="Sotuv boshlash"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 rounded-lg active:scale-95"
              style={{ color: accentColor.color }}
              aria-label="Tahrirlash"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-lg text-red-400 active:scale-95"
              aria-label="O‘chirish"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="p-2 rounded-lg opacity-30 group-hover:opacity-60 active:scale-95"
              aria-label="Batafsil"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        {stats.totalRevenue > 0 ? (
          <button
            type="button"
            onClick={onOpen}
            className="w-full px-3.5 pb-3 flex justify-between text-[10px] border-t pt-2 mx-3.5 text-left"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
          >
            <span className="opacity-50">Jami berilgan</span>
            <span className="font-bold" style={{ color: accentColor.color }}>
              {formatMoney(stats.totalRevenue)}
            </span>
          </button>
        ) : null}
      </div>
    </li>
  );
}
