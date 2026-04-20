import { useState } from 'react';
import { Plus, Minus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RentalNextPaymentInfo } from './RentalNextPaymentInfo';
import { RentalLiveCountdown } from './RentalLiveCountdown';
import { useUserPanelT, userPanelLocale } from '../../i18n/userPanel';
import { useTheme } from '../../context/ThemeContext';
import { rentalExtendMaxUnits } from '../../utils/rentalNextPayment';
import { normalizeRentalProductImageUrl } from '../../utils/rentalProductImage';
import { computeRentalCourierHandoffUzs } from '../../utils/rentalCashHandoff';
import { publicAnonKey } from '/utils/supabase/info';

export type ProfileActiveRentalOrder = {
  id: string;
  branchId: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  paymentSchedule?: string;
  nextPaymentDue?: string | null;
  pricePerPeriod?: number;
  quantity?: number;
  contractStartDate?: string | null;
  rentalPeriodStartedAt?: string | null;
  rentalPeriodEndsAt?: string | null;
  rentalPeriod?: string | null;
  awaitingCourierDelivery?: boolean;
  needsBranchAcceptance?: boolean;
  awaitingCourierAssignment?: boolean;
  requiresAutoCourier?: boolean;
  /** Kuryer tayinlangan, lekin ijara muddati hali boshlanmagan — mijoz «oldim» bosishi mumkin */
  awaitingDeliveryConfirmation?: boolean;
  pickupAlert?: string;
  paymentAlert?: string;
  deliveryPending?: boolean;
  totalPrice?: number;
  paymentMethod?: string;
  deliveryPrice?: number;
};

type Props = {
  order: ProfileActiveRentalOrder;
  isDark: boolean;
  accentColor: string;
  phonePk: string;
  apiBaseUrl: string;
  /** Serverdan kelgan yangi buyurtma maydonlari (taymer/narx) darhol UIga */
  onExtended: (updatedOrder?: ProfileActiveRentalOrder | Record<string, unknown>) => void;
};

