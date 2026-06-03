import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Building2, ChevronRight, Package, Save, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerFirm } from '../../utils/dillerData';
import { createFirm, deleteFirm, formatMoney } from '../../utils/dillerData';
import { formatDillerDateTime, getFirmStats } from '../../utils/dillerFirmStats';
import { DillerFirmDetailSheet } from './DillerFirmDetailSheet';
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

const emptyFirmForm = () => ({
  name: '',
  ownerName: '',
  address: '',
  productName: '',
  phone: '',
});

export function DillerProfilTab({ data, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [firmForm, setFirmForm] = useState(emptyFirmForm);
  const [search, setSearch] = useState('');
  const [detailFirm, setDetailFirm] = useState<DillerFirm | null>(null);

  const sortedFirms = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...data.firms];
    if (q) {
      list = list.filter((f) => {
        const hay = `${f.name} ${f.ownerName} ${f.address} ${f.productName} ${f.phone}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list.sort((a, b) => {
      const sa = getFirmStats(data, a.id);
      const sb = getFirmStats(data, b.id);
      const ta = sa?.lastSaleAt ? new Date(sa.lastSaleAt).getTime() : 0;
      const tb = sb?.lastSaleAt ? new Date(sb.lastSaleAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, 'uz');
    });
  }, [data.firms, data.products, data.sales, data.warehouse, search, data]);

  const totalSales = data.sales.reduce((s, x) => s + x.total, 0);

  const saveFirm = () => {
    if (!firmForm.name.trim()) {
      toast.error('Firma nomi majburiy');
      return;
    }
    if (!firmForm.ownerName.trim()) {
      toast.error('Ega ismi majburiy');
      return;
    }
    if (!firmForm.address.trim()) {
      toast.error('Manzil majburiy');
      return;
    }
    if (!firmForm.productName.trim()) {
      toast.error('Firma beradigan mahsulot nomi majburiy');
      return;
    }
    if (!firmForm.phone.trim()) {
      toast.error('Telefon raqam majburiy');
      return;
    }

    const next = createFirm(data, firmForm);
    onDataChange(next);
    setFirmForm(emptyFirmForm());
    toast.success('Firma saqlandi');
  };

  const removeFirm = (id: string) => {
    onDataChange(deleteFirm(data, id));
    toast.success('Firma o‘chirildi');
  };

  const activeDetail = detailFirm
    ? data.firms.find((f) => f.id === detailFirm.id) ?? detailFirm
    : null;

  return (
    <div className={dillerTabContentClass}>
      <Card isDark={isDark}>
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-5 h-5" style={{ color: accentColor.color }} />
          <h3 className="font-bold">Firma qo‘shish</h3>
        </div>
        <p className="text-xs opacity-70 mb-4">
          Yetkazib beruvchi: nom, ega, manzil, qaysi mahsulot berishi va telefon.
        </p>
        <div className="space-y-2">
          <input
            placeholder="Firma nomi *"
            value={firmForm.name}
            onChange={(e) => setFirmForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls(isDark)}
          />
          <input
            placeholder="Ega ismi (mas‘ul shaxs) *"
            value={firmForm.ownerName}
            onChange={(e) => setFirmForm((f) => ({ ...f, ownerName: e.target.value }))}
            className={inputCls(isDark)}
          />
          <input
            placeholder="Manzil *"
            value={firmForm.address}
            onChange={(e) => setFirmForm((f) => ({ ...f, address: e.target.value }))}
            className={inputCls(isDark)}
          />
          <input
            placeholder="Firma beradigan mahsulot nomi *"
            value={firmForm.productName}
            onChange={(e) => setFirmForm((f) => ({ ...f, productName: e.target.value }))}
            className={inputCls(isDark)}
          />
          <input
            placeholder="Telefon raqam *"
            type="tel"
            value={firmForm.phone}
            onChange={(e) => setFirmForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputCls(isDark)}
          />
          <button
            type="button"
            onClick={saveFirm}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-slate-900"
            style={{ background: accentColor.gradient }}
          >
            <Save className="w-4 h-4" />
            Firmani saqlash
          </button>
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Firma, ega, mahsulot, telefon..."
          className={`${inputCls(isDark)} pl-9`}
        />
      </div>

      <Card isDark={isDark}>
        <h3 className="font-bold text-sm mb-3">Saqlangan firmalar ({data.firms.length})</h3>
        {data.firms.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-4">Hali firma yo‘q — yuqoridagi formani to‘ldiring</p>
        ) : sortedFirms.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-4">Qidiruv bo‘yicha topilmadi</p>
        ) : (
          <ul className="space-y-2">
            {sortedFirms.map((f) => (
              <FirmListCard
                key={f.id}
                firm={f}
                data={data}
                isDark={isDark}
                accentColor={accentColor}
                onOpen={() => setDetailFirm(f)}
              />
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Firmalar', value: String(data.firms.length) },
          { label: 'Mahsulotlar', value: String(data.products.length) },
          { label: 'Do‘konlar', value: String(data.stores.length) },
          { label: 'Sotuvlar', value: String(data.sales.length) },
          { label: 'Aylanma', value: formatMoney(totalSales), span: true },
        ].map((s) => (
          <Card key={s.label} isDark={isDark} className={s.span ? 'col-span-2' : undefined}>
            <div className="text-xs opacity-60">{s.label}</div>
            <div className="text-lg font-bold mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      <DillerFirmDetailSheet
        open={activeDetail != null}
        firm={activeDetail}
        data={data}
        onClose={() => setDetailFirm(null)}
        onDelete={removeFirm}
      />
    </div>
  );
}

function FirmListCard({
  firm,
  data,
  isDark,
  accentColor,
  onOpen,
}: {
  firm: DillerFirm;
  data: DillerData;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  onOpen: () => void;
}) {
  const stats = getFirmStats(data, firm.id);

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
        <div className="h-1" style={{ background: accentColor.gradient }} />
        <div className="p-3.5 flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}
          >
            <Building2 className="w-5 h-5 opacity-70" style={{ color: accentColor.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {(stats?.productCount ?? 0) > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                  {stats?.productCount} mahsulot
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full opacity-40 border border-current">
                  Mahsulot yo‘q
                </span>
              )}
              {(stats?.saleCount ?? 0) > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                  {stats?.saleCount} sotuv
                </span>
              ) : null}
            </div>
            <div className="font-bold text-sm mt-1 truncate">{firm.name}</div>
            <div className="text-xs opacity-70 truncate">Ega: {firm.ownerName}</div>
            <div className="text-xs opacity-60 truncate mt-0.5">{firm.address}</div>
            <div className="text-xs mt-1.5 text-emerald-400/90 flex items-center gap-1">
              <Package className="w-3 h-3 shrink-0" />
              <span className="truncate">{firm.productName}</span>
            </div>
            <div className="text-xs opacity-60 mt-1">{firm.phone}</div>
            {stats?.lastSaleAt ? (
              <div className="text-[10px] opacity-45 mt-1">
                Oxirgi sotuv: {formatDillerDateTime(stats.lastSaleAt)}
              </div>
            ) : null}
          </div>
          <ChevronRight className="w-5 h-5 opacity-30 shrink-0 group-hover:opacity-60 mt-2" />
        </div>
        {(stats?.totalRevenue ?? 0) > 0 || (stats?.warehouseQty ?? 0) > 0 ? (
          <div
            className="px-3.5 pb-3 flex justify-between text-[10px] border-t pt-2 mx-3.5 gap-2"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
          >
            <span className="opacity-50">
              Ombor: <strong className="opacity-90">{stats?.warehouseQty ?? 0}</strong>
            </span>
            {(stats?.totalRevenue ?? 0) > 0 ? (
              <span className="font-bold shrink-0" style={{ color: accentColor.color }}>
                {formatMoney(stats?.totalRevenue ?? 0)}
              </span>
            ) : null}
          </div>
        ) : null}
      </button>
    </li>
  );
}
