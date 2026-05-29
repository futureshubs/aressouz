import { playNotificationSound } from './appToast';

export type PanelRole =
  | 'seller'
  | 'kuryer'
  | 'tayyorlovchi'
  | 'taom'
  | 'kassa'
  | 'filial'
  | 'admin'
  | 'avtokuryer'
  | 'ijara'
  | 'xodim'
  | 'omborchi'
  | 'support';

export const PANEL_DASHBOARD_PATH: Record<PanelRole, string> = {
  seller: '/seller/dashboard',
  kuryer: '/kuryer/dashboard',
  tayyorlovchi: '/tayyorlovchi',
  taom: '/restaurant/panel',
  kassa: '/kassa/dashboard',
  filial: '/filyal/dashboard',
  admin: '/admin/dashboard',
  avtokuryer: '/avtokuryer/dashboard',
  ijara: '/ijara-panel/dashboard',
  xodim: '/xodim/dashboard',
  omborchi: '/omborchi/dashboard',
  support: '/support/dashboard',
};

const LS_PUSH_DECLINED = 'aresso:panel-push-declined';

function readBoolLs(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    const v = JSON.parse(raw);
    return typeof v === 'boolean' ? v : fallback;
  } catch {
    return fallback;
  }
}

export function isPanelNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function panelNotificationsEnabled(): boolean {
  return readBoolLs('panelNotifications', true) && readBoolLs('notifications', true);
}

export async function requestPanelNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPanelNotificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function showPanelNotification(opts: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  panel?: PanelRole;
}): Promise<void> {
  if (!panelNotificationsEnabled()) return;
  if (!isPanelNotificationsSupported()) return;
  if (Notification.permission !== 'granted') return;

  const title = opts.title.slice(0, 64);
  const body = opts.body.slice(0, 180);
  const tag = opts.tag || `panel-${Date.now()}`;
  const url = opts.url || (opts.panel ? PANEL_DASHBOARD_PATH[opts.panel] : '/');

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        tag,
        icon: opts.panel === 'kuryer' || opts.panel === 'avtokuryer'
          ? '/icons/icon-kuryer.png'
          : opts.panel === 'tayyorlovchi'
            ? '/icons/icon-tayyorlovchi.png'
            : '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url },
        requireInteraction: false,
      });
      return;
    }
  } catch {
    /* fallback */
  }

  try {
    new Notification(title, { body, tag, data: { url } });
  } catch {
    /* ignore */
  }
}

export function playPanelAlertBeep(): void {
  playNotificationSound('message');
}

export function formatAlertLabels(labels: string[], max = 4): string {
  const clean = labels.map((s) => String(s || '').trim()).filter(Boolean);
  if (clean.length === 0) return 'Yangi buyurtma';
  if (clean.length <= max) return clean.join(', ');
  return `${clean.slice(0, max).join(', ')}…`;
}

/** Poll natijasida yangi ID lar — ovoz + bildirishnoma */
export function detectNewIds(
  nextIds: string[],
  prevRef: { current: Set<string> | null },
): string[] {
  const next = new Set(nextIds.filter(Boolean));
  const prev = prevRef.current;
  prevRef.current = next;
  if (prev == null) return [];
  return [...next].filter((id) => !prev.has(id));
}

export type PanelPushScope = {
  panel: PanelRole;
  scopeId: string;
  branchId?: string;
  shopId?: string;
  restaurantId?: string;
  preparerId?: string;
  courierId?: string;
};

export async function subscribePanelWebPush(
  scope: PanelPushScope,
  apiBaseUrl: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  if (!isWebPushSupported()) return { ok: false, error: 'Brauzer push qo‘llamaydi' };
  if (!panelNotificationsEnabled()) return { ok: false, error: 'Bildirishnomalar o‘chirilgan' };

  const perm = await requestPanelNotificationPermission();
  if (perm !== 'granted') return { ok: false, error: 'Ruxsat berilmadi' };

  const vapidRes = await fetch(`${apiBaseUrl}/push/vapid-public-key`, {
    cache: 'no-store',
    headers,
  });
  const vapidJson = await vapidRes.json().catch(() => ({}));
  const publicKey = String(vapidJson?.publicKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
  if (!publicKey) return { ok: false, error: 'Server push sozlanmagan (VAPID)' };

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = sub.toJSON();
    const res = await fetch(`${apiBaseUrl}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        ...scope,
        subscription: json,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { ok: false, error: String(data?.error || 'Obuna saqlanmadi') };
    }
    localStorage.removeItem(LS_PUSH_DECLINED);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Push obuna xatoligi' };
  }
}

export function wasPanelPushDeclined(): boolean {
  try {
    return localStorage.getItem(LS_PUSH_DECLINED) === '1';
  } catch {
    return false;
  }
}

export function markPanelPushDeclined(): void {
  try {
    localStorage.setItem(LS_PUSH_DECLINED, '1');
  } catch {
    /* ignore */
  }
}
