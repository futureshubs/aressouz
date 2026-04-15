import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { RENTAL_TERMS_CLAUSES, RENTAL_TERMS_TITLE } from '../constants/rentalTermsUz';

export type RentalTermsAccent = {
  color: string;
  gradient: string;
};

type RentalTermsConsentModalProps = {
  open: boolean;
  onClose: () => void;
  /** Checkbox belgilangan va “Roziman” bosilganda (async bo‘lishi mumkin) */
  onConfirm: () => void | Promise<void>;
  isDark: boolean;
  accentColor: RentalTermsAccent;
};

export function RentalTermsConsentModal({
  open,
  onClose,
  onConfirm,
  isDark,
  accentColor,
}: RentalTermsConsentModalProps) {
  const reactId = useId();
  const checkboxId = `rental-terms-${reactId}`;
  const titleId = `rental-terms-title-${reactId}`;
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setChecked(false);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!checked || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await Promise.resolve(onConfirm());
    } catch {
      // Xatolikni ota komponent toast orqali bildiradi
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 app-safe-pad bg-black/65 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="rounded-3xl max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col shadow-2xl border"
        style={{
          background: isDark ? 'rgb(17 24 39)' : '#ffffff',
          borderColor: isDark ? `${accentColor.color}33` : `${accentColor.color}22`,
          boxShadow: isDark
            ? `0 25px 80px -12px rgba(0,0,0,0.7), 0 0 0 1px ${accentColor.color}22`
            : `0 25px 80px -12px ${accentColor.color}25`,
        }}
      >
        <div
          className="relative p-6 sm:p-8 text-white shrink-0"
          style={{ background: accentColor.gradient }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 pr-2">
              <p className="text-sm font-medium opacity-90 mb-1" aria-hidden>
                🏠
              </p>
              <h3
                id={titleId}
                className="text-lg sm:text-xl font-bold leading-snug tracking-tight"
              >
                {RENTAL_TERMS_TITLE}
              </h3>
              <p className="text-sm mt-2 opacity-90 max-w-xl">
                Foydalanuvchi roziligi va majburiyatlari
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="shrink-0 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto p-6 sm:p-8 min-h-0"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, rgba(255,255,255,0.04), transparent)'
              : 'linear-gradient(to bottom, rgba(0,0,0,0.02), transparent)',
          }}
        >
          <div className="space-y-5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {RENTAL_TERMS_CLAUSES.map((clause) => (
              <section
                key={clause.n}
                className="rounded-2xl p-4 border"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : `${accentColor.color}18`,
                  background: isDark ? 'rgba(255,255,255,0.03)' : `${accentColor.color}08`,
                }}
              >
                <h4 className="font-bold mb-2" style={{ color: accentColor.color }}>
                  {clause.n}. {clause.title}
                </h4>
                <p className="text-gray-600 dark:text-gray-400">{clause.body}</p>
              </section>
            ))}
          </div>

          <div
            className="mt-6 p-4 rounded-2xl border"
            style={{
              background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
              borderColor: isDark ? 'rgba(248, 113, 113, 0.35)' : 'rgba(248, 113, 113, 0.45)',
            }}
          >
            <p className="text-xs text-red-800 dark:text-red-200">
              Diqqat: shartlarga rioya qilmaslik huquqiy javobgarlikka olib kelishi mumkin.
            </p>
          </div>
        </div>

        <div
          className="p-5 sm:p-6 border-t shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              id={checkboxId}
              checked={checked}
              disabled={isSubmitting}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              style={{ accentColor: accentColor.color }}
            />
            <label
              htmlFor={checkboxId}
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              Men yuqoridagi barcha ijara shartlarini o‘qib, to‘liq tushundim va ularning barchasiga roziman
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              style={{
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                color: isDark ? '#e5e7eb' : '#374151',
              }}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!checked || isSubmitting}
              className="flex-1 px-4 py-3 text-white rounded-xl font-medium transition-all disabled:opacity-45 disabled:cursor-not-allowed shadow-lg"
              style={{
                background: accentColor.gradient,
                boxShadow: checked && !isSubmitting ? `0 8px 24px ${accentColor.color}45` : undefined,
              }}
            >
              {isSubmitting ? 'Yuborilmoqda…' : 'Roziman'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
