import { useEffect, useMemo, useState } from 'react';

type ExpandableTextProps = {
  text: string;
  /**
   * Mobile preview line clamp (default: 2).
   * Desktop shows full text (no clamp).
   */
  mobileLines?: number;
  /**
   * Only show the toggle if text is long enough.
   * Defaults to 140 chars to match existing restaurant behavior.
   */
  minToggleChars?: number;
  className?: string;
  style?: React.CSSProperties;
  moreLabel?: string;
  lessLabel?: string;
  toggleColor?: string;
};

export function ExpandableText({
  text,
  mobileLines = 2,
  minToggleChars = 140,
  className,
  style,
  moreLabel = "Batafsil",
  lessLabel = "Yopish",
  toggleColor,
}: ExpandableTextProps) {
  const normalized = String(text ?? '').trim();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Reset when content changes (e.g. switching items)
    setExpanded(false);
  }, [normalized]);

  const showToggle = useMemo(
    () => normalized.length >= minToggleChars,
    [minToggleChars, normalized.length],
  );

  if (!normalized) return null;

  return (
    <div>
      <button
        type="button"
        className="w-full text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <p
          className={className}
          style={{
            ...style,
            ...(expanded
              ? {}
              : {
                  display: '-webkit-box',
                  WebkitLineClamp: mobileLines,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }),
          }}
        >
          {normalized}
        </p>
      </button>

      {showToggle && (
        <div className="mt-2 sm:hidden">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-semibold"
            style={toggleColor ? { color: toggleColor } : undefined}
          >
            {expanded ? lessLabel : moreLabel}
          </button>
        </div>
      )}
    </div>
  );
}

