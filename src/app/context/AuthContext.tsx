import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, getCurrentUser, setCurrentUser, clearAuthToken } from '../services/api';
import { registerExpoPushTokenIfAvailable } from '../utils/registerExpoPushToken';

interface User {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: 'male' | 'female';
}

interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  smsSignin: (user: User, session: Session) => void;
  signout: () => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    // Try to restore session from localStorage
    try {
      console.log('💾 localStorage check:', {
        sms_user: localStorage.getItem('sms_user') ? 'EXISTS' : null,
        sms_session: localStorage.getItem('sms_session') ? 'EXISTS' : null,
      });
      
      const storedUser = localStorage.getItem('sms_user');
      const storedSession = localStorage.getItem('sms_session');
      
      console.log('🔍 ===== RESTORING SESSION FROM LOCALSTORAGE =====');
      console.log('📦 storedUser:', storedUser ? 'EXISTS' : 'NULL');
      console.log('📦 storedSession:', storedSession ? 'EXISTS' : 'NULL');
      
      if (storedUser && storedSession) {
        const parsedUser = JSON.parse(storedUser);
        const parsedSession = JSON.parse(storedSession);
        
        console.log('✅ Parsed user:', parsedUser);
        console.log('✅ Parsed session:', parsedSession);
        console.log('🔑 access_token from session:', parsedSession.access_token || 'MISSING');
        
        // CRITICAL: Validate token format
        if (!parsedSession.access_token) {
          console.log('❌ access_token is missing from session! Clearing...');
          localStorage.removeItem('sms_user');
          localStorage.removeItem('sms_session');
          setIsLoading(false);
          return;
        }
        
        // Check if it's a JWT (has 3 parts separated by dots)
        const isJWT = parsedSession.access_token.split('.').length === 3;
        
        // Check if it's a custom token (has dashes)
        const tokenParts = parsedSession.access_token.split('-');
        const isCustomToken = tokenParts.length >= 7;
        
        console.log('🔍 Token validation:');
        console.log('  - Token preview:', parsedSession.access_token.substring(0, 50) + '...');
        console.log('  - Is JWT:', isJWT);
        console.log('  - Is Custom Token:', isCustomToken);
        
        if (!isJWT && !isCustomToken) {
          console.log('❌ Invalid token format! Must be either JWT or custom token');
          localStorage.removeItem('sms_user');
          localStorage.removeItem('sms_session');
          setIsLoading(false);
          return;
        }
        
        // Check if session is expired
        if (parsedSession.expires_at && Date.now() > parsedSession.expires_at) {
          console.log('⚠️ Stored session expired, clearing...');
          localStorage.removeItem('sms_user');
          localStorage.removeItem('sms_session');
          setIsLoading(false);
          return;
        }
        
        console.log('✅ Restored session from localStorage:', parsedUser);
        console.log('✅ Token format:', isJWT ? 'JWT' : 'Custom');
        setUser(parsedUser);
        setSession(parsedSession);
      } else {
        console.log('ℹ️ No stored session found');
      }
      console.log('🔍 ===== SESSION RESTORATION COMPLETE =====\n');
    } catch (error) {
      console.error('❌ Error restoring session:', error);
      // Clear corrupted data
      localStorage.removeItem('sms_user');
      localStorage.removeItem('sms_session');
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || !user || !accessToken) return;
    const tryRegister = () => registerExpoPushTokenIfAvailable(accessToken);
    const inNativeWebView = Boolean(
      (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView,
    );
    if (!inNativeWebView) {
      void tryRegister();
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    void tryRegister();
    intervalId = setInterval(() => {
      if (cancelled) {
        if (intervalId) clearInterval(intervalId);
        return;
      }
      void tryRegister().then((ok) => {
        if (ok && intervalId) clearInterval(intervalId);
      });
    }, 2000);
    const stop = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
    }, 45000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      clearTimeout(stop);
    };
  }, [isLoading, user?.id, accessToken]);

  const signin = async (email: string, password: string) => {
    try {
      const { user: loggedInUser, session: sessionData } = await authAPI.signin(email, password);
      setUser(loggedInUser);
      setSession(sessionData);
      setCurrentUser(loggedInUser);
      
      // Persist to localStorage
      try {
        localStorage.setItem('sms_user', JSON.stringify(loggedInUser));
        localStorage.setItem('sms_session', JSON.stringify(sessionData));
        console.log('✅ Email/Password Sign-in successful (session saved to localStorage)');
      } catch (error) {
        console.error('❌ Error saving session to localStorage:', error);
      }
    } catch (error) {
      console.error('Signin error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const { user: newUser } = await authAPI.signup(email, password, name);
      // After signup, automatically sign in
      await signin(email, password);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const smsSignin = (userData: User, sessionData: Session) => {
    // Save user and session data in memory and localStorage
    setUser(userData);
    setSession(sessionData);
    
    // Persist to localStorage
    try {
      console.log('💾 ===== SAVING SESSION TO LOCALSTORAGE =====');
      console.log('👤 User data:', userData);
      console.log('🎫 Session data:', sessionData);
      console.log('🔑 Access token FULL:', sessionData.access_token || 'MISSING');
      console.log('🔑 Token type:', typeof sessionData.access_token);
      console.log('🔑 Token length:', sessionData.access_token?.length || 0);
      
      // Validate token format (JWT or custom token)
      const isJWT = sessionData.access_token && sessionData.access_token.split('.').length === 3;
      const isCustomToken = sessionData.access_token && sessionData.access_token.split('-').length >= 7;
      
      if (!isJWT && !isCustomToken) {
        console.error('❌ ERROR: Invalid token format');
        console.error('❌ Expected format: JWT (xxx.yyy.zzz) or custom token (userId-timestamp-random)');
        console.error('❌ Received:', sessionData.access_token);
        throw new Error('Invalid token format received from server');
      }
      
      localStorage.setItem('sms_user', JSON.stringify(userData));
      localStorage.setItem('sms_session', JSON.stringify(sessionData));
      console.log('✅ SMS Sign-in successful (session saved to localStorage)');
      console.log('🔑 Token format:', isJWT ? 'JWT' : 'Custom');
      console.log('🔑 Access token preview:', sessionData.access_token ? `${sessionData.access_token.substring(0, 30)}... (length: ${sessionData.access_token.length})` : 'MISSING')
      
      // Verify it was saved correctly
      const saved = localStorage.getItem('sms_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('✅ Verification: Token saved correctly:', parsed.access_token ? 'YES' : 'NO');
        console.log('✅ Saved token preview:', parsed.access_token ? `${parsed.access_token.substring(0, 30)}...` : 'MISSING');
      }
      console.log('💾 ===== SESSION SAVED SUCCESSFULLY =====');
    } catch (error) {
      console.error('❌ Error saving session to localStorage:', error);
      throw error;
    }
  };

  const signout = () => {
    authAPI.signout();
    setUser(null);
    setSession(null);
    
    // Clear localStorage
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_session');
    
    console.log('✅ Signed out successfully');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        accessToken,
        signin,
        signup,
        smsSignin,
        signout,
        isAuthOpen,
        setIsAuthOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}