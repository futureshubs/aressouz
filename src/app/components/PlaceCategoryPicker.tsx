import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { findPlaceCategory, getGroupedPlaceCategories } from '../data/places';

type Props = {
  value: string;
  onChange: (categoryId: string) => void;
  isDark: boolean;
  accentColor: { color: string; gradient?: string };
  required?: boolean;
};

export function PlaceCategoryPicker({ value, onChange, isDark, accentColor }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => getGroupedPlaceCategories(query), [query]);
  const resultCount = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups],
  );
  const selected = findPlaceCategory(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const panelBg = isDark ? '#141414' : '#ffffff';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors sm:py-3.5"
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.98)',
          borderColor: open ? `${accentColor.color}88` : border,
          color: selected ? (isDark ? '#fff' : '#000') : muted,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-lg"
              style={{
                background: `${accentColor.color}18`,
                border: `1px solid ${accentColor.color}33`,
              }}
            >
              {selected.icon}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 truncate">Kategoriya tanlang</span>
        )}
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: muted }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-[60] mt-2 overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background: panelBg,
            borderColor: border,
            boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.55)' : '0 16px 40px rgba(15,23,42,0.14)',
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-3 py-2.5"
            style={{ borderColor: border }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: muted }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kategoriya qidirish..."
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              style={{ color: isDark ? '#fff' : '#111' }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-lg p-1"
                aria-label="Tozalash"
              >
                <X className="h-4 w-4" style={{ color: muted }} />
              </button>
            ) : null}
          </div>

          <div
            role="listbox"
            className="max-h-[min(52vh,360px)] overflow-y-auto overscroll-contain p-1.5"
          >
            {resultCount === 0 ? (
              <p className="px-3 py-6 text-center text-sm" style={{ color: muted }}>
                Kategoriya topilmadi
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="mb-1 last:mb-0">
                  <p
                    className="sticky top-0 z-[1] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm"
                    style={{
                      color: accentColor.color,
                      background: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)',
                    }}
                  >
                    {group.label}
                  </p>
                  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                    {group.items.map((cat) => {
                      const isSelected = value === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => pick(cat.id)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors active:scale-[0.99]"
                          style={{
                            background: isSelected ? `${accentColor.color}18` : 'transparent',
                            color: isDark ? '#fff' : '#111',
                            fontWeight: isSelected ? 700 : 500,
                          }}
                        >
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-base"
                            style={{
                              background: isSelected
                                ? `${accentColor.color}22`
                                : isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.04)',
                            }}
                          >
                            {cat.icon}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                          {isSelected ? (
                            <Check className="size-4 shrink-0" style={{ color: accentColor.color }} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
