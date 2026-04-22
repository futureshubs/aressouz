/**
 * Telegram Notification Service
 * Sends notifications via TWO separate bots:
 * 1. TELEGRAM_BOT_TOKEN - Do'kon (Marketplace) uchun
 * 2. TELEGRAM_RESTAURANT_BOT_TOKEN - Taomlar (Restoran) uchun
 */

const TELEGRAM_SHOP_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_RESTAURANT_BOT_TOKEN = Deno.env.get('TELEGRAM_RESTAURANT_BOT_TOKEN');

/** New (2026): broadcast channels for couriers & preparers */
const TELEGRAM_COURIER_BOT_TOKEN = Deno.env.get('TELEGRAM_COURIER_BOT_TOKEN');
const TELEGRAM_PREPARER_BOT_TOKEN = Deno.env.get('TELEGRAM_PREPARER_BOT_TOKEN');
const TELEGRAM_COURIER_CHANNEL = Deno.env.get('TELEGRAM_COURIER_CHANNEL'); // e.g. "@Aressobuyutma"
// Backward-compat: PREPAPER misspelling in some dashboards.
const TELEGRAM_PREPARER_CHANNEL =
  Deno.env.get('TELEGRAM_PREPARER_CHANNEL') ||
  Deno.env.get('TELEGRAM_PREPAPER_CHANNEL'); // e.g. "@Aressotayyorlovchi"

type NotificationType = 'shop' | 'restaurant';

/** HTML parse_mode uchun — < > & bo‘lsa Telegram 400 qaytaradi (test oddiy matn bilan o‘tadi). */
export function escapeTelegramHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Raqamli chat / supergroup yoki @username */
export function isValidTelegramTarget(chatId: string): boolean {
  const s = String(chatId || '').trim();
  if (!s) return false;
  if (/^-?\d+$/.test(s)) return true;
  if (/^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(s)) return true;
  return false;
}

/**
 * Secrets'da target ba'zan `https://t.me/<name>` ko‘rinishida turadi.
 * Telegram API esa `@<name>` yoki raqamli chat_id kutadi.
 */
