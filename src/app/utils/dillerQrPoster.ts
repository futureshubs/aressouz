import QRCodeLib from 'qrcode';

export type QrPosterInput = {
  orderUrl: string;
  companyName: string;
  phone: string;
  telegram: string;
  instagram: string;
  filename?: string;
};

/** Karobka sticker: 10 sm × 5 sm @ 300 DPI */
export const DILLER_QR_POSTER_CM = { w: 10, h: 5 } as const;
const DPI = 300;
const W = Math.round((DILLER_QR_POSTER_CM.w / 2.54) * DPI); // 1181
const H = Math.round((DILLER_QR_POSTER_CM.h / 2.54) * DPI); // 591
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

type ContactRow = {
  label: string;
  value: string;
  kind: 'phone' | 'telegram' | 'instagram';
};

export async function makeDillerQrDataUrl(orderUrl: string, size = 512): Promise<string> {
  return QRCodeLib.toDataURL(orderUrl, {
    width: size,
    margin: 1,
    color: { dark: '#0b1220', light: '#ffffff' },
  });
}

export async function renderDillerQrPosterDataUrl(input: QrPosterInput): Promise<string> {
  const canvas = await renderPosterCanvas(input);
  return canvas.toDataURL('image/png', 1);
}

export async function downloadDillerQrPoster(input: QrPosterInput): Promise<void> {
  const canvas = await renderPosterCanvas(input);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1),
  );
  if (!blob) throw new Error('Rasm yaratilmadi');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = input.filename ?? 'buyurtma-qr-10x5.png';
  a.click();
  URL.revokeObjectURL(url);
}

async function renderPosterCanvas(input: QrPosterInput): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi');

  const brand = input.companyName.trim() || 'Aresso';
  const contacts = collectContacts(input);

  paintBackdrop(ctx);
  paintStickerBody(ctx);

  const pad = 40;
  const qrPlate = 448;
  const qrX = 48;
  const qrY = (H - qrPlate) / 2;
  await paintQrPlate(ctx, qrX, qrY, qrPlate, input.orderUrl);

  const rightX = qrX + qrPlate + 28;
  const rightW = W - pad - rightX;
  paintCopyAndContacts(ctx, rightX, 36, rightW, H - 72, brand, contacts);

  return canvas;
}

function collectContacts(input: QrPosterInput): ContactRow[] {
  const rows: ContactRow[] = [];
  if (input.phone.trim()) {
    rows.push({ label: 'Telefon', value: input.phone.trim(), kind: 'phone' });
  }
  if (input.telegram.trim()) {
    rows.push({
      label: 'Telegram',
      value: `@${input.telegram.replace(/^@/, '')}`,
      kind: 'telegram',
    });
  }
  if (input.instagram.trim()) {
    rows.push({
      label: 'Instagram',
      value: `@${input.instagram.replace(/^@/, '')}`,
      kind: 'instagram',
    });
  }
  return rows;
}

function paintBackdrop(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#071018');
  bg.addColorStop(0.45, '#0f3d38');
  bg.addColorStop(1, '#052e2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const spot = ctx.createRadialGradient(W * 0.18, H * 0.12, 20, W * 0.18, H * 0.12, 520);
  spot.addColorStop(0, 'rgba(255,255,255,0.18)');
  spot.addColorStop(0.4, 'rgba(16,185,129,0.12)');
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  const spot2 = ctx.createRadialGradient(W * 0.92, H * 0.9, 10, W * 0.92, H * 0.9, 380);
  spot2.addColorStop(0, 'rgba(52,211,153,0.22)');
  spot2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot2;
  ctx.fillRect(0, 0, W, H);
}

function paintStickerBody(ctx: CanvasRenderingContext2D) {
  const x = 18;
  const y = 18;
  const w = W - 36;
  const h = H - 36;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, x, y, w, h, 42);
  ctx.fillStyle = '#0b1c1a';
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, w, h, 42);
  const body = ctx.createLinearGradient(x, y, x + w, y + h);
  body.addColorStop(0, '#123d38');
  body.addColorStop(0.5, '#0d2926');
  body.addColorStop(1, '#0a1f1c');
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, w, h, 42);
  ctx.clip();
  const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.45);
  gloss.addColorStop(0, 'rgba(255,255,255,0.14)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, w, h * 0.5);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 40);
  ctx.stroke();
  ctx.restore();

  // chap emerald 3D chiziq
  ctx.save();
  roundRect(ctx, x, y, w, h, 42);
  ctx.clip();
  const bar = ctx.createLinearGradient(x, y, x + 14, y);
  bar.addColorStop(0, '#34d399');
  bar.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = bar;
  ctx.fillRect(x, y, 18, h);
  ctx.restore();
}

