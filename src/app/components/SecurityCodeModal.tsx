import { useState, useRef, useEffect } from 'react';
import { X, Lock, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SecurityCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'delete' | 'edit';
  title: string;
}

const SECRET_CODE = '0099'; // Maxfiy kod

export function SecurityCodeModal({ isOpen, onClose, onSuccess, action, title }: SecurityCodeModalProps) {
  const { theme, accentColor } = useTheme();
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      setCode(['', '', '', '']);
      setError('');
      // Focus first input when modal opens
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-check when all filled
    if (newCode.every(digit => digit !== '')) {
      const enteredCode = newCode.join('');
      checkCode(enteredCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const checkCode = async (enteredCode: string) => {
    setIsChecking(true);
    
    // Simulate checking delay
    await new Promise(resolve => setTimeout(resolve, 300));

    if (enteredCode === SECRET_CODE) {
      // Success!
      setIsChecking(false);
      onSuccess();
    } else {
      // Wrong code
      setError('Noto\'g\'ri kod!');
      setCode(['', '', '', '']);
      setIsChecking(false);
      inputRefs[0].current?.focus();
      
      // Vibrate if available
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    if (/^\d{4}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setCode(digits);
      setError('');
      checkCode(pastedData);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(16px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(25, 25, 25, 0.98), rgba(15, 15, 15, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
          backdropFilter: 'blur(40px)',
          borderRadius: '32px',
          boxShadow: isDark
            ? '0 24px 64px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 24px 64px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl transition-all active:scale-90"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }}
        >
          <X className="size-5" style={{ color: isDark ? '#ffffff' : '#000000' }} strokeWidth={2.5} />
        </button>

        {/* Content */}
        <div className="p-8 pt-6">
          {/* Icon */}
          <div 
            className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              backgroundImage: action === 'delete' 
                ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                : accentColor.gradient,
              boxShadow: action === 'delete'
                ? '0 8px 24px rgba(239, 68, 68, 0.4)'
                : `0 8px 24px ${accentColor.color}44`,
            }}
          >
            <Lock className="size-8 text-white" strokeWidth={2.5} />
          </div>

          <h2 
            className="text-2xl font-bold text-center mb-2"
            style={{ color: isDark ? '#ffffff' : '#000000' }}
          >
            Xavfsizlik kodi
          </h2>
          
          <p 
            className="text-sm text-center mb-8"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {title}
          </p>

          {/* Code Input */}
          <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="size-16 text-center text-2xl font-bold rounded-2xl transition-all outline-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: error 
                    ? '2px solid #ef4444'
                    : digit 
                    ? `2px solid ${accentColor.color}` 
                    : isDark 
                    ? '2px solid rgba(255, 255, 255, 0.1)' 
                    : '2px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  caretColor: accentColor.color,
                }}
                disabled={isChecking}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div 
              className="flex items-center gap-2 p-3 rounded-xl mb-4 animate-shake"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertCircle className="size-5 text-red-500" strokeWidth={2.5} />
              <p className="text-sm text-red-500 font-semibold">
                {error}
              </p>
            </div>
          )}

          {/* Loading State */}
          {isChecking && (
            <div className="flex justify-center">
              <div 
                className="animate-spin rounded-full h-8 w-8 border-4 border-t-transparent"
                style={{ 
                  borderColor: `${accentColor.color}44`, 
                  borderTopColor: 'transparent' 
                }}
              />
            </div>
          )}

          {/* Help Text */}
          <p 
            className="text-xs text-center mt-6"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
          >
            🔒 Maxfiy kodni kiriting
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
}
