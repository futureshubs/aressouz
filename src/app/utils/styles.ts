// Style utility functions and constants
import { Platform } from './platform';

export interface StyleConfig {
  isDark: boolean;
  platform: Platform;
  accentColor: {
    color: string;
    gradient: string;
  };
}

// Background styles
export const getBackgroundStyle = ({ isDark, platform }: { isDark: boolean; platform: Platform }) => {
  const isIOS = platform === 'ios';
  
  if (isIOS) {
    return {
      background: isDark 
        ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(10, 10, 10, 0.98))'
        : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
      backdropFilter: 'blur(20px)',
    };
  }
  
  return {
    background: isDark 
      ? 'linear-gradient(135deg, #1e1e1e, #121212)'
      : 'linear-gradient(135deg, #ffffff, #f9fafb)',
  };
};

// Card styles
export const getCardStyle = ({ isDark, platform }: { isDark: boolean; platform: Platform }) => {
  const isIOS = platform === 'ios';
  
  if (isIOS) {
    return {
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
    };
  }
  
  return {
    background: isDark 
      ? 'linear-gradient(135deg, #1a1a1a, #141414)'
      : 'linear-gradient(135deg, #ffffff, #fafafa)',
    border: isDark 
      ? '1px solid rgba(255, 255, 255, 0.05)' 
      : '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: isDark 
      ? 'none'
      : '0 2px 8px rgba(0, 0, 0, 0.04)',
  };
};

// Button styles
export const getButtonStyle = ({ isDark, platform, accentColor }: StyleConfig) => {
  const isIOS = platform === 'ios';
  
  return {
    backgroundImage: accentColor.gradient,
    border: isIOS 
      ? (isDark ? '0.5px solid rgba(255, 255, 255, 0.2)' : '0.5px solid rgba(0, 0, 0, 0.1)')
      : `1px solid ${accentColor.color}4d`,
    boxShadow: isDark 
      ? `0 4px 16px ${accentColor.color}66`
      : `0 4px 12px ${accentColor.color}4d`,
  };
};

// Icon container styles
export const getIconContainerStyle = ({ isDark, platform, accentColor, danger = false }: StyleConfig & { danger?: boolean }) => {
  const isIOS = platform === 'ios';
  
  if (danger) {
    return {
      backgroundImage: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      boxShadow: 'none',
    };
  }
  
  if (isIOS) {
    return {
      backgroundImage: accentColor.gradient,
      border: `1px solid ${accentColor.color}4d`,
      boxShadow: isDark ? 'none' : `0 2px 6px ${accentColor.color}1a`,
    };
  }
  
  return {
    background: `${accentColor.color}26`,
    border: `1px solid ${accentColor.color}4d`,
    boxShadow: isDark ? 'none' : `0 2px 6px ${accentColor.color}1a`,
  };
};

// Border styles
export const getBorderStyle = ({ isDark, platform }: { isDark: boolean; platform: Platform }) => {
  const isIOS = platform === 'ios';
  
  return isDark 
    ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)')
    : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)');
};

// Text color
export const getTextColor = (isDark: boolean, opacity?: number) => {
  if (opacity) {
    return isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
  }
  return isDark ? '#ffffff' : '#111827';
};

// Backdrop styles
export const getBackdropStyle = ({ isDark, platform }: { isDark: boolean; platform: Platform }) => {
  const isIOS = platform === 'ios';
  
  return {
    background: isDark 
      ? (isIOS ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.8)')
      : (isIOS ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.5)'),
    backdropFilter: isIOS ? 'blur(10px)' : undefined,
  };
};

// Toggle switch styles
export const getToggleSwitchStyle = ({ isDark, accentColor, isActive }: { isDark: boolean; accentColor: { color: string; gradient: string }; isActive: boolean }) => {
  return {
    backgroundImage: isActive ? accentColor.gradient : 'none',
    backgroundColor: isActive ? 'transparent' : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
    boxShadow: isActive ? `0 4px 12px ${accentColor.color}66` : 'none',
  };
};
