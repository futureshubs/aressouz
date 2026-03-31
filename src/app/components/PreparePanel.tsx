// Preparer Panel - For preparing market and rental orders
// Tayyorlovchi paneli - Market va Ijara buyurtmalarini tayyorlash uchun

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { 
  Package, CheckCircle, Clock,
  XCircle, Phone, MapPin, RefreshCw,
  User, Moon, Sun, Check, Scan, BarChart3, Award,
  TrendingUp, Activity, DollarSign, BriefcaseBusiness
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

interface PreparerInfo {
  id: string;
  name: string;
  phone: string;
  zones: string[];
  region: string;
  district: string;
  workTime: string;
}

/** Filial naqd qabul qilmaguncha tayyorlovchi ro‘yxatidan yashirib turish (server bilan bir xil mantiq). */
function shouldHideMarketCashBeforeBranchAccept(order: {
  orderType?: string;
  type?: string;
  paymentMethod?: string;
  payment_method?: string;
  releasedToPreparerAt?: string;
}): boolean {
  const ot = String(order.orderType || order.type || '').toLowerCase();
  if (ot !== 'market') return false;
  if (order.releasedToPreparerAt) return false;
  const raw = String(order.paymentMethod ?? order.payment_method ?? '')
    .toLowerCase()
    .trim();
  if (!raw) return false;
  const c = raw.replace(/\s+/g, '');
  if (c === 'cash' || c === 'naqd' || c === 'naqdpul') return true;
  if (raw.includes('naqd') || raw.includes('naqt')) return true;
  if (raw.includes('cash')) return true;
  return false;
}

interface Order {
  id: string;
  orderNumber: string;
  orderType?: string;
  type?: string;
  paymentMethod?: string;
  payment_method?: string;
  releasedToPreparerAt?: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    id?: string;
    name?: string;
    title?: string;
    quantity?: number;
    barcode?: string;
    sku?: string;
    rasta?: string;
    rackNumber?: string;
    image?: string;
    imageUrl?: string;
    productImage?: string;
    photo?: string;
    photos?: string[];
  }>;
  totalAmount: number;
  deliveryPrice: number;
  finalTotal: number;
  paymentStatus: string;
  address: any;
  deliveryZone: string;
  status: string;
  createdAt: string;
  statusHistory?: any[];
  branchId?: string;
  preparedBagId?: string;
  preparedBagNumber?: string;
  preparedBagCode?: string;
}

type ReadyBagOption = {
  id: string;
  name: string;
  number: string;
  status?: string;
};

interface PreparePanelProps {
  token: string;
  preparer: PreparerInfo;
  onLogout: () => void;
}

type MainTabType = 'orders' | 'stats' | 'profile';
type OrderTabType = 'new' | 'preparing' | 'ready' | 'cancelled';

type SwipeConfirmProps = {
  label: string;
  isDark: boolean;
  gradient: string;
  disabled?: boolean;
  onConfirm: () => void;
};

function SwipeConfirm({ label, isDark, gradient, disabled = false, onConfirm }: SwipeConfirmProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [startDragX, setStartDragX] = useState(0);
  const knobSize = 42;

  const maxDrag = () => {
    const width = trackRef.current?.clientWidth || 0;
    return Math.max(0, width - knobSize - 6);
  };

  const begin = (clientX: number) => {
    if (disabled) return;
    setDragging(true);
    setStartX(clientX);
    setStartDragX(dragX);
  };

  const move = (clientX: number) => {
    if (!dragging || disabled) return;
    const next = Math.max(0, Math.min(maxDrag(), startDragX + (clientX - startX)));
    setDragX(next);
  };

  const end = () => {
    if (!dragging) return;
    const max = maxDrag();
    const confirmed = max > 0 && dragX >= max * 0.82;
    setDragging(false);
    if (confirmed) {
      setDragX(max);
      onConfirm();
      window.setTimeout(() => setDragX(0), 400);
      return;
    }
    setDragX(0);
  };

  return (
    <div
      ref={trackRef}
      className="relative h-12 rounded-2xl overflow-hidden select-none"
      style={{
        background: disabled
          ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
          : gradient,
      }}
      onPointerMove={(e) => move(e.clientX)}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold text-white">{label}</span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => begin(e.clientX)}
        className="absolute top-[3px] left-[3px] w-[42px] h-[42px] rounded-xl flex items-center justify-center border"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 160ms ease',
          background: 'rgba(255,255,255,0.92)',
          borderColor: 'rgba(0,0,0,0.08)',
          touchAction: 'none',
        }}
        aria-label={label}
      >
        <Check className="w-5 h-5" style={{ color: '#2563eb' }} />
      </button>
    </div>
  );
}

