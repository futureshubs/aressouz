import { useEffect, useState } from 'react';
import { computeTargetCountdown } from '../../utils/rentalNextPayment';
import { useUserPanelT } from '../../i18n/userPanel';

type Props = {
  rentalPeriodEndsAt: string;
  isDark: boolean;
  accentColor: string;
  /** Katta profil kartochkasi */
  prominent?: boolean;
};

export function RentalLiveCountdown({
  rentalPeriodEndsAt,
  isDark,
  accentColor,
  prominent = false,
}: Props) {
  const t = useUserPanelT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cd = computeTargetCountdown(rentalPeriodEndsAt, now);
  if (!cd) return null;

  const col =
    cd.tone === 'overdue' ? '#ef4444' : cd.tone === 'soon' ? '#f59e0b' : accentColor;
  const hms = (
    <span className="tabular-nums tracking-tight font-mono">
      {cd.days > 0 ? `${cd.days}${t('rental.countdownDaySuffix')} ` : ''}
      {String(cd.hours).padStart(2, '0')}:{String(cd.mins).padStart(2, '0')}:
      {String(cd.secs).padStart(2, '0')}
    </span>
  );

  if (prominent) {
    return (
      <div
        className="rounded-xl px-3 py-2.5 border"
        style={{
          background: isDark ? 'rgba(0,0,0,0.35)' : `linear-gradient(135deg, ${accentColor}12, transparent)`,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : `${accentColor}40`,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: col }}>
          {cd.overdue ? t('rental.countdownLateLabel') : t('rental.profileCountdownTitle')}
        </p>
        <p className="text-lg sm:text-xl font-extrabold leading-none" style={{ color: col }}>
          {hms}
        </p>
      </div>
    );
  }

  return (
    <p className="text-xs font-semibold font-mono tabular-nums" style={{ color: col }}>
      {cd.overdue ? t('rental.countdownLateLabel') : t('rental.countdownLeftLabel')} {hms}
    </p>
  );
}
