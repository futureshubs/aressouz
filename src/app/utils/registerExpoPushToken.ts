import { publicAnonKey, API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';

declare global {
  interface Window {
    /** React Native (Expo) WebView tomonidan injeksiya qilinadi */
    __EXPO_PUSH_TOKEN__?: string;
  }
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') return API_BASE_URL;
  return window.location.hostname === 'localhost' ? DEV_API_BASE_URL : API_BASE_URL;
}

/** Android ilovada ochilganda Expo push token serverga bog‘lanadi (filial xabarlari uchun). */
export async function registerExpoPushTokenIfAvailable(accessToken: string): Promise<boolean> {
  const token = typeof window !== 'undefined' ? window.__EXPO_PUSH_TOKEN__?.trim() : '';
  if (!token?.startsWith('ExponentPushToken') || !accessToken) return false;
  try {
    const res = await fetch(`${apiBaseUrl()}/user/push-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        apikey: publicAnonKey,
        'X-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expoPushToken: token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('Expo push-token:', res.status, data);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Expo push-token tarmoq xatosi', e);
    return false;
  }
}