export function normalizeTelegramTarget(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  // accept full URLs like https://t.me/ChannelName or t.me/ChannelName
  s = s.replace(/^https?:\/\/t\.me\//i, "@");
  s = s.replace(/^t\.me\//i, "@");
  // accept joinchat links are not usable as chat_id; keep as-is (will fail validation)
  // remove trailing slashes/spaces
  s = s.replace(/\/+$/, "").trim();
  return s;
}

interface OrderNotification {
  shopName: string;
  shopChatId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: {
    name: string;
    variantName: string;
    quantity: number;
    price: number;
    additionalProducts?: {
      name: string;
      price: number;
      quantity?: number;
    }[];
  }[];
  totalAmount: number;
  deliveryMethod: string;
  paymentMethod: string;
  orderDate: string;
  type?: NotificationType; // 'shop' yoki 'restaurant'
}

/**
 * Send order notification to shop owner
 */
export async function sendOrderNotification(notification: OrderNotification): Promise<boolean> {
  const botToken = notification.type === 'restaurant' ? TELEGRAM_RESTAURANT_BOT_TOKEN : TELEGRAM_SHOP_BOT_TOKEN;

  if (!botToken) {
    console.error(
      notification.type === 'restaurant'
        ? '❌ TELEGRAM_RESTAURANT_BOT_TOKEN sozlanmagan'
        : '❌ TELEGRAM_BOT_TOKEN sozlanmagan'
    );
    return false;
  }

  if (!notification.shopChatId) {
    console.log('⚠️ No Telegram chat ID configured for shop:', notification.shopName);
    return false;
  }

  if (!isValidTelegramTarget(notification.shopChatId)) {
    console.error('❌ Invalid Telegram chat ID format:', notification.shopChatId);
    return false;
  }

  try {
    // Format order items
    const itemsList = notification.items
      .map((item, index) => {
        const addons = Array.isArray(item.additionalProducts) ? item.additionalProducts : [];
        const addonsText = addons.length
          ? `\n   Qo'shimchalar:\n${addons
              .map((addon) => {
                const addonQty = Number(addon?.quantity || 1);
                const addonPrice = Number(addon?.price || 0);
                const an = escapeTelegramHtml(String(addon?.name || "Qo'shimcha"));
                return `   - ${an} × ${addonQty} (${addonPrice.toLocaleString()} so'm)`;
              })
              .join('\n')}`
          : '';

        const nm = escapeTelegramHtml(String(item.name || ''));
        const vn = escapeTelegramHtml(String(item.variantName || ''));

        return `${index + 1}. ${nm} (${vn})\n   ${item.quantity} ta × ${item.price.toLocaleString()} so'm = ${(item.quantity * item.price).toLocaleString()} so'm${addonsText}`;
      })
      .join('\n\n');

    const shopNameEsc = escapeTelegramHtml(String(notification.shopName || ''));
    const orderNumEsc = escapeTelegramHtml(String(notification.orderNumber || ''));
    const orderDateEsc = escapeTelegramHtml(String(notification.orderDate || ''));
    const custNameEsc = escapeTelegramHtml(String(notification.customerName || ''));
    const custPhoneEsc = escapeTelegramHtml(String(notification.customerPhone || ''));
    const custAddrEsc = escapeTelegramHtml(String(notification.customerAddress || ''));
    const deliveryEsc = escapeTelegramHtml(String(notification.deliveryMethod || ''));
    const paymentEsc = escapeTelegramHtml(String(notification.paymentMethod || ''));

    // Create message
    const message = `
🎉 <b>YANGI BUYURTMA!</b>

📍 <b>Do'kon:</b> ${shopNameEsc}
🔢 <b>Buyurtma raqami:</b> #${orderNumEsc}
📅 <b>Sana:</b> ${orderDateEsc}

━━━━━━━━━━━━━━━━━━

👤 <b>MIJOZ MA'LUMOTLARI:</b>

👨‍💼 <b>Ismi:</b> ${custNameEsc}
📞 <b>Telefon:</b> ${custPhoneEsc}
📍 <b>Manzil:</b> ${custAddrEsc}

━━━━━━━━━━━━━━━━━━

🛍️ <b>MAHSULOTLAR:</b>

${itemsList}

━━━━━━━━━━━━━━━━━━

💰 <b>JAMI SUMMA:</b> ${notification.totalAmount.toLocaleString()} so'm

🚚 <b>Yetkazib berish:</b> ${deliveryEsc}
💳 <b>To'lov usuli:</b> ${paymentEsc}

━━━━━━━━━━━━━━━━━━

⚡ <b>DIQQAT!</b>
Bu buyurtmani tasdiqlash yoki bekor qilish uchun /seller platformasiga kiring va buyurtmalar bo'limiga o'ting.

✅ Tasdiqlash - Buyurtmani qabul qilish
❌ Bekor qilish - Buyurtmani rad etish
`.trim();

    // Send message via Telegram API
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: notification.shopChatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram API error:', error);
      return false;
    }

    console.log(`✅ Order notification sent to shop ${notification.shopName} (Chat ID: ${notification.shopChatId})`);
    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

export async function sendOrderBroadcastToChannel(p: {
  audience: 'courier' | 'preparer';
  orderType: 'market' | 'shop' | 'food' | 'rental' | 'other';
  orderNumber: string;
  merchantName?: string;
  customerAddress?: string;
  totalAmount?: number;
  paymentMethod?: string;
  pickupHint?: string;
}): Promise<boolean> {
  const audience = p.audience;
  const botToken =
    audience === 'courier'
      ? (TELEGRAM_COURIER_BOT_TOKEN || TELEGRAM_SHOP_BOT_TOKEN)
      : (TELEGRAM_PREPARER_BOT_TOKEN || TELEGRAM_RESTAURANT_BOT_TOKEN);
  const chatId = normalizeTelegramTarget(
    audience === 'courier'
      ? String(TELEGRAM_COURIER_CHANNEL || '')
      : String(TELEGRAM_PREPARER_CHANNEL || ''),
  );

  if (!botToken) {
    console.error(`❌ TELEGRAM_${audience.toUpperCase()}_BOT_TOKEN sozlanmagan`);
    return false;
  }
  if (!chatId || !isValidTelegramTarget(chatId)) {
    console.error(`❌ TELEGRAM_${audience.toUpperCase()}_CHANNEL noto‘g‘ri yoki bo‘sh`, chatId);
    return false;
  }

  const typeUz =
    p.orderType === 'market' ? 'Market' :
    p.orderType === 'shop' ? "Do'kon" :
    p.orderType === 'food' ? 'Taom' :
    p.orderType === 'rental' ? 'Ijara' : 'Buyurtma';

  const orderNumEsc = escapeTelegramHtml(String(p.orderNumber || ''));
  const merchantEsc = escapeTelegramHtml(String(p.merchantName || '').trim());
  const addrEsc = escapeTelegramHtml(String(p.customerAddress || '').trim());
  const payEsc = escapeTelegramHtml(String(p.paymentMethod || '').trim());
  const pickupEsc = escapeTelegramHtml(String(p.pickupHint || '').trim());
  const total = Number(p.totalAmount || 0) || 0;

  const lines: string[] = [];
  lines.push(`📦 <b>${typeUz} · Yangi</b>`);
  lines.push(`🔢 <b>Buyurtma:</b> #${orderNumEsc}`);
  if (merchantEsc) lines.push(`🏪 <b>Manba:</b> ${merchantEsc}`);
  if (pickupEsc) lines.push(`📍 <b>Olib ketish:</b> ${pickupEsc}`);
  if (addrEsc) lines.push(`🏠 <b>Yetkazish:</b> ${addrEsc}`);
  if (total) lines.push(`💰 <b>Jami:</b> ${total.toLocaleString('uz-UZ')} so'm`);
  if (payEsc) lines.push(`💳 <b>To'lov:</b> ${payEsc}`);

  const message = lines.join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Telegram channel sendMessage error:', err);
      return false;
    }
    console.log(`✅ Telegram channel broadcast sent (${audience}) -> ${chatId}`);
    return true;
  } catch (e) {
    console.error('Telegram channel broadcast exception:', e);
    return false;
  }
}

export async function sendOrderBroadcastToChannelDebug(p: {
  audience: 'courier' | 'preparer';
  orderType: 'market' | 'shop' | 'food' | 'rental' | 'other';
  orderNumber: string;
  merchantName?: string;
  customerAddress?: string;
  totalAmount?: number;
  paymentMethod?: string;
  pickupHint?: string;
}): Promise<{ ok: boolean; audience: 'courier' | 'preparer'; chatId: string; status?: number; error?: unknown }> {
  const audience = p.audience;
  const botToken =
    audience === 'courier'
      ? (TELEGRAM_COURIER_BOT_TOKEN || TELEGRAM_SHOP_BOT_TOKEN)
      : (TELEGRAM_PREPARER_BOT_TOKEN || TELEGRAM_RESTAURANT_BOT_TOKEN);
  const chatId = normalizeTelegramTarget(
    audience === 'courier'
      ? String(TELEGRAM_COURIER_CHANNEL || '')
      : String(TELEGRAM_PREPARER_CHANNEL || ''),
  );

  if (!botToken) {
    return { ok: false, audience, chatId, error: `TELEGRAM_${audience.toUpperCase()}_BOT_TOKEN missing` };
  }
  if (!chatId || !isValidTelegramTarget(chatId)) {
    return { ok: false, audience, chatId, error: `TELEGRAM_${audience.toUpperCase()}_CHANNEL invalid` };
  }

  const typeUz =
    p.orderType === 'market' ? 'Market' :
    p.orderType === 'shop' ? "Do'kon" :
    p.orderType === 'food' ? 'Taom' :
    p.orderType === 'rental' ? 'Ijara' : 'Buyurtma';

  const lines: string[] = [];
  lines.push(`🧪 <b>DEBUG</b>`);
  lines.push(`📦 <b>${typeUz} · Test</b>`);
  lines.push(`🔢 <b>Buyurtma:</b> #${escapeTelegramHtml(String(p.orderNumber || ''))}`);
  if (p.pickupHint) lines.push(`📍 <b>Izoh:</b> ${escapeTelegramHtml(String(p.pickupHint))}`);
  const message = lines.join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, audience, chatId, status: response.status, error: payload };
    }
    return { ok: true, audience, chatId, status: response.status };
  } catch (e) {
    return { ok: false, audience, chatId, error: String(e) };
  }
}

