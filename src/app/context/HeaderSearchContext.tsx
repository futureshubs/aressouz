import { createContext, useContext, type ReactNode } from 'react';

export type HeaderSearchValue = {
  query: string;
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
  return useContext(HeaderSearchContext) ?? { query: '', setQuery: () => {} };
}
