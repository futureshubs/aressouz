import { X, Globe, Bell, Shield, HelpCircle, LogOut, ChevronRight, Moon, Sun, Volume2, VolumeX, Palette, Info, FileText, MessageCircle, Star, Share2, Copy, ExternalLink, Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Platform } from '../utils/platform';
import { useTheme, type Language } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ColorPickerModal } from './ColorPickerModal';
import { isMarketplaceNativeApp, postToMarketplaceNative } from '../utils/marketplaceNativeBridge';
import { profileAccentLabel, useUserPanelT } from '../i18n/userPanel';
import { openExternalUrlSync } from '../utils/openExternalUrl';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
}

const PRIVACY_SUPPORT_EMAIL = 'support@aressouz.app';

function LegalPolicyRichContent({
  isDark,
  accentHex,
  language,
}: {
  isDark: boolean;
  accentHex: string;
  language: Language;
}) {
  const muted = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.72)';
  const heading = isDark ? '#fff' : '#111827';
  const sub = isDark ? 'rgba(255,255,255,0.88)' : '#1f2937';
  const li = 'list-disc pl-5 space-y-1.5 mt-2';
  const sectionTitle = 'text-[15px] font-bold mt-5 mb-2';
  const block = 'text-[13px] leading-relaxed';

  if (language === 'ru') {
    return (
      <div className={`space-y-1 ${block}`} style={{ color: muted }}>
        <section>
          <h3 className="text-base font-bold mb-2" style={{ color: heading }}>
            🔐 Политика конфиденциальности
          </h3>
          <p>Мы уважаем и защищаем персональные данные пользователей.</p>
          <h4 className={sectionTitle} style={{ color: sub }}>1. Какие данные собираем</h4>
          <ul className={li}>
            <li>Имя и фамилия</li>
            <li>Телефон / email</li>
            <li>Данные оплат</li>
            <li>История заказов и активности</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>2. Зачем используем</h4>
          <ul className={li}>
            <li>Обработка заказов и платежей</li>
            <li>Улучшение сервиса и поддержка</li>
            <li>Связь с пользователем</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>3. Защита</h4>
          <ul className={li}>
            <li>Данные хранятся на защищённых серверах</li>
            <li>Оплаты проходят по шифрованным каналам (SSL)</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>4. Третьи стороны</h4>
          <ul className={li}>
            <li>Передаём только тем, кто нужен для услуги (платежи, доставка)</li>
            <li><span className="font-semibold" style={{ color: sub }}>Не продаём</span> персональные данные</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>5. Cookie</h4>
          <p className="mt-2">Используем cookie для работы сайта и аналитики.</p>
          <h4 className={sectionTitle} style={{ color: sub }}>6. Ваши права</h4>
          <ul className={li}>
            <li>Запросить доступ, исправление или удаление данных</li>
          </ul>
          <p className="mt-4 flex flex-wrap items-center gap-1.5">
            <span>📩 Контакт:</span>
            <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2 break-all" style={{ color: accentHex }}>{PRIVACY_SUPPORT_EMAIL}</a>
          </p>
        </section>
        <hr className="my-6 border-0 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
        <section>
          <h3 className="text-base font-bold mb-2" style={{ color: heading }}>📜 Условия использования</h3>
          <h4 className={sectionTitle} style={{ color: sub }}>1. Общие</h4>
          <p className="mt-2">Используя платформу, вы соглашаетесь с условиями.</p>
          <h4 className={sectionTitle} style={{ color: sub }}>2. Аккаунт</h4>
          <ul className={li}>
            <li>Вы отвечаете за безопасность аккаунта</li>
            <li>Ложные данные могут привести к блокировке</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>3. Заказы и оплата</h4>
          <ul className={li}>
            <li>Оплата, как правило, до выполнения заказа</li>
            <li>Заказ активен после подтверждения оплаты</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>4. Товары продавцов</h4>
          <ul className={li}>
            <li>Продавцы несут ответственность за свои объявления</li>
            <li>Платформа выступает посредником</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>5. Запрещено</h4>
          <ul className={li}><li>Мошенничество, подделки, незаконная торговля</li></ul>
          <h4 className={sectionTitle} style={{ color: sub }}>6. Ограничение ответственности</h4>
          <ul className={li}><li>В ряде случаев ответственность платформы ограничена законом</li></ul>
          <h4 className={sectionTitle} style={{ color: sub }}>7. Блокировка</h4>
          <p className="mt-2">При нарушении правил аккаунт может быть закрыт.</p>
        </section>
      </div>
    );
  }

  if (language === 'en') {
    return (
      <div className={`space-y-1 ${block}`} style={{ color: muted }}>
        <section>
          <h3 className="text-base font-bold mb-2" style={{ color: heading }}>🔐 Privacy policy</h3>
          <p>We respect and protect users&apos; personal data.</p>
          <h4 className={sectionTitle} style={{ color: sub }}>1. Data we collect</h4>
          <ul className={li}>
            <li>Name</li>
            <li>Phone / email</li>
            <li>Payment-related data</li>
            <li>Order and activity history</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>2. How we use it</h4>
          <ul className={li}>
            <li>Process orders and payments</li>
            <li>Improve the service and support you</li>
            <li>Contact you when needed</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>3. Security</h4>
          <ul className={li}>
            <li>Data is stored on secured infrastructure</li>
            <li>Payments use encrypted channels (SSL)</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>4. Third parties</h4>
          <ul className={li}>
            <li>Shared only with providers needed for the service (payments, delivery)</li>
            <li><span className="font-semibold" style={{ color: sub }}>We do not sell</span> your personal data</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>5. Cookies</h4>
          <p className="mt-2">We use cookies for core functionality and analytics.</p>
          <h4 className={sectionTitle} style={{ color: sub }}>6. Your rights</h4>
          <ul className={li}>
            <li>You may request access, correction or deletion where applicable</li>
          </ul>
          <p className="mt-4 flex flex-wrap items-center gap-1.5">
            <span>📩 Contact:</span>
            <a href={`mailto:${PRIVACY_SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2 break-all" style={{ color: accentHex }}>{PRIVACY_SUPPORT_EMAIL}</a>
          </p>
        </section>
        <hr className="my-6 border-0 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
        <section>
          <h3 className="text-base font-bold mb-2" style={{ color: heading }}>📜 Terms &amp; conditions</h3>
          <h4 className={sectionTitle} style={{ color: sub }}>1. General</h4>
          <p className="mt-2">By using the platform you agree to these terms.</p>
          <h4 className={sectionTitle} style={{ color: sub }}>2. Account</h4>
          <ul className={li}>
            <li>You are responsible for account security</li>
            <li>Fraudulent information may lead to suspension</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>3. Orders &amp; payment</h4>
          <ul className={li}>
            <li>Payment is generally required before fulfilment</li>
            <li>Orders activate after payment confirmation</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>4. Marketplace listings</h4>
          <ul className={li}>
            <li>Sellers are responsible for their listings</li>
            <li>The platform acts as an intermediary</li>
          </ul>
          <h4 className={sectionTitle} style={{ color: sub }}>5. Prohibited</h4>
          <ul className={li}><li>Fraud, counterfeit goods, illegal trade</li></ul>
          <h4 className={sectionTitle} style={{ color: sub }}>6. Liability</h4>
          <ul className={li}><li>Liability may be limited where the law allows</li></ul>
          <h4 className={sectionTitle} style={{ color: sub }}>7. Enforcement</h4>
          <p className="mt-2">We may suspend accounts that violate the rules.</p>
        </section>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${block}`} style={{ color: muted }}>
      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: heading }}>
          🔐 Maxfiylik siyosati (Privacy Policy)
        </h3>
        <p>Biz foydalanuvchilarning shaxsiy ma’lumotlarini hurmat qilamiz va himoya qilamiz.</p>

        <h4 className={sectionTitle} style={{ color: sub }}>
          1. Yig‘iladigan ma’lumotlar:
        </h4>
        <ul className={li}>
          <li>Ism, familiya</li>
          <li>Telefon raqami / email</li>
          <li>To‘lov ma’lumotlari</li>
          <li>Buyurtma va faoliyat tarixi</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          2. Ma’lumotlardan foydalanish:
        </h4>
        <ul className={li}>
          <li>Buyurtmalarni qayta ishlash</li>
          <li>To‘lovlarni amalga oshirish</li>
          <li>Xizmatni yaxshilash</li>
          <li>Foydalanuvchi bilan bog‘lanish</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          3. Ma’lumotlarni himoya qilish:
        </h4>
        <ul className={li}>
          <li>Barcha ma’lumotlar xavfsiz serverlarda saqlanadi</li>
          <li>To‘lovlar shifrlangan (SSL) orqali amalga oshiriladi</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          4. Uchinchi tomonlar:
        </h4>
        <ul className={li}>
          <li>Ma’lumotlar faqat xizmatni bajarish uchun (to‘lov tizimlari, yetkazib berish) beriladi</li>
          <li>
            <span className="font-semibold" style={{ color: sub }}>
              Hech qachon sotilmaydi
            </span>{' '}
            (ha, bu muhim joy 😏)
          </li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          5. Cookie va tracking:
        </h4>
        <p className="mt-2">Sayt ishlashi va analytics uchun cookie ishlatiladi.</p>

        <h4 className={sectionTitle} style={{ color: sub }}>
          6. Foydalanuvchi huquqlari:
        </h4>
        <ul className={li}>
          <li>O‘z ma’lumotini ko‘rish</li>
          <li>O‘zgartirish yoki o‘chirishni so‘rash</li>
        </ul>

        <p className="mt-4 flex flex-wrap items-center gap-1.5">
          <span>📩 Aloqa:</span>
          <a
            href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}
            className="font-semibold underline underline-offset-2 break-all"
            style={{ color: accentHex }}
          >
            {PRIVACY_SUPPORT_EMAIL}
          </a>
        </p>
      </section>

      <hr
        className="my-6 border-0 h-px"
        style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
      />

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: heading }}>
          📜 Foydalanish shartlari (Terms & Conditions)
        </h3>

        <h4 className={sectionTitle} style={{ color: sub }}>
          1. Umumiy:
        </h4>
        <p className="mt-2">Platformadan foydalanish orqali siz barcha shartlarga rozilik bildirasiz.</p>

        <h4 className={sectionTitle} style={{ color: sub }}>
          2. Hisob (Account):
        </h4>
        <ul className={li}>
          <li>Foydalanuvchi o‘z akkaunti xavfsizligi uchun javobgar</li>
          <li>Soxta ma’lumot kiritish = block 😎</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          3. Buyurtma va to‘lov:
        </h4>
        <ul className={li}>
          <li>Barcha to‘lovlar oldindan amalga oshiriladi</li>
          <li>To‘lov tasdiqlanmaguncha buyurtma aktiv emas</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          4. Mahsulotlar (Marketplace uchun muhim!):
        </h4>
        <ul className={li}>
          <li>Sotuvchilar joylagan mahsulotlar uchun o‘zlari javobgar</li>
          <li>Platforma vositachi (middleman)</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          5. Taqiqlangan narsalar:
        </h4>
        <ul className={li}>
          <li>Firibgarlik</li>
          <li>Soxta mahsulot</li>
          <li>Qonunga zid savdo</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          6. Zarar va javobgarlik:
        </h4>
        <ul className={li}>
          <li>Mahsulotga zarar yetkazilsa yoki ruxsatsiz sotilsa — foydalanuvchi to‘liq to‘laydi</li>
          <li>Platforma ayrim holatlarda javobgar emas</li>
        </ul>

        <h4 className={sectionTitle} style={{ color: sub }}>
          7. Bloklash:
        </h4>
        <p className="mt-2">Qoidani buzgan user → account yopiladi.</p>
      </section>
    </div>
  );
}

