/** SMS OTP — brauzer WebOTP va `autocomplete="one-time-code"` */

export function parseOtpDigits(text: string, length = 6): string {
  const digits = String(text || '').replace(/\D/g, '');
  if (digits.length >= length) return digits.slice(0, length);
  const m = String(text || '').match(new RegExp(`\\b(\\d{${length}})\\b`));
  if (m?.[1]) return m[1];
  return digits.slice(0, length);
}

export function otpDigitsToArray(otp: string, length = 6): string[] {
  const d = parseOtpDigits(otp, length);
  return [...d.split(''), ...Array(length).fill('')].slice(0, length);
}

/** WebOTP (Chrome Android) — SMS oxirida `@host #123456` bo‘lishi kerak */
export async function requestWebSmsOtp(signal?: AbortSignal): Promise<string | null> {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    credentials?: {
      get?: (options: {
        otp: { transport: string[] };
        signal?: AbortSignal;
      }) => Promise<{ code?: string } | null>;
    };
  };
  const getOtp = nav.credentials?.get;
  if (typeof getOtp !== 'function') return null;

  try {
    const cred = await getOtp.call(nav.credentials, {
      otp: { transport: ['sms'] },
      signal,
    });
    const code = parseOtpDigits(String(cred?.code || ''));
    return code.length === 6 ? code : null;
  } catch {
    return null;
  }
}

/** SMS yuborishda serverga host (WebOTP uchun) */
export function smsOtpHostForApi(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname.replace(/^www\./, '');
  if (!host || host === 'localhost' || host === '127.0.0.1') return 'aresso.app';
  return host;
}
