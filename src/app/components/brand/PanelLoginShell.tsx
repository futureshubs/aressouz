import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import AressoPanelBrand, { type AressoPanelVariant } from './AressoPanelBrand';

type Props = {
  variant: AressoPanelVariant;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  isDark: boolean;
  accentColor: string;
  children: ReactNode;
  maxWidthClass?: string;
  /** Mobil klaviatura — restaurant login kabi */
  keyboardSafe?: boolean;
};

/** Barcha panel login sahifalari — bir xil fon, logo, kartochka */
export default function PanelLoginShell({
  variant,
  subtitle,
  showBack = true,
  backTo = '/',
  isDark,
  accentColor,
  children,
  maxWidthClass = 'max-w-md',
  keyboardSafe = false,
}: Props) {
  const navigate = useNavigate();

  return (
    <div
      className={
        keyboardSafe
          ? 'flex items-start sm:items-center justify-center p-4 app-safe-pt overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
          : 'min-h-screen flex items-center justify-center p-4 app-safe-pt'
      }
      style={{
        minHeight: keyboardSafe ? 'var(--app-viewport-height, 100dvh)' : undefined,
        paddingBottom: keyboardSafe
          ? 'calc(1rem + var(--kb-inset, 0px) + var(--app-safe-bottom, 0px))'
          : undefined,
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <div className={`w-full ${maxWidthClass}`}>
        {showBack ? (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Ortga
          </button>
        ) : null}

        <div
          className="rounded-3xl p-8 border"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            boxShadow: isDark
              ? '0 25px 50px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="mb-8">
            <AressoPanelBrand
              variant={variant}
              size="lg"
              align="center"
              subtitle={subtitle}
              isDark={isDark}
              accentColor={accentColor}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
