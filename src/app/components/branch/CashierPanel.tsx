import { useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { Payments } from './Payments';

type CashierPanelProps = {
  branchId?: string;
  branchInfo?: {
    region: string;
    district: string;
    phone: string;
  };
};

export function CashierPanel({ branchId, branchInfo }: CashierPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!branchId) {
    return (
      <div
        className="min-h-screen"
        style={{
          background: isDark ? '#000000' : '#f9fafb',
          color: isDark ? '#ffffff' : '#111827',
        }}
      >
        <div className="p-10 rounded-3xl border text-center m-4" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Filial tanlanmagan</div>
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>Avval operator/omborchi orqali filialga kiring.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Kassa paneli</h1>
          <p style={{ opacity: 0.7, fontSize: 13 }}>
            Kassa bo'limi uchun to'lovlar tarixi.
          </p>
        </div>

        <div
          className="p-6 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4">To'lovlar tarixi</h2>
          <Payments branchId={branchId} branchInfo={branchInfo} />
        </div>
      </div>
    </div>
  );
}

