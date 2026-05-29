import { aressoMainLogoSrc } from '../../utils/aressoBrandAssets';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  size?: number;
  className?: string;
  isDark?: boolean;
};

/** Asosiy Aresso logosi — kun/tun avtomatik */
export default function AressoMainLogo({ size = 32, className = '', isDark: isDarkProp }: Props) {
  const { theme } = useTheme();
  const isDark = isDarkProp ?? theme === 'dark';
  const src = aressoMainLogoSrc(isDark);

  return (
    <img
      src={src}
      alt="Aresso"
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className}`.trim()}
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}
