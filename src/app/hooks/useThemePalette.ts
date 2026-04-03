import { useTheme } from '../context/ThemeContext';
import { getThemeColors } from '../utils/themeColors';

/** Modal / auth ekranlari uchun yorug‘-qorong‘i palitra (themeColors.ts) */
export function useThemePalette(platform: 'ios' | 'android' = 'android') {
  const { theme } = useTheme();
  return {
    theme,
    isLight: theme === 'light',
    isDark: theme === 'dark',
    tc: getThemeColors(theme, platform),
  };
}
