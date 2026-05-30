import type { Hono } from "npm:hono";
import * as kv from "../kv_store.tsx";
import * as r2 from "../r2-storage.tsx";
import * as chatMsg from "../chat-messages.ts";
import { validateImageBuffer500x500 } from "../../_shared/imageDimensions.ts";
import {
  CHAT_KEY_PREFIX,
  CHAT_MESSAGE_KEY_PREFIX,
  USER_SUPPORT_BRANCH_ID,
  normalizeKVValueChat,
  sanitizeForChatId,
  buildChatId,
  mapMessageStatusToUI,
  parseCustomerIdFromChatId,
} from "../chat-constants.ts";

export type ChatRouteDeps = {
  validateAccessToken: (
    c: any,
    formData?: FormData,
  ) => Promise<{ success: boolean; userId?: string; error?: string }>;
  notifyUserExpoPush: (
    userId: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ) => Promise<void>;
};

let chatRouteDeps: ChatRouteDeps | null = null;

async function enrichChatWithUserProfile(chat: any): Promise<any> {
  if (!chat || typeof chat !== "object") return chat;
  const pid = String(chat.participantId || "").trim();
  if (!pid) return chat;
  const profile = (await kv.get(`user:${pid}`)) as Record<string, unknown> | null;
  const first = String(profile?.firstName || profile?.first_name || "").trim();
  const last = String(profile?.lastName || profile?.last_name || "").trim();
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  const phone = String(profile?.phone || chat.participantPhone || "").trim();
  return {
    ...chat,
    participantName:
      fullName ||
      String(profile?.name || chat.participantName || "Mijoz").trim() ||
      "Mijoz",
    participantPhone: phone || undefined,
    isSupportChat: String(chat.branchId || "") === USER_SUPPORT_BRANCH_ID,
  };
}

