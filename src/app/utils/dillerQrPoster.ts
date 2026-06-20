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

const EMERALD = '#10b981';
const EMERALD_DARK = '#059669';
const SLATE = '#0f172a';
const MUTED = '#64748b';

export async function downloadDillerQrPoster(input: QrPosterInput): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi');

  // Fon — yumshoq gradient + dekor nuqtalar
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f0fdf4');
  bg.addColorStop(0.55, '#ffffff');
  bg.addColorStop(1, '#f8fafc');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(16,185,129,0.06)';
  ctx.beginPath();
  ctx.arc(W - 80, 60, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, H - 40, 120, 0, Math.PI * 2);
  ctx.fill();

  // Asosiy karta
  roundRect(ctx, 32, 32, W - 64, H - 64, 28);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(15,23,42,0.08)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  roundRect(ctx, 32, 32, W - 64, H - 64, 28);
  ctx.strokeStyle = 'rgba(16,185,129,0.22)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Chap — QR blok
  const qrSize = 420;
  const qrX = 72;
  const qrY = Math.round((H - qrSize - 48) / 2) + 12;

  roundRect(ctx, qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 22);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(16,185,129,0.15)';
  ctx.shadowBlur = 28;
  ctx.fill();
  ctx.shadowBlur = 0;

  roundRect(ctx, qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 22);
  ctx.strokeStyle = 'rgba(16,185,129,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const qrDataUrl = await QRCodeLib.toDataURL(input.orderUrl, {
    width: qrSize,
    margin: 1,
    color: { dark: SLATE, light: '#ffffff' },
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // QR ostidagi yorliq
  const scanLabelW = 280;
  const scanLabelX = qrX + (qrSize - scanLabelW) / 2;
  roundRect(ctx, scanLabelX, qrY + qrSize + 28, scanLabelW, 44, 22);
  ctx.fillStyle = EMERALD;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKANER QILING', scanLabelX + scanLabelW / 2, qrY + qrSize + 58);

  // O‘ng — sarlavha va kontaktlar
  const rightX = 580;
  const rightW = W - rightX - 56;

  ctx.textAlign = 'left';
  ctx.fillStyle = SLATE;
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.fillText('Buyurtma bering', rightX, 132);

  ctx.fillStyle = MUTED;
  ctx.font = '24px system-ui, -apple-system, sans-serif';
  ctx.fillText('Telefon kamerasini yoqing', rightX, 178);

  const contacts: { label: string; value: string; accent: string; icon: 'phone' | 'tg' | 'ig' }[] = [];
  if (input.phone.trim()) {
    contacts.push({ label: 'Telefon', value: input.phone.trim(), accent: EMERALD, icon: 'phone' });
  }
  if (input.telegram.trim()) {
    contacts.push({
      label: 'Telegram',
      value: `@${input.telegram.replace(/^@/, '')}`,
      accent: '#229ED9',
      icon: 'tg',
    });
  }
  if (input.instagram.trim()) {
    contacts.push({
      label: 'Instagram',
      value: `@${input.instagram.replace(/^@/, '')}`,
      accent: '#E1306C',
      icon: 'ig',
    });
  }

  let rowY = 220;
  const rowH = 108;
  for (const c of contacts) {
    roundRect(ctx, rightX, rowY, rightW, rowH - 12, 18);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    roundRect(ctx, rightX, rowY, rightW, rowH - 12, 18);
    ctx.strokeStyle = 'rgba(15,23,42,0.06)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawIconCircle(ctx, rightX + 36, rowY + (rowH - 12) / 2, 28, c.accent, c.icon);

    ctx.fillStyle = MUTED;
    ctx.font = '20px system-ui, -apple-system, sans-serif';
    ctx.fillText(c.label, rightX + 72, rowY + 38);

    ctx.fillStyle = SLATE;
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    const displayVal =
      c.value.length > 22 ? `${c.value.slice(0, 21)}…` : c.value;
    ctx.fillText(displayVal, rightX + 72, rowY + 74);

    rowY += rowH;
  }

  // Footer
  const footerW = 220;
  const footerX = (W - footerW) / 2;
  roundRect(ctx, footerX, H - 88, footerW, 40, 20);
  ctx.fillStyle = 'rgba(16,185,129,0.1)';
  ctx.fill();
  ctx.fillStyle = EMERALD_DARK;
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('aressouz.uz', W / 2, H - 62);

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
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawIconCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  icon: 'phone' | 'tg' | 'ig',
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (icon === 'phone') {
    const pw = 16;
    const ph = 22;
    const pr = 4;
    ctx.beginPath();
    ctx.moveTo(-pw / 2 + pr, -ph / 2);
    ctx.lineTo(pw / 2 - pr, -ph / 2);
    ctx.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + pr);
    ctx.lineTo(pw / 2, ph / 2 - pr);
    ctx.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - pr, ph / 2);
    ctx.lineTo(-pw / 2 + pr, ph / 2);
    ctx.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - pr);
    ctx.lineTo(-pw / 2, -ph / 2 + pr);
    ctx.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + pr, -ph / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 10);
    ctx.lineTo(4, 10);
    ctx.stroke();
  } else if (icon === 'tg') {
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(10, -8);
    ctx.lineTo(-2, 10);
    ctx.lineTo(-2, 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
