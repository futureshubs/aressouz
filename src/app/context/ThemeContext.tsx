import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Toaster } from 'sonner';
import { getUserId } from '../utils/userId';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

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

export type ThemeMode = 'light' | 'dark';
export type Language = 'uz' | 'ru' | 'en';

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
  theme: ThemeMode;
  language: Language;
  notifications: boolean;
  soundEnabled: boolean;
  supportChatEnabled: boolean;
  accentColor: typeof accentColors[0];
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  toggleNotifications: () => void;
  toggleSound: () => void;
  toggleSupportChat: () => void;
  setAccentColor: (colorId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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
    return 'anonymous';
  };
  
  const userId = getUserIdFromStorage();
  const visibilityRefetchTick = useVisibilityTick();

  // Load from localStorage FIRST (instant). JSON.parse xatosi ThemeProvider’ni yiqitmasin.
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    return 'dark';
  });

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

            // Update state with Supabase data
            if (settings.theme) setTheme(settings.theme);
            if (settings.language) setLanguageState(settings.language);
            if (settings.notifications !== undefined) setNotifications(settings.notifications);
            if (settings.soundEnabled !== undefined) setSoundEnabled(settings.soundEnabled);
            if (settings.supportChatEnabled !== undefined) setSupportChatEnabled(settings.supportChatEnabled);
            if (settings.accentColor) {
              const color = accentColors.find(c => c.id === settings.accentColor);
              if (color) setAccentColorState(color);
            }
            
            // Also update localStorage
            localStorage.setItem('theme', settings.theme || 'dark');
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
  }, [userId, visibilityRefetchTick]);

  // Tailwind `dark:` va theme.css `.dark` o‘zgaruvchilari — html bilan sinxron
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  useEffect(() => {
    const map: Record<string, string> = { uz: 'uz', ru: 'ru', en: 'en' };
    document.documentElement.lang = map[language] || 'uz';
  }, [language]);

  // Single effect to save all settings when any change
  useEffect(() => {
    localStorage.setItem('theme', theme);
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
          theme, 
          language, 
          notifications, 
          soundEnabled, 
          supportChatEnabled,
          accentColor: accentColor.id 
        });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [theme, language, notifications, soundEnabled, accentColor.id, saveToSupabase, userId]);

  const toggleTheme = () => {
    setTheme((prev: ThemeMode) => prev === 'dark' ? 'light' : 'dark');
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleNotifications = () => {
    setNotifications((prev: boolean) => !prev);
  };

  const toggleSound = () => {
    setSoundEnabled((prev: boolean) => !prev);
  };

  const toggleSupportChat = () => {
    setSupportChatEnabled((prev: boolean) => !prev);
  };

  const setAccentColor = (colorId: string) => {
    const color = accentColors.find(c => c.id === colorId);
    if (color) {
      setAccentColorState(color);
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme,
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
    }}>
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