import { X, Phone, Send, MessageCircle } from 'lucide-react';
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
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{
        background: isDark
          ? 'linear-gradient(180deg, #0a0a0a 0%, #111 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
      }}
    >
      <header
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b app-safe-pad"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: accentColor.gradient }}
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate" style={{ color: isDark ? '#fff' : '#111827' }}>
              Aresso support
            </p>
            <p className="text-xs truncate" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
              Operator bilan bir xil chat — xabarlar filial panelida ham ko‘rinadi
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl shrink-0 active:scale-95 transition"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}
          aria-label="Yopish"
        >
          <X className="w-5 h-5" style={{ color: isDark ? '#fff' : '#111827' }} />
        </button>
      </header>

      <div
        className="shrink-0 flex gap-2 px-4 py-3 border-b"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
      >
        <button
          type="button"
          onClick={() => setMode('chat')}
          className="flex-1 py-2.5 rounded-2xl font-bold transition active:scale-95"
          style={{
            background: mode === 'chat' ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            color: mode === 'chat' ? '#fff' : isDark ? '#fff' : '#111827',
          }}
        >
          Chat
        </button>
        <button
          type="button"
          onClick={() => setMode('contact')}
          className="flex-1 py-2.5 rounded-2xl font-bold transition active:scale-95"
          style={{
            background: mode === 'contact' ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            color: mode === 'contact' ? '#fff' : isDark ? '#fff' : '#111827',
          }}
        >
          Aloqa
        </button>
      </div>

      {mode === 'chat' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <UserBranchChat mode="single" embedTarget="support" layout="fullscreen" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-lg mx-auto w-full">
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
              <Send className="w-5 h-5" strokeWidth={2.5} />
              <div className="leading-tight">
                <p className="font-bold">Telegram</p>
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
              <Phone className="w-5 h-5" style={{ color: accentColor.color }} />
              <div className="leading-tight">
                <p className="font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
                  Telefon
                </p>
                <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                  {phone}
                </p>
              </div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
