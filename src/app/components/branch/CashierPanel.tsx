import { useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Payments } from './Payments';
import { CashierCashReceiveTab } from './CashierCashReceiveTab';
import { ArrowDownToLine, ArrowUpFromLine, Store } from 'lucide-react';

type CashierPanelProps = {
  branchId?: string;
  branchInfo?: {
    region: string;
    district: string;
    phone: string;
  };
};

type CashierTab = 'receive' | 'payout';

export function CashierPanel({ branchId, branchInfo }: CashierPanelProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<CashierTab>('receive');

  const surface = useMemo(
    () => (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.92)'),
    [isDark],
  );
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.58)';

  if (!branchId) {
    return (
      <div
        className="app-panel-viewport app-safe-pad"
        style={{
          background: isDark ? '#000000' : '#f9fafb',
          color: isDark ? '#ffffff' : '#111827',
        }}
      >
        <div className="app-panel-main-scroll p-4 min-h-0">
        <div
          className="p-10 rounded-3xl border text-center m-4"
          style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>Filial tanlanmagan</div>
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
            Avval filial paneliga kiring yoki operator orqali filialni tanlang.
          </div>
        </div>
        </div>
      </div>
    );
  }

  const tabs: { id: CashierTab; label: string; hint: string; icon: typeof ArrowDownToLine }[] = [
    {
      id: 'receive',
      label: 'Qabul qilish',
      hint: 'Kuryer naqd mahsulot pulini topshiradi',
      icon: ArrowDownToLine,
    },
    {
      id: 'payout',
      label: 'Berish',
      hint: 'Do‘kon / taom — tadbirkorga to‘lov (QR, chek)',
      icon: ArrowUpFromLine,
    },
  ];

  return (
    <div
      className="app-panel-viewport app-safe-pad"
      style={{
        background: isDark ? '#000000' : '#f4f6f9',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <div className="app-panel-main-scroll p-4 lg:p-8 max-w-6xl mx-auto space-y-6 min-h-0">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-2xl"
              style={{ background: `${accentColor.color}22`, color: accentColor.color }}
            >
              <Store className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Kassa</h1>
              <p className="text-sm" style={{ color: muted }}>
                Ikki yo‘nalish: mijozdan kelgan naqdni qabul qilish va tadbirkorga to‘lovlar
              </p>
            </div>
          </div>
        </header>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 rounded-2xl border"
          style={{ background: surface, borderColor: border }}
          role="tablist"
          aria-label="Kassa bo‘limlari"
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className="flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-all"
                style={{
                  background: active ? accentColor.gradient : 'transparent',
                  color: active ? '#ffffff' : isDark ? '#f3f4f6' : '#111827',
                  boxShadow: active ? `0 8px 24px ${accentColor.color}44` : 'none',
                }}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  <span className="block font-bold">{t.label}</span>
                  <span
                    className="block text-xs mt-0.5 leading-snug"
                    style={{ opacity: active ? 0.95 : 0.75 }}
                  >
                    {t.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="rounded-3xl border overflow-hidden shadow-sm"
          style={{ background: surface, borderColor: border }}
        >
          {tab === 'receive' ? (
            <div className="p-5 sm:p-6">
              <CashierCashReceiveTab branchId={branchId} />
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-sm" style={{ color: muted }}>
                Taom va do‘kon buyurtmalari uchun to‘lovlar, QR va chek tasdiqlari — quyidagi jadvaldan boshqariladi.
                Restoran / sotuvchi qabul qilgach, shu yerda «to‘lov kutilmoqda» ko‘rinishi kerak.
              </p>
              <Payments variant="cashier" branchId={branchId} branchInfo={branchInfo} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
