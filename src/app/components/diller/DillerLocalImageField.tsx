import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { resolveDillerImage, saveDillerLocalImage } from '../../utils/dillerMedia';

type Props = {
  imageUrl: string;
  onChange: (url: string) => void;
  isDark: boolean;
  accentColor: string;
  label?: string;
  hint?: string;
  variant?: 'default' | 'hero';
};

export function DillerLocalImageField({
  imageUrl,
  onChange,
  isDark,
  accentColor,
  label = 'Rasm',
  hint,
  variant = 'default',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const preview = resolveDillerImage(imageUrl);

  const pick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const saved = await saveDillerLocalImage(file);
      onChange(saved.ref);
    } catch {
      toast.error('Rasm saqlanmadi');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      className="hidden"
      onChange={(e) => void pick(e.target.files?.[0] ?? null)}
    />
  );

  if (variant === 'hero') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-[96px] h-[96px] rounded-[22px] overflow-hidden flex items-center justify-center border border-dashed active:scale-[0.97]"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.10)',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(241,245,249,0.9)',
              color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(148,163,184,0.95)',
            }}
            aria-label="Rasm qo‘shish"
          >
            {busy ? (
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: accentColor }} />
            ) : preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-8 h-8" strokeWidth={1.6} />
            )}
          </button>
          {preview ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange('')}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-red-400"
              style={{
                background: isDark ? 'rgba(28,28,30,0.95)' : '#fff',
                boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
              }}
              aria-label="Rasmni o‘chirish"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : null}
        </div>
        <p className="text-[11px] opacity-40 mt-2.5 text-center leading-relaxed max-w-[16rem]">
          {hint ?? 'Rasm faqat shu telefon/kompyuterda saqlanadi'}
        </p>
        {fileInput}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium opacity-80 mb-1">
        {label} <span className="opacity-45 font-normal">(ixtiyoriy)</span>
      </label>
      {hint ? <p className="text-[10px] opacity-45 mb-2 leading-relaxed">{hint}</p> : null}

      {preview ? (
        <div className="flex items-center gap-3">
          <div
            className="w-16 h-16 rounded-xl overflow-hidden shrink-0"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#eee' }}
          >
            <img src={preview} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold py-2 px-3 rounded-xl"
              style={{ color: accentColor }}
            >
              Boshqa rasm
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange('')}
              className="text-xs font-semibold py-2 px-3 rounded-xl text-red-400 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              O‘chirish
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="w-full py-5 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            color: accentColor,
          }}
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-7 h-7" />}
          <span className="text-xs font-semibold">Rasm qo‘shish</span>
        </button>
      )}

      {fileInput}
    </div>
  );
}
