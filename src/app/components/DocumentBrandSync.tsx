import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { applyDocumentBrand } from '../utils/documentBrand';

/** Marshrut o‘zgarganda tab ikonkasi va sarlavhasini yangilaydi. */
export function DocumentBrandSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    applyDocumentBrand(pathname);
  }, [pathname]);

  return null;
}
