import { useEffect, useState } from 'react';
import {
  computePaymentCountdown,
  formatDueDateTimeUz,
  nextInstallmentAmountUz,
} from '../../utils/rentalNextPayment';

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
  const endCd = computePaymentCountdown(rentalPeriodEndsAt, now);
  if (!endCd) return null;
  const soonColor = '#f59e0b';
  const overdueColor = '#ef4444';
  const col =
    endCd.tone === 'overdue' ? overdueColor : endCd.tone === 'soon' ? soonColor : accentColor;
  if (compact) {
    return (
      <div className="mt-1 pt-1 border-t border-dashed" style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}>
        <p className="text-xs font-medium" style={{ color: accentColor }}>
          Ijara tugashi: {formatDueDateTimeUz(endCd.dueDate)}
        </p>
        <p className="text-xs font-semibold" style={{ color: col }}>
          {endCd.remainingUz.replace(/^Qoldi:/, 'Tugashiga qoldi:').replace(/^Kechikkan:/, 'Tugash vaqti o‘tgan:')}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-2 pt-2 border-t border-dashed" style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}>
      <p className="text-sm font-semibold" style={{ color: accentColor }}>
        Ijara tugash vaqti: {formatDueDateTimeUz(endCd.dueDate)}
      </p>
      <p className="text-sm font-bold" style={{ color: col }}>
        {endCd.remainingUz.replace(/^Qoldi:/, 'Tugashiga qoldi:').replace(/^Kechikkan:/, 'Tugash vaqti o‘tgan:')}
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const schedule = String(paymentSchedule || '').toLowerCase();
  const isPeriodic = schedule === 'weekly' || schedule === 'monthly';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const sumLine = nextInstallmentAmountUz(pricePerPeriod, quantity);
  if (awaitingCourierDelivery) {
    return (
      <div className={compact ? 'text-xs mt-1 space-y-1' : 'text-sm mt-2 space-y-1'}>
        <p className="font-semibold" style={{ color: '#d97706' }}>
          Kuryer yetkazib berishi kutilmoqda.
        </p>
        <p style={{ color: muted }}>
          Filial «Kuryer yetkazib berdi»ni bosgach ijara muddati va tugash vaqti boshlanadi
          {isPeriodic ? '; keyingi to‘lov sanasi ham shundan hisoblanadi' : ''}.
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
    return (
      <div className={compact ? 'text-xs mt-1 space-y-0.5' : 'text-sm mt-1 space-y-1'} style={{ color: muted }}>
        {startOk && start && (
          <p>
            Ijara boshlangan:{' '}
            <span className="font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#111827' }}>
              {start.toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </p>
        )}
        <p>Keyingi davriy to‘lov yo‘q — {String(rentalPeriod || 'muddatlik')} ijara.</p>
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

  const periodicBody =
    !cd ? (
      <p className={compact ? 'text-xs mt-1' : 'text-sm mt-1'} style={{ color: muted }}>
        Keyingi to‘lov sanasi hali belgilanmagan.
      </p>
    ) : (
      <>
        <p className={compact ? 'text-xs font-medium' : 'text-sm font-semibold'} style={{ color: accentColor }}>
          {compact ? 'Keyingi to‘lov:' : 'Keyingi to‘lov vaqti:'}{' '}
          {formatDueDateTimeUz(cd.dueDate)}
        </p>
        <p className={compact ? 'text-xs font-semibold' : 'text-sm font-bold'} style={{ color: cd.tone === 'overdue' ? overdueColor : cd.tone === 'soon' ? soonColor : accentColor }}>
          {cd.remainingUz}
        </p>
        {sumLine ? (
          <p className={compact ? 'text-xs' : 'text-sm'} style={{ color: muted }}>
            Navbatdagi summa: {sumLine}
            {schedule === 'weekly' ? ' (har hafta)' : schedule === 'monthly' ? ' (har oy)' : ''}
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
