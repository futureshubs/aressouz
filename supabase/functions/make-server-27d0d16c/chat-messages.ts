import * as kv from "./kv_store.tsx";

export const CHAT_MESSAGE_KEY_PREFIX = "chat_message:";

export function extractMessageContent(raw: Record<string, unknown>): string {
  for (const f of [raw.content, raw.text, raw.message, raw.body, raw.caption]) {
    if (f == null) continue;
    if (typeof f === "object") {
      const nested = f as Record<string, unknown>;
      const inner = extractMessageContent(nested);
      if (inner) return inner;
      continue;
    }
    const s = String(f).trim();
    if (s) return s;
  }
  return "";
}

export function isImageUrl(content: string): boolean {
  const c = String(content || "").trim();
  return /^https?:\/\//i.test(c) || c.startsWith("data:image/");
}

export function inferMessageType(
  content: string,
  declared?: string,
): "text" | "image" | "file" | "system" {
  const t = String(declared || "").toLowerCase().trim();
  if (t === "image" || t === "file" || t === "system") {
    return t as "text" | "image" | "file" | "system";
  }
  if (isImageUrl(content)) return "image";
  return "text";
}

export function messageIdFromKvKey(
  key: string,
  raw: Record<string, unknown>,
): string {
  const fromValue = String(raw.id || "").trim();
  if (fromValue) return fromValue;
  const parts = String(key || "").split(":");
  return parts[parts.length - 1] || `msg_${Date.now()}`;
}

/** `chat_{branchId}_customer_{userId}` → branchId */
export function parseBranchIdFromChatId(chatId: string): string {
  const marker = "_customer_";
  const s = String(chatId || "");
  const i = s.indexOf(marker);
  if (i < 0 || !s.startsWith("chat_")) return "";
  return s.slice(5, i);
}

/** `chat.branchId` bo‘sh bo‘lsa ham `chatId` dan filialni aniqlash */
export function resolveChatBranchId(chat: Record<string, unknown>): string {
  const fromField = String(chat.branchId || "").trim();
  if (fromField) return fromField;
  return parseBranchIdFromChatId(String(chat.id || ""));
}

export function chatBelongsToBranch(
  chat: Record<string, unknown>,
  branchId: string,
): boolean {
  const bid = String(branchId || "").trim();
  if (!bid) return false;
  return resolveChatBranchId(chat) === bid;
}

