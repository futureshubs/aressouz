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

  drawBackground(ctx);

  // Asosiy karta
  roundRect(ctx, 28, 28, W - 56, H - 56, 32);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(15,23,42,0.12)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  roundRect(ctx, 28, 28, W - 56, H - 56, 32);
  const borderGrad = ctx.createLinearGradient(28, 28, W - 28, H - 28);
  borderGrad.addColorStop(0, '#34d399');
  borderGrad.addColorStop(0.5, '#10b981');
  borderGrad.addColorStop(1, '#059669');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Chap panel — yashil gradient fon
  roundRect(ctx, 48, 48, 500, H - 96, 24);
  const leftPanel = ctx.createLinearGradient(48, 48, 548, H - 48);
  leftPanel.addColorStop(0, '#ecfdf5');
  leftPanel.addColorStop(1, '#d1fae5');
  ctx.fillStyle = leftPanel;
  ctx.fill();

  // QR
  const qrSize = 380;
  const qrX = 48 + (500 - qrSize) / 2;
  const qrY = 88;

  roundRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 20);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(5,150,105,0.2)';
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;

  drawQrFrame(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);

  const qrDataUrl = await QRCodeLib.toDataURL(input.orderUrl, {
    width: qrSize,
    margin: 0,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Skaner tugmasi
  const btnW = 340;
  const btnX = 48 + (500 - btnW) / 2;
  const btnY = qrY + qrSize + 36;
  roundRect(ctx, btnX, btnY, btnW, 52, 26);
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
  btnGrad.addColorStop(0, '#10b981');
  btnGrad.addColorStop(1, '#059669');
  ctx.fillStyle = btnGrad;
  ctx.fill();

  ctx.save();
  ctx.translate(btnX + 52, btnY + 26);
  drawScanIcon(ctx, 0, 0, 18);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SKANER QILING', btnX + btnW / 2 + 12, btnY + 27);
  ctx.textBaseline = 'alphabetic';

  // O‘ng panel
  const rightX = 580;
  const rightW = W - rightX - 56;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText('Buyurtma', rightX, 112);
  ctx.fillStyle = '#059669';
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText('bering', rightX, 172);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `22px ${FONT}`;
  ctx.fillText('Telefon kamerasini yoqing', rightX, 210);

  const lineGrad = ctx.createLinearGradient(rightX, 0, rightX + 180, 0);
  lineGrad.addColorStop(0, '#10b981');
  lineGrad.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = lineGrad;
  roundRect(ctx, rightX, 222, 180, 5, 3);
  ctx.fill();

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

  const rowH = 108;
  let rowY = 244;
  for (const c of contacts) {
    drawContactCard(ctx, rightX, rowY, rightW, rowH - 14, c);
    rowY += rowH;
  }

  // Footer
  const footerY = H - 78;
  roundRect(ctx, W / 2 - 130, footerY, 260, 44, 22);
  ctx.fillStyle = 'rgba(16,185,129,0.12)';
  ctx.fill();
  ctx.fillStyle = '#047857';
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('aressouz.uz', W / 2, footerY + 30);

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

function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f0fdf4');
  bg.addColorStop(0.4, '#ffffff');
  bg.addColorStop(1, '#eff6ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(16,185,129,0.05)';
  ctx.beginPath();
  ctx.arc(W - 60, 80, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(60, H - 60, 140, 0, Math.PI * 2);
  ctx.fill();
}

function drawQrFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const len = 36;
  const pad = 10;
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  const corners: [number, number, number, number][] = [
    [x + pad, y + pad + len, x + pad, y + pad, x + pad + len, y + pad],
    [x + w - pad - len, y + pad, x + w - pad, y + pad, x + w - pad, y + pad + len],
    [x + pad, y + h - pad - len, x + pad, y + h - pad, x + pad + len, y + h - pad],
    [x + w - pad - len, y + h - pad, x + w - pad, y + h - pad, x + w - pad, y + h - pad - len],
  ];

  for (const [mx, my, cx, cy, ex, ey] of corners) {
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
}

function drawContactCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  contact: ContactRow,
) {
  const styles = {
    phone: { bg: '#ecfdf5', border: '#a7f3d0', accent: '#10b981', iconBg: '#10b981' },
    telegram: { bg: '#eff6ff', border: '#bfdbfe', accent: '#229ED9', iconBg: '#229ED9' },
    instagram: { bg: '#fdf2f8', border: '#fbcfe8', accent: '#e1306c', iconBg: '' },
  }[contact.kind];

  roundRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = styles.bg;
  ctx.fill();
  roundRect(ctx, x, y, w, h, 20);
  ctx.strokeStyle = styles.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chap accent
  roundRect(ctx, x, y + 12, 6, h - 24, 3);
  ctx.fillStyle = styles.accent;
  ctx.fill();

  const iconCx = x + 52;
  const iconCy = y + h / 2;

  if (contact.kind === 'instagram') {
    drawInstagramIconBg(ctx, iconCx, iconCy, 30);
  } else {
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 30, 0, Math.PI * 2);
    ctx.fillStyle = styles.iconBg;
    ctx.fill();
  }

  ctx.save();
  ctx.translate(iconCx, iconCy);
  if (contact.kind === 'phone') drawPhoneIcon(ctx);
  else if (contact.kind === 'telegram') drawTelegramIcon(ctx);
  else drawInstagramIcon(ctx);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(contact.label, x + 96, y + 38);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 32px ${FONT}`;
  const val = contact.value.length > 20 ? `${contact.value.slice(0, 19)}…` : contact.value;
  ctx.fillText(val, x + 96, y + 76);
}

function drawPhoneIcon(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Smartfon
  roundRect(ctx, -11, -16, 22, 32, 5);
  ctx.stroke();

  // Ekran
  roundRect(ctx, -8, -11, 16, 22, 2);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;

  // Home tugma
  ctx.beginPath();
  ctx.arc(0, 12, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawTelegramIcon(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-13, 5);
  ctx.lineTo(13, -5);
  ctx.lineTo(4, 15);
  ctx.lineTo(0, 7);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fill();
}

function drawInstagramIconBg(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, '#f58529');
  g.addColorStop(0.35, '#dd2a7b');
  g.addColorStop(0.7, '#8134af');
  g.addColorStop(1, '#515bd4');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawInstagramIcon(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';

  // Rounded square
  roundRect(ctx, -11, -11, 22, 22, 6);
  ctx.stroke();

  // Lens
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.stroke();

  // Flash dot
  ctx.beginPath();
  ctx.arc(7, -7, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawScanIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const h = s * 0.7;
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