type SettingsInfoModal =
  | { title: string; body: string; kind?: 'contact' }
  | { title: string; rich: ReactNode };

export function SettingsModal({ isOpen, onClose, platform }: SettingsModalProps) {
  const { theme, toggleTheme, language, setLanguage, notifications, toggleNotifications, soundEnabled, toggleSound, accentColor, setAccentColor, supportChatEnabled, toggleSupportChat } = useTheme();
  const { isAuthenticated, signout } = useAuth();
  const t = useUserPanelT();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [infoModal, setInfoModal] = useState<SettingsInfoModal | null>(null);
  
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  const languageLabels: Record<Language, string> = {
    uz: t('settings.lang.uz'),
    ru: t('settings.lang.ru'),
    en: t('settings.lang.en'),
  };

  const handleSignOut = () => {
    if (confirm(t('settings.confirmSignOut'))) {
      signout();
      onClose();
    }
  };

  const handleClearCache = () => {
    if (confirm(t('settings.confirmClearCache'))) {
      localStorage.removeItem('sms_user');
      localStorage.removeItem('sms_session');
      signout();
      alert(t('settings.cacheCleared'));
      window.location.reload();
    }
  };

  const APP_VERSION = '1.0.0';
  const APP_YEAR = '2026';
  const SUPPORT_EMAIL = PRIVACY_SUPPORT_EMAIL;
  const SUPPORT_TELEGRAM = '@aresso_support';
  const SUPPORT_TELEGRAM_URL = 'https://t.me/aresso_support';
  const SUPPORT_PHONE = '+998901234567';

  const openInfo = (title: string, body: string, kind?: 'contact') =>
    setInfoModal(kind ? { title, body, kind } : { title, body });

  const handleAboutApp = () => {
    openInfo(
      t('settings.infoAboutTitle'),
      t('settings.about.body', { version: APP_VERSION, year: APP_YEAR }),
    );
  };

  const openLegalDocs = () => {
    setInfoModal({
      title: t('settings.legalTitle'),
      rich: <LegalPolicyRichContent isDark={isDark} accentHex={accentColor.color} language={language} />,
    });
  };

  const handlePrivacyPolicy = () => openLegalDocs();

  const handleTermsOfService = () => openLegalDocs();

  const handleHelpCenter = () => {
    openInfo(t('settings.infoHelpTitle'), t('settings.help.body'));
  };

  const handleContactUs = () => {
    openInfo(
      t('settings.infoContactTitle'),
      t('settings.contact.body', { email: SUPPORT_EMAIL, telegram: SUPPORT_TELEGRAM, phone: SUPPORT_PHONE }),
      'contact',
    );
  };

  const handleRateApp = () => {
    const url = 'https://example.com/rate';
    openExternalUrlSync(url);
  };

  const handleShareApp = async () => {
    const url = window.location.href;
    const title = t('settings.share.title');
    const text = t('settings.share.text');

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
      openInfo(t('settings.shareTitle'), `${t('settings.shareCopied')}:\n${url}`);
    } catch {
      openInfo(t('settings.shareTitle'), `${t('settings.shareLink')}:\n${url}`);
    }
  };

  const settingsGroups: Array<{
    title: string;
    items: Array<{
      icon: typeof Moon;
      label: string;
      subtitle?: string;
      toggle?: boolean;
      value?: boolean;
      action: () => void;
      danger?: boolean;
    }>;
  }> = [
    {
      title: t('settings.group.preferences'),
      items: [
        {
          icon: theme === 'dark' ? Moon : Sun,
          label: t('settings.darkMode'),
          toggle: true,
          value: theme === 'dark',
          action: toggleTheme,
        },
        {
          icon: Palette,
          label: t('settings.pickColor'),
          subtitle: profileAccentLabel(language, accentColor.id),
          action: () => setShowColorPicker(true),
        },
        {
          icon: Bell,
          label: t('settings.notifications'),
          toggle: true,
          value: notifications,
          action: toggleNotifications,
        },
        {
          icon: soundEnabled ? Volume2 : VolumeX,
          label: t('settings.sound'),
          toggle: true,
          value: soundEnabled,
          action: toggleSound,
        },
        {
          icon: Globe,
          label: t('settings.language'),
          subtitle: languageLabels[language],
          action: () => setShowLanguageModal(true),
        },
      ],
    },
    {
      title: t('settings.group.help'),
      items: [
        { icon: Info, label: t('settings.about'), subtitle: t('settings.aboutSubtitle'), action: handleAboutApp },
        { icon: Shield, label: t('settings.privacy'), subtitle: t('settings.privacySubtitle'), action: handlePrivacyPolicy },
        { icon: FileText, label: t('settings.terms'), subtitle: t('settings.termsSubtitle'), action: handleTermsOfService },
        {
          icon: MessageCircle,
          label: t('settings.supportChat'),
          subtitle: t('settings.supportChatSubtitle'),
          toggle: true,
          value: supportChatEnabled,
          action: toggleSupportChat,
        },
        { icon: MessageCircle, label: t('settings.contact'), subtitle: t('settings.contactSubtitle'), action: handleContactUs },
        { icon: HelpCircle, label: t('settings.helpCenter'), subtitle: t('settings.helpCenterSubtitle'), action: handleHelpCenter },
      ],
    },
    {
      title: t('settings.group.social'),
      items: [
        { icon: Star, label: t('settings.rateApp'), subtitle: t('settings.rateSubtitle'), action: handleRateApp },
        { icon: Share2, label: t('settings.shareApp'), subtitle: t('settings.shareSubtitle'), action: handleShareApp },
      ],
    },
    ...(isAuthenticated
      ? [
          {
            title: t('settings.group.account'),
            items: [
              { icon: LogOut, label: t('settings.signOut'), action: handleSignOut, danger: true as const },
              { icon: X, label: t('settings.clearCache'), action: handleClearCache, danger: true as const },
            ],
          },
        ]
      : []),
  ];

  const infoModalLayer = infoModal ? (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
        <button
          type="button"
          className="absolute inset-0"
          onClick={() => setInfoModal(null)}
          aria-label="Close info modal"
          style={{
            background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
          }}
        />
        <div
          className={`relative w-full rounded-t-3xl sm:rounded-3xl p-5 flex flex-col min-h-0 ${
            'rich' in infoModal ? 'sm:max-w-xl' : 'sm:max-w-lg'
          }`}
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(20,20,20,0.98), rgba(10,10,10,0.98))'
              : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
            border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
            boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.85)' : '0 24px 70px rgba(0,0,0,0.18)',
            maxHeight: 'min(88vh, 900px)',
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-info-modal-title"
        >
          <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
            <div className="min-w-0 flex-1">
              <p
                id="settings-info-modal-title"
                className="text-base font-bold leading-snug"
                style={{ color: isDark ? '#fff' : '#111827' }}
              >
                {infoModal.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="p-2 rounded-xl active:scale-95 transition shrink-0"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.08)',
              }}
              aria-label={t('settings.close')}
            >
              <X className="size-5" style={{ color: isDark ? '#fff' : '#111827' }} />
            </button>
          </div>

          {'rich' in infoModal ? (
            <div
              className="rounded-2xl p-4 sm:p-5 overflow-y-auto overscroll-y-contain min-h-0 flex-1"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                maxHeight: 'min(68vh, 620px)',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {infoModal.rich}
            </div>
          ) : (
            <div
              className="rounded-2xl p-4 overflow-y-auto overscroll-y-contain"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                maxHeight: '58vh',
                whiteSpace: 'pre-wrap',
                color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
                fontSize: 13,
                lineHeight: 1.55,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {infoModal.body}
            </div>
          )}

          {'kind' in infoModal && infoModal.kind === 'contact' && 'body' in infoModal && (
            <div className="grid grid-cols-2 gap-2 mt-3 shrink-0">
              <a
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold active:scale-95 transition"
                href={SUPPORT_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: accentColor.gradient, color: '#fff' }}
              >
                <ExternalLink className="size-4" />
                Telegram
              </a>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold active:scale-95 transition"
                onClick={async () => {
                  if (!('body' in infoModal) || infoModal.kind !== 'contact') return;
                  try {
                    await navigator.clipboard.writeText(
                      `${SUPPORT_EMAIL} | ${SUPPORT_TELEGRAM} | ${SUPPORT_PHONE}`,
                    );
                    openInfo(
                      t('settings.infoContactTitle'),
                      `${infoModal.body}\n\n${t('settings.contactCopied')}`,
                      'contact',
                    );
                  } catch {
                    openInfo(
                      t('settings.infoContactTitle'),
                      `${infoModal.body}\n\n${t('settings.contactCopyFail')}`,
                      'contact',
                    );
                  }
                }}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
                  color: isDark ? '#fff' : '#111827',
                }}
              >
                <Copy className="size-4" />
                {t('settings.copy')}
              </button>
            </div>
          )}
        </div>
      </div>
  ) : null;

  const languageChoices: Language[] = ['uz', 'ru', 'en'];
  const languagePickerLayer = showLanguageModal ? (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t('settings.close')}
        onClick={() => setShowLanguageModal(false)}
        style={{
          background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
        }}
      />
      <div
        className="relative w-full max-w-md mx-3 sm:mx-0 rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(24,24,24,0.98), rgba(12,12,12,0.98))'
            : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
          border: isDark ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.08)',
          boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.85)' : '0 24px 70px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-lang-title"
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
        >
          <p id="settings-lang-title" className="text-base font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
            {t('settings.langTitle')}
          </p>
          <button
            type="button"
            onClick={() => setShowLanguageModal(false)}
            className="p-2 rounded-xl active:scale-95"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
            aria-label={t('settings.close')}
          >
            <X className="size-5" style={{ color: isDark ? '#fff' : '#111827' }} />
          </button>
        </div>
        <div className="p-2 space-y-1">
          {languageChoices.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLanguage(code);
                setShowLanguageModal(false);
              }}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl text-left font-semibold transition active:scale-[0.99]"
              style={{
                background:
                  language === code
                    ? `${accentColor.color}22`
                    : isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                color: isDark ? '#fff' : '#111827',
                border:
                  language === code
                    ? `0.5px solid ${accentColor.color}55`
                    : isDark
                      ? '0.5px solid rgba(255,255,255,0.06)'
                      : '0.5px solid rgba(0,0,0,0.06)',
              }}
            >
              <span className="flex items-center gap-2">
                <Globe className="size-5 opacity-80" />
                {languageLabels[code]}
              </span>
              {language === code ? (
                <Check className="size-5 shrink-0" style={{ color: accentColor.color }} strokeWidth={2.5} />
              ) : (
                <span className="size-5 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (!isOpen) return null;

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
              {t('settings.title')}
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
              aria-label={t('settings.close')}
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

      {languagePickerLayer}

      {/* Color Picker Modal */}
      <ColorPickerModal
        isOpen={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        platform={platform}
        selectedColorId={accentColor.id}
        onColorSelect={setAccentColor}
        theme={theme}
      />

      {infoModalLayer}
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
            {t('settings.title')}
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
            aria-label={t('settings.close')}
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

    {languagePickerLayer}

    {/* Color Picker Modal */}
    <ColorPickerModal
      isOpen={showColorPicker}
      onClose={() => setShowColorPicker(false)}
      platform={platform}
      selectedColorId={accentColor.id}
      onColorSelect={setAccentColor}
      theme={theme}
    />
    {infoModalLayer}
    </>
  );
}