export function ProfileActiveRentalCard({
  order,
  isDark,
  accentColor,
  phonePk,
  apiBaseUrl,
  onExtended,
}: Props) {
  const { language } = useTheme();
  const t = useUserPanelT();
  const loc = userPanelLocale(language);
  const [extendOpen, setExtendOpen] = useState(false);
  const [units, setUnits] = useState(1);
  const [extending, setExtending] = useState(false);
  const [confirmReceivedBusy, setConfirmReceivedBusy] = useState(false);

  const imgRaw = String(order.productImage || '').trim();
  const img = normalizeRentalProductImageUrl(imgRaw, apiBaseUrl);
  const name = String(order.productName || '').trim() || t('profile.rentFallback');
  const price = Number(order.pricePerPeriod) || 0;
  const qty = Math.max(1, Number(order.quantity) || 1);
  const maxU = rentalExtendMaxUnits(order.rentalPeriod);
  const approxExtra = Math.round(price * qty * units);
  const cur = t('profile.currency');
  const handoffPreview = computeRentalCourierHandoffUzs(order);
  const extendUnitLabel = (() => {
    const p = String(order.rentalPeriod || '').toLowerCase();
    if (p === 'hourly') return 'soat';
    if (p === 'daily') return 'kun';
    if (p === 'weekly') return 'hafta';
    if (p === 'monthly') return 'oy';
    return 'birlik';
  })();

  const canExtend =
    phonePk.length >= 9 &&
    Boolean(order.rentalPeriodStartedAt) &&
    order.awaitingCourierDelivery !== true &&
    order.deliveryPending !== true;

  const showLiveEndCountdown =
    Boolean(order.rentalPeriodStartedAt && order.rentalPeriodEndsAt) &&
    order.awaitingCourierDelivery !== true &&
    order.deliveryPending !== true;

  const submitConfirmReceived = async () => {
    if (confirmReceivedBusy || phonePk.length < 9) return;
    setConfirmReceivedBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/rentals/my-rentals/confirm-received`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phonePk,
          branchId: order.branchId,
          orderId: order.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(typeof data.error === 'string' ? data.error : t('profile.confirmError'));
        return;
      }
      toast.success(t('rental.confirmReceivedSuccess'));
      onExtended(data.order && typeof data.order === 'object' ? data.order : undefined);
    } catch {
      toast.error(t('profile.confirmError'));
    } finally {
      setConfirmReceivedBusy(false);
    }
  };

  const submitExtend = async () => {
    if (!canExtend || extending) return;
    setExtending(true);
    try {
      const res = await fetch(`${apiBaseUrl}/rentals/my-rentals/extend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phonePk,
          branchId: order.branchId,
          orderId: order.id,
          units,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(typeof data.error === 'string' ? data.error : t('profile.confirmError'));
        return;
      }
      toast.success(t('rental.extendSuccess'));
      setExtendOpen(false);
      setUnits(1);
      onExtended(data.order && typeof data.order === 'object' ? data.order : undefined);
    } catch {
      toast.error(t('profile.confirmError'));
    } finally {
      setExtending(false);
    }
  };

  return (
    <>
      <div
        className="rounded-2xl border p-3 flex gap-3 items-stretch"
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden bg-black/10">
          {img && (img.startsWith('http') || img.startsWith('//') || img.startsWith('/') || img.startsWith('data:')) ? (
            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[10px] font-medium text-center px-1"
              style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)' }}
            >
              {t('profile.productFallback')}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <p className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: isDark ? '#fff' : '#111827' }}>
            {name}
          </p>
          <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
            {t('profile.rentSchedule')}{' '}
            {order.paymentSchedule === 'weekly'
              ? t('profile.rentWeekly')
              : order.paymentSchedule === 'monthly'
                ? t('profile.rentMonthly')
                : t('profile.rentOneOff')}
          </p>
          {showLiveEndCountdown && order.rentalPeriodEndsAt ? (
            <div className="mt-1">
              <RentalLiveCountdown
                rentalPeriodEndsAt={order.rentalPeriodEndsAt}
                isDark={isDark}
                accentColor={accentColor}
                prominent
              />
            </div>
          ) : null}
          {handoffPreview.totalUzs > 0 ? (
            <div
              className="mt-1.5 rounded-xl border px-2.5 py-2"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
                {t('rental.contractTotalShort')}
              </p>
              <p className="text-base font-extrabold tabular-nums" style={{ color: isDark ? '#fff' : '#111827' }}>
                {handoffPreview.totalUzs.toLocaleString(loc)} {cur}
              </p>
              {handoffPreview.isCashLike && handoffPreview.toCashierUzs > 0 ? (
                <p className="text-[11px] leading-snug mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                  {t('rental.cashHandoffUserHint', {
                    cashier: handoffPreview.toCashierUzs.toLocaleString(loc),
                    delivery:
                      handoffPreview.deliveryKeptUzs > 0
                        ? handoffPreview.deliveryKeptUzs.toLocaleString(loc)
                        : '0',
                    cur,
                  })}
                </p>
              ) : !handoffPreview.isCashLike ? (
                <p className="text-[11px] leading-snug mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                  {t('rental.onlinePaidNoCashierHandoff')}
                </p>
              ) : null}
            </div>
          ) : null}
          {order.awaitingDeliveryConfirmation === true ? (
            <div
              className="mt-2 rounded-xl border px-2.5 py-2.5 space-y-2"
              style={{
                borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.3)',
                background: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)',
              }}
            >
              <p className="text-[11px] leading-snug" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>
                {t('rental.confirmReceivedHint')}
              </p>
              <button
                type="button"
                disabled={confirmReceivedBusy || phonePk.length < 9}
                onClick={() => void submitConfirmReceived()}
                className="w-full py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 disabled:opacity-45"
                style={{ background: accentColor, boxShadow: `0 4px 14px ${accentColor}44` }}
              >
                {confirmReceivedBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('rental.confirmReceivedCta')}
              </button>
            </div>
          ) : null}
          {order.needsBranchAcceptance === true ? (
            <p className="text-[11px] mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
              Filial buyurtmani qabul qilguncha kuting.
            </p>
          ) : null}
          {order.awaitingCourierAssignment === true && order.awaitingDeliveryConfirmation !== true ? (
            <p className="text-[11px] mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
              {order.requiresAutoCourier
                ? 'Avto-kuryer biriktirilmoqda…'
                : 'Kuryer tayinlanmoqda…'}
            </p>
          ) : null}
          <RentalNextPaymentInfo
            compact
            isDark={isDark}
            accentColor={accentColor}
            paymentSchedule={order.paymentSchedule}
            nextPaymentDue={order.nextPaymentDue}
            pricePerPeriod={order.pricePerPeriod}
            quantity={order.quantity}
            contractStartDate={order.contractStartDate}
            rentalPeriodStartedAt={order.rentalPeriodStartedAt}
            rentalPeriodEndsAt={order.rentalPeriodEndsAt}
            rentalPeriod={order.rentalPeriod}
            awaitingCourierDelivery={order.awaitingCourierDelivery === true}
            endCountdownLive
            omitRentalEndCountdown={showLiveEndCountdown}
          />
          {order.pickupAlert === 'overdue' && (
            <p className="text-xs text-red-500 font-semibold">{t('rental.pickupOverdue')}</p>
          )}
          {order.paymentAlert === 'overdue' && (
            <p className="text-xs text-red-500 font-semibold mt-0.5">{t('profile.rentOverdue')}</p>
          )}
          {order.paymentAlert === 'due_soon' && (
            <p className="text-xs text-amber-500 font-medium mt-0.5">{t('profile.rentDueSoon')}</p>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-center justify-center gap-1">
          <button
            type="button"
            title={canExtend ? t('rental.extendOpen') : t('rental.extendDisabled')}
            disabled={!canExtend}
            onClick={() => canExtend && setExtendOpen(true)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: canExtend ? `${accentColor}28` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              color: canExtend ? accentColor : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              boxShadow: canExtend ? `0 4px 14px ${accentColor}33` : 'none',
            }}
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {extendOpen ? (
        <div className="fixed inset-0 app-safe-pad z-[140] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => !extending && setExtendOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border p-4 shadow-2xl"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-base font-bold pr-8" style={{ color: isDark ? '#fff' : '#111827' }}>
                {t('rental.extendTitle')}
              </h3>
              <button
                type="button"
                disabled={extending}
                onClick={() => setExtendOpen(false)}
                className="p-1 rounded-lg -mr-1 -mt-1"
                style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
              {t('rental.extendHint')}
            </p>

            <p className="text-xs font-semibold mb-2" style={{ color: accentColor }}>
              {t('rental.extendUnits')}
            </p>
            <p
              className="text-[11px] mb-2"
              style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
            >
              Nechta {extendUnitLabel}ga uzaytirasiz? (1…{maxU})
            </p>
            <select
              disabled={extending}
              value={String(units)}
              onChange={(e) => {
                const v = Math.floor(Number(e.target.value));
                if (!Number.isFinite(v)) return;
                setUnits(Math.max(1, Math.min(maxU, v)));
              }}
              className="w-full h-12 rounded-xl border px-3 text-sm font-bold outline-none mb-3"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                color: isDark ? '#fff' : '#111827',
              }}
            >
              {Array.from({ length: Math.max(1, maxU) }, (_, i) => i + 1).map((v) => (
                <option key={`extend-u-${v}`} value={String(v)}>
                  {v} {extendUnitLabel}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2 mb-4">
              {[1, 2, 3, maxU].filter((v, i, a) => v >= 1 && v <= maxU && a.indexOf(v) === i).map((v) => (
                <button
                  key={`extend-chip-${v}`}
                  type="button"
                  disabled={extending}
                  onClick={() => setUnits(v)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] disabled:opacity-55"
                  style={{
                    background: units === v ? `${accentColor}22` : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: units === v ? `${accentColor}66` : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                    color: units === v ? accentColor : isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)',
                  }}
                >
                  {v === maxU ? `Maksimum (${v} ${extendUnitLabel})` : `${v} ${extendUnitLabel}`}
                </button>
              ))}
            </div>

            <p className="text-sm mb-4" style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)' }}>
              {t('rental.extendApprox')}{' '}
              <span className="font-bold" style={{ color: accentColor }}>
                {approxExtra.toLocaleString(loc)} {cur}
              </span>
            </p>

            <button
              type="button"
              disabled={extending}
              onClick={() => void submitExtend()}
              className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2"
              style={{
                background: accentColor,
                boxShadow: `0 8px 24px ${accentColor}55`,
              }}
            >
              {extending ? <Loader2 className="size-5 animate-spin" /> : null}
              {t('rental.extendSubmit')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
