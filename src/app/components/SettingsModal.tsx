import { X, User, Globe, Bell, Shield, HelpCircle, LogOut, ChevronRight, Moon, Sun, Volume2, VolumeX, Palette, Info, FileText, MessageCircle, Star, Share2, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Platform } from '../utils/platform';
import { useTheme, accentColors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ColorPickerModal } from './ColorPickerModal';
import { isMarketplaceNativeApp, postToMarketplaceNative } from '../utils/marketplaceNativeBridge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
}

export function SettingsModal({ isOpen, onClose, platform }: SettingsModalProps) {
  const { theme, toggleTheme, language, setLanguage, notifications, toggleNotifications, soundEnabled, toggleSound, accentColor, setAccentColor, supportChatEnabled, toggleSupportChat } = useTheme();
  const { isAuthenticated, signout } = useAuth();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [infoModal, setInfoModal] = useState<null | { title: string; body: string }>(null);
  
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const languageLabels = {
    uz: "O'zbekcha",
    ru: 'Русский',
    en: 'English'
  };

  const handleSignOut = () => {
    if (confirm('Chiqishni xohlaysizmi?')) {
      signout();
      onClose();
    }
  };

  const handleClearCache = () => {
    if (confirm('⚠️ Barcha saqlangan ma\'lumotlarni o\'chirish?\n\nBu localStorage\'ni tozalaydi va qayta login qilishingiz kerak bo\'ladi.')) {
      // Clear localStorage
      localStorage.removeItem('sms_user');
      localStorage.removeItem('sms_session');
      
      // Sign out
      signout();
      
      // Reload page
      alert('✅ Cache tozalandi! Sahifa qayta yuklanmoqda...');
      window.location.reload();
    }
  };

  const APP_VERSION = '1.0.0';
  const APP_YEAR = '2026';
  const SUPPORT_EMAIL = 'support@aresso.app';
  const SUPPORT_TELEGRAM = '@aresso_support';
  const SUPPORT_TELEGRAM_URL = 'https://t.me/aresso_support';
  const SUPPORT_PHONE = '+998901234567';

  const openInfo = (title: string, body: string) => setInfoModal({ title, body });

  const handleAboutApp = () => {
    openInfo(
      'Ilova haqida',
      [
        `ARESSO — Zamonaviy online do‘kon`,
        ``,
        `Versiya: ${APP_VERSION}`,
        `Yil: ${APP_YEAR}`,
        ``,
        `Asosiy bo‘limlar:`,
        `- Market`,
        `- Do‘kon`,
        `- Taomlar`,
        `- Ijara`,
        `- Auktsion`,
      ].join('\n')
    );
  };

  const handlePrivacyPolicy = () => {
    openInfo(
      'Maxfiylik siyosati',
      [
        `Sizning maxfiyligingiz biz uchun muhim.`,
        ``,
        `- Shaxsiy ma’lumotlar himoyalanadi`,
        `- To‘lov ma’lumotlari shifrlanadi`,
        `- Uchinchi shaxslarga uzatilmaydi (qonuniy holatlardan tashqari)`,
        ``,
        `Aloqa: ${SUPPORT_EMAIL}`,
      ].join('\n')
    );
  };

  const handleTermsOfService = () => {
    openInfo(
      'Foydalanish shartlari',
      [
        `1) Yosh: kamida 16`,
        `2) Hisob: telefon orqali, SMS tasdiqlash`,
        `3) Xarid: narxlar o‘zgarishi mumkin, yetkazib berish haqqi qo‘shiladi`,
        `4) To‘lov: tasdiqlanishi kerak`,
        `5) Taqiqlar: noqonuniy/tan olinmagan mahsulotlar taqiqlanadi`,
      ].join('\n')
    );
  };

  const handleHelpCenter = () => {
    openInfo(
      'Yordam markazi',
      [
        `Ko‘p so‘raladigan savollar:`,
        ``,
        `1) Buyurtma qayerda?`,
        `- Buyurtmalar bo‘limidan statusni ko‘ring.`,
        ``,
        `2) To‘lov muammo bo‘lsa?`,
        `- Support chat yoki aloqa orqali yozing.`,
        ``,
        `3) Qaytarish/refund?`,
        `- Supportga murojaat qiling.`,
      ].join('\n')
    );
  };

  const handleContactUs = () => {
    openInfo(
      'Aloqa',
      [
        `Email: ${SUPPORT_EMAIL}`,
        `Telegram: ${SUPPORT_TELEGRAM}`,
        `Telefon: ${SUPPORT_PHONE}`,
        ``,
        `Ish vaqti: 09:00 - 22:00`,
      ].join('\n')
    );
  };

  const handleRateApp = () => {
    const url = 'https://example.com/rate';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareApp = async () => {
    const url = window.location.href;
    const title = 'ARESSO - Zamonaviy Online Do‘kon';
    const text =
      "ARESSO ilovasini sinab ko‘ring! Market, Do‘kon, Taomlar, Ijara va Auktsion — hammasi bir joyda.";

    if (isMarketplaceNativeApp()) {
      postToMarketplaceNative({ type: 'share', title, message: text, url });
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      // fallthrough to clipboard
    }

    try {
      await navigator.clipboard.writeText(url);
      openInfo('Ulashish', `Havola nusxalandi:\n${url}`);
    } catch {
      openInfo('Ulashish', `Havola:\n${url}`);
    }
  };

  const settingsGroups = [
    {
      title: 'Afzalliklar',
      items: [
        { 
          icon: theme === 'dark' ? Moon : Sun, 
          label: 'Qorong\'u rejim', 
          toggle: true,
          value: theme === 'dark',
          action: toggleTheme
        },
        { 
          icon: Palette, 
          label: 'Rang tanlash', 
          subtitle: accentColor.name,
          action: () => setShowColorPicker(true)
        },
        { 
          icon: Bell, 
          label: 'Bildirishnomalar', 
          toggle: true,
          value: notifications,
          action: toggleNotifications
        },
        { 
          icon: soundEnabled ? Volume2 : VolumeX, 
          label: 'Ovoz effektlari', 
          toggle: true,
          value: soundEnabled,
          action: toggleSound
        },
        { 
          icon: Globe, 
          label: 'Til', 
          subtitle: languageLabels[language],
          action: () => setShowLanguageModal(true)
        },
      ]
    },
    {
      title: 'Yordam va Ma\'lumot',
      items: [
        { icon: Info, label: 'Ilova haqida', subtitle: 'Versiya 1.0.0', action: handleAboutApp },
        { icon: Shield, label: 'Maxfiylik siyosati', subtitle: 'Ma\'lumotlar himoyasi', action: handlePrivacyPolicy },
        { icon: FileText, label: 'Foydalanish shartlari', subtitle: 'Qoidalar va shartlar', action: handleTermsOfService },
        { icon: MessageCircle, label: 'Support chat', subtitle: 'Ekranda tugma chiqsin', toggle: true, value: supportChatEnabled, action: toggleSupportChat },
        { icon: MessageCircle, label: 'Aloqa', subtitle: 'Biz bilan bog\'laning', action: handleContactUs },
        { icon: HelpCircle, label: 'Yordam markazi', subtitle: 'Ko\'p so\'raladigan savollar', action: handleHelpCenter },
      ]
    },
    {
      title: 'Ijtimoiy',
      items: [
        { icon: Star, label: 'Ilovani baholang', subtitle: 'Fikringizni bildiring', action: handleRateApp },
        { icon: Share2, label: 'Do\'stlarga ulashing', subtitle: 'ARESSO haqida xabar bering', action: handleShareApp },
      ]
    }
  ];

  // Add sign out option if authenticated
  if (isAuthenticated) {
    settingsGroups.push({
      title: 'Hisob',
      items: [
        { icon: LogOut, label: 'Chiqish', action: handleSignOut, danger: true },
        { icon: X, label: 'Cache tozalash', action: handleClearCache, danger: true },
      ]
    });
  }

  if (isIOS) {
    return (
      <>
      <div 
        className="fixed inset-0 z-[60] flex items-end justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)',
          }}
        />

        {/* Modal Content */}
        <div 
          className="relative w-full max-w-md rounded-t-3xl overflow-hidden"
          style={{
            background: isDark 
              ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(10, 10, 10, 0.98))'
              : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
            maxHeight: '85vh',
            boxShadow: isDark 
              ? '0 -8px 32px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 -8px 24px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between"
            style={{
              background: isDark 
                ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(15, 15, 15, 0.95))'
                : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
              backdropFilter: 'blur(20px)',
              borderBottom: isDark 
                ? '0.5px solid rgba(255, 255, 255, 0.1)' 
                : '0.5px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 
              className="text-xl font-bold"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Sozlamalar
            </h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl transition-all active:scale-90"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                boxShadow: isDark 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 3px 10px rgba(0, 0, 0, 0.08)',
                border: isDark 
                  ? '0.5px solid rgba(255, 255, 255, 0.15)' 
                  : '0.5px solid rgba(0, 0, 0, 0.1)',
              }}
            >
              <X className="size-5" strokeWidth={2.5} style={{ color: isDark ? '#ffffff' : '#374151' }} />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
            {settingsGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                <h3 
                  className="text-xs font-semibold uppercase mb-3 px-2"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)' }}
                >
                  {group.title}
                </h3>
                <div 
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: isDark 
                      ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                      : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                    backdropFilter: 'blur(20px)',
                    border: isDark 
                      ? '0.5px solid rgba(255, 255, 255, 0.08)' 
                      : '0.5px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: isDark 
                      ? 'none'
                      : '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  {group.items.map((item, itemIndex) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={itemIndex}
                        onClick={item.action}
                        className="w-full flex items-center gap-4 p-4 transition-all active:scale-98"
                        style={{
                          borderBottom: itemIndex < group.items.length - 1 
                            ? (isDark 
                              ? '0.5px solid rgba(255, 255, 255, 0.05)' 
                              : '0.5px solid rgba(0, 0, 0, 0.05)')
                            : 'none',
                        }}
                      >
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundImage: item.danger 
                              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))'
                              : accentColor.gradient,
                            border: item.danger 
                              ? '1px solid rgba(239, 68, 68, 0.3)' 
                              : `1px solid ${accentColor.color}4d`,
                            boxShadow: item.danger 
                              ? 'none'
                              : isDark 
                                ? 'none'
                                : `0 2px 6px ${accentColor.color}1a`,
                          }}
                        >
                          <Icon 
                            className={`size-5 ${item.danger ? 'text-red-500' : 'text-white'}`}
                            style={{ color: item.danger ? undefined : '#ffffff' }}
                            strokeWidth={2} 
                          />
                        </div>
                        <div className="flex-1 text-left">
                          <p 
                            className="font-semibold"
                            style={{ color: item.danger ? '#ef4444' : (isDark ? '#ffffff' : '#111827') }}
                          >
                            {item.label}
                          </p>
                          {item.subtitle && (
                            <p 
                              className="text-xs mt-0.5"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                            >
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        {item.toggle ? (
                          <div 
                            className="relative w-12 h-7 rounded-full transition-all"
                            style={{
                              backgroundImage: item.value 
                                ? accentColor.gradient 
                                : 'none',
                              backgroundColor: item.value 
                                ? 'transparent' 
                                : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
                              boxShadow: item.value 
                                ? (isDark 
                                  ? `0 4px 12px ${accentColor.color}66`
                                  : `0 3px 10px ${accentColor.color}4d`)
                                : 'none',
                            }}
                          >
                            <div 
                              className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform"
                              style={{
                                transform: item.value ? 'translateX(20px)' : 'translateX(0)',
                                boxShadow: isDark 
                                  ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                                  : '0 2px 6px rgba(0, 0, 0, 0.15)',
                              }}
                            />
                          </div>
                        ) : (
                          <ChevronRight 
                            className="size-5" 
                            strokeWidth={2} 
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Color Picker Modal */}
      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        platform={platform}
        selectedColorId={accentColor.id}
        onColorSelect={setAccentColor}
        theme={theme}
      />

      {/* Info modal (replaces alerts) */}
      {infoModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <button
            className="absolute inset-0"
            onClick={() => setInfoModal(null)}
            aria-label="Close info modal"
            style={{
              background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(8px)',
            }}
          />
          <div
            className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(20,20,20,0.98), rgba(10,10,10,0.98))'
                : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
              border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
              boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.85)' : '0 24px 70px rgba(0,0,0,0.18)',
              maxHeight: '80vh',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: isDark ? '#fff' : '#111827' }}>
                  {infoModal.title}
                </p>
              </div>
              <button
                onClick={() => setInfoModal(null)}
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

            <div
              className="rounded-2xl p-4 overflow-y-auto"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                maxHeight: '58vh',
                whiteSpace: 'pre-wrap',
                color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {infoModal.body}
            </div>

            {infoModal.title === 'Aloqa' && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <a
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold active:scale-95 transition"
                  href={SUPPORT_TELEGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ background: accentColor.gradient, color: '#fff' }}
                >
                  <ExternalLink className="size-4" />
                  Telegram
                </a>
                <button
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold active:scale-95 transition"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${SUPPORT_EMAIL} | ${SUPPORT_TELEGRAM} | ${SUPPORT_PHONE}`);
                      openInfo('Aloqa', `${infoModal.body}\n\n✅ Nusxalandi`);
                    } catch {
                      openInfo('Aloqa', `${infoModal.body}\n\n⚠️ Nusxalab bo‘lmadi`);
                    }
                  }}
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
                    color: isDark ? '#fff' : '#111827',
                  }}
                >
                  <Copy className="size-4" />
                  Nusxa
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </>
    );
  }

  // Android Material Design
  return (
    <>
    <div 
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-md rounded-t-2xl overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #1e1e1e, #121212)'
            : 'linear-gradient(135deg, #ffffff, #f9fafb)',
          maxHeight: '85vh',
          boxShadow: isDark 
            ? '0 -4px 24px rgba(0, 0, 0, 0.8)'
            : '0 -4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, #1e1e1e, #161616)'
              : 'linear-gradient(135deg, #ffffff, #fafafa)',
            borderBottom: isDark 
              ? '1px solid rgba(255, 255, 255, 0.08)' 
              : '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          <h2 
            className="text-xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Sozlamalar
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl transition-all active:scale-90"
            style={{
              background: isDark 
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.04)',
              border: isDark 
                ? '1px solid rgba(255, 255, 255, 0.1)' 
                : '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <X className="size-5" strokeWidth={2.5} style={{ color: isDark ? '#ffffff' : '#374151' }} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {settingsGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 
                className="text-xs font-bold uppercase mb-3"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)' }}
              >
                {group.title}
              </h3>
              <div 
                className="rounded-xl overflow-hidden"
                style={{
                  background: isDark 
                    ? 'linear-gradient(135deg, #1a1a1a, #141414)'
                    : 'linear-gradient(135deg, #ffffff, #fafafa)',
                  border: isDark 
                    ? '1px solid rgba(255, 255, 255, 0.05)' 
                    : '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: isDark 
                    ? 'none'
                    : '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                }}
              >
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={itemIndex}
                      onClick={item.action}
                      className="w-full flex items-center gap-4 p-4 transition-all active:scale-98"
                      style={{
                        borderBottom: itemIndex < group.items.length - 1 
                          ? (isDark 
                            ? '1px solid rgba(255, 255, 255, 0.03)' 
                            : '1px solid rgba(0, 0, 0, 0.05)')
                          : 'none',
                      }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: item.danger 
                            ? 'rgba(239, 68, 68, 0.15)'
                            : `${accentColor.color}26`,
                          border: item.danger 
                            ? '1px solid rgba(239, 68, 68, 0.3)' 
                            : `1px solid ${accentColor.color}4d`,
                          boxShadow: item.danger 
                            ? 'none'
                            : isDark 
                              ? 'none'
                              : `0 2px 6px ${accentColor.color}1a`,
                        }}
                      >
                        <Icon 
                          className={`size-5 ${item.danger ? 'text-red-500' : 'text-white'}`}
                          style={{ color: item.danger ? undefined : '#ffffff' }}
                          strokeWidth={2} 
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <p 
                          className="font-bold"
                          style={{ color: item.danger ? '#ef4444' : (isDark ? '#ffffff' : '#111827') }}
                        >
                          {item.label}
                        </p>
                        {item.subtitle && (
                          <p 
                            className="text-xs mt-0.5"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                          >
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      {item.toggle ? (
                        <div 
                          className="relative w-12 h-7 rounded-full transition-all"
                          style={{
                            backgroundImage: item.value 
                              ? accentColor.gradient 
                              : 'none',
                            backgroundColor: item.value 
                              ? 'transparent' 
                              : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)'),
                            boxShadow: item.value 
                              ? `0 2px 8px ${accentColor.color}80`
                              : 'none',
                          }}
                        >
                          <div 
                            className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform"
                            style={{
                              transform: item.value ? 'translateX(20px)' : 'translateX(0)',
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                            }}
                          />
                        </div>
                      ) : (
                        <ChevronRight 
                          className="size-5" 
                          strokeWidth={2} 
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Color Picker Modal */}
    <ColorPickerModal
      isOpen={showColorPicker}
      onClose={() => setShowColorPicker(false)}
      platform={platform}
      selectedColorId={accentColor.id}
      onColorSelect={setAccentColor}
      theme={theme}
    />
    </>
  );
}