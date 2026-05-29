import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { applyDocumentBrand } from '../utils/documentBrand';

/** Marshrut yoki tema o‘zgarganda tab ikonkasi va sarlavhasini yangilaydi. */
export function DocumentBrandSync() {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    applyDocumentBrand(pathname, isDark);
  }, [pathname, isDark]);

  return null;
}
