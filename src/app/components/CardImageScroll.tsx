import { useCallback, useRef, useState } from 'react';

type CardImageScrollProps = {
  images: string[];
  alt: string;
  /** Tashqi quti (masalan bo‘sh — ota `aspect-square` / `h-28` beradi) */
  className?: string;
  imgClassName?: string;
  /** Gorizontal scroll / swipe — ota `onClick` ni bir marta yubormaslik uchun */
  onUserInteracted?: () => void;
  showDots?: boolean;
  dotColor?: string;
};

/**
 * Kartochka ichida bir nechta rasm — barmoq bilan gorizontal scroll (snap).
 * Bitta rasm bo‘lsa oddiy <img>.
 */
export function CardImageScroll({
  images,
  alt,
  className = '',
  imgClassName = 'h-full w-full object-cover',
  onUserInteracted,
  showDots = true,
  dotColor = '#14b8a6',
}: CardImageScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const firedRef = useRef(false);

  const notify = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onUserInteracted?.();
    window.setTimeout(() => {
      firedRef.current = false;
    }, 450);
  }, [onUserInteracted]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    notify();
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    setIdx(Math.min(Math.max(0, i), Math.max(0, images.length - 1)));
  }, [images.length, notify]);

  const list = images.filter(Boolean);
  if (list.length === 0) return null;

  if (list.length === 1) {
    return (
      <img
        src={list[0]}
        alt={alt}
        className={imgClassName}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    );
  }

  return (
    <div className={`relative h-full w-full min-h-0 min-w-0 ${className}`}>
      <div
        ref={scrollRef}
        role="group"
        aria-label={alt}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scrollbar-hide overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]"
      >
        {list.map((src, i) => (
          <div
            key={`${src.slice(-48)}-${i}`}
            className="h-full min-h-0 w-full min-w-full shrink-0 snap-start"
          >
            <img
              src={src}
              alt={i === 0 ? alt : ''}
              aria-hidden={i !== 0}
              className={imgClassName}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          </div>
        ))}
      </div>
      {showDots ? (
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-[1] flex -translate-x-1/2 gap-1">
          {list.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-200"
              style={{
                width: idx === i ? 14 : 4,
                background: idx === i ? dotColor : 'rgba(255,255,255,0.5)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
