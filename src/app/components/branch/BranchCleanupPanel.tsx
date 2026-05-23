import { useCallback, useState } from 'react';
import {
  Trash2,
  Loader2,
  AlertTriangle,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Home as HomeIcon,
  ShoppingCart,
  Package,
  ChefHat,
  Car,
  KeyRound,
  TrendingUp,
  Image,
  Settings,
  MapPin,
  Building,
  Bike,
  Truck,
  BriefcaseBusiness,
  Map,
  MessageSquare,
  CreditCard,
  RotateCcw,
  Users,
  FileBarChart,
  ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { SecurityCodeModal } from '../SecurityCodeModal';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';

type CleanupTargetId =
  | 'market-orders'
  | 'shop-orders'
  | 'food-orders'
  | 'rental-orders'
  | 'market'
  | 'shop'
  | 'foods'
  | 'rentals'
  | 'rental-providers'
  | 'auction'
  | 'banner'
  | 'services'
  | 'nearby'
  | 'house'
  | 'car'
  | 'bank'
  | 'couriers'
  | 'auto-couriers'
  | 'courier-bags'
  | 'pickup-racks'
  | 'preparers'
  | 'delivery-zones'
  | 'chat'
  | 'payments'
  | 'refunds'
  | 'employees'
  | 'reports'
  | 'all';

type CleanupSection = {
  title: string;
  items: {
    id: CleanupTargetId;
    label: string;
    description: string;
    icon: LucideIcon;
    danger?: 'high' | 'medium';
  }[];
};

const CLEANUP_SECTIONS: CleanupSection[] = [
  {
    title: 'Buyurtmalar',
    items: [
      { id: 'market-orders', label: 'Market buyurtmalar', description: 'Filial market buyurtmalari', icon: ShoppingBag },
      { id: 'shop-orders', label: "Do'kon buyurtmalar", description: "Onlayn do'kon buyurtmalari", icon: Store },
      { id: 'food-orders', label: 'Taom buyurtmalar', description: 'Restoran/taom buyurtmalari', icon: UtensilsCrossed },
      { id: 'rental-orders', label: 'Ijara buyurtmalar', description: 'Ijara buyurtma tarixi', icon: HomeIcon },
    ],
  },
  {
    title: 'Mahsulotlar va xizmatlar',
    items: [
      { id: 'market', label: 'Market', description: 'Market mahsulotlari, sotuv va ombor tarixi', icon: ShoppingCart, danger: 'high' },
      { id: 'shop', label: "Do'kon", description: "Do'konlar, mahsulotlar va buyurtmalar", icon: Package, danger: 'high' },
      { id: 'foods', label: 'Taomlar', description: 'Restoranlar va taomlar', icon: ChefHat, danger: 'high' },
      { id: 'rentals', label: 'Ijara', description: 'Ijara mahsulotlari va ombor', icon: Car, danger: 'high' },
      { id: 'rental-providers', label: 'Ijara beruvchi', description: 'Ijara beruvchi akkauntlar', icon: KeyRound },
      { id: 'auction', label: 'Auksion', description: 'Auksionlar va takliflar', icon: TrendingUp },
      { id: 'banner', label: 'Banner', description: 'Reklama bannerlari', icon: Image },
      { id: 'services', label: 'Xizmatlar', description: 'Portfolio va loyihalar', icon: Settings },
      { id: 'nearby', label: 'Atrof', description: 'Joylar (places)', icon: MapPin },
    ],
  },
  {
    title: 'Mening',
    items: [
      { id: 'house', label: 'Uy', description: 'Filial mulk e\'lonlari', icon: HomeIcon },
      { id: 'car', label: 'Moshina', description: 'Filial avtomobil e\'lonlari', icon: Car },
      { id: 'bank', label: 'Bank', description: 'Bank ma\'lumotlari', icon: Building },
    ],
  },
  {
    title: 'Hodimlar va logistika',
    items: [
      { id: 'couriers', label: 'Kuryer', description: 'Kuryerlar va sessiyalar', icon: Bike },
      { id: 'auto-couriers', label: 'Avto-kuryer', description: 'Avto-kuryerlar', icon: Truck },
      { id: 'courier-bags', label: "So'mkalar", description: 'Kuryer sumkalari', icon: BriefcaseBusiness },
      { id: 'pickup-racks', label: 'Olib ketish rastasi', description: 'Pickup rastalari', icon: MapPin },
      { id: 'preparers', label: 'Tayyorlovchi', description: 'Tayyorlovchi akkauntlar (filial hududi)', icon: ChefHat },
      { id: 'delivery-zones', label: 'Yetkazib berish zonasi', description: 'Yetkazish zonalar', icon: Map },
    ],
  },
  {
    title: 'Tizim',
    items: [
      { id: 'chat', label: 'Chat', description: 'Mijoz chat suhbatlari', icon: MessageSquare },
      { id: 'payments', label: "To'lovlar tarixi", description: "Filial buyurtmalariga bog'liq to'lovlar", icon: CreditCard },
      { id: 'refunds', label: "To'lov qaytarish", description: 'Qaytarish kutilayotgan buyurtmalar', icon: RotateCcw },
      { id: 'employees', label: 'Ishchilar', description: 'Filial xodimlari', icon: Users, danger: 'high' },
      { id: 'reports', label: 'Hisobboti', description: 'Saqlangan hisobotlar', icon: FileBarChart },
    ],
  },
];

function sumCounts(counts: Record<string, number> | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
}

interface BranchCleanupPanelProps {
  branchId: string;
}

export function BranchCleanupPanel({ branchId }: BranchCleanupPanelProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [pendingTarget, setPendingTarget] = useState<CleanupTargetId | null>(null);
  const [busyTarget, setBusyTarget] = useState<CleanupTargetId | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);

  const pendingMeta = CLEANUP_SECTIONS.flatMap((s) => s.items).find((i) => i.id === pendingTarget);

  const runCleanup = useCallback(
    async (target: CleanupTargetId) => {
      const label =
        CLEANUP_SECTIONS.flatMap((s) => s.items).find((i) => i.id === target)?.label || target;
      setBusyTarget(target);
      try {
        const res = await fetch(`${apiBaseUrl}/branch/cleanup`, {
          method: 'POST',
          headers: {
            ...buildBranchHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            securityCode: '0099',
            target,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error(
            "Tozalash API hali serverda yo'q. Terminalda: npm run supabase:deploy:server",
          );
        }
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Tozalash amalga oshmadi');
        }
        const total = sumCounts(data.counts);
        toast.success(
          total > 0
            ? `${label}: ${total} ta yozuv tozalandi`
            : `${label}: tozalash uchun ma'lumot topilmadi`,
        );
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Tozalashda xatolik');
      } finally {
        setBusyTarget(null);
        setPendingTarget(null);
      }
    },
    [apiBaseUrl],
  );

  const requestCleanup = (target: CleanupTargetId) => {
    setPendingTarget(target);
    setShowCodeModal(true);
  };

  const handleCodeSuccess = () => {
    setShowCodeModal(false);
    if (pendingTarget) void runCleanup(pendingTarget);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div
        className="p-5 rounded-2xl border flex gap-4 items-start"
        style={{
          background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)',
          borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)',
        }}
      >
        <ShieldAlert className="size-8 shrink-0 text-red-500" strokeWidth={2} />
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: isDark ? '#fff' : '#111827' }}>
            Ma&apos;lumotlarni tozalash
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)' }}>
            Har bir bo&apos;limni alohida tozalashingiz mumkin. Amal qaytarib bo&apos;lmaydi.
            Tozalash uchun maxfiy parol talab qilinadi.
          </p>
        </div>
      </div>

      <div
        className="p-4 rounded-2xl border"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
              Hammasini tozalash
            </p>
            <p className="text-sm mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}>
              Filialga tegishli barcha bo&apos;limlar (filial o&apos;zi saqlanadi)
            </p>
          </div>
          <button
            type="button"
            onClick={() => requestCleanup('all')}
            disabled={!!busyTarget}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
          >
            {busyTarget === 'all' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Hammasini tozalash
          </button>
        </div>
      </div>

      {CLEANUP_SECTIONS.map((section) => (
        <div key={section.title}>
          <h3
            className="text-sm font-bold uppercase tracking-wide mb-3 px-1"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}
          >
            {section.title}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isBusy = busyTarget === item.id;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border flex flex-col gap-3"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
                      : 'linear-gradient(145deg, #ffffff, #fafafa)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2.5 rounded-xl shrink-0"
                      style={{
                        background: item.danger === 'high' ? 'rgba(239,68,68,0.15)' : `${accentColor.color}18`,
                      }}
                    >
                      <Icon
                        className="size-5"
                        style={{ color: item.danger === 'high' ? '#ef4444' : accentColor.color }}
                        strokeWidth={2}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm" style={{ color: isDark ? '#fff' : '#111827' }}>
                        {item.label}
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestCleanup(item.id)}
                    disabled={!!busyTarget}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Tozalash
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div
        className="flex items-start gap-2 p-3 rounded-xl text-xs"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        }}
      >
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <span>
          Dashboard, analitika va 2FA sozlamalari bu yerda tozalanmaydi. Filial login ma&apos;lumotlari saqlanadi.
        </span>
      </div>

      <SecurityCodeModal
        isOpen={showCodeModal}
        onClose={() => {
          setShowCodeModal(false);
          setPendingTarget(null);
        }}
        onSuccess={handleCodeSuccess}
        action="delete"
        title={
          pendingTarget === 'all'
            ? "Barcha filial ma'lumotlarini o'chirish uchun maxfiy kodni kiriting"
            : `"${pendingMeta?.label || ''}" bo'limini tozalash uchun maxfiy kodni kiriting`
        }
      />
    </div>
  );
}

export default BranchCleanupPanel;
