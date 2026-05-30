import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getUzumNasiyaCountdown, UZUM_NASIYA_LAUNCH_AT, isUzumNasiyaAvailable } from '../../utils/uzumNasiyaLaunch';

export type UzumNasiyaTerm = 3 | 6 | 12 | 24;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function UzumNasiyaCountdownBlock({ isDark }: { isDark: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { day, hr, min, sec, ended } = getUzumNasiyaCountdown();
  const sub = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
  const card = isDark ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.08)';
  const border = isDark ? 'rgba(124, 58, 237, 0.35)' : 'rgba(124, 58, 237, 0.25)';

  if (ended && !isUzumNasiyaAvailable()) {
    return (
      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
        Uzum Nasiya vaqtincha o‘chirilgan. Keyinroq qayta urinib ko‘ring.
      </p>
    );
  }

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ background: card, borderColor: border }}
    >
      <p className="text-sm font-semibold" style={{ color: isDark ? '#e9d5ff' : '#5b21b6' }}>
        Ochilishgacha qolgan vaqt
      </p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { v: day, l: 'kun' },
          { v: pad2(hr), l: 'soat' },
          { v: pad2(min), l: 'daq' },
          { v: pad2(sec), l: 'son' },
        ].map((x) => (
          <div
            key={x.l}
            className="rounded-xl py-2.5 px-1"
            style={{
              background: isDark ? 'rgba(0,0,0,0.35)' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <div className="text-lg font-bold tabular-nums" style={{ color: isDark ? '#fff' : '#1f2937' }}>
              {x.v}
            </div>
            <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: sub }}>
              {x.l}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: sub }}>
        Taxminan{' '}
        <strong style={{ color: isDark ? '#ddd6fe' : '#6d28d9' }}>
          {UZUM_NASIYA_LAUNCH_AT.toLocaleString('uz-UZ', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Tashkent',
          })}
        </strong>{' '}
        dan keyin bo‘lib to‘lashni shu yerdan yakunlashingiz mumkin bo‘ladi.
      </p>
    </div>
  );
}

type InstallmentProps = {
  totalUzs: number;
  months: UzumNasiyaTerm;
  onMonthsChange: (m: UzumNasiyaTerm) => void;
  isDark: boolean;
  accentHex?: string;
  selected?: boolean;
  onSelect?: () => void;
};

const TERMS: UzumNasiyaTerm[] = [24, 12, 6, 3];

const UZUM_LOGO = '/payments/checkout-uzum-nasiya-square.png?v=1';

export function UzumNasiyaInstallmentBlock({
  totalUzs,
  months,
  onMonthsChange,
  isDark,
  selected = false,
  onSelect,
}: InstallmentProps) {
  const monthly = Math.ceil(Math.max(0, totalUzs) / months);

  const cardBg = isDark ? '#18181b' : '#ffffff';
  const cardBorder = selected ? 'rgba(124, 58, 237, 0.55)' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const segmentTrack = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6';
  const segmentActive = isDark ? '#27272a' : '#ffffff';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className="overflow-hidden rounded-2xl border transition-all active:scale-[0.99] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
      style={{
        background: selected
          ? isDark
            ? 'linear-gradient(145deg, rgba(124,58,237,0.18), rgba(24,24,27,1))'
            : 'linear-gradient(145deg, rgba(124,58,237,0.08), #ffffff)'
          : cardBg,
        borderColor: cardBorder,
        boxShadow: selected
          ? '0 8px 28px rgba(124,58,237,0.22)'
          : isDark
            ? 'none'
            : '0 2px 16px rgba(15,23,42,0.06)',
      }}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={{ background: '#ff6b00' }}
          >
            <img src={UZUM_LOGO} alt="Uzum Nasiya" className="h-9 w-9 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight" style={{ color: isDark ? '#fff' : '#111827' }}>
              Uzum Nasiya
            </p>
            <p className="text-[13px] leading-snug" style={{ color: muted }}>
              Muddatli to&apos;lov kalkulyatori
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0" style={{ color: muted }} aria-hidden />
        </div>

        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: segmentTrack }}
          onClick={(e) => e.stopPropagation()}
        >
          {TERMS.map((m) => {
            const termSelected = months === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMonthsChange(m)}
                className="flex-1 rounded-lg py-2.5 text-center text-[14px] font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: termSelected ? segmentActive : 'transparent',
                  color: termSelected ? (isDark ? '#fff' : '#111827') : muted,
                  boxShadow: termSelected
                    ? isDark
                      ? '0 1px 4px rgba(0,0,0,0.35)'
                      : '0 1px 4px rgba(15,23,42,0.08)'
                    : 'none',
                }}
              >
                {m} oy
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className="inline-flex items-center rounded-xl px-3 py-2 text-[22px] font-bold tabular-nums leading-none"
            style={{
              background: '#ffe566',
              color: '#111827',
            }}
          >
            {monthly.toLocaleString('uz-UZ')} so&apos;m
          </span>
          <span
            className="text-[18px] font-semibold tabular-nums"
            style={{ color: isDark ? 'rgba(255,255,255,0.88)' : '#111827' }}
          >
            × {months} oy
          </span>
        </div>
      </div>
    </div>
  );
}

export { isUzumNasiyaAvailable };
