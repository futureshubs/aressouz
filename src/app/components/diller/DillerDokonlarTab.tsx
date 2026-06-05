import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  Map,
  MapPin,
  Plus,
  Search,
  Store,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import {
  deleteStore,
  formatMoney,
  formatStoreCoords,
} from '../../utils/dillerData';
import { formatDillerDateTime, getStoreStats } from '../../utils/dillerStoreStats';
import { DillerStoreDetailSheet } from './DillerStoreDetailSheet';
import { DillerStoreAddSheet } from './DillerStoreAddSheet';
import { DillerStoresMapSheet } from './DillerStoresMapSheet';
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
  const [mapOpen, setMapOpen] = useState(false);
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

  const remove = (id: string) => {
    onDataChange(deleteStore(data, id));
    toast.success('Do‘kon o‘chirildi');
  };

  const activeDetail = detailStore
    ? data.stores.find((s) => s.id === detailStore.id) ?? detailStore
    : null;

  return (
    <div className={dillerTabContentClass}>
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
        onClick={() => setAddOpen(true)}
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
        onClose={() => setAddOpen(false)}
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
            onClick={() => setAddOpen(true)}
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
