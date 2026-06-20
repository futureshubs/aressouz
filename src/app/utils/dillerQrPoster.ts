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
const PAD = 36;
const BORDER = 3;

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

  // Fon
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Tashqi ramka — to‘rtburchak
  strokeRect(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, '#059669', BORDER);
  ctx.fillStyle = '#ffffff';
  fillRect(ctx, PAD + BORDER, PAD + BORDER, W - PAD * 2 - BORDER * 2, H - PAD * 2 - BORDER * 2);

  const innerX = PAD + 20;
  const innerY = PAD + 20;
  const innerW = W - (PAD + 20) * 2;
  const innerH = H - (PAD + 20) * 2;

  // Chap blok
  const leftW = 488;
  fillRect(ctx, innerX, innerY, leftW, innerH, '#ecfdf5');
  strokeRect(ctx, innerX, innerY, leftW, innerH, '#6ee7b7', 1);

  const qrSize = 360;
  const qrX = innerX + (leftW - qrSize) / 2;
  const qrY = innerY + 44;

  fillRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, '#ffffff');
  strokeRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, '#10b981', 2);
  drawQrCorners(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28);

  const qrDataUrl = await QRCodeLib.toDataURL(input.orderUrl, {
    width: qrSize,
    margin: 0,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  ctx.drawImage(await loadImage(qrDataUrl), qrX, qrY, qrSize, qrSize);

  // Skaner paneli — to‘rtburchak
  const barW = 320;
  const barX = innerX + (leftW - barW) / 2;
  const barY = qrY + qrSize + 32;
  fillRect(ctx, barX, barY, barW, 46, '#059669');

  ctx.save();
  ctx.translate(barX + 28, barY + 23);
  drawScanIcon(ctx, 0, 0, 16);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SKANER QILING', barX + barW / 2 + 10, barY + 24);
  ctx.textBaseline = 'alphabetic';

  // O‘ng blok
  const rightX = innerX + leftW + 24;
  const rightW = innerW - leftW - 24;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText('Buyurtma bering', rightX, innerY + 52);

  ctx.fillStyle = '#64748b';
  ctx.font = `18px ${FONT}`;
  ctx.fillText('Telefon kamerasini yoqing', rightX, innerY + 82);

  fillRect(ctx, rightX, innerY + 94, 120, 3, '#10b981');

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

  const rowH = 98;
  let rowY = innerY + 118;
  for (const c of contacts) {
    drawContactRow(ctx, rightX, rowY, rightW, rowH - 10, c);
    rowY += rowH;
  }

  // Footer
  const footY = innerY + innerH - 42;
  fillRect(ctx, W / 2 - 110, footY, 220, 32, '#ecfdf5');
  strokeRect(ctx, W / 2 - 110, footY, 220, 32, '#6ee7b7', 1);
  ctx.fillStyle = '#047857';
  ctx.font = `700 18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('aressouz.uz', W / 2, footY + 22);

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

function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color?: string,
) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function strokeRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  width: number,
) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawQrCorners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const len = 32;
  const inset = 8;
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 4;
  ctx.lineCap = 'square';

  const corners: [number, number, number, number][] = [
    [x + inset, y + inset + len, x + inset, y + inset, x + inset + len, y + inset],
    [x + w - inset - len, y + inset, x + w - inset, y + inset, x + w - inset, y + inset + len],
    [x + inset, y + h - inset - len, x + inset, y + h - inset, x + inset + len, y + h - inset],
    [x + w - inset - len, y + h - inset, x + w - inset, y + h - inset, x + w - inset, y + h - inset - len],
  ];

  for (const [mx, my, cx, cy, ex, ey] of corners) {
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
}

function drawContactRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  contact: ContactRow,
) {
  const theme = {
    phone: { bg: '#f0fdf4', line: '#10b981', icon: '#10b981' },
    telegram: { bg: '#eff6ff', line: '#229ED9', icon: '#229ED9' },
    instagram: { bg: '#fdf2f8', line: '#db2777', icon: '' },
  }[contact.kind];

  fillRect(ctx, x, y, w, h, theme.bg);
  strokeRect(ctx, x, y, w, h, '#e2e8f0', 1);
  fillRect(ctx, x, y, 5, h, theme.line);

  const iconSize = 52;
  const iconX = x + 22;
  const iconY = y + (h - iconSize) / 2;

  if (contact.kind === 'instagram') {
    fillInstagramSquare(ctx, iconX, iconY, iconSize);
  } else {
    fillRect(ctx, iconX, iconY, iconSize, iconSize, theme.icon);
  }

  ctx.save();
  ctx.translate(iconX + iconSize / 2, iconY + iconSize / 2);
  if (contact.kind === 'phone') drawPhoneIcon(ctx);
  else if (contact.kind === 'telegram') drawTelegramIcon(ctx);
  else drawInstagramIcon(ctx);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(contact.label.toUpperCase(), x + 88, y + 32);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 26px ${FONT}`;
  const val = contact.value.length > 22 ? `${contact.value.slice(0, 21)}…` : contact.value;
  ctx.fillText(val, x + 88, y + 64);
}

function fillInstagramSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
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
  ctx.lineJoin = 'miter';

  ctx.beginPath();
  ctx.rect(-9, -14, 18, 28);
  ctx.stroke();

  ctx.globalAlpha = 0.3;
  ctx.fillRect(-6, -10, 12, 20);
  ctx.globalAlpha = 1;

  ctx.fillRect(-3, 10, 6, 2);
}

function drawTelegramIcon(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-12, 4);
  ctx.lineTo(12, -4);
  ctx.lineTo(3, 14);
  ctx.lineTo(0, 6);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();
}

function drawInstagramIcon(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.rect(-10, -10, 20, 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, -7, 3, 3);
}

function drawScanIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'square';
  const h = s * 0.75;
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
