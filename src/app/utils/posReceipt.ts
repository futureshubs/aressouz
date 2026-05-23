export type PosReceiptItem = {
  name: string;
  qty: number;
  priceUzs: number;
  totalUzs: number;
};

export type PosReceiptData = {
  saleId: string;
  createdAt: string;
  items: PosReceiptItem[];
  subtotalUzs: number;
  discountUzs: number;
  totalUzs: number;
  payMethod: 'cash' | 'card';
};

export function formatPosUzs(n: number) {
  return `${Math.round(n || 0).toLocaleString('uz-UZ')} so'm`;
}

export function isMobilePosDevice() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(max-width: 768px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

export function buildPosReceiptHtml(
  receipt: PosReceiptData,
  shopName: string,
  paperWidthMm: 58 | 80 = 58,
  opts?: { autoPrint?: boolean; autoClose?: boolean },
) {
  const created = new Date(receipt.createdAt);
  const payLabel = receipt.payMethod === 'cash' ? 'Naqd' : 'Karta';
  const autoPrint = opts?.autoPrint !== false;
  const autoClose = opts?.autoClose !== false;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Chek #${receipt.saleId}</title>
  <style>
    :root {
      --paper-width: ${paperWidthMm}mm;
      --font-size: ${paperWidthMm === 58 ? '10px' : '11px'};
      --pad-x: ${paperWidthMm === 58 ? '1.5mm' : '2.5mm'};
      --pad-y: 0mm;
    }
    @page { size: var(--paper-width) auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: var(--paper-width) !important;
      height: auto !important;
      background: #fff;
      color: #000;
      font-family: "Courier New", monospace;
      font-size: var(--font-size);
      line-height: 1.32;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt { width: 100%; margin: 0; padding: var(--pad-y) var(--pad-x); }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .header h1 { margin: 0 0 3px; font-size: ${paperWidthMm === 58 ? '13px' : '15px'}; font-weight: 700; word-break: break-word; }
    .header p { margin: 1px 0; font-size: ${paperWidthMm === 58 ? '9px' : '10px'}; }
    .section { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .item { margin: 5px 0; }
    .item-name { font-weight: 700; margin-bottom: 1px; word-break: break-word; }
    .muted { opacity: 0.85; }
    .total { border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; font-weight: 700; font-size: ${paperWidthMm === 58 ? '12px' : '14px'}; }
    .footer { text-align: center; margin-top: 6px; font-size: ${paperWidthMm === 58 ? '9px' : '10px'}; }
    @media print {
      @page { size: var(--paper-width) auto; margin: 0 !important; }
      html, body { width: var(--paper-width) !important; margin: 0 !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="receipt" id="receipt">
    <div class="header">
      <h1>${escapeHtml(shopName || "Do'kon")}</h1>
      <p class="muted">Savdo cheki (POS)</p>
      <p class="muted">${paperWidthMm}mm termal</p>
    </div>
    <div class="section">
      <div class="row"><span>Chek №:</span><strong>${escapeHtml(receipt.saleId)}</strong></div>
      <div class="row"><span>Sana:</span><span>${created.toLocaleDateString('uz-UZ')}</span></div>
      <div class="row"><span>Vaqt:</span><span>${created.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="row"><span>To'lov:</span><span>${payLabel}</span></div>
    </div>
    <div class="section">
      ${receipt.items
        .map(
          (it) => `
        <div class="item">
          <div class="item-name">${escapeHtml(it.name)}</div>
          <div class="row muted">
            <span>${it.qty} × ${it.priceUzs.toLocaleString('uz-UZ')}</span>
            <span>${it.totalUzs.toLocaleString('uz-UZ')} so'm</span>
          </div>
        </div>`,
        )
        .join('')}
    </div>
    <div class="section">
      <div class="row"><span>Subtotal:</span><span>${receipt.subtotalUzs.toLocaleString('uz-UZ')} so'm</span></div>
      <div class="row"><span>Chegirma:</span><span>${receipt.discountUzs.toLocaleString('uz-UZ')} so'm</span></div>
      <div class="row total"><span>JAMI:</span><span>${receipt.totalUzs.toLocaleString('uz-UZ')} so'm</span></div>
    </div>
    <div class="footer">Rahmat!</div>
  </div>
  <script>
    (function () {
      function pxToMm(px) { return (px * 25.4) / 96; }
      function computeAndInjectPageSize() {
        const receiptEl = document.getElementById('receipt');
        if (!receiptEl) return;
        document.documentElement.style.height = 'auto';
        document.body.style.height = 'auto';
        const contentHeightMm = Math.max(18, pxToMm(receiptEl.scrollHeight) + 2);
        const dynamicPageStyle = document.createElement('style');
        dynamicPageStyle.textContent =
          '@media print { @page { size: ${paperWidthMm}mm ' +
          contentHeightMm.toFixed(2) +
          'mm !important; margin: 0 !important; } }';
        document.head.appendChild(dynamicPageStyle);
      }
      async function waitImages() {
        const imgs = Array.from(document.images || []);
        if (!imgs.length) return;
        await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())));
      }
      (async function run() {
        try { await waitImages(); } catch {}
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            computeAndInjectPageSize();
            ${autoPrint ? `
            window.focus();
            setTimeout(() => {
              window.print();
              ${autoClose ? 'setTimeout(() => { try { window.close(); } catch {} }, 400);' : ''}
            }, 240);` : ''}
          });
        });
      })();
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let printFrameEl: HTMLIFrameElement | null = null;

function getPrintFrame() {
  if (printFrameEl && document.body.contains(printFrameEl)) return printFrameEl;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'POS chek chop etish');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);
  printFrameEl = iframe;
  return iframe;
}

