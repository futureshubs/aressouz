import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '../../utils/useBodyScrollLock';
import { chatImageFallbackLabel } from '../../utils/chatMessageDisplay';

type Props = {
  url: string;
  alt?: string;
  isOwn: boolean;
  imageCaption?: string;
  isDark?: boolean;
  maxThumbHeightClass?: string;
};

/**
 * Support chat rasmi — `<a href>` o‘rniga lightbox (yopgach qayta ochilish bug’i yo‘q).
 */
export function ChatImageBubble({
  url,
  alt = 'Rasm',
  isOwn,
  imageCaption,
  isDark = true,
  maxThumbHeightClass = 'max-h-80',
}: Props) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  useBodyScrollLock(open);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const label = chatImageFallbackLabel(isOwn, imageCaption);

  return (
    <>
      <button
        type="button"
        className="block w-full text-left rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!broken) setOpen(true);
        }}
        aria-label="Rasmni kattalashtirish"
      >
        {!broken ? (
          <img
            src={url}
            alt={alt}
            className={`w-full ${maxThumbHeightClass} rounded-xl object-contain bg-black/10`}
            loading="lazy"
            draggable={false}
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-sm opacity-80">Rasm yuklanmadi</span>
        )}
      </button>
      {label ? (
        <p className="text-sm mt-1.5 whitespace-pre-wrap break-words opacity-95">{label}</p>
      ) : null}

      {open && !broken ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Rasm ko‘rinishi"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-[301] p-2 rounded-full text-white/90 hover:bg-white/10"
            onClick={close}
            aria-label="Yopish"
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain select-none"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
          {label ? (
            <p
              className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg text-center text-sm px-4 py-2 rounded-xl"
              style={{
                color: '#fff',
                background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.5)',
              }}
            >
              {label}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
