/** Chat polling — UI qayta chizilmasin, faqat o‘zgarganda state yangilanadi */

export type ChatMessageLike = {
  id: string;
  content?: string;
  timestamp?: string;
  status?: string;
  type?: string;
};

function messageFingerprint(m: ChatMessageLike): string {
  return [
    m.id,
    m.timestamp ?? '',
    String(m.content ?? ''),
    m.status ?? '',
    m.type ?? '',
  ].join('|');
}

export function mergeChatMessages<T extends ChatMessageLike>(prev: T[], next: T[]): T[] {
  if (next.length === 0) return prev.length === 0 ? prev : next;
  if (prev.length !== next.length) return next;
  for (let i = 0; i < next.length; i++) {
    if (messageFingerprint(prev[i]) !== messageFingerprint(next[i])) return next;
  }
  return prev;
}

export type ChatSummaryLike = {
  id: string;
  updatedAt?: string;
  unreadCount?: number;
  lastMessage?: { content?: string; timestamp?: string };
};

function chatFingerprint(c: ChatSummaryLike): string {
  const lm = c.lastMessage;
  return [
    c.id,
    c.updatedAt ?? '',
    String(c.unreadCount ?? 0),
    lm?.content ?? '',
    lm?.timestamp ?? '',
  ].join('|');
}

export function mergeChatList<T extends ChatSummaryLike>(prev: T[], next: T[]): T[] {
  if (next.length === 0) return prev.length === 0 ? prev : next;
  if (prev.length !== next.length) return next;
  for (let i = 0; i < next.length; i++) {
    if (chatFingerprint(prev[i]) !== chatFingerprint(next[i])) return next;
  }
  return prev;
}

export function isScrollNearBottom(el: HTMLElement | null, thresholdPx = 96): boolean {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}