export function printPosReceipt(
  receipt: PosReceiptData,
  shopName: string,
  paperWidthMm: 58 | 80 = 58,
): boolean {
  const mobile = isMobilePosDevice();
  const html = buildPosReceiptHtml(receipt, shopName, paperWidthMm, { autoPrint: !mobile, autoClose: false });

  if (mobile) {
    const iframe = getPrintFrame();
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return false;
    doc.open();
    doc.write(html);
    doc.close();
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      return true;
    } catch {
      return false;
    }
  }

  const popupWidth = paperWidthMm === 58 ? 280 : 360;
  const printWindow = window.open('', '_blank', `width=${popupWidth},height=900`);
  if (!printWindow) return false;
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return true;
  } catch {
    try {
      printWindow.close();
    } catch {
      // ignore
    }
    return false;
  }
}

export async function downloadPosReceiptPdf(receipt: PosReceiptData, shopName: string) {
  const { jsPDF } = await import('jspdf');
  const created = new Date(receipt.createdAt);
  const payLabel = receipt.payMethod === 'cash' ? 'Naqd' : 'Karta';
  const width = 58;
  const lineH = 4;
  const margin = 2;
  const estHeight = Math.max(
    40,
    28 + receipt.items.length * 8 + 24,
  );
  const doc = new jsPDF({ unit: 'mm', format: [width, estHeight], orientation: 'portrait' });
  let y = margin + 2;

  const center = (text: string, size = 8, bold = false) => {
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, width / 2, y, { align: 'center', maxWidth: width - margin * 2 });
    y += lineH;
  };

  const row = (left: string, right: string, bold = false) => {
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.text(left, margin, y, { maxWidth: width * 0.62 });
    doc.text(right, width - margin, y, { align: 'right', maxWidth: width * 0.38 });
    y += lineH;
  };

  center(shopName || "Do'kon", 9, true);
  center('Savdo cheki (POS)', 7);
  center('--------------------------------', 7);
  row('Chek:', receipt.saleId.slice(0, 18));
  row('Sana:', created.toLocaleDateString('uz-UZ'));
  row('Vaqt:', created.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }));
  row("To'lov:", payLabel);
  center('--------------------------------', 7);

  for (const it of receipt.items) {
    const name = it.name.length > 28 ? `${it.name.slice(0, 27)}…` : it.name;
    center(name, 7, true);
    row(`${it.qty} x ${it.priceUzs.toLocaleString('uz-UZ')}`, `${it.totalUzs.toLocaleString('uz-UZ')}`);
    y += 1;
  }

  center('--------------------------------', 7);
  row('Subtotal:', `${receipt.subtotalUzs.toLocaleString('uz-UZ')}`);
  row('Chegirma:', `${receipt.discountUzs.toLocaleString('uz-UZ')}`);
  row('JAMI:', `${receipt.totalUzs.toLocaleString('uz-UZ')}`, true);
  y += 2;
  center('Rahmat!', 8, true);

  doc.save(`chek-${receipt.saleId.slice(0, 12)}.pdf`);
}

export async function sharePosReceiptPdf(receipt: PosReceiptData, shopName: string) {
  if (!navigator.share) return false;
  const { jsPDF } = await import('jspdf');
  const created = new Date(receipt.createdAt);
  const width = 58;
  const estHeight = Math.max(40, 28 + receipt.items.length * 8 + 24);
  const doc = new jsPDF({ unit: 'mm', format: [width, estHeight], orientation: 'portrait' });
  let y = 4;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(shopName || "Do'kon", width / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`Chek: ${receipt.saleId}`, 2, y);
  y += 4;
  doc.text(created.toLocaleString('uz-UZ'), 2, y);
  y += 4;
  doc.text(`JAMI: ${receipt.totalUzs.toLocaleString('uz-UZ')} so'm`, 2, y);
  const blob = doc.output('blob');
  const file = new File([blob], `chek-${receipt.saleId.slice(0, 12)}.pdf`, { type: 'application/pdf' });
  await navigator.share({
    title: `Chek ${receipt.saleId}`,
    text: `${shopName} — ${formatPosUzs(receipt.totalUzs)}`,
    files: [file],
  });
  return true;
}

export type PosReceiptDispatchResult = {
  mode: 'escpos' | 'browser_print' | 'preview';
  success: boolean;
};

export function dispatchPosReceiptAfterSale(opts: {
  receipt: PosReceiptData;
  shopName: string;
  posPrinterReady: boolean;
  printEscpos: (receipt: PosReceiptData) => Promise<void>;
}): PosReceiptDispatchResult {
  const { receipt, shopName, posPrinterReady, printEscpos } = opts;
  const mobile = isMobilePosDevice();

  if (posPrinterReady) {
    void printEscpos(receipt);
    return { mode: 'escpos', success: true };
  }

  if (mobile) {
    return { mode: 'preview', success: true };
  }

  const ok = printPosReceipt(receipt, shopName, 58);
  return { mode: 'browser_print', success: ok };
}
