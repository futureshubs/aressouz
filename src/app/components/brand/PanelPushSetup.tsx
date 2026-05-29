import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { edgeFunctionBaseUrl } from '../../utils/edgeFunctionBaseUrl';
import {
  isPanelNotificationsSupported,
  isWebPushSupported,
  markPanelPushDeclined,
  requestPanelNotificationPermission,
  subscribePanelWebPush,
  wasPanelPushDeclined,
  type PanelPushScope,
} from '../../utils/panelNotifications';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  scope: PanelPushScope;
  headers: Record<string, string>;
  className?: string;
};

/** Panel ochilganda push obuna taklifi (PWA / iOS «Uyga qo‘shish» dan keyin) */
export default function PanelPushSetup({ scope, headers, className = '' }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(wasPanelPushDeclined);

  useEffect(() => {
    if (!isPanelNotificationsSupported()) return;
    if (perm === 'granted') {
      void subscribePanelWebPush(scope, edgeFunctionBaseUrl(), headers).catch(() => {});
    }
  }, [perm, scope.panel, scope.scopeId]);

  if (!isWebPushSupported() && !isPanelNotificationsSupported()) return null;
  if (perm === 'granted' || dismissed) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const p = await requestPanelNotificationPermission();
      setPerm(p);
      if (p !== 'granted') {
        toast.error('Bildirishnomalar uchun ruxsat kerak');
        return;
      }
      const r = await subscribePanelWebPush(scope, edgeFunctionBaseUrl(), headers);
      if (r.ok) {
        toast.success('Bildirishnomalar yoqildi — buyurtma tushsa telefoningizga keladi');
        setPerm('granted');
      } else {
        toast.error(r.error || 'Push ulanmadi');
      }
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    markPanelPushDeclined();
    setDismissed(true);
  };

  return (
    <div
      className={`rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
      style={{
        background: isDark ? 'rgba(20,184,166,0.12)' : 'rgba(20,184,166,0.08)',
        borderColor: isDark ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.25)',
      }}
    >
      <div className="flex items-start gap-2 min-w-0">
        <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accentColor.color }} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Buyurtma bildirishnomalari</p>
          <p className="text-xs mt-0.5 opacity-70">
            Ilovani uyga qo‘shing — yangi buyurtma yoki xabar tushganda telefoningizga xabar keladi (iOS 16.4+).
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: accentColor.gradient }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Yoqish
        </button>
        <button
          type="button"
          onClick={skip}
          className="p-2 rounded-xl opacity-60 hover:opacity-100"
          aria-label="Keyinroq"
        >
          <BellOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
