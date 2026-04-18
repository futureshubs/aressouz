import { X, Phone, Send } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { UserBranchChat } from './UserBranchChat';

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportChatModal({ isOpen, onClose }: SupportChatModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [mode, setMode] = useState<'chat' | 'contact'>('chat');

  if (!isOpen) return null;

  const telegramHandle = '@myAresso';
  const telegramUrl = 'https://t.me/myAresso';
  const phone = '+998332363636';

  return (
    <div className="fixed inset-0 app-safe-pad z-[60] flex items-end sm:items-center justify-center">
      <button
        className="absolute inset-0"
        style={{
          background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
        aria-label="Close support chat"
      />

      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 flex flex-col min-h-0 max-h-[85vh] overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(20,20,20,0.98), rgba(10,10,10,0.98))'
            : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
          border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
          boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.85)' : '0 24px 70px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
              Support chat
            </p>
            <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
              Savolingiz bo‘lsa tezkor bog‘laning
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl active:scale-95 transition"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.08)',
            }}
            aria-label="Close"
          >
            <X className="size-5" style={{ color: isDark ? '#fff' : '#111827' }} />
          </button>
        </div>

        <div className="flex gap-2 mb-4 shrink-0">
          <button
            onClick={() => setMode('chat')}
            className="flex-1 py-2.5 rounded-2xl font-bold transition active:scale-95"
            style={{
              background: mode === 'chat' ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: mode === 'chat' ? '#fff' : isDark ? '#fff' : '#111827',
              border:
                mode === 'chat'
                  ? 'none'
                  : isDark
                    ? '0.5px solid rgba(255,255,255,0.10)'
                    : '0.5px solid rgba(0,0,0,0.08)',
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setMode('contact')}
            className="flex-1 py-2.5 rounded-2xl font-bold transition active:scale-95"
            style={{
              background: mode === 'contact' ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: mode === 'contact' ? '#fff' : isDark ? '#fff' : '#111827',
              border:
                mode === 'contact'
                  ? 'none'
                  : isDark
                    ? '0.5px solid rgba(255,255,255,0.10)'
                    : '0.5px solid rgba(0,0,0,0.08)',
            }}
          >
            Aloqa
          </button>
        </div>

        {mode === 'chat' ? (
          <div
            className="flex-1 min-h-0 flex flex-col"
            style={{
              paddingBottom: 10,
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.08)',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            {/* Profile → Chat tabidagi bir xil UI — bitta scroll faqat ichki xabarlarda */}
            <div className="min-h-0 flex-1 max-h-[62vh] overflow-hidden flex flex-col">
              <UserBranchChat mode="single" embedTarget="support" />
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pr-1 -mr-1">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between rounded-2xl px-4 py-4 active:scale-[0.99] transition"
              style={{
                background: accentColor.gradient,
                color: '#fff',
                boxShadow: `0 10px 30px ${accentColor.color}55`,
              }}
            >
              <div className="flex items-center gap-3">
                <Send className="size-5" strokeWidth={2.5} />
                <div className="leading-tight">
                  <p className="font-bold">Telegram’da yozish</p>
                  <p className="text-xs opacity-90">{telegramHandle}</p>
                </div>
              </div>
              <span className="text-xs font-bold opacity-90">Ochish</span>
            </a>

            <a
              href={`tel:${phone}`}
              className="w-full flex items-center justify-between rounded-2xl px-4 py-4 active:scale-[0.99] transition"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                <Phone className="size-5" style={{ color: accentColor.color }} />
                <div className="leading-tight">
                  <p className="font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
                    Telefon orqali
                  </p>
                  <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    {phone}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold" style={{ color: accentColor.color }}>
                Qo‘ng‘iroq
              </span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