export async function loadMergedBranchChatMessages(
  chatId: string,
  supportBranchId: string,
  buildSupportChatId: (participantId: string) => string,
  parseParticipantId: (chatId: string) => string | null,
  normalize: (v: unknown) => Record<string, unknown> | null,
  mapStatus: (raw: unknown) => string,
  extraParticipantIds: string[] = [],
): Promise<ChatMessageUi[]> {
  const primary = await loadChatMessagesUi(
    chatId,
    { view: "branch" },
    normalize,
    mapStatus,
  );
  const branchFromChat = parseBranchIdFromChatId(chatId);
  const participantId = parseParticipantId(chatId);
  if (!branchFromChat || branchFromChat === supportBranchId) {
    return primary;
  }

  const participantKeys = new Set<string>();
  for (const raw of [participantId, ...extraParticipantIds]) {
    const s = String(raw || "").trim();
    if (s) participantKeys.add(s);
  }

  const byId = new Map<string, ChatMessageUi>();
  for (const m of primary) {
    if (m.id) byId.set(m.id, m);
  }

  for (const key of participantKeys) {
    const supportChatId = buildSupportChatId(key);
    if (supportChatId === chatId) continue;
    const supportMsgs = await loadChatMessagesUi(
      supportChatId,
      { view: "branch" },
      normalize,
      mapStatus,
    );
    for (const m of supportMsgs) {
      if (m.id) byId.set(m.id, m);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function previewTextForMessage(m: {
  type: string;
  content: string;
  imageCaption?: string;
}): string {
  if (m.type === "image") {
    const cap = String(m.imageCaption || "").trim();
    return cap ? `📷 ${cap.slice(0, 80)}` : "📷 Rasm";
  }
  return String(m.content || "").trim() || "—";
}

export type ChatMessageUi = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  imageCaption: string;
  timestamp: string;
  status: string;
  isOwn: boolean;
};

export async function loadChatMessagesUi(
  chatId: string,
  opts: { view: "branch" } | { view: "user"; userId: string },
  normalize: (v: unknown) => Record<string, unknown> | null,
  mapStatus: (raw: unknown) => string,
): Promise<ChatMessageUi[]> {
  const prefix = `${CHAT_MESSAGE_KEY_PREFIX}${chatId}:`;
  const rows = await kv.getByPrefixWithKeys(prefix);
  const parsed: ChatMessageUi[] = [];

  for (const { key, value } of rows) {
    const m = normalize(value);
    if (!m || typeof m !== "object") continue;

    const content = extractMessageContent(m);
    const type = inferMessageType(content, String(m.type || ""));
    const imageCaption = m.imageCaption != null ? String(m.imageCaption) : "";
    const senderId = String(m.senderId || "");
    const timestamp = new Date(String(m.timestamp || Date.now())).toISOString();
    const id = messageIdFromKvKey(key, m);
    const isOwn =
      opts.view === "branch"
        ? senderId === "branch"
        : senderId === opts.userId;

    parsed.push({
      id,
      chatId: String(m.chatId || chatId),
      senderId,
      senderName:
        String(m.senderName || "").trim() ||
        (isOwn
          ? opts.view === "branch"
            ? "Filial"
            : "Siz"
          : opts.view === "branch"
            ? "Mijoz"
            : "Filial"),
      content,
      type,
      imageCaption,
      timestamp,
      status: mapStatus(m.status),
      isOwn,
    });
  }

  parsed.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return parsed;
}

export function lastMessageFromUiMessage(m: ChatMessageUi) {
  return {
    content: previewTextForMessage(m),
    timestamp: m.timestamp,
    senderName: m.senderName,
    isOwn: m.isOwn,
  };
}

export async function refreshChatWithLatestMessage(
  chat: Record<string, unknown>,
  normalize: (v: unknown) => Record<string, unknown> | null,
  mapStatus: (raw: unknown) => string,
  loadMessages?: (
    chatId: string,
  ) => Promise<ChatMessageUi[]>,
): Promise<Record<string, unknown>> {
  const chatId = String(chat.id || "");
  if (!chatId) return chat;

  const msgs = loadMessages
    ? await loadMessages(chatId)
    : await loadChatMessagesUi(chatId, { view: "branch" }, normalize, mapStatus);
  const latest = msgs.length ? msgs[msgs.length - 1] : null;
  if (!latest) return chat;

  const prevTs = new Date(
    String(
      (chat.lastMessage as { timestamp?: string })?.timestamp ||
        chat.updatedAt ||
        chat.createdAt ||
        0,
    ),
  ).getTime();
  const latestTs = new Date(latest.timestamp).getTime();
  if (latestTs >= prevTs) {
    return {
      ...chat,
      lastMessage: lastMessageFromUiMessage(latest),
      updatedAt: latest.timestamp,
    };
  }
  return chat;
}

/** Xabarlar bor, lekin `chat:` yozuvi yo‘q bo‘lsa ham ro‘yxatda chiqishi uchun */
export async function discoverChatIdsForBranch(
  branchId: string,
  sanitize: (s: string) => string,
): Promise<string[]> {
  const bid = sanitize(branchId);
  const prefix = `${CHAT_MESSAGE_KEY_PREFIX}chat_${bid}_`;
  const rows = await kv.getByPrefixWithKeys(prefix);
  const ids = new Set<string>();
  for (const { key } of rows) {
    const rest = key.slice(CHAT_MESSAGE_KEY_PREFIX.length);
    const colon = rest.lastIndexOf(":");
    if (colon > 0) ids.add(rest.slice(0, colon));
  }
  return Array.from(ids);
}
