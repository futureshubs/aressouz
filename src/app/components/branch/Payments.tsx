import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Filter, 
  Search, 
  RefreshCw, 
  Download,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Smartphone,
  Wallet,
  Receipt,
  FileText,
  QrCode,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  Award,
  Users,
  ShoppingCart,
  Star,
  X,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '../../../../utils/supabase/info';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { compressImageIfNeeded, uploadFormDataWithProgress } from '../../utils/uploadWithProgress';
import { formatOrderNumber } from '../../utils/orderNumber';

interface Payment {
  id: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  orderType?: string;
  orderStatus?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  currency: string;
  method: 'cash' | 'card' | 'click' | 'payme' | 'uzum' | 'apelsin' | 'qr';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  type: 'payment' | 'refund';
  description: string;
  transactionId?: string;
  paymentGateway?: string;
  qrImageUrl?: string;
  paymentRequiresVerification?: boolean;
  receiptUrl?: string;
  paymentConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  refundedAt?: string;
  failureReason?: string;
  metadata: {
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    deliveryFee: number;
    serviceFee: number;
    discount: number;
    tax: number;
  };
  /** Do‘kon/taom buyurtmasi: mahsulot qatorlari bo‘yicha platforma ulushi (buyurtma yaratilganda snapshot) */
  platformCommissionTotalUzs?: number;
  merchantGoodsPayoutUzs?: number;
  commissionableItemsSubtotalUzs?: number;
}

interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  successRate: number;
  refundRate: number;
  paymentMethods: Array<{
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  dailyRevenue: Array<{
    date: string;
    amount: number;
    transactions: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    amount: number;
    transactions: number;
  }>;
}

interface PaymentsProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
  /** Kassa: faqat navbatdagi to‘lovlar, yengil UI */
  variant?: 'full' | 'cashier';
}

