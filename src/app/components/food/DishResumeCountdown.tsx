import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import {
  computeDishResumeCountdown,
  dishStopLabelUz,
  formatDishResumeCountdownHms,
  isDishTemporarilyStopped,
} from '../../utils/dishResumeCountdown';

type Props = {
  dish: {
    isActive?: boolean;
    autoResumeAt?: string | null;
    stopLabel?: string | null;
  };
  isDark: boolean;
  accentColor: string;
  /** Modal pastki qism — kattaroq */
  prominent?: boolean;
};

export function DishResumeCountdown({ dish, isDark, accentColor, prominent = false }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isDishTemporarilyStopped(dish)) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [dish.isActive, dish.autoResumeAt]);

  if (!isDishTemporarilyStopped(dish)) return null;

  const cd = computeDishResumeCountdown(dish.autoResumeAt, now);
  const label = dishStopLabelUz(dish);
  const col = '#f59e0b';

  if (!cd) {
    return (
      <p className="text-xs font-semibold text-center" style={{ color: col }}>
        {label} — tez orada qayta ochiladi
      </p>
    );
  }

  const hms = formatDishResumeCountdownHms(cd);

  if (prominent) {
    return (
      <div
        className="rounded-xl px-3 py-2.5 border mb-2"
        style={{
          background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
          borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.4)',
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: col }}>
          {label} — qayta sotuv
        </p>
        <p className="text-lg sm:text-xl font-extrabold tabular-nums font-mono leading-none" style={{ color: col }}>
          {hms}
        </p>
        <p className="text-[11px] mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
          Ish vaqti boshlanguncha savatga qo‘shib bo‘lmaydi
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center gap-1.5 text-[11px] font-semibold tabular-nums font-mono"
      style={{ color: col }}
    >
      <Timer className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
      <span>·</span>
      <span>{hms}</span>
    </div>
  );
}
