// Two-Factor Authentication Settings
// Google Authenticator Integration

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Shield, 
  QrCode, 
  Key, 
  Copy, 
  Check, 
  Eye, 
  EyeOff,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';

interface TwoFactorAuthProps {
  branchId: string;
  branchName: string;
  isDark: boolean;
  accentColor: any;
}

export default function TwoFactorAuth({ branchId, branchName, isDark, accentColor }: TwoFactorAuthProps) {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrCodeImage, setQrCodeImage] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [password, setPassword] = useState('');
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    check2FAStatus();
  }, [branchId, visibilityRefetchTick]);

  const check2FAStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/2fa/status/${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIs2FAEnabled(data.enabled || false);

        // If enabled, get backup codes
        if (data.enabled) {
          await loadBackupCodes();
        }
      }
    } catch (error) {
      console.error('Check 2FA status error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBackupCodes = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/2fa/backup-codes/${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBackupCodes(data.backupCodes || []);
      }
    } catch (error) {
      console.error('Load backup codes error:', error);
    }
  };

  const handleEnable2FA = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/2fa/enable`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchId,
            branchName,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSecret(data.secret);
        setQrCodeUrl(data.qrCodeUrl);
        setBackupCodes(data.backupCodes);
        setShowSetup(true);

        // Generate QR code image
        const qrImage = await QRCodeLib.toDataURL(data.qrCodeUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: isDark ? '#ffffff' : '#000000',
            light: isDark ? '#0a0a0a' : '#ffffff',
          },
        });
        setQrCodeImage(qrImage);

        toast.success('2FA sozlamalari yaratildi');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Enable 2FA error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/2fa/verify-and-enable`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchId,
            token: verificationCode,
          }),
        }
      );

      if (response.ok) {
        toast.success('2FA muvaffaqiyatli yoqildi!');
        setIs2FAEnabled(true);
        setShowSetup(false);
        setVerificationCode('');
        setShowBackupCodes(true);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Kod noto\'g\'ri');
        setVerificationCode('');
      }
    } catch (error) {
      console.error('Verify 2FA error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!password) {
      toast.error('Parolni kiriting');
      return;
    }

    if (!confirm('2FA ni o\'chirmoqchimisiz? Bu xavfsizlikni pasaytiradi.')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/2fa/disable`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchId,
            password,
          }),
        }
      );

      if (response.ok) {
        toast.success('2FA o\'chirildi');
        setIs2FAEnabled(false);
        setPassword('');
        setBackupCodes([]);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Disable 2FA error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!password) {
      toast.error('Parolni kiriting');
      return;
    }

    if (!confirm('Yangi backup kodlar yaratmoqchimisiz? Eski kodlar ishlamay qoladi.')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/2fa/regenerate-backup-codes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchId,
            password,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBackupCodes(data.backupCodes);
        setPassword('');
        setShowBackupCodes(true);
        toast.success('Yangi backup kodlar yaratildi');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Regenerate backup codes error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'backup') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    }
    toast.success('Nusxalandi');
  };

  const downloadBackupCodes = () => {
    const text = `Online Shop - Backup Codes\nFilial: ${branchName}\nSana: ${new Date().toLocaleDateString()}\n\n${backupCodes.join('\n')}\n\nDiqqat: Bu kodlarni xavfsiz joyda saqlang!`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-${branchId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup kodlar yuklandi');
  };

  if (isLoading && !showSetup) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-12 h-12 animate-spin shrink-0" style={{ color: accentColor.color }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="p-4 rounded-2xl"
          style={{ background: `${accentColor.color}20` }}
        >
          <Shield className="w-8 h-8" style={{ color: accentColor.color }} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Ikki Faktorli Autentifikatsiya (2FA)</h2>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Google Authenticator orqali qo'shimcha himoya
          </p>
        </div>
      </div>

      {/* Status Card */}
      <div
        className="p-6 rounded-2xl border"
        style={{
          background: is2FAEnabled 
            ? `${accentColor.color}10`
            : isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          borderColor: is2FAEnabled 
            ? accentColor.color 
            : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {is2FAEnabled ? (
              <CheckCircle2 className="w-6 h-6" style={{ color: accentColor.color }} />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            )}
            <div>
              <h3 className="font-bold text-lg">
                {is2FAEnabled ? '2FA Yoniq' : '2FA O\'chiq'}
              </h3>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                {is2FAEnabled 
                  ? 'Hisobingiz Google Authenticator bilan himoyalangan'
                  : 'Hisobingizni qo\'shimcha himoyalang'}
              </p>
            </div>
          </div>

          {!is2FAEnabled && !showSetup && (
            <button
              type="button"
              onClick={() => void handleEnable2FA()}
              disabled={isLoading}
              className="px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
              }}
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
              2FA ni yoqish
            </button>
          )}
        </div>
      </div>

      {/* Setup Flow */}
      {showSetup && !is2FAEnabled && (
        <div className="space-y-6">
          {/* Step 1: QR Code */}
          <div
            className="p-6 rounded-2xl border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold" style={{ background: accentColor.gradient, color: '#ffffff' }}>
                1
              </div>
              <h3 className="text-xl font-bold">Google Authenticator'ga qo'shing</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* QR Code */}
              <div className="text-center">
                {qrCodeImage ? (
                  <div className="inline-block p-4 rounded-2xl" style={{ background: isDark ? '#ffffff' : '#f9fafb' }}>
                    <img src={qrCodeImage} alt="QR Code" className="w-64 h-64 mx-auto" />
                  </div>
                ) : (
                  <div className="w-64 h-64 mx-auto flex items-center justify-center rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}>
                    <QrCode className="w-16 h-16" style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} />
                  </div>
                )}
                <p className="mt-4 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Ilovadan QR kodni skanerlang
                </p>
              </div>

              {/* Manual Entry */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-2">Yoki qo'lda kiriting:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={secret}
                      readOnly
                      className="flex-1 px-4 py-3 rounded-xl border outline-none font-mono text-sm"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-3 rounded-xl transition-all active:scale-95"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(secret, 'secret')}
                      className="p-3 rounded-xl transition-all active:scale-95"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      {copiedSecret ? <Check className="w-5 h-5" style={{ color: accentColor.color }} /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl text-sm space-y-2"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <p className="font-semibold">Qadamlar:</p>
                  <ol className="list-decimal list-inside space-y-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    <li>Google Authenticator ilovasini oching</li>
                    <li>"+" tugmasini bosing</li>
                    <li>"Scan a QR code" yoki "Enter a setup key" tanlang</li>
                    <li>QR kodni skanerlang yoki secret key ni kiriting</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Verify Code */}
          <div
            className="p-6 rounded-2xl border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold" style={{ background: accentColor.gradient, color: '#ffffff' }}>
                2
              </div>
              <h3 className="text-xl font-bold">Kodni tasdiqlang</h3>
            </div>

            <form onSubmit={handleVerifyAndEnable} className="max-w-md">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">6 raqamli kod</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isLoading}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border outline-none text-center text-2xl font-mono tracking-widest disabled:opacity-60"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                  maxLength={6}
                  required
                />
                <p className="mt-2 text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Google Authenticator ilovasidan kodni oling
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSetup(false);
                    setVerificationCode('');
                  }}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                  }}
                >
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                  {isLoading ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backup Codes */}
      {is2FAEnabled && (
        <div
          className="p-6 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Key className="w-6 h-6" style={{ color: accentColor.color }} />
              <div>
                <h3 className="text-lg font-bold">Backup Kodlar</h3>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Telefon yo'qolganda foydalanish uchun
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBackupCodes(!showBackupCodes)}
              className="px-4 py-2 rounded-xl font-semibold transition-all active:scale-95"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              {showBackupCodes ? 'Yashirish' : 'Ko\'rsatish'}
            </button>
          </div>

          {showBackupCodes && (
            <>
              <div
                className="p-4 rounded-xl mb-4 grid grid-cols-2 gap-2 font-mono text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                }}
              >
                {backupCodes.map((code, index) => (
                  <div key={index} className="p-2 rounded text-center">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
                  className="flex-1 py-2 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {copiedBackup ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>Nusxalash</span>
                </button>
                <button
                  onClick={downloadBackupCodes}
                  className="flex-1 py-2 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>Yuklash</span>
                </button>
              </div>

              <div
                className="p-3 rounded-xl text-sm flex items-start gap-2"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                }}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Muhim:</strong> Bu kodlarni xavfsiz joyda saqlang! Har bir kod faqat bir marta ishlatilishi mumkin.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Management */}
      {is2FAEnabled && (
        <div
          className="p-6 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="text-lg font-bold mb-4">Boshqarish</h3>

          <div className="space-y-4">
            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Parol</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Parolingizni kiriting"
                className="w-full px-4 py-3 rounded-xl border outline-none disabled:opacity-60"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              />
              <p className="mt-1 text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                O'zgarishlarni amalga oshirish uchun parolni kiriting
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleRegenerateBackupCodes()}
                disabled={isLoading || !password}
                className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: `${accentColor.color}20`,
                  color: accentColor.color,
                }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                ) : (
                  <RefreshCw className="w-5 h-5 shrink-0" />
                )}
                <span>Backup kodlarni yangilash</span>
              </button>

              <button
                type="button"
                onClick={() => void handleDisable2FA()}
                disabled={isLoading || !password}
                className="px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                }}
              >
                {isLoading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                2FA ni o'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
