import { toast } from 'sonner';

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

let sharedAudioContext: AudioContext | null = null;

/**
 * Qisqa, yumshoq «ding» — iOS bildirishnomaga o‘xshash (Web Audio).
 */
export function playNotificationSound(kind: 'success' | 'message' = 'success'): void {
  if (typeof window === 'undefined') return;
  if (!readBoolLs('soundEnabled', true)) return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!sharedAudioContext) sharedAudioContext = new Ctor();
    const ctx = sharedAudioContext;
    if (ctx.state === 'suspended') void ctx.resume();

    const t0 = ctx.currentTime;
    const duration = kind === 'message' ? 0.26 : 0.2;
    const f1 = kind === 'message' ? 830 : 1000;
    const f2 = kind === 'message' ? 1180 : 1260;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f1, t0);
    osc.frequency.linearRampToValueAtTime(f2, t0 + Math.min(0.055, duration * 0.35));

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    /* brauzer ovozni bloklagan bo‘lishi mumkin */
  }
}

export function notifyCartAdded(quantity: number, options?: { name?: string }): void {
  playNotificationSound('success');
  const title = quantity === 1 ? 'Savatga qo‘shildi' : `+${quantity} ta qo‘shildi`;
  const desc = options?.name?.trim().slice(0, 56);
  toast.success(title, {
    duration: 2200,
    ...(desc ? { description: desc } : {}),
  });
}

export function notifyRentalCartAdded(productName: string): void {
  playNotificationSound('success');
  toast.success('Ijara savatda', {
    description: productName.trim().slice(0, 52),
    duration: 2400,
  });
}

/** Community fon bildirishnomasi — faqat bildirishnomalar yoqilgan bo‘lsa */
export function notifyCommunityBackgroundMessage(senderName: string, preview: string): void {
  if (!readBoolLs('notifications', true)) return;
  playNotificationSound('message');
  const name = senderName.trim().slice(0, 24) || 'A’zo';
  const p = preview.replace(/\s+/g, ' ').trim().slice(0, 64);
  toast.message('Community', {
    description: p ? `${name}: ${p}` : `${name}: yangi xabar`,
    duration: 4200,
  });
}