export function Payments({ branchId, branchInfo, variant = 'full' }: PaymentsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? DEV_API_BASE_URL
    : API_BASE_URL;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30days'); // 7days, 30days, 90days
  const [statusCategory, setStatusCategory] = useState<
    'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'
  >('all');
  const [typeCategory, setTypeCategory] = useState<
    'all' | 'market' | 'shop' | 'food' | 'rental' | 'other'
  >('all');
  const [showDetails, setShowDetails] = useState<Payment | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPdfLoading, setReportPdfLoading] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [receiptUploadPct, setReceiptUploadPct] = useState(0);
  const [searchDebounced, setSearchDebounced] = useState('');
  const [cashierReceiptFile, setCashierReceiptFile] = useState<File | null>(null);
  const [cashierReceiptPreview, setCashierReceiptPreview] = useState<string | null>(null);
  const cashierFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(searchTerm.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const loadPayments = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) setIsLoading(true);

      const params = new URLSearchParams({
        branchId,
        dateRange: variant === 'cashier' ? '30days' : dateRange,
      });
      if (variant !== 'cashier') {
        if (searchDebounced) params.set('search', searchDebounced);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (methodFilter !== 'all') params.set('method', methodFilter);
      }
      const branchToken = getStoredBranchToken();
      if (branchToken) {
        params.set('branchToken', branchToken);
      }

      const response = await fetch(
        `${apiBaseUrl}/payments?${params}`,
        {
          headers: {
            ...buildBranchHeaders({ 'Content-Type': 'application/json' }),
          },
        }
      );

      if (!response.ok) {
        setPayments([]);
        setStats(null);
        console.error('❌ Payments API response not ok:', response.status, response.statusText);
        if (!silent) toast.error('To‘lovlarni yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setPayments(data.payments);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('❌ Error loading payments:', error);
      if (!silent) toast.error('To\'lovlarni yuklashda xatolik');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [apiBaseUrl, branchId, dateRange, methodFilter, searchDebounced, statusFilter, variant]);

  useVisibilityRefetch(() => {
    void loadPayments({ silent: true });
  });

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    const ms = variant === 'cashier' ? 25000 : 15000;
    const t = window.setInterval(() => {
      void loadPayments({ silent: true });
    }, ms);
    return () => window.clearInterval(t);
  }, [loadPayments, variant]);

  useEffect(() => {
    if (variant !== 'cashier') return;
    setCashierReceiptFile(null);
    setCashierReceiptPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (cashierFileInputRef.current) cashierFileInputRef.current.value = '';
  }, [variant, showDetails?.id]);

  useEffect(() => {
    if (variant !== 'cashier' || !showDetails) return;
    const cur = payments.find((x) => x.id === showDetails.id);
    if (!cur || cur.receiptUrl || cur.status === 'completed') {
      setShowDetails(null);
    }
  }, [variant, payments, showDetails?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'processing': return '#3b82f6';
      case 'failed': return '#ef4444';
      case 'refunded': return '#8b5cf6';
      case 'cancelled': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const isFoodLike = (raw?: string) => {
    const t = String(raw || '').toLowerCase().trim();
    return t === 'food' || t === 'restaurant' || t.includes('restaurant');
  };
  const isShopLike = (raw?: string) => String(raw || '').toLowerCase().trim() === 'shop';
  const isFoodOrShopMerchantOrder = (p: Payment) => isFoodLike(p.orderType) || isShopLike(p.orderType);
  const isAcceptedLike = (raw?: string) => {
    const s = String(raw || '').toLowerCase().trim();
    if (!s) return false;
    return (
      s === 'accepted' ||
      s === 'confirmed' ||
      s.includes('accept') ||
      s.includes('confirm') ||
      s.includes('qabul')
    );
  };

  /**
   * Taom: restoran / Do‘kon: seller panel qabul qilmaguncha — kassada to‘lov QR chiqmasligi kerak.
   * Qabul qilingach `mapOrderToPaymentUIStatus` → processing bo‘ladi, QR ochiladi.
   */
  const isAwaitingMerchantAcceptance = (p: Payment): boolean => {
    if (!isFoodOrShopMerchantOrder(p)) return false;
    const st = String(p.status || '').toLowerCase().trim();
    const os = String(p.orderStatus || '').toLowerCase().trim();
    if (st === 'processing' || st === 'completed') return false;
    if (isAcceptedLike(p.orderStatus)) return false;
    if (['preparing', 'ready', 'with_courier', 'delivering', 'delivered'].includes(os)) return false;
    if (['cancelled', 'canceled', 'rejected'].includes(os)) return false;
    if (os === 'pending' || os === 'new' || !os) return st === 'pending';
    return false;
  };

  const canShowCashierMerchantQrForOrder = (p: Payment): boolean => !isAwaitingMerchantAcceptance(p);

  /** Kassa: mijoz QR orqali to‘lashi va chek kutilayotgan buyurtmalar */
  const isCashierQrQueuePayment = (p: Payment): boolean => {
    if (p.type !== 'payment') return false;
    const st = String(p.status || '').toLowerCase().trim();
    if (st !== 'pending' && st !== 'processing') return false;
    if (!p.qrImageUrl || p.receiptUrl) return false;
    if (!canShowCashierMerchantQrForOrder(p)) return false;
    const m = String(p.method || '').toLowerCase().trim();
    return Boolean(p.paymentRequiresVerification) || m === 'qr';
  };

  const getCourierDeliveryFee = (payment: Payment) => Number(payment.metadata?.deliveryFee) || 0;

  // Cashier should NOT collect courier delivery fee.
  const getPayableAmount = (payment: Payment) => {
    const direct = Number(payment.amount) || 0;
    if (direct > 0) return direct;
    const itemsSubtotal = (payment.metadata?.items || []).reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );
    const serviceFee = Number(payment.metadata?.serviceFee) || 0;
    const tax = Number(payment.metadata?.tax) || 0;
    const discount = Number(payment.metadata?.discount) || 0;
    return Math.max(0, itemsSubtotal + serviceFee + tax - discount);
  };

  const getPaymentStatusText = (payment: Payment) => {
    const status = String(payment.status || '').toLowerCase().trim();
    const os = String(payment.orderStatus || '').toLowerCase().trim();
    // Taom / do‘kon: qabul holati alohida ko‘rsatiladi.
    if (isFoodOrShopMerchantOrder(payment) && isAcceptedLike(payment.orderStatus)) {
      return 'Qabul qilindi';
    }
    if (isFoodOrShopMerchantOrder(payment) && status === 'processing') {
      if (['preparing', 'ready', 'with_courier', 'delivering'].includes(os)) {
        return 'Jarayonda';
      }
      return 'Qabul qilindi';
    }
    if (status === 'pending' && isAwaitingMerchantAcceptance(payment)) {
      return 'Qabul qilinmagan';
    }
    switch (status) {
      case 'completed': return 'Muvaffaqiyatli';
      case 'pending': return 'Kutilmoqda';
      case 'processing': return 'Qayta ishlash';
      case 'failed': return 'Xatolik';
      case 'refunded': return 'Qaytarildi';
      case 'cancelled': return 'Bekor qilindi';
      default: return status;
    }
  };

  const getStatusCategoryKey = (payment: Payment) => {
    const base = String(payment.status || '').toLowerCase().trim();
    if (isFoodOrShopMerchantOrder(payment) && (isAcceptedLike(payment.orderStatus) || base === 'processing')) {
      return 'processing';
    }
    return base;
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return DollarSign;
      case 'card': return CreditCard;
      case 'click': return Smartphone;
      case 'payme': return Wallet;
      case 'uzum': return ShoppingCart;
      case 'apelsin': return ShoppingCart;
      case 'qr': return QrCode;
      default: return CreditCard;
    }
  };

  const getMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Naqd pul';
      case 'card': return 'Karta';
      case 'click': return 'Click';
      case 'payme': return 'Payme';
      case 'uzum': return 'Uzum';
      case 'apelsin': return 'Apelsin';
      case 'qr': return 'QR';
      default: return method;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: accentColor.color }} />
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            To\'lovlar yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'cashier') {
    const qrQueue = payments.filter(isCashierQrQueuePayment);
    const waitingMerchant = payments.filter(
      (p) =>
        p.type === 'payment' &&
        (p.status === 'pending' || p.status === 'processing') &&
        isAwaitingMerchantAcceptance(p),
    );

    const submitCashierReceipt = async () => {
      if (!showDetails || !cashierReceiptFile) {
        toast.error('Avval chek rasmini tanlang');
        return;
      }
      try {
        setConfirmingReceipt(true);
        setReceiptUploadPct(0);
        const compressed = await compressImageIfNeeded(cashierReceiptFile);
        const fd = new FormData();
        fd.append('file', compressed);
        const { data: uploadData, status: uploadStatus } = await uploadFormDataWithProgress<{
          url?: string;
          error?: string;
        }>({
          url: `${apiBaseUrl}/public/upload`,
          formData: fd,
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          onProgress: (pct) => setReceiptUploadPct(pct),
        });
        if (uploadStatus < 200 || uploadStatus >= 300 || !uploadData?.url) {
          toast.error(uploadData?.error || 'Rasm yuklashda xatolik');
          return;
        }
        const confirmResp = await fetch(
          `${apiBaseUrl}/orders/${encodeURIComponent(showDetails.orderId)}/confirm-receipt`,
          {
            method: 'POST',
            headers: { ...buildBranchHeaders({ 'Content-Type': 'application/json' }) },
            body: JSON.stringify({ receiptImageUrl: uploadData.url }),
          },
        );
        const confirmData = await confirmResp.json().catch(() => ({}));
        if (!confirmResp.ok || !confirmData?.success) {
          toast.error(confirmData?.error || 'To‘lovni tasdiqlashda xatolik');
          return;
        }
        toast.success('To‘lov qabul qilindi');
        setShowDetails(null);
        await loadPayments({ silent: true });
      } catch (err) {
        console.error(err);
        toast.error('Chek yuborishda xatolik');
      } finally {
        setConfirmingReceipt(false);
        setReceiptUploadPct(0);
      }
    };

    return (
      <div className="space-y-4 min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">To‘lov kutilmoqda</h2>
            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' }}>
              Faqat kassa QR va chek talab qilinadigan buyurtmalar
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPayments()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shrink-0 disabled:opacity-50"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            }}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Yangilash
          </button>
        </div>

        {qrQueue.length === 0 ? (
          <div
            className="rounded-2xl border p-8 text-center text-sm"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            }}
          >
            Hozircha navbatdagi to‘lov yo‘q
          </div>
        ) : (
          <div className="max-h-[min(70dvh,640px)] space-y-3 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
            {qrQueue.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{formatOrderNumber(p.orderNumber, p.orderId)}</p>
                  <p className="text-sm truncate" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>
                    {p.customerName} · {p.customerPhone}
                  </p>
                  <p className="mt-1 font-semibold" style={{ color: accentColor.color }}>
                    {formatCurrency(getPayableAmount(p))}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
                  >
                    To‘lov kutilmoqda
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDetails(p)}
                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-white"
                    style={{ background: accentColor.gradient }}
                  >
                    To‘lov qilish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {waitingMerchant.length > 0 ? (
          <details
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <summary className="cursor-pointer font-semibold">
              Sotuvchi / restoran qabuli kutilmoqda ({waitingMerchant.length})
            </summary>
            <ul className="mt-2 space-y-1 opacity-90">
              {waitingMerchant.slice(0, 12).map((p) => (
                <li key={p.id} className="truncate">
                  {formatOrderNumber(p.orderNumber, p.orderId)} — {p.customerName}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {showDetails &&
          isCashierQrQueuePayment(showDetails) &&
          (showDetails.status === 'pending' || showDetails.status === 'processing') &&
          Boolean(showDetails.qrImageUrl) &&
          !showDetails.receiptUrl && (
            <div
              className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
              onClick={() => setShowDetails(null)}
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="To‘lov — QR va chek"
                className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
                style={{
                  background: isDark ? '#161616' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b px-4 py-3 shrink-0" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{formatOrderNumber(showDetails.orderNumber, showDetails.orderId)}</p>
                    <p className="text-xs truncate opacity-70">{showDetails.customerName}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border p-2"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    }}
                    onClick={() => setShowDetails(null)}
                    aria-label="Yopish"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 space-y-4">
                  <p className="text-center text-lg font-bold" style={{ color: accentColor.color }}>
                    {formatCurrency(getPayableAmount(showDetails))}
                  </p>
                  {(Number(showDetails.platformCommissionTotalUzs) || 0) > 0 ? (
                    <div
                      className="rounded-xl border px-3 py-2 text-sm space-y-1"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      }}
                    >
                      <p className="font-semibold text-xs opacity-80">Kassa: mahsulot bo‘yicha taqsimot</p>
                      <div className="flex justify-between gap-2">
                        <span className="opacity-75">Mijoz to‘laydi (jami)</span>
                        <span className="font-medium tabular-nums">{formatCurrency(getPayableAmount(showDetails))}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="opacity-75">Platforma ulushi (%)</span>
                        <span className="font-medium tabular-nums text-amber-500">
                          {formatCurrency(Number(showDetails.platformCommissionTotalUzs) || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="opacity-75">Sotuvchi/restoranga (mahsulot)</span>
                        <span className="font-medium tabular-nums text-emerald-500">
                          {formatCurrency(Number(showDetails.merchantGoodsPayoutUzs) || 0)}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-55 pt-1">
                        Yetkazish va boshqa yig‘indilar alohida; foiz faqat belgilangan mahsulot qatorlari narxiga qo‘llanadi.
                      </p>
                    </div>
                  ) : null}
                  <div className="flex justify-center rounded-2xl border p-3 bg-white/5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                    <img
                      src={showDetails.qrImageUrl}
                      alt="To‘lov QR"
                      className="h-56 w-56 max-w-full object-contain sm:h-64 sm:w-64"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Chek rasmi (yuklang)</p>
                    <input
                      ref={cashierFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={confirmingReceipt}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setCashierReceiptFile(file);
                        setCashierReceiptPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return URL.createObjectURL(file);
                        });
                      }}
                    />
                    <button
                      type="button"
                      disabled={confirmingReceipt}
                      onClick={() => cashierFileInputRef.current?.click()}
                      className="w-full rounded-xl border py-3 text-sm font-semibold"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      }}
                    >
                      {cashierReceiptFile ? 'Boshqa rasm tanlash' : 'Chek tanlash'}
                    </button>
                    {cashierReceiptPreview ? (
                      <img
                        src={cashierReceiptPreview}
                        alt="Tanlangan chek"
                        className="mt-3 max-h-48 w-full rounded-xl object-contain border"
                        style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                      />
                    ) : null}
                  </div>
                  {confirmingReceipt ? (
                    <div>
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}>
                        <div
                          className="h-full transition-all"
                          style={{ width: `${Math.max(5, receiptUploadPct)}%`, background: accentColor.color }}
                        />
                      </div>
                      <p className="mt-1 text-xs opacity-70">Yuklanmoqda: {receiptUploadPct}%</p>
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 border-t p-4" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                  <button
                    type="button"
                    disabled={confirmingReceipt || !cashierReceiptFile}
                    onClick={() => void submitCashierReceipt()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white disabled:opacity-45"
                    style={{ background: accentColor.gradient }}
                  >
                    <Send className="h-5 w-5" />
                    Yuborish — to‘lov qabul qilindi
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    );
  }

  const normalizeOrderType = (raw?: string) => String(raw || '').toLowerCase().trim();
  const resolvedTypeCategory = (payment: Payment) => {
    const t = normalizeOrderType(payment.orderType);
    if (t.includes('market')) return 'market';
    if (t.includes('shop')) return 'shop';
    if (t.includes('food') || t.includes('restaurant')) return 'food';
    if (t.includes('rental')) return 'rental';
    if (!t) return 'other';
    return 'other';
  };

  const statusCounts = payments.reduce(
    (acc, p) => {
      const s = getStatusCategoryKey(p);
      acc.all += 1;
      if (s === 'pending') acc.pending += 1;
      else if (s === 'processing') acc.processing += 1;
      else if (s === 'completed') acc.completed += 1;
      else if (s === 'failed') acc.failed += 1;
      else if (s === 'cancelled') acc.cancelled += 1;
      else if (s === 'refunded') acc.refunded += 1;
      return acc;
    },
    { all: 0, pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, refunded: 0 },
  );

  const typeCounts = payments.reduce(
    (acc, p) => {
      const k = resolvedTypeCategory(p);
      acc.all += 1;
      acc[k] += 1;
      return acc;
    },
    { all: 0, market: 0, shop: 0, food: 0, rental: 0, other: 0 } as Record<
      'all' | 'market' | 'shop' | 'food' | 'rental' | 'other',
      number
    >,
  );

  const visiblePayments = payments.filter((payment) => {
    if (statusCategory !== 'all' && getStatusCategoryKey(payment) !== statusCategory) return false;
    const t = resolvedTypeCategory(payment);
    if (typeCategory !== 'all' && t !== typeCategory) return false;
    return true;
  });

  const dateRangeLabel =
    dateRange === '7days'
      ? 'So‘nggi 7 kun'
      : dateRange === '90days'
        ? 'So‘nggi 90 kun'
        : 'So‘nggi 30 kun';

  const escapeCsvCell = (v: string | number | undefined | null) => {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const reportCompletedTotal = visiblePayments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const downloadPaymentsReportCsv = () => {
    if (visiblePayments.length === 0) {
      toast.error('Hisobot uchun qatorlar yo‘q — filtrlarni tekshiring');
      return;
    }
    const headers = [
      'Sana',
      'Buyurtma',
      'Buyurtma turi',
      'Mijoz',
      'Telefon',
      'Summa',
      'Valyuta',
      'To‘lov usuli',
      'Holat',
      'Operatsiya turi',
      'Tavsif',
    ];
    const lines = [
      headers.join(','),
      ...visiblePayments.map((p) =>
        [
          p.createdAt,
          formatOrderNumber(p.orderNumber, p.orderId),
          p.orderType || '',
          p.customerName,
          p.customerPhone,
          p.amount,
          p.currency,
          getMethodText(p.method),
          getPaymentStatusText(p),
          p.type,
          (p.description || '').replace(/\s+/g, ' ').trim(),
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];
    const csv = `\uFEFF${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kassa-hisobot-${String(branchId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32)}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV fayl yuklandi');
  };

  const downloadPaymentsReportPdf = async () => {
    if (visiblePayments.length === 0) {
      toast.error('Hisobot uchun qatorlar yo‘q — filtrlarni tekshiring');
      return;
    }
    setReportPdfLoading(true);
    try {
      const jsPDFMod = await import('jspdf');
      const autoTableMod = await import('jspdf-autotable');
      const JsPDF = (jsPDFMod as any).jsPDF || (jsPDFMod as any).default || jsPDFMod;
      const autoTable = (autoTableMod as any).default || autoTableMod;

      const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(18);
      doc.text("To'lovlar hisoboti (kassa)", 14, 16);

      doc.setFontSize(10);
      let metaY = 24;
      doc.text(`Vaqt oralig'i: ${dateRangeLabel}`, 14, metaY);
      metaY += 6;
      if (branchInfo?.region || branchInfo?.district) {
        doc.text(
          `Hudud: ${[branchInfo.region, branchInfo.district].filter(Boolean).join(', ')}`,
          14,
          metaY,
        );
        metaY += 6;
      }
      doc.text(`Yuklangan: ${new Date().toLocaleString('uz-UZ')}`, 14, metaY);
      metaY += 6;
      doc.text(`Filtrlangan qatorlar: ${visiblePayments.length}`, 14, metaY);
      metaY += 6;
      doc.text(`Yakunlangan tushum (filtr): ${formatCurrency(reportCompletedTotal)}`, 14, metaY);
      metaY += 10;

      const tableData = visiblePayments.map((p) => [
        formatDate(p.createdAt),
        formatOrderNumber(p.orderNumber, p.orderId),
        String(p.orderType || '—'),
        String(p.customerName || '—').slice(0, 42),
        String(p.customerPhone || '—'),
        formatCurrency(Number(p.amount) || 0),
        getMethodText(p.method),
        getPaymentStatusText(p),
        p.type === 'refund' ? 'Qaytarish' : "To'lov",
      ]);

      autoTable(doc, {
        head: [['Sana', 'Buyurtma', 'Tur', 'Mijoz', 'Telefon', 'Summa', "To'lov usuli", 'Holat', 'Operatsiya']],
        body: tableData,
        startY: metaY,
        styles: { font: 'helvetica', fontSize: 8 },
        headStyles: { fillColor: [20, 184, 166] },
        columnStyles: {
          0: { cellWidth: 34 },
          1: { cellWidth: 22 },
          2: { cellWidth: 18 },
          3: { cellWidth: 30 },
          4: { cellWidth: 26 },
          5: { cellWidth: 28 },
          6: { cellWidth: 22 },
          7: { cellWidth: 26 },
          8: { cellWidth: 20 },
        },
      });

      doc.save(
        `kassa-hisobot-${String(branchId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32)}-${Date.now()}.pdf`,
      );
      toast.success('PDF yuklandi');
    } catch (e) {
      console.error('Payments PDF export:', e);
      toast.error('PDF yaratishda xatolik');
    } finally {
      setReportPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">To'lovlar tarixi</h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Filial to\'lovlarini boshqarish va kuzatish
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-lg"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <Download className="w-4 h-4" />
            Hisobot
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            className="p-6 rounded-2xl border transition-all hover:shadow-lg"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div 
                className="p-3 rounded-xl"
                style={{ background: `${accentColor.color}20` }}
              >
                <DollarSign className="w-6 h-6" style={{ color: accentColor.color }} />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-green-500">
                <ArrowUpRight className="w-4 h-4" />
                12.5%
              </div>
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ 
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' 
            }}>
              Jami daromad
            </h3>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          </div>

          <div 
            className="p-6 rounded-2xl border transition-all hover:shadow-lg"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div 
                className="p-3 rounded-xl"
                style={{ background: '#3b82f620' }}
              >
                <BarChart3 className="w-6 h-6" style={{ color: '#3b82f6' }} />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-green-500">
                <ArrowUpRight className="w-4 h-4" />
                8.3%
              </div>
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ 
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' 
            }}>
              Tranzaksiyalar
            </h3>
            <p className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</p>
          </div>

          <div 
            className="p-6 rounded-2xl border transition-all hover:shadow-lg"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div 
                className="p-3 rounded-xl"
                style={{ background: '#10b98120' }}
              >
                <Target className="w-6 h-6" style={{ color: '#10b981' }} />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-green-500">
                <ArrowUpRight className="w-4 h-4" />
                5.2%
              </div>
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ 
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' 
            }}>
              Muvaffaqiyat darajasi
            </h3>
            <p className="text-2xl font-bold">{stats.successRate}%</p>
          </div>

          <div 
            className="p-6 rounded-2xl border transition-all hover:shadow-lg"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div 
                className="p-3 rounded-xl"
                style={{ background: '#f59e0b20' }}
              >
                <Activity className="w-6 h-6" style={{ color: '#f59e0b' }} />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-red-500">
                <ArrowDownRight className="w-4 h-4" />
                2.1%
              </div>
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ 
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' 
            }}>
              Qaytarish darajasi
            </h3>
            <p className="text-2xl font-bold">{stats.refundRate}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} />
            <input
              type="text"
              placeholder="Buyurtma raqami yoki mijoz nomi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="all">Barcha holatlar</option>
          <option value="completed">Muvaffaqiyatli</option>
          <option value="pending">Kutilmoqda</option>
          <option value="processing">Qayta ishlash</option>
          <option value="failed">Xatolik</option>
          <option value="refunded">Qaytarildi</option>
          <option value="cancelled">Bekor qilindi</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="all">Barcha usullar</option>
          <option value="cash">Naqd pul</option>
          <option value="card">Karta</option>
          <option value="click">Click</option>
          <option value="payme">Payme</option>
          <option value="uzum">Uzum</option>
          <option value="apelsin">Apelsin</option>
          <option value="qr">QR</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="7days">Oxirgi 7 kun</option>
          <option value="30days">Oxirgi 30 kun</option>
          <option value="90days">Oxirgi 90 kun</option>
        </select>
        <button
          onClick={loadPayments}
          className="p-2 rounded-xl border transition-all hover:shadow-lg"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Payment Methods Chart */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div 
            className="p-6 rounded-2xl border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5" style={{ color: accentColor.color }} />
              To\'lov usullari
            </h3>
            <div className="space-y-3">
              {stats.paymentMethods.map((method, index) => {
                const MethodIcon = getMethodIcon(method.method);
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MethodIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                        <span className="font-medium">{getMethodText(method.method)}</span>
                      </div>
                      <div className="text-sm">
                        <span style={{ color: accentColor.color }}>{method.percentage}%</span>
                        <span className="ml-2" style={{ 
                          color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                        }}>
                          {method.count} ta
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${method.percentage}%`,
                          background: accentColor.gradient,
                        }}
                      />
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(method.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div 
            className="p-6 rounded-2xl border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: accentColor.color }} />
              Kunlik daromad
            </h3>
            <div className="space-y-3">
              {stats.dailyRevenue.map((day, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div>
                    <p className="font-medium">{new Date(day.date).toLocaleDateString('uz-UZ', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="text-sm" style={{ 
                      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                    }}>
                      {day.transactions} tranzaksiya
                    </p>
                  </div>
                  <p className="font-bold" style={{ color: accentColor.color }}>
                    {formatCurrency(day.amount).split(' ')[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div 
        className="rounded-2xl border overflow-hidden"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Categories (must be right before orders table) */}
        <div
          className="p-4 border-b space-y-3"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          }}
        >
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'Barchasi', count: statusCounts.all },
                  { key: 'pending', label: 'Kutilmoqda', count: statusCounts.pending },
                  { key: 'processing', label: typeCategory === 'food' ? 'Qabul qilingan' : 'Jarayonda', count: statusCounts.processing },
              { key: 'completed', label: 'To‘langan', count: statusCounts.completed },
              { key: 'failed', label: 'Xatolik', count: statusCounts.failed },
              { key: 'cancelled', label: 'Bekor', count: statusCounts.cancelled },
              { key: 'refunded', label: 'Qaytarildi', count: statusCounts.refunded },
            ] as const).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setStatusCategory(cat.key)}
                className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
                style={{
                  background:
                    statusCategory === cat.key
                      ? accentColor.gradient
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)',
                  color: statusCategory === cat.key ? '#fff' : (isDark ? 'rgba(255,255,255,0.8)' : '#111827'),
                  borderColor:
                    statusCategory === cat.key
                      ? 'transparent'
                      : isDark
                        ? 'rgba(255,255,255,0.10)'
                        : 'rgba(0,0,0,0.08)',
                }}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'Hamma turlar', count: typeCounts.all },
              { key: 'market', label: 'Market', count: typeCounts.market },
              { key: 'shop', label: 'Do‘kon', count: typeCounts.shop },
              { key: 'food', label: 'Taom', count: typeCounts.food },
              { key: 'rental', label: 'Ijara', count: typeCounts.rental },
              { key: 'other', label: 'Boshqa', count: typeCounts.other },
            ] as const).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setTypeCategory(cat.key)}
                className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
                style={{
                  background:
                    typeCategory === cat.key
                      ? `${accentColor.color}22`
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)',
                  color: typeCategory === cat.key ? accentColor.color : (isDark ? 'rgba(255,255,255,0.8)' : '#111827'),
                  borderColor:
                    typeCategory === cat.key
                      ? `${accentColor.color}55`
                      : isDark
                        ? 'rgba(255,255,255,0.10)'
                        : 'rgba(0,0,0,0.08)',
                }}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-hidden">
          <table className="w-full table-fixed">
            <thead style={{
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            }}>
              <tr>
                <th className="text-left p-3 font-medium w-[26%]">Buyurtma</th>
                <th className="text-left p-3 font-medium w-[20%]">Mijoz</th>
                <th className="text-left p-3 font-medium w-[12%]">Summa</th>
                <th className="text-left p-3 font-medium w-[11%]">Usul</th>
                <th className="text-left p-3 font-medium w-[13%]">Holat</th>
                <th className="text-left p-3 font-medium w-[12%]">Sana</th>
                <th className="text-left p-3 font-medium w-[6%]">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((payment) => {
                const MethodIcon = getMethodIcon(payment.method);
                const displayStatus = getStatusCategoryKey(payment);
                const StatusIcon = displayStatus === 'completed' ? CheckCircle : 
                                 displayStatus === 'failed' ? XCircle : 
                                 displayStatus === 'pending' ? Clock :
                                 displayStatus === 'processing' ? Activity : AlertCircle;
                
                return (
                  <tr key={payment.id} className="border-t transition-all hover:bg-opacity-5"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <td className="p-3 align-top">
                      <div className="min-w-0">
                        <p className="font-medium truncate" title={formatOrderNumber(payment.orderNumber, payment.orderId)}>
                          {formatOrderNumber(payment.orderNumber, payment.orderId)}
                        </p>
                        <p className="text-sm" style={{ 
                          color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                        }}>
                          {payment.description}
                        </p>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="min-w-0">
                        <p className="font-medium truncate" title={payment.customerName}>{payment.customerName}</p>
                        <p className="text-sm" style={{ 
                          color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                        }}>
                          {payment.customerPhone}
                        </p>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <p className="font-bold truncate" title={formatCurrency(getPayableAmount(payment))}>{formatCurrency(getPayableAmount(payment))}</p>
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        <MethodIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                        <span className="truncate">{getMethodText(payment.method)}</span>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        <StatusIcon className="w-4 h-4" style={{ color: getStatusColor(displayStatus) }} />
                        <span className="truncate" style={{ color: getStatusColor(displayStatus) }}>
                          {getPaymentStatusText(payment)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <p className="text-sm truncate" title={formatDate(payment.createdAt)}>{formatDate(payment.createdAt)}</p>
                    </td>
                    <td className="p-3 align-top">
                      <button
                        onClick={() => setShowDetails(payment)}
                        className="p-2 rounded-lg border transition-all hover:shadow-lg"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hisobot modal (kassa) */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReportOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setReportOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payments-report-title"
            className="w-full max-w-md rounded-2xl border p-6 shadow-xl"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="payments-report-title" className="text-xl font-bold">
                  To‘lovlar hisoboti
                </h2>
                <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                  Joriy filtrlar bo‘yicha ro‘yxat — PDF yoki CSV yuklab olish
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-lg border p-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                }}
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="mb-5 space-y-2 rounded-xl border p-4 text-sm"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex justify-between gap-2">
                <span style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>Vaqt oralig‘i</span>
                <span className="font-medium">{dateRangeLabel}</span>
              </div>
              {branchInfo?.region || branchInfo?.district ? (
                <div className="flex justify-between gap-2">
                  <span style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>Hudud</span>
                  <span className="text-right font-medium">
                    {[branchInfo.region, branchInfo.district].filter(Boolean).join(', ')}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <span style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>Filtrlangan qatorlar</span>
                <span className="font-bold">{visiblePayments.length}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>Yakunlangan tushum (filtr)</span>
                <span className="font-bold" style={{ color: accentColor.color }}>
                  {formatCurrency(reportCompletedTotal)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              >
                Yopish
              </button>
              <button
                type="button"
                onClick={() => downloadPaymentsReportCsv()}
                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              >
                <Download className="h-4 w-4" />
                CSV yuklab olish
              </button>
              <button
                type="button"
                disabled={reportPdfLoading}
                onClick={() => void downloadPaymentsReportPdf()}
                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{
                  background: accentColor.gradient,
                  borderColor: 'transparent',
                  color: '#ffffff',
                }}
              >
                <FileText className="h-4 w-4" />
                {reportPdfLoading ? 'PDF…' : 'PDF yuklab olish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal (filial / operator — to‘liq) */}
      {showDetails && variant === 'full' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            className="w-full max-w-2xl p-6 rounded-2xl max-h-[80vh] overflow-y-auto"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">To'lov tafsilotlari</h2>
              <button
                onClick={() => setShowDetails(null)}
                className="p-2 rounded-lg border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* QR + Receipt confirmation (merchant orders, non-market/non-rental) */}
              {(showDetails.status === 'pending' || showDetails.status === 'processing') &&
                Boolean(showDetails.qrImageUrl) &&
                !showDetails.receiptUrl &&
                (Boolean(showDetails.paymentRequiresVerification) ||
                  String(showDetails.method || '').toLowerCase().trim() === 'qr') &&
                // Taom / do‘kon: sotuvchi-restoran qabul qilgach — QR ko‘rsatiladi.
                canShowCashierMerchantQrForOrder(showDetails) && (
                  <div className="md:col-span-2">
                    <h3 className="font-semibold mb-3">To'lov kutulmoqda (QR)</h3>
                    <div className="p-4 rounded-2xl border"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                            QR mijoz tomonida skaner bo'lishi uchun.
                          </p>
                          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}>
                            Kassa chek rasmini yuklab tasdiqlaydi.
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold" style={{ color: accentColor.color }}>
                            {formatOrderNumber(showDetails.orderNumber, showDetails.orderId)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <img src={showDetails.qrImageUrl} alt="Payment QR" className="w-64 h-64 object-contain rounded-xl bg-white/5" />
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-semibold mb-2">Chek rasmini yuklang</p>
                        <label
                          className="block w-full rounded-xl border-2 border-dashed p-4 cursor-pointer transition-all"
                          style={{
                            borderColor: confirmingReceipt
                              ? accentColor.color
                              : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)'),
                            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                            opacity: confirmingReceipt ? 0.9 : 1,
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            disabled={confirmingReceipt}
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setConfirmingReceipt(true);
                                setReceiptUploadPct(0);

                                const compressed = await compressImageIfNeeded(file);
                                const fd = new FormData();
                                fd.append('file', compressed);

                                const { data: uploadData, status: uploadStatus } = await uploadFormDataWithProgress<{
                                  url?: string;
                                  error?: string;
                                }>({
                                  url: `${apiBaseUrl}/public/upload`,
                                  formData: fd,
                                  headers: {
                                    Authorization: `Bearer ${publicAnonKey}`,
                                  },
                                  onProgress: (pct) => setReceiptUploadPct(pct),
                                });

                                if (uploadStatus < 200 || uploadStatus >= 300 || !uploadData?.url) {
                                  toast.error(uploadData?.error || 'Rasm yuklashda xatolik');
                                  return;
                                }

                                const confirmResp = await fetch(
                                `${apiBaseUrl}/orders/${encodeURIComponent(showDetails.orderId)}/confirm-receipt`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      ...buildBranchHeaders({ 'Content-Type': 'application/json' }),
                                    },
                                    body: JSON.stringify({ receiptImageUrl: uploadData.url }),
                                  }
                                );

                                const confirmData = await confirmResp.json().catch(() => ({}));
                                if (!confirmResp.ok || !confirmData?.success) {
                                  toast.error(confirmData?.error || 'To\'lovni tasdiqlashda xatolik');
                                  return;
                                }

                                toast.success('Chek tasdiqlandi. Kuryerga chiqarildi.');
                                setShowDetails(null);
                                await loadPayments();
                              } catch (err) {
                                console.error('Receipt confirm error:', err);
                                toast.error('Chek tasdiqlashda xatolik');
                              } finally {
                                setConfirmingReceipt(false);
                                setReceiptUploadPct(0);
                                e.target.value = '';
                              }
                            }}
                          />
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                {confirmingReceipt ? 'Chek yuklanmoqda...' : 'Chek rasmini tanlang'}
                              </p>
                              <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                                PNG/JPG, yuklangandan so‘ng avtomatik tasdiqlanadi.
                              </p>
                            </div>
                            <span
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{
                                background: `${accentColor.color}22`,
                                color: accentColor.color,
                              }}
                            >
                              {confirmingReceipt ? 'Yuklanmoqda' : 'Fayl tanlash'}
                            </span>
                          </div>
                        </label>

                        {confirmingReceipt && (
                          <div className="mt-3">
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}>
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${Math.max(5, receiptUploadPct)}%`,
                                  background: accentColor.color,
                                }}
                              />
                            </div>
                            <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                              Yuklanmoqda: {receiptUploadPct}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* Taom / do‘kon: qabul bo‘lmaguncha QR yo‘q */}
              {isAwaitingMerchantAcceptance(showDetails) &&
                (showDetails.status === 'pending' || showDetails.status === 'processing') && (
                  <div className="md:col-span-2">
                    <div
                      className="p-4 rounded-2xl border"
                      style={{
                        background: isDark ? 'rgba(245, 158, 11, 0.10)' : 'rgba(245, 158, 11, 0.08)',
                        borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.28)',
                      }}
                    >
                      <p className="font-semibold text-sm" style={{ color: '#f59e0b' }}>Qabul qilinmagan</p>
                      <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                        {isShopLike(showDetails.orderType)
                          ? 'Seller panelida buyurtmani qabul qilgandan keyin QR kod kassa bo‘limida chiqadi.'
                          : 'Restoran buyurtmani qabul qilgandan keyin QR kod kassa bo‘limida chiqadi.'}
                      </p>
                    </div>
                  </div>
                )}

              {showDetails.receiptUrl && (
                <div className="md:col-span-2">
                  <div
                    className="p-4 rounded-2xl border"
                    style={{
                      background: isDark ? 'rgba(16, 185, 129, 0.10)' : 'rgba(16, 185, 129, 0.08)',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.28)',
                    }}
                  >
                    <p className="font-semibold text-sm text-green-500">To'lov tasdiqlangan</p>
                    <a
                      href={showDetails.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm underline mt-1 inline-block"
                      style={{ color: accentColor.color }}
                    >
                      Chek rasmini ko‘rish
                    </a>
                  </div>
                </div>
              )}
              {/* Basic Info */}
              <div>
                <h3 className="font-semibold mb-3">Asosiy ma'lumotlar</h3>
                <div className="space-y-2">
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Buyurtma raqami</p>
                    <p className="font-bold text-sm break-all">{formatOrderNumber(showDetails.orderNumber, showDetails.orderId)}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Mijoz</p>
                    <p className="font-bold text-sm break-words">{showDetails.customerName}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Telefon</p>
                    <p className="font-bold text-sm break-all">{showDetails.customerPhone}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>To'lov usuli</p>
                    <p className="font-bold text-sm">{getMethodText(showDetails.method)}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Holat</p>
                    <p className="font-bold text-sm" style={{ color: getStatusColor(showDetails.status) }}>
                      {getPaymentStatusText(showDetails)}
                    </p>
                  </div>
                  {showDetails.transactionId && (
                    <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Tranzaksiya ID</p>
                      <p className="font-bold text-sm break-all">{showDetails.transactionId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Info */}
              <div>
                <h3 className="font-semibold mb-3">Moliyaviy ma'lumotlar</h3>
                <div className="space-y-2">
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Jami summa</p>
                    <p className="font-bold text-sm break-words">{formatCurrency(getPayableAmount(showDetails))}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Mahsulotlar</p>
                    <p className="font-bold text-sm break-words">{formatCurrency(showDetails.metadata.items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Yetkazib berish (kuryerga)</p>
                    <p className="font-bold text-sm break-words">{formatCurrency(getCourierDeliveryFee(showDetails))}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Xizmat haqi</p>
                    <p className="font-bold text-sm break-words">{formatCurrency(showDetails.metadata.serviceFee)}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Chegirma</p>
                    <p className="font-bold text-sm text-green-500 break-words">-{formatCurrency(showDetails.metadata.discount)}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>Soliq</p>
                    <p className="font-bold text-sm break-words">{formatCurrency(showDetails.metadata.tax)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Mahsulotlar</h3>
              <div className="space-y-2">
                {showDetails.metadata.items.map((item, index) => (
                  <div key={index} className="flex justify-between p-3 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm" style={{ 
                        color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                      }}>
                        {item.quantity} ta × {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="font-bold">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamps */}
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Vaqt qaydlari</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Yaratilgan:</span>
                  <span className="font-bold">{formatDate(showDetails.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Yangilangan:</span>
                  <span className="font-bold">{formatDate(showDetails.updatedAt)}</span>
                </div>
                {showDetails.completedAt && (
                  <div className="flex justify-between">
                    <span>Bajarilgan:</span>
                    <span className="font-bold">{formatDate(showDetails.completedAt)}</span>
                  </div>
                )}
                {showDetails.refundedAt && (
                  <div className="flex justify-between">
                    <span>Qaytarilgan:</span>
                    <span className="font-bold">{formatDate(showDetails.refundedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {showDetails.failureReason && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Xatolik sababi</h3>
                <div className="p-3 rounded-xl bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20">
                  <p className="text-red-500">{showDetails.failureReason}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
