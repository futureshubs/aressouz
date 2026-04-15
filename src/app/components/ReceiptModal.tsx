import { X, Printer, Download, CheckCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ReceiptItem {
  name: string;
  variant: string;
  quantity: number;
  price: number;
  total: number;
}

interface ReceiptData {
  receiptNumber: string;
  date: string;
  time: string;
  branch: string;
  items: ReceiptItem[];
  subtotal: number;
  total: number;
  paymentMethod: string;
  cashier: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

export function ReceiptModal({ isOpen, onClose, receipt }: ReceiptModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!receipt) return;

    const jsPDFMod = await import('jspdf');
    await import('jspdf-autotable');
    const JsPDF = (jsPDFMod as any).jsPDF || (jsPDFMod as any).default || jsPDFMod;

    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 297],
    });

    let y = 10;
    const leftMargin = 5;
    const rightMargin = 75;
    const centerX = 40;

    // ========== HEADER ==========
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ONLINE DO\'KON', centerX, y, { align: 'center' });
    y += 6;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.branch, centerX, y, { align: 'center' });
    y += 8;
    
    // Divider
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(leftMargin, y, rightMargin, y);
    y += 5;
    
    // ========== RECEIPT INFO ==========
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Chek raqami:', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${receipt.receiptNumber}`, rightMargin, y, { align: 'right' });
    y += 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Sana:', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.date, rightMargin, y, { align: 'right' });
    y += 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Vaqt:', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.time, rightMargin, y, { align: 'right' });
    y += 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Kassir:', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(receipt.cashier, rightMargin, y, { align: 'right' });
    y += 6;
    
    // Divider
    doc.line(leftMargin, y, rightMargin, y);
    y += 5;
    
    // ========== ITEMS HEADER ==========
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MAHSULOTLAR', centerX, y, { align: 'center' });
    y += 5;
    
    doc.line(leftMargin, y, rightMargin, y);
    y += 5;
    
    // ========== ITEMS ==========
    receipt.items.forEach((item, index) => {
      // Item name
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const itemNameLines = doc.splitTextToSize(item.name, 65);
      doc.text(itemNameLines, leftMargin, y);
      y += 5 * itemNameLines.length;
      
      // Variant
      if (item.variant && item.variant !== 'Standart') {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`Variant: ${item.variant}`, leftMargin + 2, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }
      
      // Price details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.price.toLocaleString()} so'm x ${item.quantity}`, leftMargin + 2, y);
      
      // Subtotal
      doc.setFont('helvetica', 'bold');
      doc.text(`${item.total.toLocaleString()} so'm`, rightMargin, y, { align: 'right' });
      y += 6;
      
      // Item divider
      if (index < receipt.items.length - 1) {
        doc.setLineWidth(0.1);
        doc.setDrawColor(200, 200, 200);
        doc.line(leftMargin + 2, y, rightMargin - 2, y);
        doc.setDrawColor(0, 0, 0);
        y += 4;
      }
    });
    
    y += 2;
    
    // ========== TOTAL DIVIDER ==========
    doc.setLineWidth(0.5);
    doc.line(leftMargin, y, rightMargin, y);
    y += 6;
    
    // ========== TOTAL ==========
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('JAMI:', leftMargin, y);
    doc.text(`${receipt.total.toLocaleString()} so'm`, rightMargin, y, { align: 'right' });
    y += 8;
    
    // ========== PAYMENT METHOD ==========
    doc.setLineWidth(0.3);
    doc.line(leftMargin, y, rightMargin, y);
    y += 5;
    
    const paymentMethodName = {
      cash: 'Naqd pul',
      card: 'Plastik karta',
      online: 'Onlayn to\'lov',
    }[receipt.paymentMethod] || receipt.paymentMethod;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('To\'lov usuli:', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(paymentMethodName, rightMargin, y, { align: 'right' });
    y += 6;
    
    // ========== FOOTER ==========
    doc.line(leftMargin, y, rightMargin, y);
    y += 6;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Xaridingiz uchun rahmat!', centerX, y, { align: 'center' });
    y += 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('www.aresso.app', centerX, y, { align: 'center' });
    y += 4;
    doc.text('Tel: +998 33 236 36 36', centerX, y, { align: 'center' });
    
    // Save PDF
    doc.save(`chek-${receipt.receiptNumber}.pdf`);
  };

  const paymentMethodName = {
    cash: 'Naqd pul',
    card: 'Plastik karta',
    online: 'Onlayn to\'lov',
  }[receipt.paymentMethod] || receipt.paymentMethod;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 app-safe-pad bg-black/60 backdrop-blur-sm z-[60] print:hidden"
        onClick={onClose}
      />

      {/* Receipt Modal */}
      <div 
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[61] print:relative print:top-0 print:left-0 print:transform-none print:max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-4 rounded-3xl border p-6 max-h-[90vh] overflow-y-auto print:rounded-none print:border-0 print:mx-0 print:max-h-none"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 print:hidden">
            <div className="flex items-center gap-3">
              <div 
                className="p-2.5 rounded-xl"
                style={{
                  background: `${accentColor.color}20`,
                }}
              >
                <CheckCircle className="w-6 h-6" style={{ color: accentColor.color }} />
              </div>
              <div>
                <h3 className="text-xl font-bold">To'lov muvaffaqiyatli!</h3>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Chek tayyor
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-all active:scale-90"
              style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Receipt Content */}
          <div 
            className="p-6 rounded-2xl border print:border-0 print:p-0"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Store Header */}
            <div className="text-center mb-6 pb-4 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <h2 className="text-2xl font-bold mb-1">ONLINE DO'KON</h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                {receipt.branch}
              </p>
            </div>

            {/* Receipt Info */}
            <div className="space-y-2 mb-4 pb-4 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Chek raqami:</span>
                <span className="font-semibold">#{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Sana:</span>
                <span className="font-semibold">{receipt.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Vaqt:</span>
                <span className="font-semibold">{receipt.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Kassir:</span>
                <span className="font-semibold">{receipt.cashier}</span>
              </div>
            </div>

            {/* Items */}
            <div className="mb-4 pb-4 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <h4 className="font-bold mb-3">Mahsulotlar:</h4>
              <div className="space-y-3">
                {receipt.items.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.name}</p>
                        {item.variant && (
                          <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                            {item.variant}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-bold">{item.total.toLocaleString()} so'm</p>
                        <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          {item.price.toLocaleString()} × {item.quantity}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="mb-4 pb-4 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">JAMI:</span>
                <span className="text-2xl font-bold" style={{ color: accentColor.color }}>
                  {receipt.total.toLocaleString()} so'm
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>To'lov usuli:</span>
                <span className="font-semibold">{paymentMethodName}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <p className="text-sm font-semibold mb-1">Xaridingiz uchun rahmat!</p>
              <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                www.aresso.app
              </p>
              <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                Tel: +998 33 236 36 36
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
              }}
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 4px 16px ${accentColor.color}40`,
              }}
            >
              <Download className="w-5 h-5" />
              PDF yuklab olish
            </button>
          </div>
        </div>
      </div>
    </>
  );
}