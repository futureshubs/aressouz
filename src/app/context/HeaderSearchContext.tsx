import { createContext, useContext, type ReactNode } from 'react';

export type HeaderSearchValue = {
  /** Input bilan sinxron (darhol) */
  query: string;
  /** Ro‘yxat filtri / ranking (~140ms debounce) */
  effectiveQuery: string;
  setQuery: (q: string) => void;
};

export const HeaderSearchContext = createContext<HeaderSearchValue | null>(null);

export function HeaderSearchProvider({
  value,
  children,
}: {
  value: HeaderSearchValue;
  children: ReactNode;
}) {
  return <HeaderSearchContext.Provider value={value}>{children}</HeaderSearchContext.Provider>;
}

export function useHeaderSearch(): HeaderSearchValue {
  const ctx = useContext(HeaderSearchContext);
  if (!ctx) {
    throw new Error('useHeaderSearch: HeaderSearchProvider ichida ishlating');
  }
  return ctx;
}

export function useHeaderSearchOptional(): HeaderSearchValue {
  return useContext(HeaderSearchContext) ?? { query: '', effectiveQuery: '', setQuery: () => {} };
}
