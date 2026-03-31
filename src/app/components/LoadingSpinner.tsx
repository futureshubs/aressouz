import { memo } from 'react';
import { useTheme } from '../context/ThemeContext';

export const LoadingSpinner = memo(function LoadingSpinner() {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div 
      className="flex items-center justify-center min-h-[200px]"
      style={{
        background: isDark 
          ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent)'
          : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.5), transparent)',
      }}
    >
      <div className="relative">
        {/* Outer ring */}
        <div 
          className="w-16 h-16 rounded-full"
          style={{
            border: `3px solid ${accentColor.color}33`,
            borderTopColor: accentColor.color,
            animation: 'spin 1s linear infinite',
          }}
        />
        
        {/* Inner ring */}
        <div 
          className="absolute inset-2 rounded-full"
          style={{
            border: `2px solid ${accentColor.color}1a`,
            borderRightColor: accentColor.color,
            animation: 'spin 0.75s linear infinite reverse',
          }}
        />
        
        {/* Center dot */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
        >
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              background: accentColor.gradient,
              boxShadow: `0 0 12px ${accentColor.color}99`,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
});
