import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Toaster } from 'sonner';
import { getUserId } from '../utils/userId';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { AUTH_SESSION_CHANGED_EVENT } from '../utils/authSessionEvents';
import { isMarketplaceNativeApp } from '../utils/marketplaceNativeBridge';

/**
 * Tema: `themePreference` localStorage + serverda (`system` | `light` | `dark`).
 * `system` bo‘lsa — `prefers-color-scheme` + `change` hodisasi; yakuniy `theme` butun UI uchun.
 * `html.dark`, `color-scheme`, PWA meta — `useLayoutEffect` da (flash kam).
 */

function readBoolLs(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    const v = JSON.parse(raw);
    return typeof v === 'boolean' ? v : fallback;
  } catch {
    return fallback;
  }
}

/** UI va `dark:` klasslari uchun yakuniy rejim */
export type ThemeMode = 'light' | 'dark';
/** Foydalanuvchi tanlovi: qurilma yoki majburiy kun/tun */
export type ThemePreference = 'light' | 'dark' | 'system';
export type Language = 'uz' | 'ru' | 'en';

function normalizeThemePreference(value: unknown): ThemePreference | null {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  if (s === 'light' || s === 'dark' || s === 'system') return s;
  return null;
}

function readThemePreferenceLs(): ThemePreference {
  try {
    /** Brauzer (PWA): faqat qurilma kun/tun — foydalanuvchi tanlovi yo‘q */
    if (typeof window !== 'undefined' && !isMarketplaceNativeApp()) {
      return 'system';
    }
    const saved = normalizeThemePreference(localStorage.getItem('theme'));
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return 'system';
}

/** `prefers-color-scheme: light` aniq bo‘lsa — kun; aks holda `dark` so‘rovi (no-preference → yorug‘) */
function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)');
    if (prefersLight.matches) return false;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    return prefersDark.matches;
  } catch {
    return false;
  }
}

