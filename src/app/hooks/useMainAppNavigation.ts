import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  MAIN_APP_QUERY,
  parseMainAppSearch,
  patchSearchParams,
  searchParamsToString,
} from '../utils/mainAppSearchParams';

/**
 * Asosiy (/) marshrut: har bir tab va overlay alohida tarix yozuvi — Android orqaga tug‘masi ichkariga qaytadi.
 */
export function useMainAppNavigation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const parsed = useMemo(() => parseMainAppSearch(searchParams), [searchParams]);

  const pushSearch = useCallback(
    (next: URLSearchParams) => {
      navigate({ pathname: '/', search: searchParamsToString(next) });
    },
    [navigate],
  );

  const replaceSearch = useCallback(
    (next: URLSearchParams) => {
      navigate({ pathname: '/', search: searchParamsToString(next) }, { replace: true });
    },
    [navigate],
  );

  /** Faqat tab (boshqa kalitlar tozalanadi) — yangi "sahifa" sifatida tarixga yoziladi. */
  const goTab = useCallback(
    (tab: string) => {
      const p = new URLSearchParams();
      p.set(MAIN_APP_QUERY.tab, tab);
      pushSearch(p);
    },
    [pushSearch],
  );

  const pushPatch = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      pushSearch(patchSearchParams(searchParams, patch));
    },
    [pushSearch, searchParams],
  );

  const replacePatch = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      replaceSearch(patchSearchParams(searchParams, patch));
    },
    [replaceSearch, searchParams],
  );

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return {
    searchParams,
    parsed,
    goTab,
    pushPatch,
    replacePatch,
    goBack,
    pushSearch,
    /** Birinchi yuklash: faqat `tab` qo‘shish uchun */
    replaceSearch,
  };
}
