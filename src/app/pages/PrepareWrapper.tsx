// Preparer Wrapper - Login + Panel combined
// Tayyorlovchi wrapper - Login va Panel birlashtirilgan

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import PrepareLogin from '../components/PrepareLogin';
import PreparePanel from '../components/PreparePanel';
import { useTheme } from '../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';

export default function PrepareWrapper() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [preparer, setPreparer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('preparerToken');
    if (savedToken) {
      validateSession(savedToken);
    } else {
      setIsLoading(false);
    }
  }, [visibilityRefetchTick]);

  const validateSession = async (savedToken: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers/validate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: savedToken }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setToken(savedToken);
          setPreparer(data.preparer);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('preparerToken');
        }
      }
      // HTTP xatolik yoki tarmoq uzilishi: tokenni saqlab qolamiz — keyingi visibility yoki qayta yuklashda qayta tekshiriladi
    } catch (error) {
      console.error('Session validation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (newToken: string, preparerData: any) => {
    setToken(newToken);
    setPreparer(preparerData);
    setIsAuthenticated(true);
    localStorage.setItem('preparerToken', newToken);
  };

  const handleLogout = () => {
    setToken(null);
    setPreparer(null);
    setIsAuthenticated(false);
    localStorage.removeItem('preparerToken');
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center app-safe-pt"
        style={{
          background: isDark ? '#000000' : '#f9fafb',
          color: isDark ? '#ffffff' : '#111827',
        }}
      >
        <Loader2 className="h-12 w-12 animate-spin shrink-0 text-blue-500" aria-hidden />
      </div>
    );
  }

  if (!isAuthenticated || !token || !preparer) {
    return <PrepareLogin onLogin={handleLogin} />;
  }

  return <PreparePanel token={token} preparer={preparer} onLogout={handleLogout} />;
}