export const accentColors = [
  { id: 'teal', name: 'Teal', color: '#14b8a6', gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
  { id: 'blue', name: 'Blue', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  { id: 'purple', name: 'Purple', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)' },
  { id: 'pink', name: 'Pink', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { id: 'red', name: 'Red', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  { id: 'orange', name: 'Orange', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  { id: 'amber', name: 'Amber', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { id: 'lime', name: 'Lime', color: '#84cc16', gradient: 'linear-gradient(135deg, #84cc16, #65a30d)' },
  { id: 'green', name: 'Green', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  { id: 'cyan', name: 'Cyan', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
  { id: 'indigo', name: 'Indigo', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { id: 'rose', name: 'Rose', color: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)' },
];

interface ThemeContextType {
  /** Qurilma + tanlov bo‘yicha yakuniy kun/tun (komponentlar shu bilan ishlaydi) */
  theme: ThemeMode;
  /** `system` — OS `prefers-color-scheme` ga ergashadi */
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  language: Language;
  notifications: boolean;
  soundEnabled: boolean;
  supportChatEnabled: boolean;
  accentColor: typeof accentColors[0];
  /** system → majburiy qarama-qarshi → (light↔dark) → system */
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  toggleNotifications: () => void;
  toggleSound: () => void;
  toggleSupportChat: () => void;
  setAccentColor: (colorId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_COLOR_LIGHT = '#f9fafb';
const THEME_COLOR_DARK = '#0a0a0a';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Get userId from localStorage instead of useAuth to avoid circular dependency
  const getUserIdFromStorage = () => {
    try {
      const authData = localStorage.getItem('sb-wnondmqmuvjugbomyolz-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        return getUserId(parsed.user?.id);
      }
    } catch {
      /* ignore */
    }
    try {
      const sms = localStorage.getItem('sms_user');
      if (sms) {
        const parsed = JSON.parse(sms) as { id?: string };
        if (parsed?.id) return getUserId(String(parsed.id));
      }
    } catch {
      /* ignore */
    }
    return 'anonymous';
  };
  
  const userId = getUserIdFromStorage();
  const visibilityRefetchTick = useVisibilityTick();
  const [authSessionTick, setAuthSessionTick] = useState(0);

  useEffect(() => {
    const bump = () => setAuthSessionTick((n) => n + 1);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, bump);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, bump);
  }, []);

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(readThemePreferenceLs);
  const [systemIsDark, setSystemIsDark] = useState<boolean>(readSystemPrefersDark);

  /** Brauzer: majburiy `system` (sozlamalar va serverdagi light/dark e’tiborsiz) */
  useEffect(() => {
    if (typeof window === 'undefined' || isMarketplaceNativeApp()) return;
    setThemePreferenceState('system');
    try {
      localStorage.setItem('theme', 'system');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    const mqLight = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => setSystemIsDark(readSystemPrefersDark());
    sync();
    const onChange = () => sync();
    if (typeof mqDark.addEventListener === 'function') {
      mqDark.addEventListener('change', onChange);
      mqLight.addEventListener('change', onChange);
      return () => {
        mqDark.removeEventListener('change', onChange);
        mqLight.removeEventListener('change', onChange);
      };
    }
    mqDark.addListener(onChange);
    mqLight.addListener(onChange);
    return () => {
      mqDark.removeListener(onChange);
      mqLight.removeListener(onChange);
    };
  }, []);

  /** `system` rejimida: OS / oyna o‘lchami / WebView kechikishi — qayta o‘qish */
  useEffect(() => {
    if (themePreference !== 'system') return;
    const sync = () => setSystemIsDark(readSystemPrefersDark());
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    sync();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, [themePreference]);

  const theme: ThemeMode = useMemo(() => {
    if (themePreference === 'system') return systemIsDark ? 'dark' : 'light';
    return themePreference;
  }, [themePreference, systemIsDark]);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    const n = normalizeThemePreference(pref);
    setThemePreferenceState(n || 'system');
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'theme') return;
      const n = normalizeThemePreference(e.newValue);
      if (n) setThemePreferenceState(n);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('language');
      if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved;
    } catch {
      /* ignore */
    }
    return 'uz';
  });

  const [notifications, setNotifications] = useState(() => readBoolLs('notifications', true));

  const [soundEnabled, setSoundEnabled] = useState(() => readBoolLs('soundEnabled', true));

  const [supportChatEnabled, setSupportChatEnabled] = useState(() =>
    readBoolLs('supportChatEnabled', true),
  );

  const [accentColor, setAccentColorState] = useState(() => {
    const saved = localStorage.getItem('accentColor');
    return accentColors.find(c => c.id === saved) || accentColors[0];
  });

  // Unified save function with useCallback to prevent re-renders
  const saveToSupabase = useCallback(async (settings: any) => {
    try {
      if (!userId || userId === 'anonymous') {
        return;
      }

      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/user/${userId}/settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ settings }),
        }
      );
    } catch (error) {
      // Silently fail - localStorage is primary storage
    }
  }, [userId]);

  // Load settings from Supabase on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Only try to load settings if we have a valid userId
        if (userId && userId !== 'anonymous') {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/user/${userId}/settings`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const settings = data.settings;

            const serverTheme = normalizeThemePreference(settings?.theme);
            if (serverTheme && isMarketplaceNativeApp()) {
              setThemePreferenceState(serverTheme);
              localStorage.setItem('theme', serverTheme);
            }
            if (settings.language) setLanguageState(settings.language);
            if (settings.notifications !== undefined) setNotifications(settings.notifications);
            if (settings.soundEnabled !== undefined) setSoundEnabled(settings.soundEnabled);
            if (settings.supportChatEnabled !== undefined) setSupportChatEnabled(settings.supportChatEnabled);
            if (settings.accentColor) {
              const color = accentColors.find(c => c.id === settings.accentColor);
              if (color) setAccentColorState(color);
            }

            localStorage.setItem('language', settings.language || 'uz');
            localStorage.setItem('notifications', JSON.stringify(settings.notifications !== undefined ? settings.notifications : true));
            localStorage.setItem('soundEnabled', JSON.stringify(settings.soundEnabled !== undefined ? settings.soundEnabled : true));
            localStorage.setItem('supportChatEnabled', JSON.stringify(settings.supportChatEnabled !== undefined ? settings.supportChatEnabled : true));
            if (settings.accentColor) {
              localStorage.setItem('accentColor', settings.accentColor);
            }
          } else {
            /* defaults */
          }
        }
      } catch {
        /* defaults */
      }
    };

    loadSettings();
  }, [userId, visibilityRefetchTick, authSessionTick]);

  // useLayoutEffect: brauzer bo‘yashdan oldin — SPA ichida tema almashganda flash kamayadi
  useLayoutEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';

    let schemeMeta = document.querySelector('meta[name="color-scheme"]');
    if (!schemeMeta) {
      schemeMeta = document.createElement('meta');
      schemeMeta.setAttribute('name', 'color-scheme');
      document.head.insertBefore(schemeMeta, document.head.firstChild);
    }
    schemeMeta.setAttribute('content', isDark ? 'dark' : 'light');

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
    }

    const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatus) {
      appleStatus.setAttribute('content', isDark ? 'black-translucent' : 'default');
    }
  }, [theme]);

  useEffect(() => {
    const map: Record<string, string> = { uz: 'uz', ru: 'ru', en: 'en' };
    document.documentElement.lang = map[language] || 'uz';
  }, [language]);

  // Single effect to save all settings when any change
  useEffect(() => {
    localStorage.setItem('theme', themePreference);
    localStorage.setItem('language', language);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
    localStorage.setItem('supportChatEnabled', JSON.stringify(supportChatEnabled));
    localStorage.setItem('accentColor', accentColor.id);

    // Fon va matn — bg-background / text-foreground (theme.css + .dark)
    document.body.style.removeProperty('background');
    document.body.style.removeProperty('background-color');
    document.body.style.removeProperty('color');

    // Debounce Supabase save
    const timer = setTimeout(() => {
      if (userId && userId !== 'anonymous') {
        saveToSupabase({
          theme: themePreference,
          language,
          notifications,
          soundEnabled,
          supportChatEnabled,
          accentColor: accentColor.id,
        });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [
    themePreference,
    language,
    notifications,
    soundEnabled,
    supportChatEnabled,
    accentColor.id,
    saveToSupabase,
    userId,
  ]);

  const toggleTheme = useCallback(() => {
    if (typeof window !== 'undefined' && !isMarketplaceNativeApp()) return;
    setThemePreferenceState((prev) => {
      if (prev === 'system') {
        const osDark = readSystemPrefersDark();
        return osDark ? 'light' : 'dark';
      }
      if (prev === 'light') return 'dark';
      return 'system';
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotifications((prev: boolean) => !prev);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev: boolean) => !prev);
  }, []);

  const toggleSupportChat = useCallback(() => {
    setSupportChatEnabled((prev: boolean) => !prev);
  }, []);

  const setAccentColor = useCallback((colorId: string) => {
    const color = accentColors.find((c) => c.id === colorId);
    if (color) {
      setAccentColorState(color);
    }
  }, []);

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      theme,
      themePreference,
      setThemePreference,
      language,
      notifications,
      soundEnabled,
      supportChatEnabled,
      accentColor,
      toggleTheme,
      setLanguage,
      toggleNotifications,
      toggleSound,
      toggleSupportChat,
      setAccentColor,
    }),
    [
      theme,
      themePreference,
      setThemePreference,
      language,
      notifications,
      soundEnabled,
      supportChatEnabled,
      accentColor,
      toggleTheme,
      setLanguage,
      toggleNotifications,
      toggleSound,
      toggleSupportChat,
      setAccentColor,
    ],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
      <Toaster
        theme={theme}
        position="top-center"
        expand={false}
        richColors
        closeButton
        visibleToasts={4}
        duration={2800}
        offset={{ top: 'var(--app-safe-top)' }}
        mobileOffset={{ top: 'var(--app-safe-top)' }}
        toastOptions={{
          classNames: {
            toast:
              theme === 'dark'
                ? 'sonner-toast-ios !rounded-2xl !border !border-white/[0.12] !bg-zinc-900/88 !backdrop-blur-2xl !shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65)] !text-white'
                : 'sonner-toast-ios !rounded-2xl !border !border-black/[0.07] !bg-white/[0.94] !backdrop-blur-2xl !shadow-[0_12px_40px_-10px_rgba(15,23,42,0.18)] !text-zinc-900',
            title: '!text-[15px] !font-semibold !leading-snug !tracking-tight',
            description: '!text-[13px] !leading-snug !opacity-[0.82]',
            actionButton:
              theme === 'dark'
                ? '!rounded-xl !bg-white/15 !text-white'
                : '!rounded-xl !bg-zinc-900/90 !text-white',
            cancelButton:
              theme === 'dark' ? '!rounded-xl !bg-white/10 !text-white/90' : '!rounded-xl !bg-black/5 !text-zinc-800',
            closeButton:
              theme === 'dark'
                ? '!rounded-lg !border-white/15 !bg-white/10 !text-white/80'
                : '!rounded-lg !border-black/10 !bg-black/[0.04] !text-zinc-600',
          },
        }}
      />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}