import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const DISMISS_KEY = 'app_build_update_dismissed';

/**
 * Production: yangi frontend build chiqganda foydalanuvchini majburiy qayta yuklamaydi —
 * faqat ixtiyoriy "Yangilash" bildirishnomasi. Backend o‘zgarishi API orqali avvaloq yangilanadi.
 */
export function DeployUpdateNotifier() {
  const baselineRef = useRef<string | null>(null);
  const toastForBuildRef = useRef<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    const check = async () => {
      try {
        const res = await fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const buildId = String(data?.buildId ?? '').trim();
        if (!buildId) return;

        if (baselineRef.current == null) {
          baselineRef.current = buildId;
          return;
        }
        if (buildId === baselineRef.current) return;
        if (toastForBuildRef.current === buildId) return;
        if (sessionStorage.getItem(DISMISS_KEY) === buildId) return;

        toastForBuildRef.current = buildId;
        toast.message('Yangi versiya', {
          description: 'Sahifani yangilash ixtiyoriy — hozirgi ish davom etadi.',
          duration: 60_000,
          onDismiss: () => sessionStorage.setItem(DISMISS_KEY, buildId),
          action: {
            label: 'Yangilash',
            onClick: () => window.location.reload(),
          },
        });
      } catch {
        /* tarmoq / fayl yo‘q — e’tiborsiz */
      }
    };

    void check();
    const interval = window.setInterval(check, 8 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return null;
}
