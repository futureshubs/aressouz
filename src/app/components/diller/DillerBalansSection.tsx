import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Banknote,
  Calendar,
  CreditCard,
  Plus,
  Store,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import {
  createSavedCard,
  deleteSavedCard,
  formatCardNumber,
  formatMoney,
} from '../../utils/dillerData';
import { filterSalesByPeriod, type HistoryPeriod } from '../../utils/dillerDebtAnalytics';
import { formatDillerDateTime } from '../../utils/dillerTime';
import { getStoreStats } from '../../utils/dillerStoreStats';
import { iosAccentFillStyle, iosGlassCardStyle, iosGlassInputStyle } from './dillerIosGlass';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
  isDark: boolean;
};

type Pane = 'qarz' | 'naqd' | 'karta';

const periods: { id: HistoryPeriod; label: string }[] = [
  { id: '1d', label: 'Bugun' },
  { id: '1w', label: 'Hafta' },
  { id: '1m', label: 'Oy' },
  { id: 'all', label: 'Barchasi' },
];

function liveSales(data: DillerData) {
  return data.sales.filter((s) => !s.cancelled);
}

export function DillerBalansSection({ data, onDataChange, isDark }: Props) {
  const { accentColor } = useTheme();
  const [pane, setPane] = useState<Pane>('naqd');
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const [cardOpen, setCardOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', holderName: '', bank: 'Uzcard' });

  const periodSales = useMemo(
    () => filterSalesByPeriod(liveSales(data), period),
    [data, period],
  );

  const naqdSales = periodSales.filter((s) => s.paymentType === 'naqd');
  const kartaSales = periodSales.filter((s) => s.paymentType === 'karta');
  const naqdTotal = naqdSales.reduce((s, x) => s + x.total, 0);
  const kartaTotal = kartaSales.reduce((s, x) => s + x.total, 0);

  const debtStores = useMemo(() => {
    return data.stores
      .map((store) => {
        const stats = getStoreStats(data, store.id);
        return { store, debt: stats.openDebt };
      })
      .filter((x) => x.debt > 0)
      .sort((a, b) => b.debt - a.debt);
  }, [data]);
  const debtTotal = debtStores.reduce((s, x) => s + x.debt, 0);

  const tabs: { id: Pane; label: string; Icon: typeof Wallet }[] = [
    { id: 'qarz', label: 'Qarz', Icon: Wallet },
    { id: 'naqd', label: 'Naqt', Icon: Banknote },
    { id: 'karta', label: 'Karta', Icon: CreditCard },
  ];

  const addCard = () => {
    const result = createSavedCard(data, cardForm);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDataChange(result.data);
    setCardOpen(false);
    setCardForm({ number: '', holderName: '', bank: 'Uzcard' });
    toast.success('Karta saqlandi');
  };

  const saleRow = (sale: DillerSale, tone: 'emerald' | 'indigo') => {
    const store = data.stores.find((s) => s.id === sale.storeId);
    const product = data.products.find((p) => p.id === sale.productId);
    const color = tone === 'emerald' ? '#34d399' : '#818cf8';
    return (
      <li key={sale.id} className="rounded-[18px] px-3.5 py-3 flex items-start gap-3" style={iosGlassCardStyle(isDark)}>
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
          style={{ background: `${color}22`, color }}
        >
          {tone === 'emerald' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2">
            <div className="font-bold text-sm truncate">{store?.name ?? 'Do‘kon'}</div>
            <div className="font-black text-sm shrink-0" style={{ color }}>
              +{formatMoney(sale.total)}
            </div>
          </div>
          <div className="text-[11px] opacity-50 truncate mt-0.5">
            {product?.name} · {sale.qty} {product?.unit ?? ''}
          </div>
          <div className="text-[10px] opacity-40 mt-1">
            {formatDillerDateTime(sale.createdAt, { year: undefined })}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[22px] font-black tracking-tight">Balans</h2>
        <p className="text-[12px] opacity-50 mt-0.5">Qarz to‘lovi naqt/kartaga tushadi</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tabs.map((t) => {
          const on = pane === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPane(t.id)}
              className="rounded-[18px] py-3.5 flex flex-col items-center gap-1.5 active:scale-[0.97]"
              style={on ? iosAccentFillStyle(accentColor.gradient, accentColor.color) : iosGlassCardStyle(isDark)}
            >
              <t.Icon className="w-5 h-5" />
              <span className="text-[12px] font-black">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <Calendar className="w-4 h-4 opacity-40 shrink-0" />
        {periods.map((p) => {
          const on = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold"
              style={on ? iosAccentFillStyle(accentColor.gradient, accentColor.color) : iosGlassCardStyle(isDark)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {pane === 'qarz' ? (
        <>
          <div className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
            <div className="flex justify-between">
              <div className="text-[12px] opacity-50">Qolgan qarzdorlik</div>
              <Wallet className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-[26px] font-black mt-1 tabular-nums">{formatMoney(debtTotal)}</div>
          </div>
          <h3 className="font-bold text-sm">Qarzdor do‘konlar</h3>
          {debtStores.length === 0 ? (
            <p className="text-sm opacity-50 text-center py-6">Ochiq qarz yo‘q</p>
          ) : (
            <ul className="space-y-2">
              {debtStores.map(({ store, debt }) => (
                <li key={store.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-[18px] px-3.5 py-3 flex items-center gap-3 overflow-hidden"
                    style={iosGlassCardStyle(isDark)}
                  >
                    <Store className="w-4 h-4 opacity-40 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{store.name}</div>
                      <div className="text-[11px] opacity-45">Ochiq qarz</div>
                    </div>
                    <div className="font-black text-rose-400 shrink-0">+{formatMoney(debt)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {pane === 'naqd' ? (
        <>
          <div className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
            <div className="flex justify-between">
              <div className="text-[12px] opacity-50">Jami naqt tushum</div>
              <Banknote className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-[26px] font-black mt-1 tabular-nums text-emerald-500">
              {formatMoney(naqdTotal)}
            </div>
          </div>
          <h3 className="font-bold text-sm">Naqt harakatlar</h3>
          {naqdSales.length === 0 ? (
            <p className="text-sm opacity-50 text-center py-6">Naqt tushum yo‘q</p>
          ) : (
            <ul className="space-y-2">{naqdSales.slice(0, 40).map((s) => saleRow(s, 'emerald'))}</ul>
          )}
        </>
      ) : null}

      {pane === 'karta' ? (
        <>
          <div className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
            <div className="flex justify-between">
              <div className="text-[12px] opacity-50">Jami karta tushum</div>
              <CreditCard className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-[26px] font-black mt-1 tabular-nums">{formatMoney(kartaTotal)}</div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Kartalar</h3>
            <button
              type="button"
              onClick={() => setCardOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-bold text-white"
              style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
            >
              <Plus className="w-4 h-4" />
              Qo‘shish
            </button>
          </div>

          {cardOpen ? (
            <div className="rounded-[20px] p-4 space-y-2" style={iosGlassCardStyle(isDark)}>
              <input
                placeholder="8600 0000 0000 0000"
                value={cardForm.number}
                onChange={(e) => setCardForm((c) => ({ ...c, number: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={iosGlassInputStyle(isDark)}
              />
              <input
                placeholder="Ism familiya"
                value={cardForm.holderName}
                onChange={(e) => setCardForm((c) => ({ ...c, holderName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={iosGlassInputStyle(isDark)}
              />
              <input
                placeholder="Bank"
                value={cardForm.bank}
                onChange={(e) => setCardForm((c) => ({ ...c, bank: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={iosGlassInputStyle(isDark)}
              />
              <button
                type="button"
                onClick={addCard}
                className="w-full py-2.5 rounded-xl font-bold text-white"
                style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
              >
                Saqlash
              </button>
            </div>
          ) : null}

          {(data.cards ?? []).length === 0 && !cardOpen ? (
            <div className="rounded-[22px] py-10 text-center" style={iosGlassCardStyle(isDark)}>
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-35" />
              <p className="font-bold text-sm">Karta yo‘q</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {(data.cards ?? []).map((c) => (
                <li
                  key={c.id}
                  className="rounded-[18px] px-3.5 py-3 flex items-center gap-3"
                  style={iosGlassCardStyle(isDark)}
                >
                  <CreditCard className="w-5 h-5" style={{ color: accentColor.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{formatCardNumber(c.number)}</div>
                    <div className="text-[11px] opacity-50">
                      {c.holderName} · {c.bank}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDataChange(deleteSavedCard(data, c.id))}
                    className="p-2 text-red-400"
                    aria-label="O‘chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="font-bold text-sm">Karta harakatlar</h3>
          {kartaSales.length === 0 ? (
            <p className="text-sm opacity-50 text-center py-6">Karta tushum yo‘q</p>
          ) : (
            <ul className="space-y-2">{kartaSales.slice(0, 40).map((s) => saleRow(s, 'indigo'))}</ul>
          )}
        </>
      ) : null}
    </div>
  );
}
