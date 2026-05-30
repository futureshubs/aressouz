/** Chat KV — `index.ts` va `routes/chat-routes.ts` uchun umumiy */

export const CHAT_KEY_PREFIX = "chat:";
export const CHAT_MESSAGE_KEY_PREFIX = "chat_message:";
export const USER_SUPPORT_BRANCH_ID = "aresso_support";

export const normalizeKVValueChat = (v: unknown) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
};

export const sanitizeForChatId = (value: string) =>
  String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");

export const buildChatId = (
  branchId: string,
  participantType: string,
  participantId: string,
) =>
  `chat_${sanitizeForChatId(branchId)}_${sanitizeForChatId(participantType)}_${sanitizeForChatId(participantId)}`;

export const mapMessageStatusToUI = (raw: unknown): string => {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "sent") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "read") return "read";
  if (s === "failed" || s === "error") return "failed";
  return "sent";
};

export function parseCustomerIdFromChatId(chatId: string): string | null {
  const marker = "_customer_";
  const s = String(chatId || "");
  const i = s.lastIndexOf(marker);
  if (i < 0) return null;
  const id = s.slice(i + marker.length).trim();
  return id || null;
}
