import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Package, 
  ShoppingBag, 
  Home, 
  Building2,
  UtensilsCrossed,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Eye,
  MoreVertical,
  MapPin,
  Phone,
  User,
  Calendar,
  DollarSign,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  FileText,
  Download,
  Printer,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Activity,
  Bell,
  Play,
  Pause,
  QrCode,
} from 'lucide-react';
import { projectId } from '../../../../utils/supabase/info';
import { buildAdminHeaders, buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { toast } from 'sonner';
import { PendingCashMarketBranchPanel } from '../branch/PendingCashMarketBranchPanel';

interface Order {
  id: string;
  orderId: string;
  type: 'market' | 'shop' | 'rental' | 'restaurant';
  status: 'new' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: any[];
  totalAmount: number;
  deliveryFee?: number;
  bonusUsed?: number;
  promoCode?: string;
  discount?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  branchId?: string;
  branchName?: string;
  deliveryTime?: string;
  paymentMethod?: string;
  paymentMethodType?: string;
  paymentProvider?: string;
  addressText?: string;
  finalTotal?: number;
  deliveryPrice?: number;
  deliveryZone?: string;
  orderNumber?: string;
  marketCashHold?: boolean;
  releasedToPreparerAt?: string;
  lineItemsSubtotal?: number;
  assignedCourierId?: string;
  assignedCourierName?: string;
  assignedCourierPhone?: string;
  courierWorkflowStatus?: string;
  courierAcceptedAt?: string;
}

interface OrdersManagementProps {
  branchId?: string;
  branchInfo?: {
    region: string;
    district: string;
    phone: string;
    paymentQrImage?: string;
  };
  type?: 'all' | 'market' | 'shop' | 'rental' | 'food';
  authMode?: 'admin' | 'branch';
  readOnly?: boolean;
  onPaymentRequired?: () => void;
  // Operator/support panelda bitta umumiy top-tab bo'lsa, ichki "order type" tablarini yashiramiz.
  hideTypeTabs?: boolean;
}

const buildOrderMutationHeaders = (
  authMode: OrdersManagementProps['authMode'],
  extra: Record<string, string> = {},
) =>
  authMode === 'branch'
    ? buildBranchHeaders({ 'Content-Type': 'application/json', ...extra })
    : buildAdminHeaders({ 'Content-Type': 'application/json', ...extra });

const buildOrderKey = (order: Partial<Order>, index: number) => {
  // Ba'zi legacy yozuvlarda id/orderId bo'sh bo'lishi mumkin; index ni qo'shib key collisionni oldini olamiz.
  const identity = String(order.id || order.orderId || '').trim();
  if (identity) {
    return `order-${identity}-${index}`;
  }

  const fallbackParts = [
    order.customerPhone,
    order.createdAt,
    order.type,
  ].filter((value): value is string => Boolean(value && String(value).trim()));

  return fallbackParts.length > 0
    ? `order-${fallbackParts.join('-')}-${index}`
    : `order-fallback-${index}`;
};

const buildOrderItemKey = (item: any, index: number) => {
  const keyParts = [
    item?.id,
    item?.productId,
    item?.variantId,
    item?.sku,
    item?.name,
    item?.title,
    item?.price,
    item?.quantity,
  ].filter((value): value is string | number => value !== undefined && value !== null && value !== '');

  return keyParts.length > 0 ? `order-item-${keyParts.join('-')}` : `order-item-${index}`;
};

const coerceOrderMoney = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** KV / v2 / turli provayderlar: bitta UI qiymatiga */
const normalizePaymentStatusForOrder = (raw: unknown): Order['paymentStatus'] => {
  const s = String(raw ?? '').toLowerCase().trim();
  if (
    ['paid', 'completed', 'complete', 'success', 'succeeded', 'successful', 'captured', 'settled', 'paid_out'].includes(
      s,
    )
  ) {
    return 'paid';
  }
  if (['failed', 'error', 'declined', 'rejected', 'expired'].includes(s)) return 'failed';
  if (['refunded', 'partially_refunded', 'partial_refund'].includes(s)) return 'refunded';
  if (['pending', 'processing', 'awaiting', 'unpaid', 'new', 'created', 'authorized'].includes(s) || !s) {
    return 'pending';
  }
  return 'pending';
};

const formatPaymentMethodUz = (raw: string | null | undefined, methodType?: string | null) => {
  const m = String(raw || '').toLowerCase().trim();
  const mt = String(methodType || '').toLowerCase().trim();
  const map: Record<string, string> = {
    cash: "Naqd pul",
    naqd: "Naqd pul",
    click: 'Click',
    payme: 'Payme',
    uzum: 'Uzum',
    humo: 'Humo',
    atmos: 'Atmos',
    qr: 'QR',
    qrcode: 'QR',
    card: 'Bank kartasi',
    transfer: "O'tkazma",
    cod: "Yetkazib berishda naqd",
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
  };
  const fromProvider = m ? map[m] || raw : '';
  if (fromProvider) return fromProvider;
  if (mt && map[mt]) return map[mt];
  if (mt) return mt;
  return raw?.trim() || "Ko'rsatilmagan";
};

const buildAddressFromRaw = (raw: any) => {
  const a = raw?.address;
  if (a && typeof a === 'object') {
    return [a.street, a.building, a.apartment, a.note].filter(Boolean).join(', ');
  }
  if (typeof a === 'string' && a.trim()) return a.trim();
  return '';
};

/** API / KV / v2 dan kelgan qatorni kartochka uchun bir xil qilish */
const mapRawToOrder = (raw: any): Order => {
  const rawType = String(raw?.orderType || raw?.type || 'market').toLowerCase();
  const type: Order['type'] =
    raw?.type === 'food' || raw?.orderType === 'food' || rawType === 'food'
      ? 'restaurant'
      : rawType === 'shop'
        ? 'shop'
        : rawType === 'rental'
          ? 'rental'
          : 'market';

  const orderId = String(
    raw?.orderId ?? raw?.orderNumber ?? raw?.id ?? ''
  ).replace(/^order:/, '');

  const lineItemsSubtotal = coerceOrderMoney(
    raw?.totalAmount ?? raw?.subtotal_amount ?? raw?.subtotal ?? 0,
  );
  const totalAmount = coerceOrderMoney(
    raw?.finalTotal ?? raw?.totalAmount ?? raw?.totalPrice ?? raw?.total,
  );

  const addr =
    String(raw?.customerAddress || raw?.addressText || buildAddressFromRaw(raw) || '').trim() || undefined;

  const del =
    raw?.deliveryFee != null && Number.isFinite(Number(raw.deliveryFee))
      ? Number(raw.deliveryFee)
      : raw?.deliveryPrice != null && Number.isFinite(Number(raw.deliveryPrice))
        ? Number(raw.deliveryPrice)
        : undefined;

  let createdAt = raw?.createdAt ?? raw?.created_at;
  if (!createdAt || !Number.isFinite(new Date(createdAt).getTime())) {
    createdAt = new Date(0).toISOString();
  }

  const payMethod =
    raw?.paymentMethod ??
    raw?.payment_method ??
    raw?.paymentProvider ??
    raw?.paymentMethodType;

  const payNested = raw?.payment && typeof raw.payment === 'object' ? (raw.payment as any) : null;

  const items = Array.isArray(raw?.items) ? raw.items : [];

  const branchFromRaw =
    raw?.branchId ??
    raw?.branch_id ??
    raw?.branch?.id ??
    (Array.isArray(raw?.groups) && raw.groups[0]
      ? (raw.groups[0] as any).branchId ?? (raw.groups[0] as any).branch_id
      : undefined);
  const branchIdNorm =
    branchFromRaw != null && String(branchFromRaw).trim() !== ''
      ? String(branchFromRaw).trim()
      : undefined;
  const branchNameNorm = String(
    raw?.branchName ?? raw?.branch_name ?? raw?.branch?.name ?? '',
  ).trim();

  return {
    ...raw,
    id: String(raw?.id ?? raw?.order_id ?? orderId),
    type,
    orderId,
    lineItemsSubtotal,
    totalAmount,
    createdAt,
    customerName: String(raw?.customerName ?? raw?.name ?? ''),
    customerPhone: String(raw?.customerPhone ?? raw?.phone ?? ''),
    customerAddress: addr,
    status: String(raw?.status ?? 'pending'),
    paymentStatus: normalizePaymentStatusForOrder(
      raw?.paymentStatus ??
        raw?.payment_status ??
        (raw as any)?.paymentState ??
        payNested?.status,
    ),
    paymentMethod: payMethod != null ? String(payMethod) : undefined,
    deliveryFee: del,
    items,
    branchId: branchIdNorm,
    branchName: branchNameNorm || undefined,
  } as Order;
};

const isCashLikePaymentOrder = (o: Order | null | undefined) => {
  const raw = String(
    o?.paymentMethod ?? (o as any)?.payment_method ?? '',
  )
    .toLowerCase()
    .trim();
  if (!raw) return false;
  const c = raw.replace(/\s+/g, '');
  if (c === 'cash' || c === 'naqd' || c === 'naqdpul') return true;
  if (raw.includes('naqd') || raw.includes('naqt')) return true;
  if (raw.includes('cash')) return true;
  return false;
};

const needsMarketCashBranchRelease = (o: Order | null | undefined) => {
  if (!o) return false;
  if (o.type !== 'market') return false;
  if (!isCashLikePaymentOrder(o)) return false;
  if ((o as any).releasedToPreparerAt) return false;
  const st = String(o.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'canceled') return false;
  return true;
};

const formatOrderCardDate = (iso: string) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ONLINE_BRANCH_PAYMENT_METHODS = new Set(['click', 'click_card', 'payme', 'atmos']);

const branchFoodCounterQrUrl = (order: Order, branchPaymentQr?: string) =>
  String(
    (order as any).merchantPaymentQrUrl ||
      (order as any).merchant_payment_qr_url ||
      branchPaymentQr ||
      '',
  ).trim();

const showBranchFoodCounterQr = (order: Order, branchPaymentQr?: string) => {
  if (order.type !== 'restaurant') return false;
  const st = String(order.status || '').toLowerCase();
  const afterAccept = ['accepted', 'confirmed', 'preparing', 'ready', 'delivering'].includes(st);
  const pm = String(order.paymentMethod || '').toLowerCase();
  const onlinePaid = order.paymentStatus === 'paid' && ONLINE_BRANCH_PAYMENT_METHODS.has(pm);
  return afterAccept && onlinePaid && Boolean(branchFoodCounterQrUrl(order, branchPaymentQr));
};

const branchFoodCounterQrMissing = (order: Order, branchPaymentQr?: string) => {
  if (order.type !== 'restaurant') return false;
  const st = String(order.status || '').toLowerCase();
  const afterAccept = ['accepted', 'confirmed', 'preparing', 'ready', 'delivering'].includes(st);
  const pm = String(order.paymentMethod || '').toLowerCase();
  const onlinePaid = order.paymentStatus === 'paid' && ONLINE_BRANCH_PAYMENT_METHODS.has(pm);
  return afterAccept && onlinePaid && !branchFoodCounterQrUrl(order, branchPaymentQr);
};

export default function OrdersManagement({
  branchId,
  branchInfo,
  type = 'all',
  authMode = 'admin',
  readOnly = false,
  onPaymentRequired,
  hideTypeTabs = false,
}: OrdersManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  /** Admin panel: filial tanlanmaguncha barcha filiallar «jami» ko‘rinmasin */
  const [adminSelectedBranchId, setAdminSelectedBranchId] = useState('');
  const [adminBranches, setAdminBranches] = useState<{ id: string; name: string }[]>([]);
  const [adminBranchesLoading, setAdminBranchesLoading] = useState(() => authMode === 'admin');

  const effectiveBranchFilter =
    authMode === 'branch'
      ? String(branchId || '').trim()
      : String(branchId || adminSelectedBranchId || '').trim();

  const showAdminBranchPicker = authMode === 'admin' && !String(branchId || '').trim();

  const [activeTab, setActiveTab] = useState<'all' | 'market' | 'shop' | 'rental' | 'restaurant'>(
    type === 'food' ? 'restaurant' : type
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(() => {
    if (authMode === 'admin' && !String(branchId || '').trim()) return false;
    return true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [lastOrderCount, setLastOrderCount] = useState(0);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadOrders(true); // Silent reload
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, effectiveBranchFilter, authMode]);

  useEffect(() => {
    if (authMode !== 'admin') {
      setAdminBranchesLoading(false);
      return;
    }
    let cancelled = false;
    setAdminBranchesLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`,
          { headers: buildAdminHeaders({ 'Content-Type': 'application/json' }) },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setAdminBranches([]);
          return;
        }
        const list = Array.isArray(data.branches) ? data.branches : [];
        setAdminBranches(
          list.map((b: { id?: string; name?: string; login?: string }) => ({
            id: String(b.id || '').trim(),
            name: String(b.name || b.login || 'Filial').trim() || 'Filial',
          })).filter((b: { id: string }) => b.id),
        );
      } catch {
        if (!cancelled) setAdminBranches([]);
      } finally {
        if (!cancelled) setAdminBranchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authMode]);

  // Load orders when filial (admin) yoki filial sessiyasi tayyor
  useEffect(() => {
    if (authMode === 'admin' && !effectiveBranchFilter) {
      setOrders([]);
      setLastOrderCount(0);
      setNewOrdersCount(0);
      setLoading(false);
      return;
    }
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadOrders ichida effectiveBranchFilter ishlatiladi
  }, [authMode, branchId, adminSelectedBranchId]);

  // Filter orders
  useEffect(() => {
    let filtered = orders;

    // Filter by type
    if (activeTab !== 'all') {
      filtered = filtered.filter(order => order.type === activeTab);
    }

    // Filter by status (new + pending bitta «Yangi» tugmasida)
    if (statusFilter !== 'all') {
      if (statusFilter === 'incoming') {
        filtered = filtered.filter(
          (order) => order.status === 'new' || order.status === 'pending',
        );
      } else {
        filtered = filtered.filter((order) => order.status === statusFilter);
      }
    }

    // Filial market «Yangi»: naqd qabul alohida panelda; kartochka panjarasida barcha market
    // yangi buyurtmalar takrorlanmasin va onlayn to‘lovlar bu yerda chiqmasin (tayyorlovchi oqimi).
    if (authMode === 'branch' && activeTab === 'market' && statusFilter === 'incoming') {
      filtered = filtered.filter((order) => order.type !== 'market');
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order) => {
        const pay = formatPaymentMethodUz(order.paymentMethod, (order as any).paymentMethodType).toLowerCase();
        return (
          String(order.orderId ?? '')
            .toLowerCase()
            .includes(query) ||
          String(order.id ?? '')
            .toLowerCase()
            .includes(query) ||
          String(order.customerName ?? '')
            .toLowerCase()
            .includes(query) ||
          String(order.customerPhone ?? '').includes(query) ||
          pay.includes(query)
        );
      });
    }

    setFilteredOrders(filtered);
  }, [orders, activeTab, statusFilter, searchQuery, authMode]);

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);

    const applyNewOrderToast = (allOrders: Order[]) => {
      if (silent && lastOrderCount > 0 && allOrders.length > lastOrderCount) {
        const newCount = allOrders.length - lastOrderCount;
        setNewOrdersCount((prev) => prev + newCount);
        toast.success(`${newCount} ta yangi buyurtma!`, { icon: '🔔' });
        try {
          const audio = new Audio(
            'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE',
          );
          audio.play().catch(() => {});
        } catch {
          /* ignore */
        }
      }
      setLastOrderCount(allOrders.length);
    };

    try {
      if (authMode === 'branch') {
        const branchHeaders = buildBranchHeaders({ 'Content-Type': 'application/json' });
        const b = encodeURIComponent(branchId || '');
        const kvUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/branch?branchId=${b}&type=all`;
        const v2Url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/v2/branch/orders?branchId=${b}&type=all`;

        const [kvRes, v2Res] = await Promise.all([
          fetch(kvUrl, { headers: branchHeaders }),
          fetch(v2Url, { headers: branchHeaders }),
        ]);

        const kvData = await kvRes.json().catch(() => ({}));
        const v2Data = await v2Res.json().catch(() => ({}));

        const kvList = kvData?.success && Array.isArray(kvData.orders) ? kvData.orders : [];
        const v2List = v2Data?.success && Array.isArray(v2Data.orders) ? v2Data.orders : [];

        const byId = new Map<string, Order>();
        for (const raw of v2List) {
          const o = mapRawToOrder(raw);
          const key = String(o.id || '').trim();
          if (key) byId.set(key, o);
        }
        for (const raw of kvList) {
          const o = mapRawToOrder(raw);
          const key = String(o.id || '').trim();
          if (!key) continue;
          const prev = byId.get(key);
          if (!prev) {
            byId.set(key, o);
            continue;
          }
          const merged: Order = { ...prev, ...o };
          if (prev.paymentStatus === 'paid' || o.paymentStatus === 'paid') merged.paymentStatus = 'paid';
          else if (o.paymentStatus === 'failed' || prev.paymentStatus === 'failed') merged.paymentStatus = 'failed';
          else if (o.paymentStatus === 'refunded' || prev.paymentStatus === 'refunded') merged.paymentStatus = 'refunded';
          else merged.paymentStatus = o.paymentStatus !== 'pending' ? o.paymentStatus : prev.paymentStatus;
          byId.set(key, merged);
        }

        let merged = Array.from(byId.values());
        if (branchId) {
          merged = merged.filter((order: Order) => String(order.branchId) === String(branchId));
        }

        applyNewOrderToast(merged);
        setOrders(merged);
        return;
      }

      if (!effectiveBranchFilter) {
        applyNewOrderToast([]);
        setOrders([]);
        if (!silent) setLoading(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/all`,
        { headers: buildAdminHeaders() },
      );
      const data = await response.json();

      if (data.success) {
        let allOrders = (data.orders || []) as any[];
        allOrders = allOrders.filter(
          (order: Order) => String(order.branchId || '') === String(effectiveBranchFilter),
        );
        const mapped = allOrders.map(mapRawToOrder);
        applyNewOrderToast(mapped);
        setOrders(mapped);
      } else if (!silent) {
        toast.error('Buyurtmalarni yuklashda xatolik');
      }
    } catch (error) {
      console.error('❌ Load orders error:', error);
      if (!silent) toast.error('Buyurtmalarni yuklashda xatolik');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useVisibilityRefetch(() => {
    void loadOrders(true);
  });

  const releaseMarketCashToPreparer = async (orderId: string) => {
    if (readOnly || authMode !== 'branch') return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/${encodeURIComponent(orderId)}/release-to-preparer`,
        { method: 'POST', headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || "Yuborishda xatolik");
        return;
      }
      toast.success('Buyurtma tayyorlovchiga yuborildi');
      if (data.order) {
        const mapped = mapRawToOrder(data.order);
        setSelectedOrder(mapped);
        setOrders((prev) =>
          prev.map((x) => (String(x.id) === String(orderId) ? mapped : x)),
        );
      }
      await loadOrders(true);
    } catch (e) {
      console.error(e);
      toast.error("Yuborishda xatolik");
    } finally {
      setActionLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, paymentMethod?: string) => {
    if (readOnly) return;
    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/update-status`,
        {
          method: 'POST',
          headers: buildOrderMutationHeaders(authMode),
          body: JSON.stringify({ orderId, status: newStatus, paymentMethod }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success('Buyurtma holati yangilandi');
        loadOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus as any });
        }

        if (newStatus === 'confirmed' && paymentMethod === 'qr') {
          onPaymentRequired?.();
        }
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Update status error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setActionLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (readOnly) return;
    if (!confirm('Buyurtmani bekor qilmoqchimisiz?')) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/cancel`,
        {
          method: 'POST',
          headers: buildOrderMutationHeaders(authMode),
          body: JSON.stringify({ orderId }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success('Buyurtma bekor qilindi');
        loadOrders();
        setShowOrderModal(false);
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Cancel order error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setActionLoading(false);
    }
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const addr =
      order.customerAddress || (order as any).addressText || '';
    const pay = formatPaymentMethodUz(order.paymentMethod, (order as any).paymentMethodType);
    const items = Array.isArray(order.items) ? order.items : [];
    const del = order.deliveryFee != null ? order.deliveryFee : (order as any).deliveryPrice;
    const zone = (order as any).deliveryZone;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Buyurtma #${order.orderId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .info { margin: 10px 0; }
            .items { margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Buyurtma #${order.orderId}</h1>
          <div class="info">
            <p><strong>Ichki ID:</strong> ${order.id}</p>
            <p><strong>Mijoz:</strong> ${order.customerName}</p>
            <p><strong>Telefon:</strong> ${order.customerPhone}</p>
            ${addr ? `<p><strong>Manzil:</strong> ${addr}</p>` : ''}
            ${zone ? `<p><strong>Yetkazib berish zonasi:</strong> ${zone}</p>` : ''}
            <p><strong>To'lov usuli:</strong> ${pay}</p>
            <p><strong>To'lov holati:</strong> ${getPaymentStatusText(order.paymentStatus)}</p>
            <p><strong>Buyurtma holati:</strong> ${getStatusText(order.status)}</p>
            <p><strong>Sana:</strong> ${new Date(order.createdAt).toLocaleString('uz-UZ')}</p>
          </div>
          <div class="items">
            <h3>Mahsulotlar:</h3>
            <table>
              <tr>
                <th>Nomi</th>
                <th>Soni</th>
                <th>Narxi</th>
                <th>Jami</th>
              </tr>
              ${items
                .map(
                  (item: any) => `
                <tr>
                  <td>${item.name || item.title}${item.variantName || item.size ? ` (${item.variantName || item.size})` : ''}</td>
                  <td>${item.quantity}</td>
                  <td>${(item.price || 0).toLocaleString()} so'm</td>
                  <td>${((item.quantity || 1) * (item.price || 0)).toLocaleString()} so'm</td>
                </tr>
              `,
                )
                .join('')}
            </table>
          </div>
          <div class="total">
            ${
              order.lineItemsSubtotal != null &&
              del != null &&
              Math.abs(coerceOrderMoney(order.lineItemsSubtotal) + coerceOrderMoney(del) - coerceOrderMoney(order.totalAmount)) < 2
                ? `<p>Mahsulotlar: ${coerceOrderMoney(order.lineItemsSubtotal).toLocaleString()} so'm</p>
                   <p>Yetkazib berish: ${coerceOrderMoney(del).toLocaleString()} so'm</p>`
                : ''
            }
            <p>Jami: ${(order.totalAmount || 0).toLocaleString()} so'm</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const exportOrders = () => {
    const csv = [
      ['Buyurtma ID', 'Tur', 'Mijoz', 'Telefon', 'Summa', 'Status', 'Sana'].join(','),
      ...filteredOrders.map(order => [
        order.orderId,
        getOrderTypeName(order.type),
        order.customerName,
        order.customerPhone,
        order.totalAmount || 0,
        getStatusText(order.status),
        new Date(order.createdAt).toLocaleString('uz-UZ')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buyurtmalar-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ma\'lumotlar yuklandi');
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'market': return Package;
      case 'shop': return ShoppingBag;
      case 'rental': return Home;
      case 'restaurant': return UtensilsCrossed;
      default: return Package;
    }
  };

  const getOrderTypeName = (type: string) => {
    switch (type) {
      case 'market': return 'Market';
      case 'shop': return 'Do\'kon';
      case 'rental': return 'Ijara';
      case 'restaurant': return 'Taom';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return accentColor.color;
      case 'pending': return accentColor.color;
      case 'confirmed': return '#3b82f6';
      case 'preparing': return '#8b5cf6';
      case 'ready': return '#10b981';
      case 'delivering': return '#06b6d4';
      case 'delivered': return '#22c55e';
      case 'awaiting_receipt': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new': return 'Yangi';
      case 'pending': return 'Yangi';
      case 'confirmed': return 'Tasdiqlandi';
      case 'preparing': return 'Tayyorlanmoqda';
      case 'ready': return 'Tayyor';
      case 'delivering': return 'Yetkazilmoqda';
      case 'delivered': return 'Yetkazildi';
      case 'awaiting_receipt': return 'Mijoz tasdig‘i kutilmoqda';
      case 'cancelled': return 'Bekor qilindi';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      case 'refunded': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'To\'landi';
      case 'pending': return 'Kutilmoqda';
      case 'failed': return 'Xatolik';
      case 'refunded': return 'Qaytarildi';
      default: return status;
    }
  };

  const tabs = [
    { id: 'all' as const, label: 'Barchasi', icon: FileText },
    { id: 'market' as const, label: 'Market', icon: Package },
    { id: 'shop' as const, label: 'Do\'kon', icon: ShoppingBag },
    { id: 'rental' as const, label: 'Ijara', icon: Home },
    { id: 'restaurant' as const, label: 'Taom', icon: UtensilsCrossed },
  ];

  const statusOptions = [
    { value: 'all', label: 'Barchasi', color: accentColor.color },
    { value: 'incoming', label: 'Yangi', color: accentColor.color },
    { value: 'confirmed', label: 'Tasdiqlandi', color: '#3b82f6' },
    { value: 'preparing', label: 'Tayyorlanmoqda', color: '#8b5cf6' },
    { value: 'ready', label: 'Tayyor', color: '#10b981' },
    { value: 'delivering', label: 'Yetkazilmoqda', color: '#06b6d4' },
    { value: 'awaiting_receipt', label: 'Mijoz tasdig‘i', color: '#f59e0b' },
    { value: 'delivered', label: 'Yetkazildi', color: '#22c55e' },
    { value: 'cancelled', label: 'Bekor qilindi', color: '#ef4444' },
  ];

  // Calculate statistics (totalAmount ba'zan yo'q/noto'g'ri — NaN bo'lmasligi uchun Number)
  const safeMoney = coerceOrderMoney;

  const isCancelledStatus = (s: string) => {
    const x = String(s || '').toLowerCase().trim();
    return x === 'cancelled' || x === 'canceled';
  };

  /** Statistikalar: tanlangan filial + tur (Market/…) bo‘yicha; qidiruv/status filtri kartochkalarni o‘zgartirmaydi */
  const ordersForStats = useMemo(() => {
    if (activeTab === 'all') return orders;
    return orders.filter((o) => o.type === activeTab);
  }, [orders, activeTab]);

  const stats = {
    total: ordersForStats.length,
    pending: ordersForStats.filter((o) => o.status === 'pending' || o.status === 'new').length,
    active: ordersForStats.filter((o) =>
      ['confirmed', 'preparing', 'ready', 'delivering'].includes(o.status),
    ).length,
    completed: ordersForStats.filter((o) => o.status === 'delivered').length,
    cancelled: ordersForStats.filter((o) => isCancelledStatus(o.status)).length,
    totalRevenue: ordersForStats
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => {
        const raw = (o as any).totalAmount ?? (o as any).finalTotal ?? (o as any).total;
        return sum + safeMoney(raw);
      }, 0),
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const TypeIcon = getOrderTypeIcon(order.type);
    const createdMs = new Date(order.createdAt).getTime();
    const isNew =
      Number.isFinite(createdMs) && createdMs > Date.now() - 60000; // Last 1 minute
    
    return (
      <div
        onClick={() => {
          setSelectedOrder(order);
          setShowOrderModal(true);
        }}
        style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
          border: `1px solid ${isNew ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="p-4 sm:p-5 hover:shadow-2xl sm:hover:scale-[1.02] active:scale-[0.98] max-sm:hover:scale-100"
      >
        {/* New indicator */}
        {isNew && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: accentColor.gradient,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 min-w-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="shrink-0"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '16px',
                background: `${getStatusColor(order.status)}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TypeIcon className="w-6 h-6" style={{ color: getStatusColor(order.status) }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-base sm:text-lg break-all">
                  #{order.orderId || order.id || '—'}
                </p>
                {isNew && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full font-bold shrink-0"
                    style={{ 
                      background: `${accentColor.color}20`,
                      color: accentColor.color 
                    }}
                  >
                    YANGI
                  </span>
                )}
                {needsMarketCashBranchRelease(order) && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold shrink-0 max-w-full"
                    style={{
                      background: isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.35)',
                      color: isDark ? '#fcd34d' : '#92400e',
                    }}
                  >
                    Naqd — filial qabuli
                  </span>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                {getOrderTypeName(order.type)}
              </p>
            </div>
          </div>
          <div className="flex flex-row sm:flex-col flex-wrap gap-2 sm:items-end w-full sm:w-auto shrink-0">
            <div
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                background: `${getStatusColor(order.status)}20`,
                color: getStatusColor(order.status),
                fontSize: '13px',
                fontWeight: '700',
              }}
            >
              {getStatusText(order.status)}
            </div>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                background: `${getPaymentStatusColor(order.paymentStatus)}15`,
                color: getPaymentStatusColor(order.paymentStatus),
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              {getPaymentStatusText(order.paymentStatus)}
            </div>
          </div>
        </div>

        {authMode === 'branch' && order.type === 'market' && (
          <div
            className="mb-4 px-3 py-2.5 rounded-xl text-center text-sm font-bold tracking-tight"
            style={{
              background:
                order.paymentStatus === 'paid'
                  ? isDark
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(16, 185, 129, 0.14)'
                  : isDark
                    ? 'rgba(245, 158, 11, 0.18)'
                    : 'rgba(245, 158, 11, 0.2)',
              color: order.paymentStatus === 'paid' ? '#10b981' : isDark ? '#fcd34d' : '#b45309',
              border: `1px solid ${
                order.paymentStatus === 'paid'
                  ? 'rgba(16, 185, 129, 0.35)'
                  : 'rgba(245, 158, 11, 0.35)'
              }`,
            }}
          >
            {order.paymentStatus === 'paid'
              ? 'To‘lov: to‘langan'
              : order.paymentStatus === 'failed'
                ? 'To‘lov: xatolik'
                : order.paymentStatus === 'refunded'
                  ? 'To‘lov: qaytarilgan'
                  : 'To‘lov: kutilmoqda (to‘lanmagan)'}
          </div>
        )}

        {/* Customer Info */}
        <div 
          className="space-y-2 mb-4 p-4 rounded-xl"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
            <span className="font-semibold">{order.customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
            <span className="text-sm">{order.customerPhone}</span>
          </div>
          {(order.customerAddress || (order as any).addressText) && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
              <span className="text-sm line-clamp-2">
                {order.customerAddress || (order as any).addressText}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}>
            <CreditCard className="w-4 h-4 flex-shrink-0" />
            <span>
              To‘lov:{' '}
              <span className="font-semibold" style={{ color: isDark ? '#fff' : '#111' }}>
                {formatPaymentMethodUz(order.paymentMethod, (order as any).paymentMethodType)}
              </span>
            </span>
          </div>
          {order.assignedCourierName && (
            <div className="flex items-start gap-2">
              <Truck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accentColor.color }} />
              <div className="text-sm">
                <span className="font-semibold">{order.assignedCourierName}</span>
                {order.courierWorkflowStatus ? ` • ${order.courierWorkflowStatus}` : ''}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 shrink-0" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
            <span className="text-sm truncate" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
              {formatOrderCardDate(order.createdAt)}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold shrink-0" style={{ color: accentColor.color }}>
            {coerceOrderMoney(order.totalAmount).toLocaleString()}{' '}
            <span className="text-sm">so'm</span>
          </p>
        </div>
      </div>
    );
  };

  const OrderDetailsModal = () => {
    if (!selectedOrder) return null;

    const TypeIcon = getOrderTypeIcon(selectedOrder.type);

    return (
      <div
        className="p-3 sm:p-5"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={() => setShowOrderModal(false)}
      >
        <div
          className="rounded-2xl sm:rounded-[32px]"
          style={{
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            maxWidth: '700px',
            width: '100%',
            maxHeight: 'min(90vh, 100dvh)',
            overflow: 'auto',
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isDark 
              ? '0 30px 90px rgba(0, 0, 0, 0.9)'
              : '0 30px 90px rgba(0, 0, 0, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '24px',
              borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: `linear-gradient(135deg, ${getStatusColor(selectedOrder.status)}15, transparent)`,
            }}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowOrderModal(false)}
                className="transition-all active:scale-90"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-2xl font-bold">Buyurtma #{selectedOrder.orderId}</h2>
                <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {getOrderTypeName(selectedOrder.type)} • {new Date(selectedOrder.createdAt).toLocaleString('uz-UZ')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => printOrder(selectedOrder)}
                className="transition-all active:scale-90"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={() => loadOrders()}
                className="transition-all active:scale-90"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div style={{ padding: '24px' }} className="space-y-5">
            {/* Status */}
            <div
              style={{
                padding: '20px',
                borderRadius: '20px',
                background: `${getStatusColor(selectedOrder.status)}10`,
                border: `2px solid ${getStatusColor(selectedOrder.status)}30`,
              }}
            >
              <p className="text-sm font-bold mb-3" style={{ opacity: 0.7 }}>HOLAT</p>
              <div className="flex items-center justify-between">
                <div
                  style={{
                    padding: '12px 24px',
                    borderRadius: '16px',
                    background: getStatusColor(selectedOrder.status),
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '16px',
                  }}
                >
                  {getStatusText(selectedOrder.status)}
                </div>
                <div
                  style={{
                    padding: '12px 24px',
                    borderRadius: '16px',
                    background: `${getPaymentStatusColor(selectedOrder.paymentStatus)}20`,
                    color: getPaymentStatusColor(selectedOrder.paymentStatus),
                    fontWeight: '700',
                  }}
                >
                  {getPaymentStatusText(selectedOrder.paymentStatus)}
                </div>
              </div>
            </div>

            {/* To‘lov va buyurtma identifikatsiyasi */}
            <div
              style={{
                padding: '20px',
                borderRadius: '20px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              }}
            >
              <p className="text-sm font-bold mb-4" style={{ opacity: 0.7 }}>TO‘LOV VA BUYURTMA</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <CreditCard className="w-5 h-5" style={{ color: accentColor.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ opacity: 0.6 }}>To‘lov usuli</p>
                    <p className="font-semibold">
                      {formatPaymentMethodUz(
                        selectedOrder.paymentMethod,
                        (selectedOrder as any).paymentMethodType,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <FileText className="w-5 h-5" style={{ color: accentColor.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ opacity: 0.6 }}>Buyurtma raqami / ichki ID</p>
                    <p className="font-semibold">
                      {(selectedOrder as any).orderNumber || selectedOrder.orderId}
                      <span className="block text-xs font-normal opacity-70 mt-0.5">ID: {selectedOrder.id}</span>
                    </p>
                  </div>
                </div>
                {(selectedOrder as any).deliveryZone ? (
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ opacity: 0.6 }}>Yetkazib berish zonasi</p>
                      <p className="font-semibold">{String((selectedOrder as any).deliveryZone)}</p>
                    </div>
                  </div>
                ) : null}
                {selectedOrder.branchName ? (
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <Home className="w-5 h-5" style={{ color: accentColor.color }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ opacity: 0.6 }}>Filial</p>
                      <p className="font-semibold">{selectedOrder.branchName}</p>
                    </div>
                  </div>
                ) : null}
                {selectedOrder.type === 'market' &&
                (['cash', 'naqd'].includes(String(selectedOrder.paymentMethod || '').toLowerCase().trim()) ? (
                  <p
                    className="text-xs rounded-xl px-3 py-2"
                    style={{
                      background: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(251, 191, 36, 0.2)',
                      color: isDark ? '#fcd34d' : '#92400e',
                    }}
                  >
                    {(selectedOrder as any).releasedToPreparerAt
                      ? 'Naqd to‘lov: filial qabul qilingan, tayyorlovchiga yuborilgan.'
                      : 'Naqd to‘lov: avval filial «Market buyurtmalar»da qabul qiling, keyin tayyorlovchiga tushadi.'}
                  </p>
                ) : null)}
              </div>
            </div>

            {/* Customer Info */}
            <div
              style={{
                padding: '20px',
                borderRadius: '20px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              }}
            >
              <p className="text-sm font-bold mb-4" style={{ opacity: 0.7 }}>MIJOZ MA'LUMOTLARI</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <User className="w-5 h-5" style={{ color: accentColor.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ opacity: 0.6 }}>Ism</p>
                    <p className="font-semibold">{selectedOrder.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <Phone className="w-5 h-5" style={{ color: accentColor.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ opacity: 0.6 }}>Telefon</p>
                    <p className="font-semibold">{selectedOrder.customerPhone}</p>
                  </div>
                </div>
                {(selectedOrder.customerAddress || (selectedOrder as any).addressText) && (
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ opacity: 0.6 }}>Manzil</p>
                      <p className="font-semibold">
                        {selectedOrder.customerAddress || (selectedOrder as any).addressText}
                      </p>
                    </div>
                  </div>
                )}
                {selectedOrder.assignedCourierName && (
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <Truck className="w-5 h-5" style={{ color: accentColor.color }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ opacity: 0.6 }}>Kuryer</p>
                      <p className="font-semibold">{selectedOrder.assignedCourierName}</p>
                      {selectedOrder.assignedCourierPhone && (
                        <p style={{ opacity: 0.7 }}>{selectedOrder.assignedCourierPhone}</p>
                      )}
                      {selectedOrder.courierWorkflowStatus && (
                        <p style={{ opacity: 0.7 }}>Holat: {selectedOrder.courierWorkflowStatus}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '20px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                }}
              >
                <p className="text-sm font-bold mb-4" style={{ opacity: 0.7 }}>MAHSULOTLAR ({selectedOrder.items.length})</p>
                <div className="space-y-3">
                  {selectedOrder.items.map((item: any, index: number) => (
                    <div
                      key={buildOrderItemKey(item, index)}
                      className="flex items-center justify-between p-4 rounded-xl transition-all hover:scale-[1.02]"
                      style={{
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
                      }}
                    >
                      <div className="flex-1">
                        <p className="font-bold mb-1">
                          {item.name || item.title}
                          {item.variantName || item.size ? (
                            <span className="font-normal opacity-80">
                              {' '}
                              ({item.variantName || item.size})
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          {item.quantity} ta × {(item.price || 0).toLocaleString()} so'm
                        </p>
                      </div>
                      <p className="text-lg font-bold ml-4" style={{ color: accentColor.color }}>
                        {((item.quantity || 1) * (item.price || 0)).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Summary */}
            <div
              style={{
                padding: '20px',
                borderRadius: '20px',
                background: `linear-gradient(135deg, ${accentColor.color}15, ${accentColor.color}05)`,
                border: `1px solid ${accentColor.color}30`,
              }}
            >
              <p className="text-sm font-bold mb-4" style={{ opacity: 0.7 }}>TO'LOV MA'LUMOTLARI</p>
              <div className="space-y-3">
                {selectedOrder.lineItemsSubtotal != null &&
                selectedOrder.deliveryFee != null &&
                Math.abs(
                  coerceOrderMoney(selectedOrder.lineItemsSubtotal) +
                    coerceOrderMoney(selectedOrder.deliveryFee) -
                    coerceOrderMoney(selectedOrder.totalAmount),
                ) < 2 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ opacity: 0.7 }}>Mahsulotlar:</span>
                    <span className="font-semibold">
                      {coerceOrderMoney(selectedOrder.lineItemsSubtotal).toLocaleString()} so'm
                    </span>
                  </div>
                ) : null}
                {(selectedOrder.deliveryFee !== undefined && selectedOrder.deliveryFee !== null) ||
                (selectedOrder as any).deliveryPrice != null ? (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ opacity: 0.7 }}>Yetkazib berish:</span>
                    <span className="font-semibold">
                      {coerceOrderMoney(
                        selectedOrder.deliveryFee ?? (selectedOrder as any).deliveryPrice,
                      ).toLocaleString()}{' '}
                      so'm
                    </span>
                  </div>
                ) : null}
                {selectedOrder.discount && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ opacity: 0.7 }}>Chegirma:</span>
                    <span className="font-semibold" style={{ color: '#10b981' }}>-{(selectedOrder.discount || 0).toLocaleString()} so'm</span>
                  </div>
                )}
                {selectedOrder.bonusUsed && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ opacity: 0.7 }}>Bonus:</span>
                    <span className="font-semibold" style={{ color: '#10b981' }}>-{(selectedOrder.bonusUsed || 0).toLocaleString()} so'm</span>
                  </div>
                )}
                <div 
                  className="flex items-center justify-between pt-3 mt-3"
                  style={{ borderTop: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}
                >
                  <span className="text-lg font-bold">JAMI:</span>
                  <span className="text-2xl font-bold" style={{ color: accentColor.color }}>
                    {(selectedOrder.totalAmount || 0).toLocaleString()} <span className="text-base">so'm</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedOrder.notes && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '20px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                }}
              >
                <p className="text-sm font-bold mb-2" style={{ opacity: 0.7 }}>IZOH</p>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  {selectedOrder.notes}
                </p>
              </div>
            )}

            {showBranchFoodCounterQr(selectedOrder, branchInfo?.paymentQrImage) && (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '20px',
                  backgroundColor: isDark ? 'rgba(20, 184, 166, 0.12)' : 'rgba(20, 184, 166, 0.08)',
                  border: `1px solid ${accentColor.color}`,
                }}
              >
                <p className="text-base font-bold mb-1 flex items-center gap-2">
                  <QrCode className="w-5 h-5" style={{ color: accentColor.color }} />
                  Kassa — to&apos;lov QR (taom)
                </p>
                <p className="text-xs mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.68)' }}>
                  Mijoz Click / Payme / Atmos orqali to&apos;lagan. Buyurtma qabul qilingan — kassada QR ni
                  ko&apos;rsating yoki skaner qiling.
                </p>
                <div className="flex justify-center">
                  <img
                    src={branchFoodCounterQrUrl(selectedOrder, branchInfo?.paymentQrImage)}
                    alt="To'lov QR"
                    className="max-w-[240px] w-full rounded-xl object-contain bg-white p-2"
                    style={{
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  />
                </div>
              </div>
            )}

            {branchFoodCounterQrMissing(selectedOrder, branchInfo?.paymentQrImage) && (
              <div
                className="text-sm"
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)',
                }}
              >
                Kassa QR yo&apos;q: buyurtmada yoki filial sozlamalarida to&apos;lov QR rasmi (URL) ko&apos;rinmayapti.
                Admin «Filiallar»da filial QR yoki restoran profilida to&apos;lov QR qo&apos;shing.
              </div>
            )}

            {/* Action Buttons */}
            {!readOnly && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
              <div className="space-y-3 pt-2">
                {authMode === 'branch' && needsMarketCashBranchRelease(selectedOrder) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      releaseMarketCashToPreparer(selectedOrder.id);
                    }}
                    disabled={actionLoading}
                    className="transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      width: '100%',
                      padding: '18px',
                      borderRadius: '18px',
                      background: accentColor.gradient,
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: `0 10px 30px ${accentColor.color}40`,
                    }}
                  >
                    <CheckCircle className="w-6 h-6" />
                    Qabul qilish (tayyorlovchiga)
                  </button>
                )}
                {/* Status Update Buttons */}
                {selectedOrder.status === 'pending' &&
                  !needsMarketCashBranchRelease(selectedOrder) && (
                  <button
                    onClick={() =>
                      updateOrderStatus(
                        selectedOrder.id,
                        'confirmed',
                        // Do‘kon: kassa QR tekshiruv oqimi. Taom: mijoz onlayn to‘lagan — paymentMethod ni «qr» ga almashtirmaymiz.
                        selectedOrder.type === 'shop' ? 'qr' : undefined,
                      )
                    }
                    disabled={actionLoading}
                    className="transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      width: '100%',
                      padding: '18px',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <CheckCircle className="w-6 h-6" />
                    Qabul qilish
                  </button>
                )}
                
                {selectedOrder.status === 'confirmed' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                    disabled={actionLoading}
                    className="transition-all active:scale-95"
                    style={{
                      width: '100%',
                      padding: '18px',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '16px',
                      boxShadow: '0 10px 30px rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    Tayyorlashni boshlash
                  </button>
                )}
                
                {selectedOrder.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                    disabled={actionLoading}
                    className="transition-all active:scale-95"
                    style={{
                      width: '100%',
                      padding: '18px',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '16px',
                      boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    Tayyor deb belgilash
                  </button>
                )}
                
                {selectedOrder.status === 'ready' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'delivering')}
                    disabled={actionLoading}
                    className="transition-all active:scale-95"
                    style={{
                      width: '100%',
                      padding: '18px',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 10px 30px rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    <Truck className="w-6 h-6" />
                    Yetkazishni boshlash
                  </button>
                )}
                
                {selectedOrder.status === 'delivering' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                    disabled={actionLoading || String(selectedOrder.paymentMethod || '').toLowerCase().trim() === 'cash'}
                    className="transition-all active:scale-95"
                    title={
                      String(selectedOrder.paymentMethod || '').toLowerCase().trim() === 'cash'
                        ? 'Naqd to‘lov: to‘lov faqat kuryer yetkazgandan keyin “To‘landi”ga o‘tadi'
                        : undefined
                    }
                    style={{
                      width: '100%',
                      padding: '18px',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '16px',
                      boxShadow: '0 10px 30px rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    {String(selectedOrder.paymentMethod || '').toLowerCase().trim() === 'cash' ? 'Kuryer tasdiqlaydi' : '✓ Yetkazildi'}
                  </button>
                )}

                {/* Cancel Button */}
                <button
                  onClick={() => cancelOrder(selectedOrder.id)}
                  disabled={actionLoading}
                  className="transition-all active:scale-95"
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '18px',
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <XCircle className="w-5 h-5" />
                  Bekor qilish
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div 
            className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: `${accentColor.color}40`, borderTopColor: 'transparent' }}
          />
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:flex-wrap">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold break-words">
              {type === 'all' ? 'Buyurtmalar' : `${getOrderTypeName(type === 'food' ? 'restaurant' : type)} Buyurtmalar`}
            </h2>
            {newOrdersCount > 0 && (
              <div 
                className="px-3 py-1 rounded-full font-bold text-sm animate-bounce"
                style={{ 
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 0 20px ${accentColor.color}60`
                }}
              >
                +{newOrdersCount} yangi
              </div>
            )}
          </div>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            {authMode === 'branch' || String(branchId || '').trim()
              ? 'Filial buyurtmalarini real-time boshqaring'
              : 'Filial tanlang — faqat shu filial buyurtmalari va statistikasi ko‘rinadi'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setAutoRefresh(!autoRefresh);
              toast(autoRefresh ? 'Auto-refresh o\'chirildi' : 'Auto-refresh yoqildi', {
                icon: autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />,
              });
            }}
            className="transition-all active:scale-95"
            style={{
              padding: '12px 20px',
              borderRadius: '16px',
              background: autoRefresh ? accentColor.gradient : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              color: autoRefresh ? '#ffffff' : 'inherit',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {autoRefresh ? <Activity className="w-4 h-4 animate-pulse" /> : <Pause className="w-4 h-4" />}
            <span className="hidden sm:inline">Auto-refresh</span>
          </button>

          <button
            onClick={exportOrders}
            className="transition-all active:scale-95"
            style={{
              padding: '12px 20px',
              borderRadius: '16px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => loadOrders()}
            disabled={loading}
            className="transition-all active:scale-95"
            style={{
              padding: '12px 20px',
              borderRadius: '16px',
              background: accentColor.gradient,
              color: '#ffffff',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: `0 8px 20px ${accentColor.color}40`,
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yangilash</span>
          </button>
        </div>
      </div>

      {showAdminBranchPicker && (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
            <span className="font-bold text-sm sm:text-base">Filial</span>
          </div>
          <div className="flex-1 min-w-0">
            <select
              value={adminSelectedBranchId}
              onChange={(e) => setAdminSelectedBranchId(e.target.value)}
              className="w-full max-w-xl py-3 px-4 rounded-xl border outline-none text-base font-semibold cursor-pointer"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f9fafb',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
                color: isDark ? '#fff' : '#111827',
              }}
            >
              <option value="">— Filialni tanlang —</option>
              {adminBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {adminBranchesLoading ? (
              <p className="text-xs mt-2" style={{ opacity: 0.65 }}>
                Filiallar ro‘yxati yuklanmoqda…
              </p>
            ) : adminBranches.length === 0 ? (
              <p className="text-xs mt-2" style={{ opacity: 0.65 }}>
                Filiallar ro‘yxati yuklanmadi yoki hali filial yo‘q. «Filiallar» bo‘limida qo‘shing.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {showAdminBranchPicker && !effectiveBranchFilter ? (
        <div
          className="flex flex-col items-center justify-center py-16 sm:py-24 rounded-3xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
          }}
        >
          <Building2 className="w-14 h-14 mb-4 opacity-40" style={{ color: accentColor.color }} />
          <h3 className="text-xl font-bold mb-2 text-center px-4">Filialni tanlang</h3>
          <p
            className="text-center max-w-md px-4 text-sm"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}
          >
            Yuqoridagi ro‘yxatdan filialni tanlang. Buyurtmalar, jami sonlar va tushum faqat shu filial uchun
            ko‘rinadi — barcha filiallar aralash «jami» ko‘rinmaydi.
          </p>
        </div>
      ) : null}

      {/* Statistics Cards */}
      {(!showAdminBranchPicker || effectiveBranchFilter) && (
      <>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <div
          className="p-4 sm:p-5 rounded-2xl transition-all max-sm:hover:scale-100 sm:hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${accentColor.color}20, ${accentColor.color}10)`,
            border: `1px solid ${accentColor.color}30`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8" style={{ color: accentColor.color }} />
            <TrendingUp className="w-5 h-5" style={{ color: accentColor.color, opacity: 0.5 }} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums">{stats.total}</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>Jami buyurtmalar</p>
        </div>

        <div
          className="p-4 sm:p-5 rounded-2xl transition-all max-sm:hover:scale-100 sm:hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${accentColor.color}20, ${accentColor.color}10)`,
            border: `1px solid ${accentColor.color}30`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <Bell className="w-8 h-8" style={{ color: accentColor.color }} />
            {stats.pending > 0 && <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accentColor.color }} />}
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums">{stats.pending}</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>Yangi</p>
        </div>

        <div
          className="p-4 sm:p-5 rounded-2xl transition-all max-sm:hover:scale-100 sm:hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums">{stats.active}</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>Jarayonda</p>
        </div>

        <div
          className="p-4 sm:p-5 rounded-2xl transition-all max-sm:hover:scale-100 sm:hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums">{stats.completed}</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>Yetkazildi</p>
        </div>

        <div
          className="p-4 sm:p-5 rounded-2xl transition-all max-sm:hover:scale-100 sm:hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums">{stats.cancelled}</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>Bekor qilingan</p>
        </div>

        <div
          className="p-4 sm:p-5 rounded-2xl transition-all max-sm:hover:scale-100 sm:hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums">
            {`${Math.round(safeMoney(stats.totalRevenue) / 1000)}K`}
          </p>
          <p className="text-sm" style={{ opacity: 0.7 }}>Tushum</p>
        </div>
      </div>

      {/* Tabs - only show if type is 'all' */}
      {type === 'all' && !hideTypeTabs && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'all' 
              ? orders.length 
              : orders.filter(o => o.type === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="transition-all active:scale-95"
                style={{
                  padding: '14px 24px',
                  borderRadius: '18px',
                  background: isActive 
                    ? accentColor.gradient
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: isActive ? '#ffffff' : 'inherit',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: isActive ? `0 8px 20px ${accentColor.color}40` : 'none',
                }}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: isActive ? 'rgba(255, 255, 255, 0.2)' : `${accentColor.color}20`,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} 
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buyurtma ID, mijoz nomi yoki telefon raqami..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border outline-none transition-all focus:scale-[1.02]"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: isDark ? '#ffffff' : '#111827',
              }}
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
          {statusOptions.map(option => {
            const isActive = statusFilter === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className="transition-all active:scale-95 whitespace-nowrap shrink-0 snap-start text-xs sm:text-sm py-2.5 px-3 sm:py-3 sm:px-5"
                style={{
                  borderRadius: '16px',
                  background: isActive 
                    ? option.color
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: isActive ? '#ffffff' : 'inherit',
                  fontWeight: '600',
                  boxShadow: isActive ? `0 4px 12px ${option.color}40` : 'none',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Naqd qabul — faqat «Yangi» filtrida (market + filial) */}
      {authMode === 'branch' &&
      type === 'market' &&
      branchId &&
      statusFilter === 'incoming' ? (
        <PendingCashMarketBranchPanel
          readOnly={!!readOnly}
          onOrdersChanged={() => loadOrders(true)}
        />
      ) : null}

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        authMode === 'branch' && activeTab === 'market' && statusFilter === 'incoming' ? null : (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-3xl"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          }}
        >
          <div 
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
            style={{ background: `${accentColor.color}20` }}
          >
            <Package className="w-12 h-12" style={{ color: accentColor.color, opacity: 0.5 }} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Buyurtmalar topilmadi</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
            {searchQuery || statusFilter !== 'all' 
              ? 'Filtrlarga mos buyurtmalar yo\'q'
              : 'Hozircha buyurtmalar mavjud emas'}
          </p>
        </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredOrders.map((order, index) => (
            <OrderCard key={buildOrderKey(order, index)} order={order} />
          ))}
        </div>
      )}
      </>
      )}

      {/* Order Details Modal */}
      {showOrderModal && <OrderDetailsModal />}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
