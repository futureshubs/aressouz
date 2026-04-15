/**
 * Telegram Notification Service
 * Sends notifications via TWO separate bots:
 * 1. TELEGRAM_BOT_TOKEN - Do'kon (Marketplace) uchun
 * 2. TELEGRAM_RESTAURANT_BOT_TOKEN - Taomlar (Restoran) uchun
 */

const TELEGRAM_SHOP_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_RESTAURANT_BOT_TOKEN = Deno.env.get('TELEGRAM_RESTAURANT_BOT_TOKEN');

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
  const message = `🪑 <b>YANGI JOY BRONI</b>

🏪 <b>Restoran:</b> ${escapeTelegramHtml(p.restaurantName)}
🔢 <b>Bron ID:</b> #${escapeTelegramHtml(p.bookingIdShort)}

━━━━━━━━━━━━━━━━━━

🚪 <b>Xona / joy:</b> ${escapeTelegramHtml(p.roomName)}
📅 <b>Sana:</b> ${escapeTelegramHtml(p.bookingDate)}
🕐 <b>Vaqt:</b> ${escapeTelegramHtml(p.bookingTime)}
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