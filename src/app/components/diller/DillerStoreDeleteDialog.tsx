import { AlertTriangle } from 'lucide-react';
import { iosGlassCardStyle } from './dillerIosGlass';

export type StoreDeleteCandidate = {
  id: string;
  name: string;
  saleCount: number;
};

type Props = {
  open: boolean;
  candidate: StoreDeleteCandidate | null;
  isDark: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DillerStoreDeleteDialog({
  open,
  candidate,
  isDark,
  onOpenChange,
  onConfirm,
}: Props) {
  if (!open || !candidate) return null;

  const hasSales = candidate.saleCount > 0;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 app-safe-pad animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diller-store-delete-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[12px]"
        aria-label="Yopish"
        onClick={() => onOpenChange(false)}
      />

      <div
        className="relative w-full max-w-sm rounded-[28px] overflow-hidden animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-200"
        style={iosGlassCardStyle(isDark)}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="w-12 h-12 rounded-[18px] bg-red-500/18 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h2 id="diller-store-delete-title" className="text-base font-black leading-snug tracking-tight">
            Do‘konni o‘chirasizmi?
          </h2>
          <p
            className="text-sm leading-relaxed mt-2"
            style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}
          >
            <strong className="font-semibold" style={{ color: isDark ? '#fff' : '#111' }}>
              «{candidate.name}»
            </strong>{' '}
            do‘koni butunlay o‘chiriladi.
            {hasSales ? (
              <>
                {' '}
                Bog‘liq{' '}
                <strong className="text-red-500">{candidate.saleCount} ta sotuv</strong> ham yo‘qoladi
                — bu amalni qaytarib bo‘lmaydi.
              </>
            ) : (
              <> Bu amalni qaytarib bo‘lmaydi.</>
            )}
          </p>
        </div>

        <div className="px-5 pb-5 flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full py-3 rounded-[16px] font-bold text-sm active:scale-[0.98] transition-transform"
            style={iosGlassCardStyle(isDark)}
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 rounded-[16px] font-bold text-sm text-white bg-red-500 active:scale-[0.98] transition-transform shadow-[0_8px_20px_rgba(239,68,68,0.35)]"
          >
            Ha, o‘chirish
          </button>
        </div>
      </div>
    </div>
  );
}
