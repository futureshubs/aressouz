import { useEffect, useRef } from 'react';
import {
  panelNotificationsEnabled,
  playPanelAlertBeep,
  requestPanelNotificationPermission,
  showPanelNotification,
  type PanelRole,
} from '../utils/panelNotifications';
import { chatMessagePreviewText } from '../utils/chatMessageDisplay';

type Msg = {
  id: string;
  isOwn?: boolean;
  senderName?: string;
  content?: string;
  type?: string;
  imageCaption?: string;
};

/**
 * Yangi mijoz xabari — ovoz + brauzer bildirishnoma (support panel).
 */
export function useChatNotifications(
  messages: Msg[],
  enabled: boolean,
  opts?: {
    panel?: PanelRole;
    chatLabel?: string;
    documentTitle?: string;
  },
) {
  const seenRef = useRef<Set<string> | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    void requestPanelNotificationPermission();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || messages.length === 0) {
      return;
    }

    const ids = new Set(messages.map((m) => m.id).filter(Boolean));
    const prev = seenRef.current;

    if (prev == null) {
      seenRef.current = ids;
      primedRef.current = true;
      return;
    }

    const newcomers = messages.filter((m) => m.id && !prev.has(m.id) && !m.isOwn);
    seenRef.current = ids;

    if (!primedRef.current) {
      primedRef.current = true;
      return;
    }

    if (newcomers.length === 0) return;

    const last = newcomers[newcomers.length - 1];
    const sender = String(last.senderName || 'Mijoz').trim();
    const body = chatMessagePreviewText(
      String(last.content || ''),
      last.type,
      last.imageCaption,
    );

    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      const base = opts?.documentTitle || document.title;
      document.title = `(${newcomers.length}) ${sender} — ${base}`;
    }

    if (!panelNotificationsEnabled()) return;

    playPanelAlertBeep();
    void showPanelNotification({
      title: opts?.chatLabel ? `${sender} · ${opts.chatLabel}` : sender,
      body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
      tag: `support-chat-${last.id}`,
      panel: opts?.panel ?? 'support',
      url: '/support/dashboard',
    });
  }, [messages, enabled, opts?.chatLabel, opts?.documentTitle, opts?.panel]);
}
