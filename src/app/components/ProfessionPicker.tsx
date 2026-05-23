import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import {
  PROFESSION_OTHER,
  countFilteredProfessions,
  filterProfessionCategories,
} from '../data/serviceProfessions';

type Props = {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  accentColor: { color: string; gradient?: string };
};

export function ProfessionPicker({ value, onChange, isDark, accentColor }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => filterProfessionCategories(query), [query]);
  const resultCount = useMemo(() => countFilteredProfessions(query), [query]);

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

  const pick = (prof: string) => {
    onChange(prof);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3.5 text-left text-base transition-colors sm:py-4"
        style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.98)',
          borderColor: open ? `${accentColor.color}88` : border,
          color: value ? (isDark ? '#fff' : '#000') : muted,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value || 'Kasbni tanlang'}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: muted }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border shadow-2xl"
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
              placeholder="Kasb qidirish..."
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
            className="max-h-[min(52vh,320px)] overflow-y-auto overscroll-contain p-1.5"
          >
            {resultCount === 0 ? (
              <p className="px-3 py-6 text-center text-sm" style={{ color: muted }}>
                Topilmadi. «Boshqa» ni tanlang va o‘zingiz yozing.
              </p>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="mb-1 last:mb-0">
                  <p
                    className="sticky top-0 z-[1] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm"
                    style={{
                      color: accentColor.color,
                      background: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)',
                    }}
                  >
                    {cat.label}
                  </p>
                  {cat.professions.map((prof) => {
                    const selected = value === prof;
                    return (
                      <button
                        key={prof}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => pick(prof)}
                        className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors active:scale-[0.99]"
                        style={{
                          background: selected ? `${accentColor.color}22` : 'transparent',
                          color: isDark ? '#fff' : '#111',
                          fontWeight: selected ? 700 : 500,
                        }}
                      >
                        {prof}
                      </button>
                    );
                  })}
                </div>
              ))
            )}

            {!query.trim() || PROFESSION_OTHER.toLowerCase().includes(query.trim().toLowerCase()) ? (
              <button
                type="button"
                onClick={() => pick(PROFESSION_OTHER)}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold"
                style={{
                  borderColor: `${accentColor.color}44`,
                  color: accentColor.color,
                  background: value === PROFESSION_OTHER ? `${accentColor.color}14` : 'transparent',
                }}
              >
                {PROFESSION_OTHER} — ro‘yxatda yo‘q kasb
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
