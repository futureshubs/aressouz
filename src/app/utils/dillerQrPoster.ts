import QRCodeLib from 'qrcode';

export type QrPosterInput = {
  orderUrl: string;
  companyName: string;
  phone: string;
  telegram: string;
  instagram: string;
  filename?: string;
};

/** 10 sm × 7 sm @ 300 DPI */
const W = 1181;
const H = 827;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

type ContactRow = {
  label: string;
  value: string;
  kind: 'phone' | 'telegram' | 'instagram';
};

export async function downloadDillerQrPoster(input: QrPosterInput): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi');

  const brand = input.companyName.trim() || 'Aresso';

  // Fon gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(1, '#f1f5f9');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Tashqi yumaloq ramka effekti
  roundRect(ctx, 28, 28, W - 56, H - 56, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Yuqori banner
  roundRectTop(ctx, 28, 28, W - 56, 112, 28);
  const banner = ctx.createLinearGradient(28, 28, W - 28, 140);
  banner.addColorStop(0, '#047857');
  banner.addColorStop(1, '#059669');
  ctx.fillStyle = banner;
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(brand, 56, 88);

  ctx.font = `500 22px ${FONT}`;
  ctx.globalAlpha = 0.92;
  ctx.fillText('Onlayn buyurtma', 56, 118);
  ctx.globalAlpha = 1;

  // QR blok — chap
  const qrBoxX = 56;
  const qrBoxY = 168;
  const qrSize = 380;

  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, qrBoxX, qrBoxY, qrSize + 48, qrSize + 48, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.stroke();

  const qrX = qrBoxX + 24;
  const qrY = qrBoxY + 24;
  const qrDataUrl = await QRCodeLib.toDataURL(input.orderUrl, {
    width: qrSize,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  ctx.drawImage(await loadImage(qrDataUrl), qrX, qrY, qrSize, qrSize);

  // Skaner yorlig‘i
  const tagW = qrSize + 48;
  const tagY = qrBoxY + qrSize + 48 + 16;
  roundRect(ctx, qrBoxX, tagY, tagW, 52, 14);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  ctx.save();
  ctx.translate(qrBoxX + 36, tagY + 26);
  drawScanIcon(ctx, 0, 0, 14);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QR SKANER', qrBoxX + tagW / 2 + 8, tagY + 27);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // O‘ng blok
  const rightX = qrBoxX + tagW + 40;
  const rightW = W - 28 - 56 - rightX;

  ctx.fillStyle = '#0f172a';
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText('Buyurtma', rightX, 200);
  const buyurtmaW = ctx.measureText('Buyurtma').width;
  ctx.fillStyle = '#10b981';
  ctx.fillText('bering', rightX + buyurtmaW + 10, 200);

  ctx.fillStyle = '#64748b';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('Telefon kamerasini', rightX, 248);
  ctx.fillText('QR kodga yo‘naltiring', rightX, 276);

  // Qadamlar
  const steps = ['Skaner', 'Mahsulot tanlang', 'Buyurtma yuboring'];
  let stepY = 310;
  for (let i = 0; i < steps.length; i++) {
    ctx.beginPath();
    ctx.arc(rightX + 14, stepY + 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), rightX + 14, stepY + 3);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#334155';
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText(steps[i], rightX + 38, stepY + 8);
    stepY += 44;
  }

  const contacts: ContactRow[] = [];
  if (input.phone.trim()) {
    contacts.push({ label: 'Telefon', value: input.phone.trim(), kind: 'phone' });
  }
  if (input.telegram.trim()) {
    contacts.push({
      label: 'Telegram',
      value: `@${input.telegram.replace(/^@/, '')}`,
      kind: 'telegram',
    });
  }
  if (input.instagram.trim()) {
    contacts.push({
      label: 'Instagram',
      value: `@${input.instagram.replace(/^@/, '')}`,
      kind: 'instagram',
    });
  }

  let rowY = stepY + 12;
  const rowH = 72;
  for (const c of contacts) {
    drawContactChip(ctx, rightX, rowY, rightW, rowH - 8, c);
    rowY += rowH;
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 1),
  );
  if (!blob) throw new Error('Rasm yaratilmadi');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = input.filename ?? 'buyurtma-qr.png';
  a.click();
  URL.revokeObjectURL(url);
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

function roundRectTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawContactChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  contact: ContactRow,
) {
  const theme = {
    phone: { bg: '#ecfdf5', accent: '#10b981', icon: '#10b981' },
    telegram: { bg: '#eff6ff', accent: '#229ED9', icon: '#229ED9' },
    instagram: { bg: '#fdf2f8', accent: '#db2777', icon: '' },
  }[contact.kind];

  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = theme.bg;
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  const iconSize = 44;
  const iconX = x + 16;
  const iconY = y + (h - iconSize) / 2;

  roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
  if (contact.kind === 'instagram') {
    fillInstagramSquare(ctx, iconX, iconY, iconSize, 12);
  } else {
    ctx.fillStyle = theme.icon;
    ctx.fill();
  }

  ctx.save();
  ctx.translate(iconX + iconSize / 2, iconY + iconSize / 2);
  if (contact.kind === 'phone') drawPhoneIcon(ctx);
  else if (contact.kind === 'telegram') drawTelegramIcon(ctx);
  else drawInstagramIcon(ctx);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(contact.label.toUpperCase(), x + 72, y + 26);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 24px ${FONT}`;
  const val = contact.value.length > 20 ? `${contact.value.slice(0, 19)}…` : contact.value;
  ctx.fillText(val, x + 72, y + 52);
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
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-8, -12, 16, 24);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.fillRect(-5, -9, 10, 18);
  ctx.globalAlpha = 1;
  ctx.fillRect(-2.5, 8, 5, 2);
}

function drawTelegramIcon(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-10, 3);
  ctx.lineTo(10, -3);
  ctx.lineTo(2, 12);
  ctx.lineTo(0, 5);
  ctx.lineTo(-4, 7);
  ctx.closePath();
  ctx.fill();
}

function drawInstagramIcon(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-8, -8, 16, 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, -6, 2.5, 2.5);
}

function drawScanIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'square';
  const h = s * 0.85;
  const corners = [
    [-h, -h, -h / 3, -h, -h, -h / 3],
    [h / 3, -h, h, -h, h, -h / 3],
    [-h, h / 3, -h, h, -h / 3, h],
    [h / 3, h, h, h, h, h / 3],
  ];
  for (const [mx, my, cx2, cy2, ex, ey] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + mx, cy + my);
    ctx.lineTo(cx + cx2, cy + cy2);
    ctx.lineTo(cx + ex, cy + ey);
    ctx.stroke();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
