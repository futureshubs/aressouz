import { useEffect, useRef, useState } from 'react';

const DEFAULT_INTERVAL_MS = 2000;
const HIDDEN_INTERVAL_MS = 8000;

/**
 * Chat xabarlarini yangilash — tez polling + tab yashirilganda sekinlashtirish.
 */
export function useChatPoll(
  chatId: string | null | undefined,
  load: (id: string, opts?: { silent?: boolean }) => void | Promise<void>,
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const activeInterval = visible ? intervalMs : Math.max(intervalMs, HIDDEN_INTERVAL_MS);

  useEffect(() => {
    if (!enabled || !chatId) return;
    void loadRef.current(chatId);
    const t = setInterval(() => {
      void loadRef.current(chatId, { silent: true });
    }, activeInterval);
    return () => clearInterval(t);
  }, [chatId, activeInterval, enabled]);
}
