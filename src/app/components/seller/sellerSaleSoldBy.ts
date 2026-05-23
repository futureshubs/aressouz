export type SaleSoldByRole = 'owner' | 'worker' | 'online';

export type SaleSoldByFields = {
  staffId?: string;
  staffName?: string;
  soldBy?: string;
  soldByRole?: SaleSoldByRole;
};

/** Offline sotuvda ishchi ismi yoki egasi uchun "Seller" */
export function getSaleSoldByLabel(row: SaleSoldByFields & { kind?: string }): string {
  if (row.soldBy) return row.soldBy;
  if (row.kind === 'online') return 'Online';
  if (row.staffId) return String(row.staffName || '').trim() || 'Ishchi';
  return 'Seller';
}

export function isWorkerSale(row: SaleSoldByFields): boolean {
  return row.soldByRole === 'worker' || Boolean(row.staffId);
}

export function soldByBadgeStyle(isDark: boolean, role: SaleSoldByRole | undefined, accentColor: string) {
  if (role === 'worker') {
    return {
      background: `${accentColor}22`,
      color: accentColor,
      borderColor: `${accentColor}44`,
    };
  }
  if (role === 'online') {
    return {
      background: isDark ? 'rgba(96,165,250,0.15)' : 'rgba(59,130,246,0.12)',
      color: isDark ? '#93c5fd' : '#2563eb',
      borderColor: isDark ? 'rgba(96,165,250,0.35)' : 'rgba(59,130,246,0.25)',
    };
  }
  return {
    background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)',
    color: isDark ? '#86efac' : '#15803d',
    borderColor: isDark ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.25)',
  };
}