export async function debugTelegramAudienceMembership(audience: 'courier' | 'preparer'): Promise<{
  ok: boolean;
  audience: 'courier' | 'preparer';
  chatId: string;
  bot?: { id?: number; username?: string };
  member?: unknown;
  sendTest?: { ok: boolean; status?: number; error?: unknown };
  error?: unknown;
}> {
  const botToken =
    audience === 'courier'
      ? (TELEGRAM_COURIER_BOT_TOKEN || TELEGRAM_SHOP_BOT_TOKEN)
      : (TELEGRAM_PREPARER_BOT_TOKEN || TELEGRAM_RESTAURANT_BOT_TOKEN);
  const chatId = normalizeTelegramTarget(
    audience === 'courier'
      ? String(TELEGRAM_COURIER_CHANNEL || '')
      : String(TELEGRAM_PREPARER_CHANNEL || ''),
  );

  if (!botToken) {
    return { ok: false, audience, chatId, error: `TELEGRAM_${audience.toUpperCase()}_BOT_TOKEN missing` };
  }
  if (!chatId || !isValidTelegramTarget(chatId)) {
    return { ok: false, audience, chatId, error: `TELEGRAM_${audience.toUpperCase()}_CHANNEL invalid` };
  }

  // 1) getMe (token qaysi botniki)
  let bot: { id?: number; username?: string } = {};
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meJson = await meRes.json().catch(() => ({}));
    bot = { id: meJson?.result?.id, username: meJson?.result?.username };
  } catch (e) {
    return { ok: false, audience, chatId, error: `getMe failed: ${String(e)}` };
  }

  // 2) getChatMember (bot kanalda bormi)
  let member: unknown = null;
  try {
    if (bot.id) {
      const mRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(
          chatId,
        )}&user_id=${encodeURIComponent(String(bot.id))}`,
      );
      const mJson = await mRes.json().catch(() => ({}));
      member = mJson;
    } else {
      member = { ok: false, description: 'bot id missing from getMe' };
    }
  } catch (e) {
    member = { ok: false, description: `getChatMember exception: ${String(e)}` };
  }

  // 3) sendMessage test (real yuborish)
  const sendTest = await sendOrderBroadcastToChannelDebug({
    audience,
    orderType: 'other',
    orderNumber: `DEBUG-${Date.now()}`,
    pickupHint: 'membership-debug',
  });

  return { ok: true, audience, chatId, bot, member, sendTest };
}

/** Stol / xona broni — restoran Telegram chatiga (RESTAURANT bot). Rasmlar bo‘lsa sendPhoto / sendMediaGroup. */
export async function sendRestaurantTableBookingNotification(p: {
  restaurantName: string;
  chatId: string;
  bookingIdShort: string;
  roomName: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string;
  /** HH:mm — bron oralig‘ining tugashi */
  bookingEndTime?: string;
  partySize: number;
  notes?: string;
  /** Xona rasmlari (HTTPS URL) — Telegram serverlari yuklay oladigan ochiq URL */
  roomImageUrls?: string[];
}): Promise<boolean> {
  const botToken = TELEGRAM_RESTAURANT_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ TELEGRAM_RESTAURANT_BOT_TOKEN sozlanmagan — joy bron Telegramga yuborilmaydi');
    return false;
  }
  const chatId = String(p.chatId || '').trim();
  if (!chatId || !isValidTelegramTarget(chatId)) {
    console.error('❌ Joy bron: noto‘g‘ri Telegram chat ID', chatId);
    return false;
  }
  const notesBlock =
    p.notes && String(p.notes).trim()
      ? `\n📝 <b>Izoh:</b> ${escapeTelegramHtml(String(p.notes).trim())}`
      : '';
  const startT = String(p.bookingTime || '').trim();
  const endT = String(p.bookingEndTime || '').trim();
  const timeLine =
    endT && endT !== startT
      ? `${escapeTelegramHtml(startT)} — ${escapeTelegramHtml(endT)}`
      : escapeTelegramHtml(startT);
  const message = `🪑 <b>YANGI JOY BRONI</b>

🏪 <b>Restoran:</b> ${escapeTelegramHtml(p.restaurantName)}
🔢 <b>Bron ID:</b> #${escapeTelegramHtml(p.bookingIdShort)}

━━━━━━━━━━━━━━━━━━

🚪 <b>Xona / joy:</b> ${escapeTelegramHtml(p.roomName)}
📅 <b>Sana:</b> ${escapeTelegramHtml(p.bookingDate)}
🕐 <b>Vaqt:</b> ${timeLine}
👥 <b>Odamlar:</b> ${p.partySize}

━━━━━━━━━━━━━━━━━━

👤 <b>Ism:</b> ${escapeTelegramHtml(p.customerName)}
📞 <b>Telefon:</b> ${escapeTelegramHtml(p.customerPhone)}
${notesBlock}

━━━━━━━━━━━━━━━━━━

✅ Mijoz ilovadan joy band qildi. Panelda «Xonalar» bo‘limidan bronni tasdiqlang yoki bekor qiling.`.trim();

  const imageUrls = (Array.isArray(p.roomImageUrls) ? p.roomImageUrls : [])
    .map((u) => String(u || '').trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 10);

  const captionMax = 1024;
  const photoCaption =
    message.length <= captionMax ? message : `${message.slice(0, Math.max(0, captionMax - 40)).trim()}…`;

  try {
    if (imageUrls.length > 0) {
      if (imageUrls.length === 1) {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imageUrls[0],
            caption: photoCaption,
            parse_mode: 'HTML',
          }),
        });
        const j = await response.json().catch(() => ({}));
        if (response.ok && j.ok) return true;
        console.warn('⚠️ Joy bron sendPhoto muvaffaqiyatsiz:', response.status, JSON.stringify(j));
      } else {
        const media = imageUrls.map((url, idx) => {
          const item: Record<string, unknown> = { type: 'photo', media: url };
          // Telegram: albomda caption HTML — parse_mode odatda shu birinchi media obyektida bo‘lishi kerak
          // (faqat sendMediaGroup ildizidagi parse_mode ko‘pincha caption uchun ishlamaydi).
          if (idx === 0) {
            item.caption = photoCaption;
            item.parse_mode = 'HTML';
          }
          return item;
        });
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            media,
          }),
        });
        const j = await response.json().catch(() => ({}));
        if (response.ok && j.ok) return true;
        console.warn('⚠️ Joy bron sendMediaGroup muvaffaqiyatsiz:', response.status, JSON.stringify(j));
      }
      const urlBlock = imageUrls
        .map((u, i) => `🖼 <b>${i + 1}:</b> <code>${escapeTelegramHtml(u)}</code>`)
        .join('\n');
      const fallback = `${message}\n\n<b>Xona rasmlari</b> (havola):\n${urlBlock}`;
      return await sendHtmlMessage({ type: 'restaurant', chatId, text: fallback });
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const j = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('❌ Joy bron Telegram API:', response.status, JSON.stringify(j));
      return false;
    }
    return true;
  } catch (e) {
    console.error('❌ Joy bron Telegram xatolik:', e);
    return false;
  }
}

type ReceiptPhotoNotification = {
  type: NotificationType; // 'shop' | 'restaurant'
  chatId: string;
  photoUrl: string;
  caption: string;
};

/**
 * Send a receipt/photo to shop/restaurant Telegram chat.
 * `photoUrl` can be a public URL (R2 presigned/public URL).
 */
export async function sendReceiptPhoto(notification: ReceiptPhotoNotification): Promise<boolean> {
  const botToken = notification.type === 'restaurant' ? TELEGRAM_RESTAURANT_BOT_TOKEN : TELEGRAM_SHOP_BOT_TOKEN;

  if (!botToken) {
    console.error(notification.type === 'restaurant' ? '❌ TELEGRAM_RESTAURANT_BOT_TOKEN sozlanmagan' : '❌ TELEGRAM_BOT_TOKEN sozlanmagan');
    return false;
  }

  const chatId = String(notification.chatId || '').trim();
  if (!chatId || !isValidTelegramTarget(chatId)) {
    console.error('❌ Invalid Telegram chat ID format:', chatId);
    return false;
  }

  const photoUrl = String(notification.photoUrl || '').trim();
  if (!photoUrl) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: notification.caption,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Telegram sendReceiptPhoto error:', err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending receipt photo:', error);
    return false;
  }
}

type HtmlMessageNotification = {
  type: NotificationType;
  chatId: string;
  text: string;
};

/** Matnli xabar (masalan, sendPhoto muvaffaqiyatsiz bo‘lganda chek havolasi). */
export async function sendHtmlMessage(notification: HtmlMessageNotification): Promise<boolean> {
  const botToken =
    notification.type === 'restaurant' ? TELEGRAM_RESTAURANT_BOT_TOKEN : TELEGRAM_SHOP_BOT_TOKEN;

  if (!botToken) {
    console.error(
      notification.type === 'restaurant'
        ? '❌ TELEGRAM_RESTAURANT_BOT_TOKEN sozlanmagan'
        : '❌ TELEGRAM_BOT_TOKEN sozlanmagan',
    );
    return false;
  }

  const chatId = String(notification.chatId || '').trim();
  if (!chatId || !isValidTelegramTarget(chatId)) {
    console.error('❌ Invalid Telegram chat ID format:', chatId);
    return false;
  }

  const text = String(notification.text || '').trim();
  if (!text) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Telegram sendHtmlMessage error:', err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending HTML message:', error);
    return false;
  }
}

/**
 * Ijara / avto-kuryer: o‘z bot tokeningiz bilan HTML (masalan TELEGRAM_RENTAL_BOT_TOKEN).
 */
export async function sendHtmlTelegramWithToken(
  botToken: string | undefined | null,
  chatId: string,
  html: string,
): Promise<boolean> {
  const tok = String(botToken || '').trim();
  const cid = String(chatId || '').trim();
  const text = String(html || '').trim();
  if (!tok || !cid || !text || !isValidTelegramTarget(cid)) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cid, text, parse_mode: 'HTML' }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('sendHtmlTelegramWithToken:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('sendHtmlTelegramWithToken:', e);
    return false;
  }
}

/** Sinov / diagnostika: Telegram API javobidagi `description` ni qaytaradi */
export async function sendHtmlTelegramWithTokenDetailed(
  botToken: string | undefined | null,
  chatId: string,
  html: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const tok = String(botToken || '').trim();
  const cid = String(chatId || '').trim();
  const text = String(html || '').trim();
  if (!tok) return { ok: false, message: 'Bot token sozlanmagan (TELEGRAM_RENTAL_BOT_TOKEN / TELEGRAM_BOT_TOKEN)' };
  if (!cid) return { ok: false, message: 'Chat ID bo‘sh' };
  if (!isValidTelegramTarget(cid)) {
    return { ok: false, message: 'Chat ID formati noto‘g‘ri (masalan: -100… yoki @username)' };
  }
  if (!text) return { ok: false, message: 'Xabar bo‘sh' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cid, text, parse_mode: 'HTML' }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!response.ok || data.ok === false) {
      const desc =
        typeof data.description === 'string' && data.description.trim()
          ? data.description.trim()
          : `Telegram ${response.status}`;
      return { ok: false, message: desc };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg || 'Tarmoq xatolik' };
  }
}

/**
 * Kassa cheki: Telegram serverlari R2 URL ni ocholmasa ham ishlashi uchun
 * avvalo rasmni Edge orqali yuklab multipart sendPhoto, keyin URL bilan, oxirida matn+havola.
 */
export async function sendReceiptToTelegramRobust(args: {
  type: NotificationType;
  chatId: string;
  imageUrl: string;
  captionHtml: string;
  plainCaption: string;
}): Promise<boolean> {
  const botToken = args.type === 'restaurant' ? TELEGRAM_RESTAURANT_BOT_TOKEN : TELEGRAM_SHOP_BOT_TOKEN;
  if (!botToken) {
    console.error(
      args.type === 'restaurant' ? '❌ TELEGRAM_RESTAURANT_BOT_TOKEN sozlanmagan' : '❌ TELEGRAM_BOT_TOKEN sozlanmagan',
    );
    return false;
  }
  const chatId = String(args.chatId || '').trim();
  if (!isValidTelegramTarget(chatId)) {
    console.error('❌ Invalid Telegram chat ID:', chatId);
    return false;
  }
  const imageUrl = String(args.imageUrl || '').trim();
  if (!imageUrl) return false;

  const sendPhotoEndpoint = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  const sendMessageEndpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const imgRes = await fetch(imageUrl, { redirect: 'follow' });
    if (imgRes.ok) {
      const ab = await imgRes.arrayBuffer();
      const ct = imgRes.headers.get('content-type') || 'image/jpeg';
      const mime = ct.startsWith('image/') ? ct : 'image/jpeg';
      const blob = new Blob([ab], { type: mime });
      const fd = new FormData();
      fd.append('chat_id', chatId);
      fd.append('photo', blob, 'receipt.jpg');
      fd.append('caption', args.plainCaption);
      const pr = await fetch(sendPhotoEndpoint, { method: 'POST', body: fd });
      if (pr.ok) {
        console.log('✅ Telegram chek: multipart sendPhoto OK');
        return true;
      }
      const pe = await pr.json().catch(() => ({}));
      console.error('Telegram multipart sendPhoto:', pe);
    } else {
      console.warn('Chek rasmini yuklab olish muvaffaqiyatsiz:', imgRes.status, imageUrl.slice(0, 120));
    }
  } catch (e) {
    console.error('Chek rasmini fetch qilishda xato:', e);
  }

  try {
    const pr = await fetch(sendPhotoEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: imageUrl,
        caption: args.captionHtml,
        parse_mode: 'HTML',
      }),
    });
    if (pr.ok) {
      console.log('✅ Telegram chek: URL sendPhoto OK');
      return true;
    }
    const pe = await pr.json().catch(() => ({}));
    console.error('Telegram URL sendPhoto:', pe);
  } catch (e) {
    console.error('Telegram URL sendPhoto xato:', e);
  }

  try {
    const text = `${args.plainCaption}\n\n🔗 ${imageUrl}`;
    const mr = await fetch(sendMessageEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (mr.ok) {
      console.log('✅ Telegram chek: matn+havola yuborildi');
      return true;
    }
    const me = await mr.json().catch(() => ({}));
    console.error('Telegram sendMessage:', me);
  } catch (e) {
    console.error('Telegram sendMessage xato:', e);
  }

  return false;
}

/**
 * Test Telegram connection
 */
export async function testTelegramConnection(chatId: string, type: NotificationType = 'shop'): Promise<{ success: boolean; message: string }> {
  const botToken = type === 'restaurant' ? TELEGRAM_RESTAURANT_BOT_TOKEN : TELEGRAM_SHOP_BOT_TOKEN;
  const botName = type === 'restaurant' ? 'Restoran Bot' : 'Do\'kon Bot';

  if (!botToken) {
    return {
      success: false,
      message: `${botName} TOKEN sozlanmagan`,
    };
  }

  try {
    const testMessage = `
✅ <b>TEST XABARI - ${botName.toUpperCase()}</b>

Tabriklaymiz! Telegram bildirishnomalar to'g'ri sozlandi.

Yangi buyurtmalar kelganda sizga shunga o'xshash xabar yuboriladi.

📱 Chat ID: ${chatId}
🤖 Bot: ${botName}
`.trim();

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.description || 'Xabar yuborishda xatolik',
      };
    }

    return {
      success: true,
      message: `Test xabari yuborildi! ${botName} ni tekshiring.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Xatolik yuz berdi',
    };
  }
}