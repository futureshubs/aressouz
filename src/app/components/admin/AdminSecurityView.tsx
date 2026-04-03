import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { buildAdminHeaders } from '../../utils/requestAuth';
import { projectId } from '../../../../utils/supabase/info';
import { Shield, RefreshCw, KeyRound, Copy } from 'lucide-react';
import { toast } from 'sonner';

const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

export default function AdminSecurityView() {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ secondaryCodeLength: number; twoFaEnabled: boolean } | null>(
    null,
  );
  const [newSecondary, setNewSecondary] = useState('');
  const [totpSecondary, setTotpSecondary] = useState('');
  const [totpRotate, setTotpRotate] = useState('');
  const [rotateSecret, setRotateSecret] = useState('');
  const [rotateOtpauth, setRotateOtpauth] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/admin/security/status`, {
        headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setStatus({
          secondaryCodeLength: Number(data.secondaryCodeLength) || 0,
          twoFaEnabled: Boolean(data.twoFaEnabled),
        });
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(() => {
    void load();
  });

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)',
  } as const;

  const changeSecondary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/admin/security/secondary-code`, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          newSecondaryCode: newSecondary.trim(),
          totp: totpSecondary.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Saqlanmadi');
        return;
      }
      toast.success('Maxfiy kod yangilandi');
      setNewSecondary('');
      setTotpSecondary('');
      void load();
    } finally {
      setSaving(false);
    }
  };

  const regenerate2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/admin/2fa/regenerate`, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ totp: totpRotate.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Xatolik');
        return;
      }
      setRotateSecret(String(data.secretBase32 || ''));
      setRotateOtpauth(String(data.otpauthUrl || ''));
      setTotpRotate('');
      toast.success('Yangi secret yaratildi. Authenticatorga qo‘shing va pastdagi kod bilan yoqing.');
      void load();
    } finally {
      setSaving(false);
    }
  };

  const enableAfterRotate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotateSecret) return;
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/admin/2fa/enable`, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token: totpRotate.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Yoqilmadi');
        return;
      }
      toast.success('2FA qayta yoqildi');
      setRotateSecret('');
      setRotateOtpauth('');
      setTotpRotate('');
      void load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ opacity: 0.65 }}>
        Login va parol serverda qat‘iy (Ali / Ali). Maxfiy kod va 2FA shu yerdan boshqariladi.
      </p>

      {loading ? (
        <p className="text-sm" style={{ opacity: 0.6 }}>
          Yuklanmoqda…
        </p>
      ) : null}

      {status ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-3xl border flex items-center gap-4" style={cardStyle}>
            <div className="p-3 rounded-2xl" style={{ background: `${accentColor.color}20` }}>
              <KeyRound className="w-6 h-6" style={{ color: accentColor.color }} />
            </div>
            <div>
              <p className="text-sm" style={{ opacity: 0.65 }}>
                Maxfiy kod uzunligi
              </p>
              <p className="text-xl font-bold">{status.secondaryCodeLength} raqam</p>
            </div>
          </div>
          <div className="p-5 rounded-3xl border flex items-center gap-4" style={cardStyle}>
            <div className="p-3 rounded-2xl" style={{ background: `${accentColor.color}20` }}>
              <Shield className="w-6 h-6" style={{ color: accentColor.color }} />
            </div>
            <div>
              <p className="text-sm" style={{ opacity: 0.65 }}>
                2FA (TOTP)
              </p>
              <p className="text-xl font-bold">{status.twoFaEnabled ? 'Yoniq' : 'O‘chiq'}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="p-6 rounded-3xl border space-y-4" style={cardStyle}>
        <h3 className="font-bold text-lg flex items-center gap-2">
          <KeyRound className="w-5 h-5" style={{ color: accentColor.color }} />
          Maxfiy kodni almashtirish
        </h3>
        <p className="text-sm" style={{ opacity: 0.6 }}>
          Yangi kod 4–12 ta raqam. Joriy authenticator kodi talab qilinadi.
        </p>
        <form onSubmit={changeSecondary} className="space-y-4 max-w-md">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Yangi maxfiy kod"
            value={newSecondary}
            onChange={(e) => setNewSecondary(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border outline-none text-sm"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              color: isDark ? '#fff' : '#111',
            }}
          />
          <input
            inputMode="numeric"
            placeholder="Authenticator (6 raqam)"
            value={totpSecondary}
            onChange={(e) => setTotpSecondary(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border outline-none text-sm"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              color: isDark ? '#fff' : '#111',
            }}
          />
          <button
            type="submit"
            disabled={saving || !status?.twoFaEnabled}
            className="px-6 py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
            style={{ background: accentColor.gradient }}
          >
            Saqlash
          </button>
          {!status?.twoFaEnabled ? (
            <p className="text-xs" style={{ opacity: 0.55 }}>
              Avval 2FA ni yoqing.
            </p>
          ) : null}
        </form>
      </div>

      <div className="p-6 rounded-3xl border space-y-4" style={cardStyle}>
        <h3 className="font-bold text-lg flex items-center gap-2">
          <RefreshCw className="w-5 h-5" style={{ color: accentColor.color }} />
          2FA kalitini yangilash
        </h3>
        <p className="text-sm" style={{ opacity: 0.6 }}>
          Eski authenticator kodini tasdiqlang. Keyin yangi secret chiqadi — ilovaga qo‘shing va pastda
          yoqing.
        </p>

        {!rotateSecret ? (
          <form onSubmit={regenerate2fa} className="space-y-4 max-w-md">
            <input
              inputMode="numeric"
              placeholder="Joriy TOTP (6 raqam)"
              value={totpRotate}
              onChange={(e) => setTotpRotate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border outline-none text-sm"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                color: isDark ? '#fff' : '#111',
              }}
            />
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
              style={{ background: accentColor.gradient }}
            >
              Yangi secret olish
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div
              className="p-4 rounded-2xl border flex items-start justify-between gap-3"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: cardStyle.borderColor,
              }}
            >
              <div className="text-xs break-all font-mono" style={{ opacity: 0.9 }}>
                {rotateSecret}
              </div>
              <button
                type="button"
                className="p-2 rounded-xl border shrink-0"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(rotateSecret);
                    toast.success('Nusxalandi');
                  } catch {
                    toast.error('Nusxalanmadi');
                  }
                }}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {rotateOtpauth ? (
              <p className="text-xs break-all" style={{ opacity: 0.55 }}>
                {rotateOtpauth}
              </p>
            ) : null}
            <form onSubmit={enableAfterRotate} className="space-y-3 max-w-md">
              <input
                inputMode="numeric"
                placeholder="Yangi kod (6 raqam)"
                value={totpRotate}
                onChange={(e) => setTotpRotate(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border outline-none text-sm"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  color: isDark ? '#fff' : '#111',
                }}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
                  style={{ background: accentColor.gradient }}
                >
                  2FA ni yoqish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRotateSecret('');
                    setRotateOtpauth('');
                    setTotpRotate('');
                  }}
                  className="px-4 py-3 rounded-2xl border text-sm"
                  style={{ borderColor: cardStyle.borderColor }}
                >
                  Bekor
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
