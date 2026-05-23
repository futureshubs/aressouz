import { useState } from 'react';
import { Download, Loader2, Printer, Share2, X, Bluetooth } from 'lucide-react';
import { toast } from 'sonner';
import {
  type PosReceiptData,
  formatPosUzs,
  downloadPosReceiptPdf,
  printPosReceipt,
  sharePosReceiptPdf,
} from '../../utils/posReceipt';

type Props = {
  receipt: PosReceiptData;
  shopName: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  posPrinterReady: boolean;
  onPrintEscpos: () => void | Promise<void>;
  onClose: () => void;
  autoOpened?: boolean;
};

const PAY_LABEL = { cash: 'Naqd', card: 'Karta' } as const;

export default function SellerReceiptModal({
  receipt,
  shopName,
  isDark,
  accentColor,
  posPrinterReady,
  onPrintEscpos,
  onClose,
  autoOpened,
}: Props) {
  const [busy, setBusy] = useState<'print' | 'pdf' | 'share' | 'escpos' | null>(null);
  const created = new Date(receipt.createdAt);
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const cardBg = isDark ? '#111' : '#fff';

  const run = async (kind: 'print' | 'pdf' | 'share' | 'escpos', fn: () => void | Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 app-safe-pad z-[150] flex items-end sm:items-center justify-center p-3 sm:p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div
        className="w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
        style={{ background: isDark ? '#0a0a0a' : '#ffffff', borderColor: border }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: border }}>
          <div>
            <h3 className="font-bold text-lg">Chek tayyor</h3>
            {autoOpened ? (
              <p className="text-xs mt-0.5 opacity-70">Sotuv muvaffaqiyatli yakunlandi</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          <div
            id="seller-pos-receipt-preview"
            className="mx-auto rounded-xl border p-4 font-mono text-[11px] leading-snug"
            style={{
              maxWidth: '58mm',
              background: '#fff',
              color: '#000',
              borderColor: 'rgba(0,0,0,0.15)',
            }}
          >
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
              <div className="font-bold text-sm">{shopName || "Do'kon"}</div>
              <div className="text-[10px] opacity-80">Savdo cheki (POS)</div>
            </div>
            <div className="space-y-0.5 border-b border-dashed border-black pb-2 mb-2">
              <div className="flex justify-between gap-2"><span>Chek №</span><strong className="truncate">{receipt.saleId.slice(0, 16)}</strong></div>
              <div className="flex justify-between gap-2"><span>Sana</span><span>{created.toLocaleDateString('uz-UZ')}</span></div>
              <div className="flex justify-between gap-2"><span>Vaqt</span><span>{created.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span></div>
              <div className="flex justify-between gap-2"><span>To'lov</span><span>{PAY_LABEL[receipt.payMethod]}</span></div>
            </div>
            <div className="space-y-2 border-b border-dashed border-black pb-2 mb-2">
              {receipt.items.map((it, idx) => (
                <div key={idx}>
                  <div className="font-bold break-words">{it.name}</div>
                  <div className="flex justify-between opacity-85">
                    <span>{it.qty} × {it.priceUzs.toLocaleString('uz-UZ')}</span>
                    <span>{it.totalUzs.toLocaleString('uz-UZ')}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{receipt.subtotalUzs.toLocaleString('uz-UZ')}</span></div>
              <div className="flex justify-between"><span>Chegirma</span><span>{receipt.discountUzs.toLocaleString('uz-UZ')}</span></div>
              <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
                <span>JAMI</span>
                <span>{formatPosUzs(receipt.totalUzs)}</span>
              </div>
            </div>
            <div className="text-center mt-3 text-[10px]">Rahmat!</div>
          </div>
        </div>

        <div className="p-4 border-t shrink-0 space-y-2" style={{ borderColor: border, background: cardBg }}>
          <div className="grid grid-cols-2 gap-2">
            <ActionBtn
              icon={Printer}
              label="Chop etish"
              busy={busy === 'print'}
              onClick={() => run('print', () => {
                const ok = printPosReceipt(receipt, shopName, 58);
                if (!ok) throw new Error('Chop etish ochilmadi');
              })}
              gradient={accentColor.gradient}
            />
            <ActionBtn
              icon={Download}
              label="PDF yuklab olish"
              busy={busy === 'pdf'}
              onClick={() => run('pdf', () => downloadPosReceiptPdf(receipt, shopName))}
              isDark={isDark}
              border={border}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {typeof navigator !== 'undefined' && 'share' in navigator ? (
              <ActionBtn
                icon={Share2}
                label="Ulashish"
                busy={busy === 'share'}
                onClick={() => run('share', async () => {
                  const ok = await sharePosReceiptPdf(receipt, shopName);
                  if (!ok) throw new Error('Ulashish qo‘llab-quvvatlanmaydi');
                })}
                isDark={isDark}
                border={border}
              />
            ) : null}
            {'serial' in navigator ? (
              <ActionBtn
                icon={Bluetooth}
                label={posPrinterReady ? 'POS printer' : 'Printer yo‘q'}
                busy={busy === 'escpos'}
                disabled={!posPrinterReady}
                onClick={() => run('escpos', onPrintEscpos)}
                isDark={isDark}
                border={border}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  busy,
  disabled,
  gradient,
  isDark,
  border,
}: {
  icon: typeof Printer;
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  gradient?: string;
  isDark?: boolean;
  border?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-45"
      style={
        gradient
          ? { background: gradient, color: '#fff' }
          : {
              background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              border: `1px solid ${border}`,
              color: isDark ? '#fff' : '#111',
            }
      }
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}
