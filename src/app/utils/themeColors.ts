import { ThemeMode } from '../context/ThemeContext';

export const getThemeColors = (theme: ThemeMode, platform: 'ios' | 'android') => {
  const isIOS = platform === 'ios';
  
  if (theme === 'light') {
    return {
      // Light mode colors
      background: {
        primary: isIOS 
          ? 'linear-gradient(to bottom, rgba(249, 250, 251, 0.98), rgba(243, 244, 246, 0.95))'
          : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
        secondary: isIOS
          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(249, 250, 251, 0.85))'
          : 'linear-gradient(135deg, #ffffff, #fafafa)',
        card: isIOS
          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9))'
          : 'linear-gradient(135deg, #ffffff, #f5f5f5)',
        modal: isIOS
          ? 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.95))'
          : 'linear-gradient(135deg, #ffffff, #fafafa)',
      },
      text: {
        primary: '#1f2937',
        secondary: '#6b7280',
        tertiary: '#9ca3af',
      },
      border: {
        primary: 'rgba(0, 0, 0, 0.1)',
        secondary: 'rgba(0, 0, 0, 0.05)',
      },
      shadow: {
        sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
        md: '0 4px 16px rgba(0, 0, 0, 0.15)',
        lg: '0 8px 32px rgba(0, 0, 0, 0.2)',
        xl: '0 12px 48px rgba(0, 0, 0, 0.25)',
      },
      backdrop: 'rgba(0, 0, 0, 0.3)',
      input: {
        background: isIOS
          ? 'linear-gradient(145deg, rgba(243, 244, 246, 0.8), rgba(229, 231, 235, 0.9))'
          : 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
        border: 'rgba(0, 0, 0, 0.15)',
      }
    };
  }
  
  // Dark mode colors
  return {
    background: {
      primary: isIOS 
        ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.92))'
        : 'linear-gradient(to bottom, rgba(18, 18, 18, 0.98), rgba(10, 10, 10, 0.95))',
      secondary: isIOS
        ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.8), rgba(20, 20, 20, 0.9))'
        : 'linear-gradient(135deg, #1e1e1e, #121212)',
      card: isIOS
        ? 'linear-gradient(145deg, rgba(40, 40, 40, 0.6), rgba(25, 25, 25, 0.8))'
        : 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
      modal: isIOS
        ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(10, 10, 10, 0.98))'
        : 'linear-gradient(135deg, #1e1e1e, #121212)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      tertiary: 'rgba(255, 255, 255, 0.5)',
    },
    border: {
      primary: 'rgba(255, 255, 255, 0.1)',
      secondary: 'rgba(255, 255, 255, 0.05)',
    },
    shadow: {
      sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
      md: '0 4px 16px rgba(0, 0, 0, 0.5)',
      lg: '0 8px 32px rgba(0, 0, 0, 0.8)',
      xl: '0 12px 48px rgba(0, 0, 0, 0.9)',
    },
    backdrop: 'rgba(0, 0, 0, 0.7)',
    input: {
      background: isIOS
        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
        : 'linear-gradient(145deg, rgba(30, 30, 30, 0.8), rgba(20, 20, 20, 0.9))',
      border: isIOS ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
    }
  };
};
