/**
 * Telegram Notification Service
 * Sends notifications via TWO separate bots:
 * 1. TELEGRAM_BOT_TOKEN - Do'kon (Marketplace) uchun
 * 2. TELEGRAM_RESTAURANT_BOT_TOKEN - Taomlar (Restoran) uchun
 */

const TELEGRAM_SHOP_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_RESTAURANT_BOT_TOKEN = Deno.env.get('TELEGRAM_RESTAURANT_BOT_TOKEN');

type NotificationType = 'shop' | 'restaurant';

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
                return `   - ${addon?.name || 'Qo\'shimcha'} × ${addonQty} (${addonPrice.toLocaleString()} so'm)`;
              })
              .join('\n')}`
          : '';

        return `${index + 1}. ${item.name} (${item.variantName})\n   ${item.quantity} ta × ${item.price.toLocaleString()} so'm = ${(item.quantity * item.price).toLocaleString()} so'm${addonsText}`;
      })
      .join('\n\n');

    // Create message
    const message = `
🎉 <b>YANGI BUYURTMA!</b>

📍 <b>Do'kon:</b> ${notification.shopName}
🔢 <b>Buyurtma raqami:</b> #${notification.orderNumber}
📅 <b>Sana:</b> ${notification.orderDate}

━━━━━━━━━━━━━━━━━━

👤 <b>MIJOZ MA'LUMOTLARI:</b>

👨‍💼 <b>Ismi:</b> ${notification.customerName}
📞 <b>Telefon:</b> ${notification.customerPhone}
📍 <b>Manzil:</b> ${notification.customerAddress}

━━━━━━━━━━━━━━━━━━

🛍️ <b>MAHSULOTLAR:</b>

${itemsList}

━━━━━━━━━━━━━━━━━━

💰 <b>JAMI SUMMA:</b> ${notification.totalAmount.toLocaleString()} so'm

🚚 <b>Yetkazib berish:</b> ${notification.deliveryMethod}
💳 <b>To'lov usuli:</b> ${notification.paymentMethod}

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