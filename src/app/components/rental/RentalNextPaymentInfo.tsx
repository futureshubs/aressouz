import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { computePaymentCountdown } from '../../utils/rentalNextPayment';
import {
  formatRentalCountdownLine,
  nextInstallmentAmountI18n,
  useUserPanelT,
  userPanelFormatDateTime,
} from '../../i18n/userPanel';

type Props = {
  paymentSchedule?: string | null;
  nextPaymentDue?: string | null;
  pricePerPeriod?: number;
  quantity?: number;
  contractStartDate?: string | null;
  rentalPeriodStartedAt?: string | null;
  rentalPeriodEndsAt?: string | null;
  rentalPeriod?: string | null;
  /** Server: deliveryPending === true */
  awaitingCourierDelivery?: boolean;
  /** Profil kartochkasi — ixcham */
  compact?: boolean;
  isDark?: boolean;
  accentColor?: string;
};

function RentalEndBlock({
  rentalPeriodEndsAt,
  now,
  compact,
  isDark,
  accentColor,
}: {
  rentalPeriodEndsAt: string;
  now: number;
  compact: boolean;
  isDark: boolean;
  accentColor: string;
}) {
  const { language } = useTheme();
  const t = useUserPanelT();
  const endCd = computePaymentCountdown(rentalPeriodEndsAt, now);
  if (!endCd) return null;
  const soonColor = '#f59e0b';
  const overdueColor = '#ef4444';
  const col =
    endCd.tone === 'overdue' ? overdueColor : endCd.tone === 'soon' ? soonColor : accentColor;
  const line = formatRentalCountdownLine(
    language,
    endCd.overdue,
    endCd.days,
    endCd.hours,
    endCd.mins,
  );
  if (compact) {
    return (
      <div
        className="mt-1 pt-1 border-t border-dashed"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
      >
        <p className="text-xs font-medium" style={{ color: accentColor }}>
          {t('rental.endCompact')} {userPanelFormatDateTime(language, endCd.dueDate)}
        </p>
        <p className="text-xs font-semibold" style={{ color: col }}>
          {line}
        </p>
      </div>
    );
  }
  return (
    <div
      className="mt-2 pt-2 border-t border-dashed"
      style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
    >
      <p className="text-sm font-semibold" style={{ color: accentColor }}>
        {t('rental.endFull')} {userPanelFormatDateTime(language, endCd.dueDate)}
      </p>
      <p className="text-sm font-bold" style={{ color: col }}>
        {line}
      </p>
    </div>
  );
}

export function RentalNextPaymentInfo({
  paymentSchedule,
  nextPaymentDue,
  pricePerPeriod,
  quantity,
  contractStartDate,
  rentalPeriodStartedAt,
  rentalPeriodEndsAt,
  rentalPeriod,
  awaitingCourierDelivery = false,
  compact = false,
  isDark = false,
  accentColor = '#14b8a6',
}: Props) {
  const { language } = useTheme();
  const t = useUserPanelT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const schedule = String(paymentSchedule || '').toLowerCase();
  const isPeriodic = schedule === 'weekly' || schedule === 'monthly';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const sumLine = nextInstallmentAmountI18n(language, pricePerPeriod, quantity);

  if (awaitingCourierDelivery) {
    return (
      <div className={compact ? 'text-xs mt-1 space-y-1' : 'text-sm mt-2 space-y-1'}>
        <p className="font-semibold" style={{ color: '#d97706' }}>
          {t('rental.courierPending')}
        </p>
        <p style={{ color: muted }}>
          {t('rental.courierHint', {
            periodic: isPeriodic ? t('rental.courierHintPeriodic') : '',
          })}
        </p>
      </div>
    );
  }

  const started = Boolean(rentalPeriodStartedAt);
  const endIso = rentalPeriodEndsAt ? String(rentalPeriodEndsAt) : '';

  if (!isPeriodic) {
    const startSrc = rentalPeriodStartedAt || contractStartDate;
    const start = startSrc ? new Date(startSrc) : null;
    const startOk = Boolean(start && !Number.isNaN(start.getTime()));
    const periodWord = String(rentalPeriod || '').trim() || t('rental.periodFallback');
    return (
      <div
        className={compact ? 'text-xs mt-1 space-y-0.5' : 'text-sm mt-1 space-y-1'}
        style={{ color: muted }}
      >
        {startOk && start && (
          <p>
            {t('rental.started')}{' '}
            <span className="font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#111827' }}>
              {userPanelFormatDateTime(language, start)}
            </span>
          </p>
        )}
        <p>{t('rental.noPeriodic', { type: periodWord })}</p>
        {started && endIso ? (
          <RentalEndBlock
            rentalPeriodEndsAt={endIso}
            now={now}
            compact={compact}
            isDark={isDark}
            accentColor={accentColor}
          />
        ) : null}
      </div>
    );
  }

  const cd = computePaymentCountdown(nextPaymentDue, now);
  const soonColor = '#f59e0b';
  const overdueColor = '#ef4444';

  const periodicBody = !cd ? (
    <p className={compact ? 'text-xs mt-1' : 'text-sm mt-1'} style={{ color: muted }}>
      {t('rental.nextUnset')}
    </p>
  ) : (
    <>
      <p
        className={compact ? 'text-xs font-medium' : 'text-sm font-semibold'}
        style={{ color: accentColor }}
      >
        {compact ? t('rental.nextPayCompact') : t('rental.nextPayFull')}{' '}
        {userPanelFormatDateTime(language, cd.dueDate)}
      </p>
      <p
        className={compact ? 'text-xs font-semibold' : 'text-sm font-bold'}
        style={{
          color: cd.tone === 'overdue' ? overdueColor : cd.tone === 'soon' ? soonColor : accentColor,
        }}
      >
        {formatRentalCountdownLine(language, cd.overdue, cd.days, cd.hours, cd.mins)}
      </p>
      {sumLine ? (
        <p className={compact ? 'text-xs' : 'text-sm'} style={{ color: muted }}>
          {t('rental.nextAmount')} {sumLine}
          {schedule === 'weekly' ? t('rental.perWeek') : schedule === 'monthly' ? t('rental.perMonth') : ''}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div className="mt-1 space-y-0.5">
        {periodicBody}
        {started && endIso ? (
          <RentalEndBlock
            rentalPeriodEndsAt={endIso}
            now={now}
            compact
            isDark={isDark}
            accentColor={accentColor}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {periodicBody}
      {started && endIso ? (
        <RentalEndBlock
          rentalPeriodEndsAt={endIso}
          now={now}
          compact={false}
          isDark={isDark}
          accentColor={accentColor}
        />
      ) : null}
    </div>
  );
}
