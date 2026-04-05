import { useEffect, useState } from 'react';
import { getUzumNasiyaCountdown, UZUM_NASIYA_LAUNCH_AT } from '../../utils/uzumNasiyaLaunch';

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

  if (ended) {
    return (
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        Uzum Nasiya tez orada yoqiladi — sahifani yangilang.
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
  accentHex: string;
};

const TERMS: UzumNasiyaTerm[] = [3, 6, 12, 24];

export function UzumNasiyaInstallmentBlock({
  totalUzs,
  months,
  onMonthsChange,
  isDark,
  accentHex,
}: InstallmentProps) {
  const sub = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.62)';
  const card = isDark ? 'rgba(124, 58, 237, 0.1)' : 'rgba(124, 58, 237, 0.06)';
  const border = isDark ? 'rgba(124, 58, 237, 0.3)' : 'rgba(124, 58, 237, 0.2)';

  return (
    <div
      className="rounded-2xl border p-4 space-y-4"
      style={{ background: card, borderColor: border }}
    >
      <div>
        <p className="text-sm font-semibold mb-2" style={{ color: isDark ? '#e9d5ff' : '#5b21b6' }}>
          Bo‘lib to‘lash muddati
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TERMS.map((m) => {
            const sel = months === m;
            const per = Math.ceil(Math.max(0, totalUzs) / m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMonthsChange(m)}
                className="rounded-xl border py-3 px-2 text-center transition-all active:scale-[0.98]"
                style={{
                  borderColor: sel ? accentHex : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  background: sel
                    ? isDark
                      ? `${accentHex}35`
                      : `${accentHex}20`
                    : isDark
                      ? 'rgba(0,0,0,0.2)'
                      : '#fff',
                  boxShadow: sel ? `0 0 0 2px ${accentHex}55` : undefined,
                }}
              >
                <div className="text-sm font-bold" style={{ color: sel ? accentHex : undefined }}>
                  {m} oy
                </div>
                <div className="text-[11px] mt-1 leading-tight" style={{ color: sub }}>
                  ~{per.toLocaleString('uz-UZ')} / oy
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-xl border p-3 space-y-2 text-sm"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.9)',
        }}
      >
        <div className="flex justify-between gap-2">
          <span style={{ color: sub }}>Buyurtma jami</span>
          <span className="font-semibold tabular-nums">{Math.max(0, totalUzs).toLocaleString('uz-UZ')} so‘m</span>
        </div>
        <div className="flex justify-between gap-2">
          <span style={{ color: sub }}>Tanlangan muddat</span>
          <span className="font-semibold">{months} oy</span>
        </div>
        <div
          className="flex justify-between gap-2 pt-2 border-t"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
        >
          <span style={{ color: sub }}>Oyiga taxminan</span>
          <span className="font-bold tabular-nums" style={{ color: accentHex }}>
            {Math.ceil(Math.max(0, totalUzs) / months).toLocaleString('uz-UZ')} so‘m
          </span>
        </div>
        <p className="text-[11px] leading-snug pt-1" style={{ color: sub }}>
          Hisob oddiy bo‘lishi uchun jami summaning {months} ga bo‘linishi ko‘rsatilgan. Yakuniy foiz va to‘lov
          jadvali Uzum Nasiya ilovasida tasdiqlanadi.
        </p>
      </div>
    </div>
  );
}

export { isUzumNasiyaAvailable } from '../../utils/uzumNasiyaLaunch';
