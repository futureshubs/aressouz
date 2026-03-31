import { MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SupportChatModal } from './SupportChatModal';

interface SupportChatWidgetProps {
  /** AppContent activeTab */
  activeTab: string;
  /** Hide when profile overlay open */
  isProfileOpen: boolean;
}

const shouldShowOnTab = (tab: string) => {
  const t = String(tab || '').toLowerCase();
  // Support chat deyarli hamma sahifalarda kerak, faqat Community fullscreen ko'rinishida yashiramiz
  return t !== 'community';
};

export function SupportChatWidget({ activeTab, isProfileOpen }: SupportChatWidgetProps) {
  const { theme, accentColor, supportChatEnabled } = useTheme() as any;
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // If user disables it, close any open modal
    if (!supportChatEnabled) {
      setOpen(false);
    }
  }, [supportChatEnabled]);

  if (!supportChatEnabled) return null;
  if (isProfileOpen) return null;
  if (!shouldShowOnTab(activeTab)) return null;

  return (
    <>
      <button
        className="fixed z-50 right-4 bottom-[5.75rem] sm:right-6 sm:bottom-28 active:scale-95 transition"
        onClick={() => setOpen(true)}
        aria-label="Support chat"
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: accentColor.gradient,
          boxShadow: `0 14px 40px ${accentColor.color}55`,
          border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.08)',
        }}
      >
        <MessageSquareText className="size-6 mx-auto" style={{ color: '#fff' }} />
      </button>

      <SupportChatModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