export async function userChatsHandler(c: any) {
  try {
    if (!chatRouteDeps) {
      return c.json({ error: "Chat routes not initialized" }, 500);
    }
    const auth = await chatRouteDeps.validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const userId = String(auth.userId).trim();
    const userProfile = await kv.get(`user:${userId}`);

    const ordersRaw = await kv.getByPrefix("order:");
    const myOrders = (ordersRaw || []).filter(
      (o: any) => o && String(o.userId || "") === userId && !o.deleted,
    );

    const branchIds = Array.from(
      new Set(myOrders.map((o: any) => String(o.branchId || "").trim()).filter(Boolean)),
    ).filter((id) => id !== USER_SUPPORT_BRANCH_ID);

    const chats: any[] = [];
    for (const branchId of branchIds) {
      const chatId = buildChatId(branchId, "customer", userId);
      const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
      const existing = normalizeKVValueChat(await kv.get(chatKey));

      const nowIso = new Date().toISOString();
      const chat =
        existing ||
        ({
          id: chatId,
          branchId,
          participantId: userId,
          participantType: "customer",
          participantName:
            [userProfile?.firstName, userProfile?.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            String(userProfile?.name || userProfile?.firstName || "Mijoz"),
          lastMessage: {
            content: "Suhbat boshlandi",
            timestamp: nowIso,
            senderName: "Tizim",
            isOwn: false,
          },
          unreadCount: 0,
          isOnline: false,
          isTyping: false,
          isArchived: false,
          isStarred: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        } as any);

      if (!existing) {
        await kv.set(chatKey, chat);
      }

      chats.push(chat);
    }

    const supportChatId = buildChatId(USER_SUPPORT_BRANCH_ID, "customer", userId);
    const supportKey = `${CHAT_KEY_PREFIX}${supportChatId}`;
    const supportExisting = normalizeKVValueChat(await kv.get(supportKey));
    const nowIsoSupport = new Date().toISOString();
    const displayName =
      [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(" ").trim() ||
      String(userProfile?.name || userProfile?.firstName || "Mijoz");
    let supportChat =
      supportExisting ||
      ({
        id: supportChatId,
        branchId: USER_SUPPORT_BRANCH_ID,
        participantId: userId,
        participantType: "customer",
        participantName: displayName,
        lastMessage: {
          content: "Savolingizni yozing — operator tez orada javob beradi.",
          timestamp: nowIsoSupport,
          senderName: "Aresso support",
          isOwn: false,
        },
        unreadCount: 0,
        isOnline: false,
        isTyping: false,
        isArchived: false,
        isStarred: false,
        createdAt: nowIsoSupport,
        updatedAt: nowIsoSupport,
      } as any);

    if (
      supportExisting &&
      String(supportChat.branchId || "") !== USER_SUPPORT_BRANCH_ID
    ) {
      supportChat = { ...supportChat, branchId: USER_SUPPORT_BRANCH_ID };
      await kv.set(supportKey, supportChat);
    } else if (!supportExisting) {
      await kv.set(supportKey, supportChat);
    }

    chats.sort(
      (a: any, b: any) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );
    const ordered = [supportChat, ...chats.filter((c: any) => String(c?.id || "") !== supportChatId)];
    return c.json({ success: true, chats: ordered });
  } catch (error: any) {
    console.error("User chats list error:", error);
    return c.json({ error: "Suhbatlarni olishda xatolik" }, 500);
  }
}

const assertUserOwnsChat = (chatId: string, userId: string) => {
  const safeUser = sanitizeForChatId(userId);
  return String(chatId || "").endsWith(`_${safeUser}`);
};

export function registerChatRoutes(app: Hono, deps: ChatRouteDeps): void {
  chatRouteDeps = deps;

  const branchChatsListHandler = async (c: any) => {
    try {
      const branchId = String(c.req.query("branchId") || "").trim();
      const searchTerm = String(c.req.query("search") || "").trim().toLowerCase();
      const filter = String(c.req.query("filter") || "all").trim(); // all, unread, starred, archived

      if (!branchId) return c.json({ error: "branchId kerak" }, 400);

      // 1) KV'dagi real chats
      let chatsRaw: any[] = (await kv.getByPrefix(CHAT_KEY_PREFIX))
        .map(normalizeKVValueChat)
        .filter(Boolean)
        .filter((chat: any) => chatMsg.chatBelongsToBranch(chat, branchId));

      // Eski yozuvlar: branchId bo'sh, lekin chatId to'g'ri — KV ni tuzatish
      for (const chat of chatsRaw) {
        const id = String(chat.id || "");
        const resolved = chatMsg.resolveChatBranchId(chat);
        if (!id || !resolved || String(chat.branchId || "") === resolved) continue;
        const fixed = { ...chat, branchId: resolved };
        await kv.set(`${CHAT_KEY_PREFIX}${id}`, fixed);
        Object.assign(chat, fixed);
      }

      // 2) Agar real chats bo'lmasa: branchdagi orderlardan customer chatlarini "bootstrap" qilamiz va KV'ga saqlaymiz.
      if (chatsRaw.length === 0) {
        const ordersRaw = await kv.getByPrefix("order:");
        const orderItems = (ordersRaw || []).map(normalizeKVValueChat).filter(Boolean);
        const branchOrders = orderItems.filter((o: any) => String(o.branchId || "") === branchId);

        const chatMap = new Map<string, any>();

        for (const o of branchOrders) {
          const participantType = "customer";
          const participantId = String(o.userId || o.customerId || "");
          if (!participantId) continue;

          const chatId = buildChatId(branchId, participantType, participantId);
          if (chatMap.has(chatId)) continue;

          const statusHistory = Array.isArray(o.statusHistory) ? o.statusHistory : [];
          const lastHist = statusHistory.length ? statusHistory[statusHistory.length - 1] : null;
          const lastContent =
            String(lastHist?.note || lastHist?.status || o.status || "Buyurtma bo'limi") ||
            "Buyurtma bo'limi";
          const ts = o.updatedAt || o.createdAt || new Date().toISOString();

          chatMap.set(chatId, {
            id: chatId,
            branchId,
            participantId,
            participantType,
            participantName: String(o.customerName || "Mijoz"),
            lastMessage: {
              content: lastContent,
              timestamp: new Date(ts).toISOString(),
              senderName: "Filial",
              isOwn: true,
            },
            unreadCount: 0,
            isOnline: false,
            isTyping: false,
            isArchived: false,
            isStarred: false,
            createdAt: String(o.createdAt || ts),
            updatedAt: String(ts),
          });
        }

        chatsRaw = Array.from(chatMap.values());
        // Persist so' star/archive qilsa ham ishlaydi
        for (const chat of chatsRaw) {
          await kv.set(`${CHAT_KEY_PREFIX}${chat.id}`, chat);
        }
      }

      const knownIds = new Set(chatsRaw.map((ch: any) => String(ch.id || "")));
      const discoveredIds = await chatMsg.discoverChatIdsForBranch(branchId, sanitizeForChatId);
      for (const chatId of discoveredIds) {
        if (!chatId || knownIds.has(chatId)) continue;
        const existing = normalizeKVValueChat(await kv.get(`${CHAT_KEY_PREFIX}${chatId}`));
        const participantId = parseCustomerIdFromChatId(chatId) || "";
        const nowIso = new Date().toISOString();
        chatsRaw.push(
          existing || {
            id: chatId,
            branchId,
            participantId,
            participantType: "customer",
            participantName: "Mijoz",
            lastMessage: {
              content: "Yangi xabar",
              timestamp: nowIso,
              senderName: "Mijoz",
              isOwn: false,
            },
            unreadCount: 1,
            isOnline: false,
            isTyping: false,
            isArchived: false,
            isStarred: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        );
        knownIds.add(chatId);
      }

      const loadMsgsForPreview = async (id: string) => {
        const ch = chatsRaw.find((c: any) => String(c.id || "") === id) || {};
        const extra: string[] = [];
        const pid = String(ch.participantId || parseCustomerIdFromChatId(id) || "").trim();
        if (pid) extra.push(pid);
        const phone = String(ch.participantPhone || "").trim();
        if (phone) extra.push(phone);
        if (pid && !phone) {
          const profile = (await kv.get(`user:${pid}`)) as Record<string, unknown> | null;
          const pp = String(profile?.phone || "").trim();
          if (pp) extra.push(pp);
        }
        return chatMsg.loadMergedBranchChatMessages(
          id,
          USER_SUPPORT_BRANCH_ID,
          (participantId) => buildChatId(USER_SUPPORT_BRANCH_ID, "customer", participantId),
          parseCustomerIdFromChatId,
          normalizeKVValueChat,
          mapMessageStatusToUI,
          extra,
        );
      };

      chatsRaw = await Promise.all(
        chatsRaw.map((ch: any) =>
          chatMsg.refreshChatWithLatestMessage(
            ch,
            normalizeKVValueChat,
            mapMessageStatusToUI,
            loadMsgsForPreview,
          ),
        ),
      );

      // filter/search
      let resultChats = chatsRaw;
      if (searchTerm) {
        resultChats = resultChats.filter((ch: any) => {
          const haystack = `${ch.participantName || ""} ${ch.lastMessage?.content || ""}`.toLowerCase();
          return haystack.includes(searchTerm);
        });
      }

      if (filter === "unread") resultChats = resultChats.filter((ch: any) => Number(ch.unreadCount || 0) > 0);
      if (filter === "starred") resultChats = resultChats.filter((ch: any) => Boolean(ch.isStarred));
      if (filter === "archived") resultChats = resultChats.filter((ch: any) => Boolean(ch.isArchived));

      resultChats.sort(
        (a: any, b: any) =>
          new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
      );
      const enriched = await Promise.all(resultChats.map((ch: any) => enrichChatWithUserProfile(ch)));
      return c.json({ success: true, chats: enriched });
    } catch (error: any) {
      console.error("Chats list error:", error);
      return c.json({ error: "Suhbatlarni olishda xatolik" }, 500);
    }
  };

  const userChatMessagesListHandler = async (c: any) => {
    try {
      const auth = await deps.validateAccessToken(c);
      if (!auth.success || !auth.userId) {
        return c.json({ error: auth.error }, 401);
      }

      const chatId = c.req.param("chatId");
      if (!chatId) return c.json({ error: "chatId kerak" }, 400);
      if (!assertUserOwnsChat(chatId, String(auth.userId))) {
        return c.json({ error: "Ruxsat yo'q" }, 403);
      }

      const uiMessages = await chatMsg.loadChatMessagesUi(
        chatId,
        { view: "user", userId: String(auth.userId) },
        normalizeKVValueChat,
        mapMessageStatusToUI,
      );

      return c.json({ success: true, messages: uiMessages });
    } catch (error: any) {
      console.error("User chat messages list error:", error);
      return c.json({ error: "Xabarlarni olishda xatolik" }, 500);
    }
  };

  const userChatUploadMediaHandler = async (c: any) => {
    try {
      const auth = await deps.validateAccessToken(c);
      if (!auth.success || !auth.userId) {
        return c.json({ error: auth.error }, 401);
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File;
      if (!file || !(file instanceof File)) {
        return c.json({ error: "Fayl topilmadi" }, 400);
      }
      if (!file.type.startsWith("image/")) {
        return c.json({ error: "Faqat rasm fayli yuklash mumkin" }, 400);
      }
      if (file.size > 8 * 1024 * 1024) {
        return c.json({ error: "Rasm hajmi 8MB dan oshmasligi kerak" }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const dimErr = validateImageBuffer500x500(buffer, file.type);
      if (dimErr) return c.json({ error: dimErr, message: dimErr }, 400);

      const ext = file.name.split(".").pop() || "jpg";
      const filename = `support_chat/${auth.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const r2Config = r2.checkR2Config();
      if (!r2Config.configured) {
        return c.json({ error: r2Config.message }, 500);
      }

      const uploadResult = await r2.uploadFile(buffer, filename, file.type);
      if (!uploadResult.success) {
        return c.json({ error: uploadResult.error || "Yuklashda xatolik" }, 500);
      }

      return c.json({
        success: true,
        url: uploadResult.url,
        contentType: file.type,
      });
    } catch (error: any) {
      console.error("User chat upload-media error:", error);
      return c.json({ error: error.message || "Yuklashda xatolik" }, 500);
    }
  };

  const userChatSendHandler = async (c: any) => {
    try {
      const auth = await deps.validateAccessToken(c);
      if (!auth.success || !auth.userId) {
        return c.json({ error: auth.error }, 401);
      }

      const chatId = c.req.param("chatId");
      if (!chatId) return c.json({ error: "chatId kerak" }, 400);
      if (!assertUserOwnsChat(chatId, String(auth.userId))) {
        return c.json({ error: "Ruxsat yo'q" }, 403);
      }

      const body = await c.req.json().catch(() => ({}));
      const type = String(body?.type || "text").trim() || "text";
      const captionRaw = body?.caption != null ? String(body.caption).trim().slice(0, 500) : "";

      let content = String(body?.content || "").trim();
      let imageCaption = "";

      if (type === "image") {
        if (!/^https?:\/\//i.test(content)) {
          return c.json({ error: "Rasm uchun to'liq https havola kerak" }, 400);
        }
        imageCaption = captionRaw;
      } else {
        if (!content) return c.json({ error: "content kerak" }, 400);
      }

      const userId = String(auth.userId);
      const userProfile = await kv.get(`user:${userId}`);
      const senderName = String(userProfile?.name || userProfile?.firstName || "Mijoz");

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nowIso = new Date().toISOString();

      const message: Record<string, unknown> = {
        id: messageId,
        chatId,
        senderId: userId,
        senderName,
        content,
        type,
        timestamp: nowIso,
        status: "sent",
        isOwn: true,
      };
      if (type === "image" && imageCaption) {
        message.imageCaption = imageCaption;
      }

      await kv.set(`${CHAT_MESSAGE_KEY_PREFIX}${chatId}:${messageId}`, message);

      const lastPreview =
        type === "image" ? (imageCaption ? `📷 ${imageCaption.slice(0, 80)}` : "📷 Rasm") : content;

      // Update chat lastMessage
      const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
      const existing = normalizeKVValueChat(await kv.get(chatKey));
      const updatedAt = nowIso;
      const resolvedBranchId = chatMsg.parseBranchIdFromChatId(chatId) || USER_SUPPORT_BRANCH_ID;
      const updated = existing
        ? {
            ...existing,
            branchId: String(existing.branchId || "").trim() || resolvedBranchId,
            updatedAt,
            unreadCount: Number(existing.unreadCount || 0) + 1,
            lastMessage: {
              content: lastPreview,
              timestamp: nowIso,
              senderName,
              isOwn: false,
            },
          }
        : {
            id: chatId,
            branchId: chatMsg.parseBranchIdFromChatId(chatId) || USER_SUPPORT_BRANCH_ID,
            participantId: userId,
            participantType: "customer",
            participantName: senderName,
            lastMessage: {
              content: lastPreview,
              timestamp: nowIso,
              senderName,
              isOwn: false,
            },
            unreadCount: 1,
            isOnline: false,
            isTyping: false,
            isArchived: false,
            isStarred: false,
            createdAt: updatedAt,
            updatedAt,
          };

      await kv.set(chatKey, updated);

      return c.json({ success: true, message });
    } catch (error: any) {
      console.error("User send chat message error:", error);
      return c.json({ error: "Xabarni yuborishda xatolik" }, 500);
    }
  };

  const userPushTokenHandler = async (c: any) => {
    try {
      const auth = await deps.validateAccessToken(c);
      if (!auth.success || !auth.userId) {
        return c.json({ error: auth.error }, 401);
      }
      const body = await c.req.json().catch(() => ({}));
      const token = String(body.expoPushToken || body.token || "").trim();
      if (!token.startsWith("ExponentPushToken")) {
        return c.json({ error: "ExponentPushToken kerak" }, 400);
      }
      const userId = String(auth.userId).trim();
      const key = `expo_push_tokens:${userId}`;
      const raw = await kv.get(key);
      const prev: string[] = Array.isArray(raw)
        ? raw.filter((x: any) => typeof x === "string" && x.startsWith("ExponentPushToken"))
        : [];
      if (!prev.includes(token)) prev.push(token);
      const next = prev.slice(-25);
      await kv.set(key, next);
      return c.json({ success: true });
    } catch (e: any) {
      console.error("user push-token error", e);
      return c.json({ error: "Push token saqlanmadi" }, 500);
    }
  };

  const branchChatMessagesListHandler = async (c: any) => {
    try {
      const chatId = c.req.param("chatId");
      if (!chatId) return c.json({ error: "chatId kerak" }, 400);

      const chatMeta = normalizeKVValueChat(await kv.get(`${CHAT_KEY_PREFIX}${chatId}`));
      const extraParticipantIds: string[] = [];
      const pid = String(chatMeta?.participantId || parseCustomerIdFromChatId(chatId) || "").trim();
      if (pid) extraParticipantIds.push(pid);
      const phone = String(chatMeta?.participantPhone || "").trim();
      if (phone) extraParticipantIds.push(phone);
      if (pid && !phone) {
        const profile = (await kv.get(`user:${pid}`)) as Record<string, unknown> | null;
        const profilePhone = String(profile?.phone || "").trim();
        if (profilePhone) extraParticipantIds.push(profilePhone);
      }

      const uiMessages = await chatMsg.loadMergedBranchChatMessages(
        chatId,
        USER_SUPPORT_BRANCH_ID,
        (participantId) => buildChatId(USER_SUPPORT_BRANCH_ID, "customer", participantId),
        parseCustomerIdFromChatId,
        normalizeKVValueChat,
        mapMessageStatusToUI,
        extraParticipantIds,
      );

      return c.json({ success: true, messages: uiMessages });
    } catch (error: any) {
      console.error("Chat messages list error:", error);
      return c.json({ error: "Xabarlarni olishda xatolik" }, 500);
    }
  };

  const branchChatReadHandler = async (c: any) => {
    try {
      const chatId = c.req.param("chatId");
      if (!chatId) return c.json({ error: "chatId kerak" }, 400);

      const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
      const existing = normalizeKVValueChat(await kv.get(chatKey));
      if (!existing) {
        return c.json({ success: true });
      }

      await kv.set(chatKey, {
        ...existing,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      });

      return c.json({ success: true });
    } catch (error: any) {
      console.error("Chat mark read error:", error);
      return c.json({ error: "O'qilgan deb belgilashda xatolik" }, 500);
    }
  };

  const branchChatSendHandler = async (c: any) => {
    try {
      const chatId = c.req.param("chatId");
      if (!chatId) return c.json({ error: "chatId kerak" }, 400);

      const body = await c.req.json().catch(() => ({}));
      const content = String(body?.content || "").trim();
      const type = String(body?.type || "text").trim() || "text";
      if (!content) return c.json({ error: "content kerak" }, 400);

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nowIso = new Date().toISOString();
      const chatMeta = normalizeKVValueChat(await kv.get(`${CHAT_KEY_PREFIX}${chatId}`));
      const branchLabel =
        String(body?.senderName || "").trim() ||
        (String(chatMeta?.branchId || "") === USER_SUPPORT_BRANCH_ID ? "Aresso support" : "Filial");

      const message = {
        id: messageId,
        chatId,
        senderId: "branch",
        senderName: branchLabel,
        content,
        type,
        timestamp: nowIso,
        status: "sent",
        isOwn: true,
      };

      await kv.set(`${CHAT_MESSAGE_KEY_PREFIX}${chatId}:${messageId}`, message);

      // Update chat lastMessage
      const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
      const existing = normalizeKVValueChat(await kv.get(chatKey));
      const updatedAt = nowIso;
      const updated = existing
        ? {
            ...existing,
            updatedAt,
            lastMessage: {
              content: message.content,
              timestamp: message.timestamp,
              senderName: message.senderName,
              isOwn: message.isOwn,
            },
          }
        : {
            id: chatId,
            branchId:
              chatMsg.parseBranchIdFromChatId(chatId) ||
              String(chatMeta?.branchId || "").trim() ||
              USER_SUPPORT_BRANCH_ID,
            participantId:
              String(chatMeta?.participantId || "").trim() ||
              parseCustomerIdFromChatId(chatId) ||
              "",
            participantType: "customer",
            participantName: String(chatMeta?.participantName || "Mijoz"),
            lastMessage: {
              content: message.content,
              timestamp: message.timestamp,
              senderName: message.senderName,
              isOwn: message.isOwn,
            },
            unreadCount: 0,
            isOnline: false,
            isTyping: false,
            isArchived: false,
            isStarred: false,
            createdAt: updatedAt,
            updatedAt,
          };

      await kv.set(chatKey, updated);

      const recipientUserId =
        String(updated.participantId || "").trim() || parseCustomerIdFromChatId(chatId) || "";
      if (recipientUserId) {
        void deps.notifyUserExpoPush(
          recipientUserId,
          branchLabel,
          content.length > 160 ? `${content.slice(0, 157)}...` : content,
          { chatId: String(chatId), type: "branch_chat" },
        );
      }

      return c.json({ success: true, message: { ...message, isOwn: true } });
    } catch (error: any) {
      console.error("Send chat message error:", error);
      return c.json({ error: "Xabarni yuborishda xatolik" }, 500);
    }
  };

  const branchChatStarHandler = async (c: any) => {
    try {
      const chatId = c.req.param("chatId");
      if (!chatId) return c.json({ error: "chatId kerak" }, 400);

      const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
      const existing = normalizeKVValueChat(await kv.get(chatKey));
      if (!existing) return c.json({ error: "Suhbat topilmadi" }, 404);

      const updated = {
        ...existing,
        isStarred: !Boolean(existing.isStarred),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(chatKey, updated);

      return c.json({ success: true, chat: updated });
    } catch (error: any) {
      console.error("Star chat error:", error);
      return c.json({ error: "Suhbatni yulduzlashda xatolik" }, 500);
    }
  };

  const branchChatArchiveHandler = async (c: any) => {
    try {
      const chatId = c.req.param("chatId");
      if (!chatId) return c.json({ error: "chatId kerak" }, 400);

      const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
      const existing = normalizeKVValueChat(await kv.get(chatKey));
      if (!existing) return c.json({ error: "Suhbat topilmadi" }, 404);

      const updated = {
        ...existing,
        isArchived: !Boolean(existing.isArchived),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(chatKey, updated);

      return c.json({ success: true, chat: updated });
    } catch (error: any) {
      console.error("Archive chat error:", error);
      return c.json({ error: "Suhbatni arxivlashda xatolik" }, 500);
    }
  };

  // Branch chat list (prefixed path only)
  app.get("/make-server-27d0d16c/chats", branchChatsListHandler);

  // User chats
  app.get("/make-server-27d0d16c/user/chats", userChatsHandler);
  app.get("/user/chats", userChatsHandler);

  // User messages
  app.get("/make-server-27d0d16c/user/chats/:chatId/messages", userChatMessagesListHandler);
  app.get("/user/chats/:chatId/messages", userChatMessagesListHandler);

  // User upload media
  app.post("/make-server-27d0d16c/user/chats/upload-media", userChatUploadMediaHandler);
  app.post("/user/chats/upload-media", userChatUploadMediaHandler);

  // User send message
  app.post("/make-server-27d0d16c/user/chats/:chatId/messages", userChatSendHandler);
  app.post("/user/chats/:chatId/messages", userChatSendHandler);

  // User push token
  app.post("/make-server-27d0d16c/user/push-token", userPushTokenHandler);
  app.post("/user/push-token", userPushTokenHandler);

  // Branch messages (merged)
  app.get("/make-server-27d0d16c/chats/:chatId/messages", branchChatMessagesListHandler);

  // Branch read / send / star / archive
  app.put("/make-server-27d0d16c/chats/:chatId/read", branchChatReadHandler);
  app.post("/make-server-27d0d16c/chats/:chatId/messages", branchChatSendHandler);
  app.put("/make-server-27d0d16c/chats/:chatId/star", branchChatStarHandler);
  app.put("/make-server-27d0d16c/chats/:chatId/archive", branchChatArchiveHandler);
}