export default function PreparePanel({ token, preparer, onLogout }: PreparePanelProps) {
  const { theme, toggleTheme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827';
  const mutedTextColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('orders');
  const [activeOrderTab, setActiveOrderTab] = useState<OrderTabType>('new');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanQueue, setScanQueue] = useState<Array<{
    itemName: string;
    barcode: string;
    sku: string;
    imageUrl: string;
    sourceIndex: number;
    pieceNumber: number;
    totalPieces: number;
  }>>([]);
  const [scanIndex, setScanIndex] = useState(0);
  const scanBusyRef = useRef(false);
  const [scanHistory, setScanHistory] = useState<Array<{
    code: string;
    itemName: string;
    ok: boolean;
    expectedBarcode: string;
    expectedSku: string;
    at: string;
  }>>([]);
  const [scanStatus, setScanStatus] = useState<{ type: 'idle' | 'ok' | 'error'; text: string }>({ type: 'idle', text: '' });
  const [orderPickedCounts, setOrderPickedCounts] = useState<Record<string, Record<number, number>>>({});
  const [readyBagModalOrder, setReadyBagModalOrder] = useState<Order | null>(null);
  const [readyBagOptions, setReadyBagOptions] = useState<ReadyBagOption[]>([]);
  const [selectedReadyBagId, setSelectedReadyBagId] = useState('');
  const [loadingReadyBags, setLoadingReadyBags] = useState(false);
  const [submittingReady, setSubmittingReady] = useState(false);

  useEffect(() => {
    loadOrders();
    // Refresh every 15 seconds
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async (retryCount = 0) => {
    try {
      setIsLoading(true);
      
      console.log('🔍 Loading orders for preparer:', preparer);
      console.log('🔍 Preparer ID:', preparer.id);
      console.log('🔍 Retry count:', retryCount);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers/${preparer.id}/orders`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Orders data received:', data);
        const allowedOrders = (data.orders || []).filter((order: Order) => {
          if (shouldHideMarketCashBeforeBranchAccept(order)) return false;
          const t = String(order.orderType || order.type || 'market').toLowerCase();
          return t === 'market' || t === 'rental';
        });
        const dedupedOrders = Array.from(
          new Map(allowedOrders.map((order: Order) => [order.id, order])).values()
        );
        setOrders(dedupedOrders);
        setIsLoading(false);
      } else {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        
        // Retry up to 3 times with exponential backoff
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`⚠️ Retrying in ${delay}ms... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => loadOrders(retryCount + 1), delay);
        } else {
          toast.error('Buyurtmalarni yuklashda xatolik. Sahifani yangilang.');
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('❌ Load orders error:', error);
      
      // Retry up to 3 times
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`⚠️ Retrying in ${delay}ms... (attempt ${retryCount + 1}/3)`);
        setTimeout(() => loadOrders(retryCount + 1), delay);
      } else {
        toast.error('Internet aloqasida muammo. Sahifani yangilang.');
        setIsLoading(false);
      }
    }
  };

  useVisibilityRefetch(() => {
    void loadOrders(0);
  });

  const updateOrderStatus = async (
    orderId: string,
    newStatus: string,
    options?: { bagId?: string; rackId?: string },
    retryCount = 0,
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers/${preparer.id}/orders/${orderId}/status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: newStatus,
            ...(options?.bagId ? { bagId: options.bagId } : {}),
            ...(options?.rackId ? { rackId: options.rackId } : {}),
          }),
        }
      );

      if (response.ok) {
        toast.success('Status o\'zgartirildi ✅');
        if (newStatus === 'ready') {
          setReadyBagModalOrder(null);
          setReadyBagOptions([]);
          setSelectedReadyBagId('');
        }
        loadOrders();
        setSelectedOrder(null);
        return true;
      }
      const error = await response.json();

      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 500;
        console.log(`⚠️ Retrying status update in ${delay}ms...`);
        setTimeout(() => updateOrderStatus(orderId, newStatus, options, retryCount + 1), delay);
        return false;
      }
      toast.error(error.error || 'Status o\'zgartirishda xatolik');
      return false;
    } catch (error) {
      console.error('Update status error:', error);

      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 500;
        console.log(`⚠️ Retrying status update in ${delay}ms...`);
        setTimeout(() => updateOrderStatus(orderId, newStatus, options, retryCount + 1), delay);
        return false;
      }
      toast.error('Internet aloqasida muammo');
      return false;
    }
  };

  const acceptOrder = (order: Order) => {
    updateOrderStatus(order.id, 'preparing');
  };

  const openReadyBagModal = async (order: Order) => {
    if (!order.branchId) {
      toast.error('Buyurtmada filial ID yo‘q — admin/market sozlamalarini tekshiring');
      return;
    }
    setReadyBagModalOrder(order);
    setSelectedReadyBagId('');
    setReadyBagOptions([]);
    setLoadingReadyBags(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers/${preparer.id}/orders/${order.id}/pickup-racks`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Rastalarni yuklashda xatolik');
      }
      const bags = (data.racks || []) as ReadyBagOption[];
      setReadyBagOptions(bags);
      if (bags.length === 0) {
        toast.error('Filialda bo‘sh olib ketish rastasi yo‘q. Yangi rasta qo‘shing.');
      }
    } catch (error) {
      console.error('Ready bags load error:', error);
      toast.error(error instanceof Error ? error.message : 'Rastalarni yuklashda xatolik');
      setReadyBagModalOrder(null);
    } finally {
      setLoadingReadyBags(false);
    }
  };

  const closeReadyBagModal = () => {
    if (submittingReady) return;
    setReadyBagModalOrder(null);
    setReadyBagOptions([]);
    setSelectedReadyBagId('');
  };

  const confirmMarkReadyWithBag = async () => {
    if (!readyBagModalOrder || !selectedReadyBagId) {
      toast.error('Rastani tanlang');
      return;
    }
    setSubmittingReady(true);
    try {
      await updateOrderStatus(readyBagModalOrder.id, 'ready', { rackId: selectedReadyBagId });
    } finally {
      setSubmittingReady(false);
    }
  };

  const markCurrentPiecePicked = (current: {
    itemName: string;
    barcode: string;
    sku: string;
    imageUrl: string;
    sourceIndex: number;
    pieceNumber: number;
    totalPieces: number;
  }) => {
    const nextIndex = scanIndex + 1;
    if (selectedOrder?.id) {
      setOrderPickedCounts((prev) => {
        const currentMap = { ...(prev[selectedOrder.id] || {}) };
        const prevCount = currentMap[current.sourceIndex] || 0;
        currentMap[current.sourceIndex] = Math.min(current.totalPieces, prevCount + 1);
        return { ...prev, [selectedOrder.id]: currentMap };
      });
    }
    setScannedCode('');
    if (nextIndex >= scanQueue.length) {
      toast.success('Barcha mahsulotlar tekshirildi ✅');
      stopScanner();
      return true;
    }
    setScanIndex(nextIndex);
    return true;
  };

  const handleIncreaseCurrentItem = () => {
    const current = scanQueue[scanIndex];
    if (!current) return;
    setScanStatus({ type: 'ok', text: 'Qo‘lda +1 qo‘shildi' });
    setScanHistory((prev) => [
      {
        code: '+1',
        itemName: current.itemName,
        ok: true,
        expectedBarcode: current.barcode || '-',
        expectedSku: current.sku || '-',
        at: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev,
    ]);
    markCurrentPiecePicked(current);
  };

  const startScanner = async (orderArg?: Order) => {
    const orderToScan = orderArg || selectedOrder;
    if (!orderToScan) {
      toast.error('Avval buyurtmani tanlang');
      return;
    }
    setSelectedOrder(orderToScan);
    const queue = orderToScan.items.flatMap((item, idx) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      const barcode = String(item.barcode || '').trim();
      const sku = String(item.sku || item.rasta || item.rackNumber || '').trim();
      const itemName = String(item.name || item.title || `Mahsulot ${idx + 1}`);
      const imageUrl = String(
        item.image ||
        item.imageUrl ||
        item.productImage ||
        item.photo ||
        (Array.isArray(item.photos) ? item.photos[0] : '') ||
        ''
      ).trim();
      return Array.from({ length: qty }).map((_, pieceIdx) => ({
        itemName,
        barcode,
        sku,
        imageUrl,
        sourceIndex: idx,
        pieceNumber: pieceIdx + 1,
        totalPieces: qty,
      }));
    });
    setScanQueue(queue);
    setScanIndex(0);
    setScannedCode('');
    setScanHistory([]);
    setScanStatus({ type: 'idle', text: '' });
    setShowScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Kameraga kirishda xatolik');
      setShowScanner(false);
    }
  };

  const stopScanner = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowScanner(false);
    setScannedCode('');
    setScanQueue([]);
    setScanIndex(0);
  };

  const verifyBarcode = (code: string) => {
    const triggerScanFeedback = (ok: boolean) => {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ok ? 70 : [120, 60, 120]);
      }
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = ok ? 'sine' : 'square';
        oscillator.frequency.value = ok ? 920 : 320;
        gain.gain.value = 0.05;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + (ok ? 0.07 : 0.12));
      } catch {
        // ignore sound errors on restricted devices
      }
    };

    const normalized = String(code || '').trim().toLowerCase();
    if (!normalized) return false;
    const current = scanQueue[scanIndex];
    if (!current) {
      toast.error('Tekshiruv navbati topilmadi');
      return false;
    }
    const expectedBarcode = current.barcode.trim().toLowerCase();
    const expectedSku = current.sku.trim().toLowerCase();
    const matched = normalized === expectedBarcode || normalized === expectedSku;

    if (!matched) {
      setScanStatus({ type: 'error', text: 'Noto‘g‘ri kod' });
      setScanHistory((prev) => [
        {
          code: String(code || '').trim(),
          itemName: current.itemName,
          ok: false,
          expectedBarcode: current.barcode || '-',
          expectedSku: current.sku || '-',
          at: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prev,
      ]);
      triggerScanFeedback(false);
      toast.error(`❌ Noto'g'ri! Kutilgan: ${current.barcode || '-'} / ${current.sku || '-'}`);
      return false;
    }

    setScanStatus({ type: 'ok', text: 'To‘g‘ri' });
    setScanHistory((prev) => [
      {
        code: String(code || '').trim(),
        itemName: current.itemName,
        ok: true,
        expectedBarcode: current.barcode || '-',
        expectedSku: current.sku || '-',
        at: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev,
    ]);
    triggerScanFeedback(true);
    toast.success(
      `✅ To'g'ri! ${current.itemName} (${current.pieceNumber}/${current.totalPieces})`
    );
    return markCurrentPiecePicked(current);
  };

  useEffect(() => {
    if (!showScanner) return;
    let cancelled = false;
    const DetectorCtor = (window as unknown as { BarcodeDetector?: new (opts?: unknown) => { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!DetectorCtor) {
      return;
    }
    const detector = new DetectorCtor({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf'],
    });

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || scanBusyRef.current || scanQueue.length === 0) {
        window.requestAnimationFrame(() => { void tick(); });
        return;
      }
      try {
        const codes = await detector.detect(video);
        const raw = String(codes?.[0]?.rawValue || '').trim();
        if (raw) {
          scanBusyRef.current = true;
          verifyBarcode(raw);
          window.setTimeout(() => {
            scanBusyRef.current = false;
          }, 500);
        }
      } catch {
        // ignore intermittent detector errors
      }
      window.requestAnimationFrame(() => { void tick(); });
    };
    void tick();

    return () => {
      cancelled = true;
      scanBusyRef.current = false;
    };
  }, [showScanner, scanQueue, scanIndex]);

  const isOrderCancelledTab = (st: string) => {
    const s = String(st || '').toLowerCase().trim();
    return s === 'cancelled' || s === 'canceled';
  };

  // Filter orders by tab
  const filteredOrders = orders.filter(order => {
    if (activeOrderTab === 'new') return order.status === 'new';
    if (activeOrderTab === 'preparing') return order.status === 'preparing';
    if (activeOrderTab === 'ready') return order.status === 'ready' || order.status === 'with_courier';
    if (activeOrderTab === 'cancelled') return isOrderCancelledTab(order.status);
    return false;
  });

  const orderTabConfig = {
    new: { label: 'Yangi', icon: Package, color: '#3b82f6', count: orders.filter(o => o.status === 'new').length },
    preparing: { label: 'Tayyorlanmoqda', icon: Clock, color: '#f59e0b', count: orders.filter(o => o.status === 'preparing').length },
    ready: { label: 'Tayyor', icon: CheckCircle, color: '#10b981', count: orders.filter(o => o.status === 'ready' || o.status === 'with_courier').length },
    cancelled: { label: 'Bekor', icon: XCircle, color: '#ef4444', count: orders.filter(o => isOrderCancelledTab(o.status)).length },
  };

  // Calculate statistics
  const stats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    ready: orders.filter(o => o.status === 'ready' || o.status === 'with_courier').length,
    cancelled: orders.filter(o => isOrderCancelledTab(o.status)).length,
    totalRevenue: orders.reduce((sum, o) => sum + o.finalTotal, 0),
  };

  return (
    <div 
      className="min-h-screen pb-24"
      style={{
        background: isDark ? '#000' : '#f5f5f5',
        color: textColor,
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="p-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Tayyorlovchi Panel</h1>
              <p className="text-sm" style={{ color: mutedTextColor }}>
                {preparer.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadOrders}
                className="p-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: `${accentColor.color}20`,
                }}
              >
                {isDark ? (
                  <Sun className="w-5 h-5" style={{ color: accentColor.color }} />
                ) : (
                  <Moon className="w-5 h-5" style={{ color: accentColor.color }} />
                )}
              </button>
            </div>
          </div>

          {/* Order Sub-Tabs (only show when in orders tab) */}
          {activeMainTab === 'orders' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(orderTabConfig).map(([key, config]) => {
                const Icon = config.icon;
                const isActive = activeOrderTab === key;
                
                return (
                  <button
                    key={key}
                    onClick={() => setActiveOrderTab(key as OrderTabType)}
                    className="p-2.5 rounded-2xl transition-all active:scale-95"
                    style={{
                      background: isActive 
                        ? `linear-gradient(135deg, ${config.color}30, ${config.color}20)` 
                        : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
                      borderWidth: '2px',
                      borderColor: isActive ? config.color : 'transparent',
                    }}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isActive ? config.color : `${config.color}30`,
                          }}
                        >
                          <Icon className="w-4 h-4" style={{ color: isActive ? '#fff' : config.color }} />
                        </div>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                          style={{
                            background: isActive ? config.color : `${config.color}20`,
                            color: isActive ? '#fff' : config.color,
                          }}
                        >
                          {config.count}
                        </div>
                      </div>
                      <span className="font-bold text-xs truncate w-full text-center" style={{ color: isActive ? config.color : 'inherit' }}>
                        {config.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 pb-24">
        {/* Orders Tab */}
        {activeMainTab === 'orders' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: accentColor.color }} />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <Package className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} />
                <p className="text-lg font-semibold mb-2">Buyurtmalar yo'q</p>
                <p style={{ color: mutedTextColor }}>
                  {orderTabConfig[activeOrderTab].label} bo'limida buyurtmalar yo'q
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredOrders.map(order => {
                  const config = orderTabConfig[activeOrderTab];
                  const Icon = config.icon;
                  const pickedMap = orderPickedCounts[order.id] || {};
                  const collectedTotal = order.items.reduce((sum, item, idx) => sum + Math.min(Number(item.quantity || 1), pickedMap[idx] || 0), 0);
                  const requiredTotal = order.items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
                  const progressPercent = requiredTotal > 0 ? Math.round((collectedTotal / requiredTotal) * 100) : 0;
                  
                  return (
                    <div
                      key={order.id}
                      className="rounded-3xl border overflow-hidden transition-all hover:scale-[1.02]"
                      style={{
                        background: isDark 
                          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)' 
                          : 'linear-gradient(135deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.01) 100%)',
                        borderColor: `${config.color}50`,
                        boxShadow: isDark 
                          ? `0 8px 32px ${config.color}20` 
                          : `0 8px 32px ${config.color}15`,
                      }}
                    >
                      {/* Order Header */}
                      <div 
                        className="p-4"
                        style={{
                          background: `linear-gradient(135deg, ${config.color}40, ${config.color}20)`,
                          borderBottom: `2px solid ${config.color}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-14 h-14 rounded-2xl flex items-center justify-center"
                              style={{ 
                                background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)',
                              }}
                            >
                              <Icon className="w-7 h-7" style={{ color: config.color }} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold">{order.orderNumber}</h3>
                              <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                                {new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div
                            className="px-4 py-2 rounded-xl font-bold text-sm"
                            style={{
                              background: config.color,
                              color: '#fff',
                            }}
                          >
                            {config.label}
                          </div>
                        </div>
                      </div>

                      {/* Order Body */}
                      <div className="p-4 space-y-4">
                        {/* Customer Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                            <span className="font-semibold">{order.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                            <a href={`tel:${order.customerPhone}`} className="font-medium" style={{ color: accentColor.color }}>
                              {order.customerPhone}
                            </a>
                          </div>
                          {order.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 mt-0.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                              <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(17, 24, 39, 0.7)' }}>
                                {typeof order.address === 'string' 
                                  ? order.address 
                                  : order.address.street || JSON.stringify(order.address)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Items */}
                        <div className="p-3 rounded-2xl border" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold">Mahsulotlar ({order.items.length} ta)</p>
                            <p className="text-sm" style={{ color: mutedTextColor }}>{collectedTotal}/{requiredTotal} yig‘ildi</p>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {order.items.map((item: any, index: number) => {
                              const qty = Math.max(1, Number(item.quantity || 1));
                              const pickedQty = Math.min(qty, pickedMap[index] || 0);
                              const done = pickedQty >= qty;
                              const itemImage = item.image || item.imageUrl || item.productImage || item.photo || (Array.isArray(item.photos) ? item.photos[0] : '');
                              return (
                                <div key={index} className="rounded-2xl p-2.5 border flex items-center gap-2.5" style={{ borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)' }}>
                                  <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: isDark ? '#141414' : '#f3f4f6' }}>
                                    {itemImage ? (
                                      <img src={String(itemImage)} alt={item.name || item.title || 'item'} className="w-full h-full object-cover" />
                                    ) : (
                                      <Package className="w-6 h-6" style={{ color: accentColor.color }} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{item.name || item.title}</p>
                                    <p className="text-sm" style={{ color: mutedTextColor }}>Miqdor: {pickedQty}/{qty} dona</p>
                                    <p className="text-xs" style={{ color: accentColor.color }}>📍 {item.sku || item.rasta || item.rackNumber || '-'}</p>
                                  </div>
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: done ? 'rgba(16,185,129,0.2)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') }}>
                                    {done ? <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} /> : <Scan className="w-4 h-4" style={{ color: mutedTextColor }} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3">
                            <div className="h-2 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                              <div className="h-2 rounded-full transition-all" style={{ width: `${progressPercent}%`, background: accentColor.gradient }} />
                            </div>
                          </div>
                        </div>

                        {/* Total */}
                        <div
                          className="p-4 rounded-2xl"
                          style={{
                            background: `linear-gradient(135deg, ${accentColor.color}20, ${accentColor.color}10)`,
                            border: `2px solid ${accentColor.color}40`,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg">Jami:</span>
                            <span className="text-2xl font-bold" style={{ color: accentColor.color }}>
                              {order.finalTotal.toLocaleString()} so'm
                            </span>
                          </div>
                        </div>

                        {(order.preparedBagCode || order.preparedBagNumber) && (
                          <div
                            className="flex items-start gap-3 p-3 rounded-2xl"
                            style={{
                              background: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                            }}
                          >
                            <BriefcaseBusiness className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#d97706' }}>
                                Qadoqlangan so‘mka
                              </p>
                              <p className="font-bold" style={{ color: textColor }}>
                                #{order.preparedBagNumber || '—'} {order.preparedBagCode ? `· ${order.preparedBagCode}` : ''}
                              </p>
                              <p className="text-xs mt-1" style={{ color: mutedTextColor }}>
                                Kuryer aynan shu so‘mkada buyurtmani olib ketadi
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {activeOrderTab === 'new' && (
                          <SwipeConfirm
                            label="Surib qabul qiling"
                            isDark={isDark}
                            gradient={`linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`}
                            onConfirm={() => acceptOrder(order)}
                          />
                        )}

                        {activeOrderTab === 'preparing' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                startScanner(order);
                              }}
                              className="py-3 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                              style={{
                                background: accentColor.gradient,
                                color: '#fff',
                              }}
                            >
                              <Scan className="w-5 h-5" />
                              Yig‘ishni boshlash
                            </button>
                            <button
                              onClick={() => openReadyBagModal(order)}
                              className="py-3 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                              style={{
                                background: `linear-gradient(135deg, ${orderTabConfig.ready.color}, ${orderTabConfig.ready.color}dd)`,
                                color: '#fff',
                                boxShadow: `0 4px 16px ${orderTabConfig.ready.color}40`,
                              }}
                            >
                              <CheckCircle className="w-5 h-5" />
                              Tayyor + rasta
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Stats Tab */}
        {activeMainTab === 'stats' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: accentColor.color }} />
                <h2 className="text-xl font-bold">Statistika</h2>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: accentColor.color }} />
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Umumiy
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Jami buyurtmalar
                  </p>
                </div>
                <p className="text-2xl font-bold" style={{ color: accentColor.color }}>
                  {stats.total}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Tayyor
                  </p>
                </div>
                <p className="text-2xl font-bold" style={{ color: accentColor.color }}>
                  {stats.ready}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Tayyorlanmoqda
                  </p>
                </div>
                <p className="text-2xl font-bold" style={{ color: accentColor.color }}>
                  {stats.preparing}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Bekor qilingan
                  </p>
                </div>
                <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>
                  {stats.cancelled}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Daromad
                  </p>
                </div>
                <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                  {stats.totalRevenue.toLocaleString()} so'm
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeMainTab === 'profile' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5" style={{ color: accentColor.color }} />
                <h2 className="text-xl font-bold">Profil</h2>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" style={{ color: accentColor.color }} />
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Ma'lumotlar
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Ism
                  </p>
                </div>
                <p className="text-xl font-bold" style={{ color: accentColor.color }}>
                  {preparer.name}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Telefon
                  </p>
                </div>
                <p className="text-xl font-bold" style={{ color: accentColor.color }}>
                  {preparer.phone}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Hudud
                  </p>
                </div>
                <p className="text-xl font-bold" style={{ color: accentColor.color }}>
                  {preparer.region}, {preparer.district}
                </p>
              </div>
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5" style={{ color: accentColor.color }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Ish vaqti
                  </p>
                </div>
                <p className="text-xl font-bold" style={{ color: accentColor.color }}>
                  {preparer.workTime}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tayyor + so'mka tanlash */}
      {readyBagModalOrder && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={closeReadyBagModal}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-3xl border p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              color: textColor,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ready-bag-title"
          >
            <h2 id="ready-bag-title" className="text-xl font-bold mb-1">
              Olib ketish rastasini tanlang
            </h2>
            <p className="text-sm mb-4" style={{ color: mutedTextColor }}>
              Buyurtma <strong>{readyBagModalOrder.orderNumber}</strong> qaysi olib ketish rastasiga qo‘yiladi?
            </p>

            {loadingReadyBags ? (
              <div className="py-10 text-center" style={{ color: mutedTextColor }}>
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" style={{ color: accentColor.color }} />
                Rastalar yuklanmoqda...
              </div>
            ) : readyBagOptions.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: mutedTextColor }}>
                Bo‘sh kuryer so‘mkalari topilmadi.
              </p>
            ) : (
              <div className="space-y-3 mb-6">
                {readyBagOptions.map((bag) => (
                  <label
                    key={bag.id}
                    className="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all"
                    style={{
                      borderColor:
                        selectedReadyBagId === bag.id
                          ? accentColor.color
                          : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.08)',
                      background:
                        selectedReadyBagId === bag.id
                          ? isDark
                            ? `${accentColor.color}18`
                            : `${accentColor.color}12`
                          : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="ready-bag"
                      className="sr-only"
                      checked={selectedReadyBagId === bag.id}
                      onChange={() => setSelectedReadyBagId(bag.id)}
                    />
                    <BriefcaseBusiness className="w-6 h-6 flex-shrink-0" style={{ color: accentColor.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold">
                        Rasta #{bag.number}{' '}
                        <span className="font-normal opacity-80">({bag.name})</span>
                      </p>
                      <p className="text-sm" style={{ color: mutedTextColor }}>
                        Holati: {bag.status || 'available'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeReadyBagModal}
                disabled={submittingReady}
                className="flex-1 py-3 rounded-2xl font-semibold border"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  opacity: submittingReady ? 0.6 : 1,
                }}
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={confirmMarkReadyWithBag}
                disabled={submittingReady || !selectedReadyBagId || loadingReadyBags}
                className="flex-1 py-3 rounded-2xl font-semibold text-white"
                style={{
                  background: accentColor.gradient,
                  opacity: submittingReady || !selectedReadyBagId || loadingReadyBags ? 0.5 : 1,
                }}
              >
                {submittingReady ? 'Saqlanmoqda...' : 'Tayyor deb belgilash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ background: 'rgba(0, 0, 0, 0.95)' }}
          onClick={stopScanner}
        >
          <div className="min-h-screen px-4 flex items-center justify-center">
            <div
              className="w-full max-w-2xl rounded-3xl p-6"
              style={{
                background: isDark ? '#0a0a0a' : '#ffffff',
                color: textColor,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 rounded-2xl p-4 flex items-center justify-between" style={{ background: accentColor.gradient, color: '#fff' }}>
                <div>
                  <h2 className="text-2xl font-bold">Mahsulotni skanerlash</h2>
                  <p className="text-sm opacity-90">{scanQueue[scanIndex]?.itemName || selectedOrder?.orderNumber}</p>
                </div>
                <button
                  onClick={stopScanner}
                  className="p-2 rounded-xl transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.24)' }}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div
                  className="p-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: `${accentColor.color}66`,
                  }}
                >
                  <p className="text-sm font-semibold mb-2">
                    Tekshiruv: {Math.min(scanIndex + 1, Math.max(1, scanQueue.length))}/{Math.max(1, scanQueue.length)}
                  </p>
                  {scanStatus.type !== 'idle' && (
                    <div
                      className="mb-2 px-3 py-2 rounded-xl text-sm font-semibold"
                      style={{
                        background: scanStatus.type === 'ok' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                        color: scanStatus.type === 'ok' ? '#10b981' : '#ef4444',
                      }}
                    >
                      {scanStatus.type === 'ok' ? '✅ To‘g‘ri' : '❌ Noto‘g‘ri'}
                    </div>
                  )}
                  {scanQueue.length > 0 ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                        {scanQueue[scanIndex]?.imageUrl ? (
                          <img
                            src={scanQueue[scanIndex].imageUrl}
                            alt={scanQueue[scanIndex].itemName}
                            className="w-full h-44 object-cover"
                          />
                        ) : (
                          <div className="w-full h-44 flex items-center justify-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                            <Package className="w-12 h-12" style={{ color: accentColor.color }} />
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl p-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff' }}>
                        <p className="text-xl font-extrabold leading-tight">{scanQueue[scanIndex]?.itemName}</p>
                        <div className="text-sm mt-2 space-y-1" style={{ color: mutedTextColor }}>
                          <p>Barcode: <span className="font-semibold">{scanQueue[scanIndex]?.barcode || '-'}</span></p>
                          <p>SKU/Rasta: <span className="font-semibold">{scanQueue[scanIndex]?.sku || '-'}</span></p>
                          <p>Dona: <span className="font-semibold">{scanQueue[scanIndex]?.pieceNumber || 1}/{scanQueue[scanIndex]?.totalPieces || 1}</span></p>
                        </div>
                        {!!scanQueue[scanIndex] && Number(scanQueue[scanIndex]?.totalPieces || 1) > 1 && (
                          <button
                            type="button"
                            onClick={handleIncreaseCurrentItem}
                            className="mt-3 w-full py-2.5 rounded-xl font-bold transition-all active:scale-[0.99]"
                            style={{
                              background: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)',
                              border: '1px solid rgba(59,130,246,0.35)',
                              color: '#2563eb',
                            }}
                          >
                            + 1 dona qo‘shish (mayda mahsulot)
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: mutedTextColor }}>
                      Buyurtmada tekshiriladigan mahsulot topilmadi
                    </p>
                  )}
                </div>

                <div
                  className="p-3 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <p className="text-sm font-semibold mb-2">Tekshiruv tarixi</p>
                  {scanHistory.length === 0 ? (
                    <p className="text-sm" style={{ color: mutedTextColor }}>Hali scan qilinmadi</p>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {scanHistory.slice(0, 8).map((entry, idx) => (
                        <div
                          key={`${entry.at}-${entry.code}-${idx}`}
                          className="rounded-xl px-2.5 py-2 text-sm"
                          style={{ background: entry.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{entry.ok ? '✅ To‘g‘ri' : '❌ Noto‘g‘ri'}</span>
                            <span style={{ color: mutedTextColor }}>{entry.at}</span>
                          </div>
                          <p>{entry.itemName}</p>
                          <p style={{ color: mutedTextColor }}>Scan: {entry.code}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-64 h-64 border-4 rounded-2xl"
                      style={{
                        borderColor: accentColor.color,
                        boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.5)`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Yoki qo'lda kiriting:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scannedCode}
                      onChange={(e) => setScannedCode(e.target.value)}
                      placeholder="Barcode..."
                      className="flex-1 px-4 py-3 rounded-xl border"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        color: textColor,
                      }}
                    />
                    <button
                      onClick={() => {
                        if (scannedCode && scanQueue.length > 0) {
                          verifyBarcode(scannedCode);
                        }
                      }}
                      className="px-6 py-3 rounded-xl font-bold transition-all active:scale-95"
                      style={{
                        background: accentColor.gradient,
                        color: '#fff',
                      }}
                    >
                      Tekshirish
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 border-t safe-area-pb"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%)' 
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.98) 100%)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(20px)',
          boxShadow: isDark 
            ? '0 -4px 24px rgba(0, 0, 0, 0.5)' 
            : '0 -4px 24px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center justify-around px-2 py-3">
          {/* Orders Tab */}
          <button
            onClick={() => setActiveMainTab('orders')}
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-300 active:scale-95"
            style={{
              background: activeMainTab === 'orders' 
                ? `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}20)` 
                : 'transparent',
            }}
          >
            <div 
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
              style={{
                background: activeMainTab === 'orders' 
                  ? accentColor.gradient 
                  : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                boxShadow: activeMainTab === 'orders' 
                  ? `0 4px 16px ${accentColor.color}40` 
                  : 'none',
              }}
            >
              <Package 
                className="w-5 h-5 transition-all duration-300" 
                style={{ 
                  color: activeMainTab === 'orders' ? '#fff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') 
                }} 
              />
              {stats.new > 0 && (
                <div 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: `2px solid ${isDark ? '#0a0a0a' : '#ffffff'}`,
                  }}
                >
                  {stats.new}
                </div>
              )}
            </div>
            <span 
              className="text-xs font-semibold transition-all duration-300"
              style={{ 
                color: activeMainTab === 'orders' 
                  ? accentColor.color 
                  : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') 
              }}
            >
              Buyurtmalar
            </span>
          </button>

          {/* Stats Tab */}
          <button
            onClick={() => setActiveMainTab('stats')}
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-300 active:scale-95"
            style={{
              background: activeMainTab === 'stats' 
                ? `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}20)` 
                : 'transparent',
            }}
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
              style={{
                background: activeMainTab === 'stats' 
                  ? accentColor.gradient 
                  : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                boxShadow: activeMainTab === 'stats' 
                  ? `0 4px 16px ${accentColor.color}40` 
                  : 'none',
              }}
            >
              <BarChart3 
                className="w-5 h-5 transition-all duration-300" 
                style={{ 
                  color: activeMainTab === 'stats' ? '#fff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') 
                }} 
              />
            </div>
            <span 
              className="text-xs font-semibold transition-all duration-300"
              style={{ 
                color: activeMainTab === 'stats' 
                  ? accentColor.color 
                  : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') 
              }}
            >
              Statistika
            </span>
          </button>

          {/* Profile Tab */}
          <button
            onClick={() => setActiveMainTab('profile')}
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-300 active:scale-95"
            style={{
              background: activeMainTab === 'profile' 
                ? `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}20)` 
                : 'transparent',
            }}
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
              style={{
                background: activeMainTab === 'profile' 
                  ? accentColor.gradient 
                  : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                boxShadow: activeMainTab === 'profile' 
                  ? `0 4px 16px ${accentColor.color}40` 
                  : 'none',
              }}
            >
              <User 
                className="w-5 h-5 transition-all duration-300" 
                style={{ 
                  color: activeMainTab === 'profile' ? '#fff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') 
                }} 
              />
            </div>
            <span 
              className="text-xs font-semibold transition-all duration-300"
              style={{ 
                color: activeMainTab === 'profile' 
                  ? accentColor.color 
                  : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') 
              }}
            >
              Profil
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}