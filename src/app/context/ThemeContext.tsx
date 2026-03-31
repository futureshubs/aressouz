import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getUserId } from '../utils/userId';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

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
    } catch (error) {
      console.log('Could not get user from storage:', error);
    }
    return 'anonymous';
  };
  
  const userId = getUserIdFromStorage();
  const visibilityRefetchTick = useVisibilityTick();

  // Load from localStorage FIRST (instant)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as ThemeMode) || 'dark';
  });

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'uz';
  });

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : true;
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved ? JSON.parse(saved) : true;
  });

  const [supportChatEnabled, setSupportChatEnabled] = useState(() => {
    const saved = localStorage.getItem('supportChatEnabled');
    return saved ? JSON.parse(saved) : true;
  });

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
            
            console.log('✅ Settings loaded from Supabase:', settings);
            
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
            console.log('⚠️ Failed to load settings, using defaults');
          }
        } else {
          console.log('ℹ️ Anonymous user, skipping settings load');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [userId, visibilityRefetchTick]);

  // Single effect to save all settings when any change
  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('language', language);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
    localStorage.setItem('supportChatEnabled', JSON.stringify(supportChatEnabled));
    localStorage.setItem('accentColor', accentColor.id);
    
    document.body.style.background = theme === 'dark' ? '#000000' : '#f9fafb';
    
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