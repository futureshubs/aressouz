import { useEffect, useState } from 'react';

/** `true` — tab fokusda; yashirin bo‘lsa polling intervalini to‘xtatish uchun. */
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return visible;
}
