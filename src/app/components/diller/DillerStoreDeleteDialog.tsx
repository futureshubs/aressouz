import { AlertTriangle } from 'lucide-react';

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
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 app-safe-pad"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diller-store-delete-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Yopish"
        onClick={() => onOpenChange(false)}
      />

      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: isDark ? '#141414' : '#fff',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="px-5 pt-5 pb-4"
          style={{
            background: isDark
              ? 'linear-gradient(180deg, rgba(239,68,68,0.12), transparent)'
              : 'linear-gradient(180deg, rgba(239,68,68,0.08), transparent)',
          }}
        >
          <div className="w-11 h-11 rounded-2xl bg-red-500/15 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h2 id="diller-store-delete-title" className="text-base font-bold leading-snug">
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
            className="w-full py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              color: isDark ? '#fff' : '#111',
            }}
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-red-500 active:scale-[0.98] transition-transform"
          >
            Ha, o‘chirish
          </button>
        </div>
      </div>
    </div>
  );
}