async function paintQrPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  orderUrl: string,
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, x, y, size, size, 36);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, size, size, 36);
  const plate = ctx.createLinearGradient(x, y, x, y + size);
  plate.addColorStop(0, '#ffffff');
  plate.addColorStop(0.55, '#f8fafc');
  plate.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = plate;
  ctx.fill();

  ctx.strokeStyle = 'rgba(15,23,42,0.08)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 35);
  ctx.stroke();

  // 3D rim light
  ctx.save();
  roundRect(ctx, x, y, size, size, 36);
  ctx.clip();
  const rim = ctx.createLinearGradient(x, y, x, y + 28);
  rim.addColorStop(0, 'rgba(255,255,255,0.95)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(x, y, size, 32);
  ctx.restore();

  const qrPad = 38;
  const qrSize = size - qrPad * 2;
  const qrDataUrl = await QRCodeLib.toDataURL(orderUrl, {
    width: qrSize,
    margin: 1,
    color: { dark: '#0b1220', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
  ctx.drawImage(await loadImage(qrDataUrl), x + qrPad, y + qrPad, qrSize, qrSize);

  // scan corners
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const c = 28;
  const inset = 18;
  const x1 = x + inset;
  const y1 = y + inset;
  const x2 = x + size - inset;
  const y2 = y + size - inset;
  drawCorner(ctx, x1, y1, c, 1, 1);
  drawCorner(ctx, x2, y1, c, -1, 1);
  drawCorner(ctx, x1, y2, c, 1, -1);
  drawCorner(ctx, x2, y2, c, -1, -1);
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  len: number,
  dx: number,
  dy: number,
) {
  ctx.beginPath();
  ctx.moveTo(ox + dx * len, oy);
  ctx.lineTo(ox, oy);
  ctx.lineTo(ox, oy + dy * len);
  ctx.stroke();
}

function paintCopyAndContacts(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  brand: string,
  contacts: ContactRow[],
) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(167,243,208,0.9)';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText('SCAN · BUYURTMA', x, y + 28);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 42px ${FONT}`;
  const brandDraw = brand.length > 18 ? `${brand.slice(0, 17)}…` : brand;
  ctx.fillText(brandDraw, x, y + 78);

  ctx.font = `800 34px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Buyurtma', x, y + 126);
  const bw = ctx.measureText('Buyurtma ').width;
  ctx.fillStyle = '#34d399';
  ctx.fillText('bering', x + bw, y + 126);

  ctx.fillStyle = 'rgba(226,232,240,0.72)';
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText('Kamerani QR kodga yo‘naltiring', x, y + 156);

  const n = Math.min(contacts.length, 3);
  const rowH = n >= 3 ? 78 : n === 2 ? 88 : 96;
  const startY = y + 176;
  contacts.slice(0, 3).forEach((c, i) => {
    drawContactChip3d(ctx, x, startY + i * rowH, w, rowH - 10, c);
  });

  if (contacts.length === 0) {
    roundRect(ctx, x, startY, w, 92, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Skaner qiling — catalog ochiladi', x + 22, startY + 54);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('10 × 5 sm  ·  karobka sticker', x, y + h - 4);
}

function drawContactChip3d(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  contact: ContactRow,
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = 'rgba(8, 20, 18, 0.72)';
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, w, h, 22);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const icon = Math.min(52, Math.max(38, h - 14));
  const ix = x + 12;
  const iy = y + (h - icon) / 2;
  paintIconCube(ctx, ix, iy, icon, contact.kind);

  const textX = x + icon + 26;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(226,232,240,0.55)';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(contact.label.toUpperCase(), textX, y + h * 0.38);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 22px ${FONT}`;
  const val = contact.value.length > 22 ? `${contact.value.slice(0, 21)}…` : contact.value;
  ctx.fillText(val, textX, y + h * 0.72);
}

function paintIconCube(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  kind: ContactRow['kind'],
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, x, y, size, size, 16);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, size, size, 16);
  if (kind === 'instagram') {
    fillInstagramSquare(ctx, x, y, size, 16);
  } else if (kind === 'telegram') {
    const tg = ctx.createLinearGradient(x, y, x + size, y + size);
    tg.addColorStop(0, '#5cc8ff');
    tg.addColorStop(1, '#1a8ad4');
    ctx.fillStyle = tg;
    ctx.fill();
  } else {
    const ph = ctx.createLinearGradient(x, y, x + size, y + size);
    ph.addColorStop(0, '#6ee7b7');
    ph.addColorStop(1, '#059669');
    ctx.fillStyle = ph;
    ctx.fill();
  }

  ctx.save();
  roundRect(ctx, x, y, size, size, 16);
  ctx.clip();
  const shine = ctx.createLinearGradient(x, y, x, y + size * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.38)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(x, y, size, size * 0.5);
  ctx.restore();

  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(size / 44, size / 44);
  if (kind === 'phone') drawPhoneIcon(ctx);
  else if (kind === 'telegram') drawTelegramIcon(ctx);
  else drawInstagramIcon(ctx);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function fillInstagramSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
) {
  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, '#f58529');
  g.addColorStop(0.4, '#dd2a7b');
  g.addColorStop(0.75, '#8134af');
  g.addColorStop(1, '#515bd4');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, size, size);
  ctx.restore();
}

function drawPhoneIcon(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  roundRect(ctx, -8, -12, 16, 24, 3);
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.fillRect(-5, -8, 10, 16);
  ctx.globalAlpha = 1;
  ctx.fillRect(-2.4, 8, 4.8, 2);
}

function drawTelegramIcon(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-11, 2);
  ctx.lineTo(11, -5);
  ctx.lineTo(2, 13);
  ctx.lineTo(-1, 5);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();
}

function drawInstagramIcon(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  roundRect(ctx, -9, -9, 18, 18, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(6.2, -6.2, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
