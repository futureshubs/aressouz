import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import OrdersManagement from '../admin/OrdersManagement';
import { Chat } from './Chat';
import { Payments } from './Payments';
import { projectId } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { toast } from 'sonner';
import {
  FileText,
  Package,
  ShoppingBag,
  Home,
  UtensilsCrossed,
  MessageSquareText,
  Receipt,
  Loader2,
} from 'lucide-react';
import './operatorSupprtTabs.css';
type OperatorSupportTabsProps = {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
    paymentQrImage?: string;
  };
  role?: 'operator' | 'support';
};

type TabId =
  | 'orders_all'
  | 'orders_market'
  | 'orders_shop'
  | 'orders_rental'
  | 'orders_food'
  | 'chat'
  | 'payments';

export function OperatorSupportTabs({ branchId, branchInfo, role = 'operator' }: OperatorSupportTabsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<TabId>('orders_all');

  const visibilityRefetchTick = useVisibilityTick();
  const [counts, setCounts] = useState<Record<string, number>>({
    orders_all: 0,
    orders_market: 0,
    orders_shop: 0,
    orders_rental: 0,
    orders_food: 0,
    chat: 0,
    payments: 0,
  });
  const [countsLoading, setCountsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      try {
        setCountsLoading(true);
        const endpoint = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/v2/branch/orders?branchId=${encodeURIComponent(
          branchId
        )}&type=all`;

        const res = await fetch(endpoint, { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) });
        const data = await res.json();
        if (!res.ok || !data?.success || !data?.orders) throw new Error(data?.error || 'Orders yuklanmadi');

        const orders = data.orders as any[];

        const orders_all = orders.length;
        const orders_market = orders.filter((o) => o.type === 'market').length;
        const orders_shop = orders.filter((o) => o.type === 'shop').length;
        const orders_rental = orders.filter((o) => o.type === 'rental').length;
        const orders_food = orders.filter((o) => o.type === 'restaurant').length;

        // Chat count: noyob mijoz phone bo'yicha (o.userId bo'lmasa ham ishlaydi)
        const customerKeys = new Set(
          orders
            .map((o) => String(o.customerPhone || o.customerId || o.userId || '').trim())
            .filter(Boolean)
        );
        const chat = customerKeys.size;

        // Payments count: yetkazilgan (delivered) yoki paid bo'lgan buyurtmalar soni
        const payments = orders.filter((o) => o.status === 'delivered' || o.paymentStatus === 'paid').length;

        if (!cancelled) {
          setCounts({
            orders_all,
            orders_market,
            orders_shop,
            orders_rental,
            orders_food,
            chat,
            payments,
          });
        }
      } catch (e: any) {
        console.error('OperatorSupportTabs counts error:', e);
        // Fallback to legacy KV endpoint
        try {
          const fallbackEndpoint = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/branch?branchId=${encodeURIComponent(
            branchId
          )}&type=all`;
          const res = await fetch(fallbackEndpoint, { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) });
          const data = await res.json();
          if (!res.ok || !data?.success || !data?.orders) throw new Error(data?.error || 'Orders yuklanmadi');

          const orders = data.orders as any[];
          const orders_all = orders.length;
          const orders_market = orders.filter((o) => o.type === 'market').length;
          const orders_shop = orders.filter((o) => o.type === 'shop').length;
          const orders_rental = orders.filter((o) => o.type === 'rental').length;
          const orders_food = orders.filter((o) => o.type === 'restaurant').length;

          const customerKeys = new Set(
            orders
              .map((o) => String(o.customerPhone || o.customerId || o.userId || '').trim())
              .filter(Boolean)
          );
          const chat = customerKeys.size;
          const payments = orders.filter((o) => o.status === 'delivered' || o.paymentStatus === 'paid').length;

          if (!cancelled) {
            setCounts({
              orders_all,
              orders_market,
              orders_shop,
              orders_rental,
              orders_food,
              chat,
              payments,
            });
          }
        } catch (fallbackErr) {
          toast.error('Hisoblarni yuklashda xatolik');
        }
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    };

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [branchId, visibilityRefetchTick]);

  const tabs = useMemo(
    () =>
      {
        const baseTabs = [
          { id: 'orders_all' as const, label: 'Barchasi', icon: FileText, countKey: 'orders_all' },
          { id: 'orders_market' as const, label: 'Market', icon: Package, countKey: 'orders_market' },
          { id: 'orders_shop' as const, label: "Do'kon", icon: ShoppingBag, countKey: 'orders_shop' },
          { id: 'orders_rental' as const, label: 'Ijara', icon: Home, countKey: 'orders_rental' },
          { id: 'orders_food' as const, label: 'Taom', icon: UtensilsCrossed, countKey: 'orders_food' },
          { id: 'chat' as const, label: 'Chat', icon: MessageSquareText, countKey: 'chat' },
        ];
        // Operator ham, support ham bitta UI'da ko'rinadi:
        // To'lovlar tarixi (payments) bekor qilinmaydi.
        return [
          ...baseTabs,
          { id: 'payments' as const, label: "To'lovlar", icon: Receipt, countKey: 'payments' },
        ] as const;
      },
    [role]
  );

  const accentBtnStyle = (isActive: boolean) => ({
    padding: '14px 24px',
    borderRadius: '18px',
    background: isActive ? accentColor.gradient : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    color: isActive ? '#ffffff' : 'inherit',
    fontWeight: '700',
    whiteSpace: 'nowrap' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: isActive ? `0 8px 20px ${accentColor.color}40` : 'none',
  });

  return (
    <div className="space-y-6">
      <div
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        // Agar foydalanuvchi "mouse" g‘ildiragi bilan o‘ng/chapni surmoqchi bo‘lsa,
        // vertikal deltaY ni horizontal scrollLeft ga o‘tkazamiz.
        onWheel={(e) => {
          const el = e.currentTarget;
          if (el.scrollWidth <= el.clientWidth) return;

          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            el.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const count = counts[tab.countKey] ?? 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              disabled={countsLoading}
              className="transition-all active:scale-95 disabled:opacity-60"
              style={accentBtnStyle(isActive)}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold inline-flex items-center justify-center min-w-[1.5rem]"
                style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.2)' : `${accentColor.color}20`,
                }}
              >
                {countsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'orders_all' && (
        <OrdersManagement
          branchId={branchId}
          branchInfo={branchInfo as any}
          type="all"
          authMode="branch"
          readOnly
          hideTypeTabs
        />
      )}

      {activeTab === 'orders_market' && (
        <OrdersManagement branchId={branchId} branchInfo={branchInfo as any} type="market" authMode="branch" readOnly />
      )}

      {activeTab === 'orders_shop' && (
        <OrdersManagement branchId={branchId} branchInfo={branchInfo as any} type="shop" authMode="branch" readOnly />
      )}

      {activeTab === 'orders_rental' && (
        <OrdersManagement branchId={branchId} branchInfo={branchInfo as any} type="rental" authMode="branch" readOnly />
      )}

      {activeTab === 'orders_food' && (
        <OrdersManagement
          branchId={branchId}
          branchInfo={{
            region: branchInfo?.region ?? '',
            district: branchInfo?.district ?? '',
            phone: branchInfo?.phone ?? '',
            paymentQrImage: branchInfo?.paymentQrImage,
          }}
          type="food"
          authMode="branch"
          readOnly
        />
      )}

      {activeTab === 'chat' && <Chat branchId={branchId} branchInfo={branchInfo as any} />}

      {activeTab === 'payments' && <Payments branchId={branchId} branchInfo={branchInfo as any} />}
    </div>
  );
}

