import { useMemo } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Navigation,
  Receipt,
  Store,
  Wallet,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import { formatMoney } from '../../utils/dillerData';
import { normalizeUzPhoneForSms } from '../../utils/dillerPurchaseSms';
import { formatDillerDateTime } from '../../utils/dillerStoreStats';
import { formatDillerDate } from '../../utils/dillerTime';
import { isSaleDebtClosed, isSaleOverdue } from '../../utils/dillerDebtAnalytics';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassInputStyle,
  iosGlassPageStyle,
} from './dillerIosGlass';

export type StoreDebtBadge = {
  openDebt: number;
  openCount: number;
};

type CardProps = {
  sale: DillerSale;
  data: DillerData;
  isDark: boolean;
  distanceLabel: string | null;
  storeDebt?: StoreDebtBadge | null;
  onOpen: () => void;
};

export function DillerDebtListCard({
  sale,
  data,
  isDark,
  distanceLabel,
  storeDebt,
  onOpen,
}: CardProps) {
  const store = data.stores.find((s) => s.id === sale.storeId);
  const product = data.products.find((p) => p.id === sale.productId);
  const closed = isSaleDebtClosed(sale);
  const overdue = !closed && isSaleOverdue(sale);
  const salePaid = sale.paidAmount ?? 0;
  const saleDebt = sale.debtAmount ?? 0;
  const saleSettledPercent =
    sale.total > 0 ? Math.min(100, Math.round((salePaid / sale.total) * 100)) : 0;
  const accent = closed ? '#34d399' : overdue ? '#f87171' : '#f59e0b';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full text-left rounded-[22px] px-3.5 py-3 overflow-hidden active:scale-[0.985] transition-transform touch-manipulation"
      style={iosGlassCardStyle(isDark)}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-10 opacity-35"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.16), transparent)',
        }}
      />

      <div className="relative flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-[14px] flex items-center justify-center"
          style={{ background: `${accent}22`, color: accent }}
        >
          {closed ? (
            <CheckCircle2 className="w-5 h-5" strokeWidth={2.2} />
          ) : overdue ? (
            <AlertTriangle className="w-5 h-5" strokeWidth={2.2} />
          ) : (
            <Wallet className="w-5 h-5" strokeWidth={2.2} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-[15px] tracking-tight truncate">
                {store?.name ?? 'Do‘kon'}
              </div>
              <div className="text-[12px] opacity-55 truncate mt-0.5">
                {product?.name ?? 'Mahsulot'} × {sale.qty}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {distanceLabel ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                  <Navigation className="w-3 h-3" />
                  {distanceLabel}
                </span>
              ) : null}
              {closed ? (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/18 text-emerald-400">
                  YAKUNLANDI
                </span>
              ) : overdue ? (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500/18 text-red-400">
                  KECHIKKAN
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 opacity-30" />
              )}
            </div>
          </div>

          {!closed && storeDebt ? (
            <div className="mt-1.5 text-[11px] opacity-50 truncate">
              Do‘konda qoldiq {formatMoney(storeDebt.openDebt)} · {storeDebt.openCount} ta ochiq
            </div>
          ) : null}

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <div className="text-[10px] opacity-45">{closed ? 'To‘langan' : 'Bu sotuv qarzi'}</div>
              <div
                className="text-[17px] font-black tabular-nums leading-tight"
                style={{ color: closed ? '#34d399' : '#fbbf24' }}
              >
                {formatMoney(closed ? sale.total : saleDebt)}
              </div>
            </div>
            {!closed ? (
              <div className="text-right">
                <div className="text-[10px] opacity-45">To‘langan {saleSettledPercent}%</div>
                <div className="text-[11px] font-semibold text-emerald-400/80 tabular-nums">
                  {formatMoney(salePaid)}
                </div>
              </div>
            ) : null}
          </div>

          {!closed ? (
            <div
              className="mt-2 h-1.5 rounded-full overflow-hidden"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
            >
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${saleSettledPercent}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

type SheetProps = {
  open: boolean;
  sale: DillerSale | null;
  data: DillerData;
  distanceLabel: string | null;
  storeDebt?: StoreDebtBadge | null;
  sendDebtSms: boolean;
  onSendDebtSmsChange: (v: boolean) => void;
  smsBusy: boolean;
  payAmount: string;
  onPayAmountChange: (v: string) => void;
  onClose: () => void;
  onPartialPay: () => void;
  onSettle: () => void;
  onOverdueSms: () => void;
  onOpenChek: () => void;
};

export function DillerDebtPaySheet({
  open,
  sale,
  data,
  distanceLabel,
  storeDebt,
  sendDebtSms,
  onSendDebtSmsChange,
  smsBusy,
  payAmount,
  onPayAmountChange,
  onClose,
  onPartialPay,
  onSettle,
  onOverdueSms,
  onOpenChek,
}: SheetProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const live = useMemo(() => {
    if (!sale) return null;
    return data.sales.find((s) => s.id === sale.id) ?? sale;
  }, [data.sales, sale]);

  if (!open || !live) return null;

  const store = data.stores.find((s) => s.id === live.storeId);
  const product = data.products.find((p) => p.id === live.productId);
  const closed = isSaleDebtClosed(live);
  const overdue = !closed && isSaleOverdue(live);
  const salePaid = live.paidAmount ?? 0;
  const saleDebt = live.debtAmount ?? 0;
  const saleSettledPercent =
    live.total > 0 ? Math.min(100, Math.round((salePaid / live.total) * 100)) : 0;
  const storePhoneOk = Boolean(normalizeUzPhoneForSms(store?.phone || ''));

  return (
    <div
      className={`${dillerSheetShellClass} animate-in fade-in slide-in-from-right-8 duration-300`}
      style={{ ...iosGlassPageStyle(isDark), zIndex: 115 }}
    >
      <header className="shrink-0 px-4 pt-2 pb-3" style={{ ...iosGlassBarStyle(isDark), borderTop: 'none' }}>
        <div className="flex justify-center pb-2">
          <span className="w-10 h-1 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 w-12 h-12 rounded-[16px] flex items-center justify-center"
            style={{
              background: closed
                ? 'linear-gradient(135deg,#34d399,#10b981)'
                : overdue
                  ? 'linear-gradient(135deg,#f87171,#ef4444)'
                  : 'linear-gradient(135deg,#fbbf24,#d97706)',
              color: '#fff',
            }}
          >
            <Store className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-black truncate tracking-tight">
              {store?.name ?? 'Do‘kon'}
            </h2>
            <p className="text-[11px] opacity-55 truncate">
              {product?.name ?? 'Mahsulot'} × {live.qty}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center active:scale-95"
            style={iosGlassCardStyle(isDark)}
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-3 max-w-lg mx-auto w-full`}>
        <div
          className="rounded-[22px] px-4 py-4"
          style={{
            background: closed
              ? isDark
                ? 'rgba(16,185,129,0.16)'
                : 'rgba(16,185,129,0.12)'
              : isDark
                ? 'rgba(245,158,11,0.16)'
                : 'rgba(245,158,11,0.12)',
            border: closed
              ? '0.5px solid rgba(16,185,129,0.28)'
              : '0.5px solid rgba(245,158,11,0.28)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div className="text-[11px] font-semibold opacity-70">
            {closed ? 'To‘liq yopilgan' : 'Bu sotuv qarzi'}
          </div>
          <div
            className={`text-[28px] font-black tabular-nums leading-tight ${
              closed ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {formatMoney(closed ? live.total : saleDebt)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] opacity-60">
            <span>{formatDillerDateTime(live.createdAt)}</span>
            {distanceLabel ? (
              <span className="inline-flex items-center gap-0.5 font-bold text-blue-400">
                <Navigation className="w-3 h-3" />
                {distanceLabel}
              </span>
            ) : null}
          </div>
        </div>

        {overdue ? (
          <div
            className="rounded-[18px] px-3.5 py-3 flex items-center gap-2"
            style={{
              background: 'rgba(239,68,68,0.14)',
              border: '0.5px solid rgba(239,68,68,0.28)',
            }}
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-red-400">Muddat o‘tgan</div>
              {live.debtDueDate ? (
                <div className="text-[11px] opacity-60">
                  Qaytarish: {formatDillerDate(live.debtDueDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              ) : null}
            </div>
          </div>
        ) : !closed && live.debtDueDate ? (
          <div
            className="rounded-[18px] px-3.5 py-3 flex items-center gap-2 text-[13px]"
            style={iosGlassCardStyle(isDark)}
          >
            <CalendarClock className="w-4 h-4 opacity-50" />
            Qaytarish: {formatDillerDate(live.debtDueDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        ) : null}

        {!closed && storeDebt ? (
          <div className="rounded-[20px] px-4 py-3.5" style={iosGlassCardStyle(isDark)}>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-45">
              Do‘konda qoldiq
            </div>
            <div className="text-[20px] font-black text-amber-400 tabular-nums">
              {formatMoney(storeDebt.openDebt)}
            </div>
            <div className="text-[11px] opacity-50">{storeDebt.openCount} ta ochiq sotuv</div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[18px] p-3" style={iosGlassCardStyle(isDark)}>
            <div className="text-[10px] opacity-50">Oldin olingan</div>
            <div className="text-sm font-black text-emerald-400 mt-0.5 tabular-nums">
              {formatMoney(salePaid)}
            </div>
          </div>
          <div className="rounded-[18px] p-3" style={iosGlassCardStyle(isDark)}>
            <div className="text-[10px] opacity-50">Jami sotuv</div>
            <div className="text-sm font-black mt-0.5 tabular-nums">{formatMoney(live.total)}</div>
          </div>
        </div>

        {!closed ? (
          <div className="rounded-[20px] p-4 space-y-3" style={iosGlassCardStyle(isDark)}>
            <div className="flex justify-between text-[11px] opacity-55">
              <span>To‘langan {saleSettledPercent}%</span>
              <span>
                {formatMoney(salePaid)} / {formatMoney(live.total)}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
            >
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${saleSettledPercent}%` }}
              />
            </div>

            <label className="block text-[11px] font-semibold opacity-60">Qisman to‘lov</label>
            <input
              type="number"
              min={1}
              max={saleDebt}
              value={payAmount}
              onChange={(e) => onPayAmountChange(e.target.value)}
              className={`w-full px-3.5 py-3 rounded-[14px] text-sm outline-none tabular-nums ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
              style={iosGlassInputStyle(isDark)}
            />

            <label
              className={`flex items-start gap-2 text-[12px] ${
                !storePhoneOk ? 'opacity-45' : 'opacity-80'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={sendDebtSms && storePhoneOk}
                disabled={!storePhoneOk}
                onChange={(e) => onSendDebtSmsChange(e.target.checked)}
              />
              <span>
                <MessageSquare className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                SMS do‘kon egasiga
                <span className="block text-[11px] opacity-55 mt-0.5">
                  {storePhoneOk
                    ? 'Qolgan qarz bo‘lsa — to‘lov qabul qilindi; yopilsa — qarz yopildi'
                    : 'Do‘konda telefon yo‘q'}
                </span>
              </span>
            </label>
          </div>
        ) : (
          <div className="rounded-[20px] p-4 text-center" style={iosGlassCardStyle(isDark)}>
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="font-bold text-sm">Qarz yakunlangan</p>
            <p className="text-[11px] opacity-50 mt-1">Chekni ochib ko‘rishingiz mumkin</p>
          </div>
        )}
      </div>

      <div
        className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full space-y-2"
        style={{ ...iosGlassBarStyle(isDark), borderBottom: 'none' }}
      >
        {closed ? (
          <button
            type="button"
            onClick={onOpenChek}
            className="w-full py-3.5 rounded-[16px] font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98]"
            style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
          >
            <Receipt className="w-4 h-4" />
            Chekni ko‘rish
          </button>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onPartialPay}
                className="py-3.5 rounded-[16px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
              >
                To‘lov
              </button>
              <button
                type="button"
                onClick={onSettle}
                className="py-3.5 rounded-[16px] font-bold text-white flex items-center justify-center gap-1.5 active:scale-[0.98]"
                style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
              >
                <CheckCircle2 className="w-4 h-4" />
                Yopildi
              </button>
            </div>
            {overdue ? (
              <button
                type="button"
                disabled={!storePhoneOk || smsBusy}
                onClick={onOverdueSms}
                className="w-full py-3 rounded-[16px] font-bold text-red-400 disabled:opacity-40 active:scale-[0.98]"
                style={{
                  background: 'rgba(239,68,68,0.14)',
                  border: '0.5px solid rgba(239,68,68,0.28)',
                }}
              >
                {smsBusy
                  ? 'SMS yuborilmoqda…'
                  : storePhoneOk
                    ? 'Do‘kon egasiga muddat SMS'
                    : 'Muddat SMS (telefon yo‘q)'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenChek}
              className="w-full py-2.5 rounded-[14px] text-[13px] font-bold opacity-70"
            >
              Chekni ko‘rish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
