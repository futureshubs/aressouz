import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';

type SalesPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type SalesFilter = 'all' | 'online' | 'offline';

type InventoryPeriod = SalesPeriod;
type InventoryFilter = 'all' | 'add' | 'remove' | 'damage' | 'expired' | 'return' | 'correction';

type SaleItem = {
  productName: string;
  variantName: string;
  quantity: number;
  price: number;
};

type Sale = {
  id: string;
  branchId: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'cash' | 'card' | 'qr' | string;
  type: 'online' | 'offline' | string;
  date: string;
  timestamp?: number;
  createdAt?: string;
};

type InventoryHistoryItem = {
  id: string;
  branchId: string;
  productId?: string;
  productName: string;
  variantId?: string;
  variantName: string;
  type?: string; // backend: `type`
  operationType?: InventoryFilter; // UI: `operationType`
  quantity: number;
  reason?: string;
  createdAt?: string;
  timestamp?: number;
  note?: string;
};

export function BogalterMarketView() {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('accountantSession') || 'null');
    } catch {
      return null;
    }
  }, []);

  const accountantToken: string = session?.token || '';

  const [activeSection, setActiveSection] = useState<'history' | 'statistics' | 'analytics'>('history');
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory'>('sales');

  const [sales, setSales] = useState<Sale[]>([]);
  const [inventoryOperations, setInventoryOperations] = useState<InventoryHistoryItem[]>([]);

  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('hourly');
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('all');

  const [inventoryPeriod, setInventoryPeriod] = useState<InventoryPeriod>('hourly');
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  const periodMap = useMemo(() => {
    const hourMs = 1 * 60 * 60 * 1000;
    return {
      hourly: hourMs,
      daily: 24 * hourMs,
      weekly: 7 * 24 * hourMs,
      monthly: 30 * 24 * hourMs,
      yearly: 365 * 24 * hourMs,
    } satisfies Record<SalesPeriod, number>;
  }, []);

  const getTs = (record: { timestamp?: number; createdAt?: string }) => {
    if (typeof record.timestamp === 'number') return record.timestamp;
    if (record.createdAt) return new Date(record.createdAt).getTime();
    return 0;
  };

  const filteredSales = useMemo(() => {
    const now = Date.now();
    return sales
      .filter((sale) => {
        const ts = getTs(sale);
        const timeMatch = now - ts <= periodMap[salesPeriod];
        const typeMatch = salesFilter === 'all' || sale.type === salesFilter;
        return timeMatch && typeMatch;
      })
      .sort((a, b) => getTs(b) - getTs(a));
  }, [sales, salesPeriod, salesFilter, periodMap]);

  const filteredInventory = useMemo(() => {
    const now = Date.now();
    return inventoryOperations
      .filter((op) => {
        const ts = getTs(op);
        const timeMatch = now - ts <= periodMap[inventoryPeriod];

        const opType = (op.operationType || op.type || '') as InventoryFilter;
        const typeMatch = inventoryFilter === 'all' || opType === inventoryFilter;

        return timeMatch && typeMatch;
      })
      .sort((a, b) => getTs(b) - getTs(a));
  }, [inventoryOperations, inventoryPeriod, inventoryFilter, periodMap]);

  const fmtNumber = (n: number) =>
    new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);

  const salesPeriodLabel: Record<SalesPeriod, string> = {
    hourly: '1 soatlik',
    daily: 'Kunlik',
    weekly: 'Haftalik',
    monthly: 'Oylik',
    yearly: 'Yillik',
  };

  const salesFilterLabel: Record<SalesFilter, string> = {
    all: 'Barchasi',
    online: 'Online',
    offline: 'Offline (POS)',
  };

  const inventoryPeriodLabel: Record<InventoryPeriod, string> = {
    hourly: '1 soatlik',
    daily: 'Kunlik',
    weekly: 'Haftalik',
    monthly: 'Oylik',
    yearly: 'Yillik',
  };

  const inventoryFilterLabel: Record<Exclude<InventoryFilter, 'all'>, string> = {
    add: 'Qo‘shish',
    remove: 'Ayirish',
    damage: 'Shikast',
    expired: 'Muddati o‘tgan',
    return: 'Qaytarish',
    correction: 'Tuzatish',
  };

  const salesStats = useMemo(() => {
    const revenue = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const totalTransactions = filteredSales.length;
    const avg = totalTransactions ? revenue / totalTransactions : 0;
    const onlineRevenue = filteredSales
      .filter((s) => s.type === 'online')
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const offlineRevenue = filteredSales
      .filter((s) => s.type === 'offline')
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    return { revenue, totalTransactions, avg, onlineRevenue, offlineRevenue };
  }, [filteredSales]);

  const inventoryStats = useMemo(() => {
    const opType = (op: InventoryHistoryItem) =>
      ((op.operationType || op.type || '') as InventoryFilter) ?? 'all';

    const sumBy = (t: Exclude<InventoryFilter, 'all'>) =>
      filteredInventory
        .filter((op) => opType(op) === t)
        .reduce((sum, op) => sum + (Number(op.quantity) || 0), 0);

    const add = sumBy('add');
    const remove = sumBy('remove');
    const damage = sumBy('damage');
    const expired = sumBy('expired');
    const returned = sumBy('return');
    const correction = sumBy('correction');

    // Semantika aniqligi yo‘qligi sababli "net"ni tez ko‘rsatish uchun oddiy formula qilamiz:
    // add + return + correction - remove - damage - expired
    const netChange = add + returned + correction - remove - damage - expired;

    return {
      add,
      remove,
      damage,
      expired,
      returned,
      correction,
      netChange,
      totalOperations: filteredInventory.length,
    };
  }, [filteredInventory]);

  const salesTopProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; qty: number }>();

    for (const sale of filteredSales) {
      for (const item of sale.items || []) {
        const variant = item.variantName?.trim() ? ` (${item.variantName})` : '';
        const name = `${item.productName}${variant}`;
        const key = `${item.productName}||${item.variantName || ''}`;
        const prev = map.get(key) || { name, revenue: 0, qty: 0 };
        prev.revenue += (Number(item.quantity) || 0) * (Number(item.price) || 0);
        prev.qty += Number(item.quantity) || 0;
        map.set(key, prev);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  const salesTrendByHour = useMemo(() => {
    // Rolling davr ichida soat bo'yicha daromad (qiyosiy analitika uchun).
    const map = new Map<string, number>();

    for (const sale of filteredSales) {
      const ts = getTs(sale);
      const d = new Date(ts);
      if (ts <= 0) continue;
      const label = `${String(d.getHours()).padStart(2, '0')}:00`;
      const prev = map.get(label) || 0;
      map.set(label, prev + (Number(sale.total) || 0));
    }

    const rows = Array.from(map.entries()).map(([label, revenue]) => ({ label, revenue }));
    // label 'HH:00' bo'lgani uchun lexicographic tartib soatga mos keladi.
    rows.sort((a, b) => (a.label < b.label ? -1 : 1));
    return rows.slice(-8);
  }, [filteredSales]);

  const inventoryImpactTopItems = useMemo(() => {
    const opType = (op: InventoryHistoryItem) =>
      ((op.operationType || op.type || '') as InventoryFilter) ?? 'all';

    const netByItem = new Map<string, { name: string; net: number; affectedQty: number }>();

    for (const op of filteredInventory) {
      const key = `${op.productName}||${op.variantName || ''}`;
      const variant = op.variantName?.trim() ? ` (${op.variantName})` : '';
      const name = `${op.productName}${variant}`;

      const qty = Number(op.quantity) || 0;
      const t = opType(op);

      const sign =
        t === 'add' || t === 'return' || t === 'correction'
          ? 1
          : t === 'remove' || t === 'damage' || t === 'expired'
            ? -1
            : 0;

      const prev = netByItem.get(key) || { name, net: 0, affectedQty: 0 };
      prev.net += qty * sign;
      prev.affectedQty += qty;
      netByItem.set(key, prev);
    }

    return Array.from(netByItem.values())
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 5);
  }, [filteredInventory]);

  useEffect(() => {
    if (!accountantToken) {
      toast.error('Bogalter sessiyasi topilmadi. Qayta kiring.');
      return;
    }

    const edgeFnHeaders: Record<string, string> = {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Accountant-Token': accountantToken,
      'Content-Type': 'application/json',
    };

    const loadSales = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/accountant/sales-history`,
          { headers: edgeFnHeaders }
        );
        if (!res.ok) throw new Error('sales-history fetch failed');
        const data = await res.json();
        setSales(data.sales || []);
      } catch (err) {
        console.error(err);
        toast.error('Sotuv tarixini yuklashda xatolik');
        setSales([]);
      }
    };

    const loadInventory = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/accountant/inventory-history`,
          { headers: edgeFnHeaders }
        );
        if (!res.ok) throw new Error('inventory-history fetch failed');
        const data = await res.json();

        const normalizeOpType = (raw: any): InventoryFilter => {
          const t = String(raw || '').toLowerCase().trim();
          // Backend history `type` quyidagicha bo'lishi mumkin: add | remove | sale | return | adjust | ...
          // UI filtr esa: add | remove | damage | expired | return | correction
          if (t === 'sale') return 'remove'; // Sotuv omborni kamaytiradi
          if (t === 'adjust') return 'correction';
          if (t === 'correction') return 'correction';
          if (t === 'add' || t === 'remove' || t === 'damage' || t === 'expired' || t === 'return') return t as InventoryFilter;
          return 'all';
        };

        const normalized: InventoryHistoryItem[] = (data.history || []).map((h: any) => ({
          ...h,
          // Back-end ba'zan `type`, ba'zan `operationType` saqlashi mumkin.
          operationType: normalizeOpType(h.operationType ?? h.type),
        }));

        setInventoryOperations(normalized);
      } catch (err) {
        console.error(err);
        toast.error('Ombor tarixini yuklashda xatolik');
        setInventoryOperations([]);
      }
    };

    loadSales();
    loadInventory();
  }, [accountantToken, visibilityTick]);

  return (
    <div className="space-y-6">
      {/* Sections */}
      <div className="flex flex-wrap items-center gap-3">
        {[
          { id: 'history' as const, label: 'Tarix' },
          { id: 'statistics' as const, label: 'Statistika' },
          { id: 'analytics' as const, label: 'Analitika' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="px-6 py-3 rounded-2xl font-semibold transition-all"
            style={{
              background:
                activeSection === s.id ? accentColor.gradient : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: activeSection === s.id ? '#ffffff' : isDark ? '#ffffff' : '#111827',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Statistics Section */}
      {activeSection === 'statistics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="p-5 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                Jami sotuv (daromad)
              </div>
              <div className="text-2xl font-bold" style={{ color: accentColor.color }}>
                {fmtNumber(salesStats.revenue)}
              </div>
              <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                {salesPeriodLabel[salesPeriod]} • {salesFilterLabel[salesFilter]}
              </div>
            </div>

            <div
              className="p-5 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                Tranzaksiya soni
              </div>
              <div className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                {salesStats.totalTransactions}
              </div>
              <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                Rolling davr bo‘yicha
              </div>
            </div>

            <div
              className="p-5 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                O‘rtacha chek
              </div>
              <div className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                {fmtNumber(salesStats.avg)}
              </div>
              <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                Online: {fmtNumber(salesStats.onlineRevenue)} • Offline: {fmtNumber(salesStats.offlineRevenue)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="p-5 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                Omborga qo‘shildi
              </div>
              <div className="text-2xl font-bold" style={{ color: accentColor.color }}>
                {fmtNumber(inventoryStats.add)}
              </div>
              <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                {inventoryPeriodLabel[inventoryPeriod]} • {inventoryFilter === 'all' ? 'Barchasi' : inventoryFilterLabel[inventoryFilter]}
              </div>
            </div>

            <div
              className="p-5 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                Ombordan olindi
              </div>
              <div className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                {fmtNumber(inventoryStats.remove)}
              </div>
              <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                Operatsiyalar: {inventoryStats.totalOperations}
              </div>
            </div>

            <div
              className="p-5 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                Net o‘zgarish
              </div>
              <div
                className="text-2xl font-bold"
                style={{
                  color: inventoryStats.netChange >= 0 ? accentColor.color : '#ff6b6b',
                }}
              >
                {fmtNumber(inventoryStats.netChange)}
              </div>
              <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                add + return + correction - remove - damage - expired
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      {activeSection === 'history' && (
        <>
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('sales')}
              className="px-6 py-3 rounded-2xl font-semibold transition-all"
              style={{
                background:
                  activeTab === 'sales'
                    ? accentColor.gradient
                    : isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.05)',
                color: activeTab === 'sales' ? '#ffffff' : isDark ? '#ffffff' : '#111827',
              }}
            >
              🧾 Bogalteriya: Sotuv tarixi
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-6 py-3 rounded-2xl font-semibold transition-all"
              style={{
                background:
                  activeTab === 'inventory'
                    ? accentColor.gradient
                    : isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.05)',
                color: activeTab === 'inventory' ? '#ffffff' : isDark ? '#ffffff' : '#111827',
              }}
            >
              🧾 Bogalteriya: Ombor operatsiyalari
            </button>
          </div>

          {/* Sales UI */}
          {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {[
              { id: 'hourly', label: '1 soatlik' },
              { id: 'daily', label: 'Kunlik' },
              { id: 'weekly', label: 'Haftalik' },
              { id: 'monthly', label: 'Oylik' },
              { id: 'yearly', label: 'Yillik' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSalesPeriod(p.id as SalesPeriod)}
                className="px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{
                  background:
                    salesPeriod === p.id ? accentColor.gradient : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: salesPeriod === p.id ? '#ffffff' : isDark ? '#ffffff' : '#111827',
                }}
              >
                {p.label}
              </button>
            ))}

            <div className="w-full lg:w-px lg:h-6" />

            {[
              { id: 'all', label: 'Barchasi' },
              { id: 'online', label: 'Online' },
              { id: 'offline', label: 'Offline (POS)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSalesFilter(f.id as SalesFilter)}
                className="px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{
                  background:
                    salesFilter === f.id ? `${accentColor.color}20` : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: salesFilter === f.id ? accentColor.color : isDark ? '#ffffff' : '#111827',
                  border: salesFilter === f.id ? `2px solid ${accentColor.color}` : '2px solid transparent',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0,0,0,0.6)' }}>
            Oxirgi {salesPeriod === 'hourly' ? '1 soat' : salesPeriod === 'daily' ? 'kun' : salesPeriod === 'weekly' ? 'hafta' : salesPeriod === 'monthly' ? 'oy' : 'yil'} ichidagi savdolar (aniq rolling).
          </div>

          {filteredSales.length === 0 ? (
            <div className="p-12 rounded-3xl border text-center" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' }}>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Savdolar topilmadi</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-6 rounded-3xl border"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                >
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <div>
                      <div className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0,0,0,0.6)' }}>
                        {sale.type === 'online' ? 'Online sotuv' : 'Offline sotuv (POS)'} • №{sale.id}
                      </div>
                      <div className="mt-1 font-semibold" style={{ color: accentColor.color }}>
                        {sale.total?.toLocaleString('uz-UZ')} so'm
                      </div>
                      <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0,0,0,0.6)' }}>
                        {sale.date} •{' '}
                        {new Date(getTs(sale)).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0,0,0,0.6)' }}>
                      To'lov: {sale.paymentMethod === 'cash' ? 'Naqd' : sale.paymentMethod === 'card' ? 'Karta' : 'QR'}
                    </div>
                  </div>

                  <div className="space-y-2 pt-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                    {sale.items.map((item, idx) => (
                      <div key={`${sale.id}-${idx}`} className="flex items-center justify-between py-1.5">
                        <div className="min-w-0">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                            {item.variantName} × {item.quantity}
                          </div>
                        </div>
                        <div className="font-semibold">
                          {(item.price * item.quantity).toLocaleString('uz-UZ')} so'm
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          )}

          {/* Inventory UI */}
          {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {[
              { id: 'hourly', label: '1 soatlik' },
              { id: 'daily', label: 'Kunlik' },
              { id: 'weekly', label: 'Haftalik' },
              { id: 'monthly', label: 'Oylik' },
              { id: 'yearly', label: 'Yillik' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setInventoryPeriod(p.id as InventoryPeriod)}
                className="px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{
                  background:
                    inventoryPeriod === p.id ? accentColor.gradient : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: inventoryPeriod === p.id ? '#ffffff' : isDark ? '#ffffff' : '#111827',
                }}
              >
                {p.label}
              </button>
            ))}

            {[
              { id: 'all', label: 'Barchasi' },
              { id: 'add', label: 'Qo\'shildi' },
              { id: 'remove', label: 'Olib tashlandi' },
              { id: 'damage', label: 'Buzilgan' },
              { id: 'expired', label: 'Muddati o\'tgan' },
              { id: 'return', label: 'Qaytarildi' },
              { id: 'correction', label: 'To\'g\'irlandi' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setInventoryFilter(f.id as InventoryFilter)}
                className="px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{
                  background:
                    inventoryFilter === f.id ? `${accentColor.color}20` : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: inventoryFilter === f.id ? accentColor.color : isDark ? '#ffffff' : '#111827',
                  border: inventoryFilter === f.id ? `2px solid ${accentColor.color}` : '2px solid transparent',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredInventory.length === 0 ? (
            <div className="p-12 rounded-3xl border text-center" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' }}>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Operatsiyalar topilmadi</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInventory.map((op) => {
                const opType = (op.operationType || op.type || '') as InventoryFilter;
                const opName =
                  opType === 'add'
                    ? 'Qo\'shildi'
                    : opType === 'remove'
                    ? 'Olib tashlandi'
                    : opType === 'damage'
                    ? 'Buzilgan'
                    : opType === 'expired'
                    ? 'Muddati o\'tgan'
                    : opType === 'return'
                    ? 'Qaytarildi'
                    : opType === 'correction'
                    ? 'To\'g\'irlandi'
                    : 'Operatsiya';

                return (
                  <div
                    key={op.id}
                    className="p-6 rounded-3xl border"
                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="text-sm font-semibold">{opName}</div>
                        <div className="mt-1 font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                          {op.productName}
                        </div>
                        <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                          {op.variantName} • {op.quantity} dona
                        </div>
                      </div>

                      <div className="text-right text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                        {op.createdAt ? new Date(op.createdAt).toLocaleDateString('uz-UZ') : ''} •{' '}
                        {new Date(getTs(op)).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {op.reason ? (
                      <div className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}>
                        Sabab: {op.reason}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
          )}
        </>
      )}

      {/* Analytics Section */}
      {activeSection === 'analytics' && (
        <div className="space-y-6">
          <div
            className="p-5 rounded-3xl border"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <div className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
              Analitika (rolling davr + filtr)
            </div>
            <div className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              Sotuv: {salesPeriodLabel[salesPeriod]} • {salesFilterLabel[salesFilter]}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="p-5 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                Top mahsulotlar (daromad)
              </div>
              <div className="mt-3 space-y-3">
                {salesTopProducts.length === 0 ? (
                  <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Ma’lumot yo‘q
                  </div>
                ) : (
                  salesTopProducts.map((p) => (
                    <div key={p.name} className="flex items-start justify-between gap-3">
                      <div className="text-xs" style={{ color: isDark ? '#ffffff' : '#111827', flex: 1 }}>
                        {p.name}
                        <div className="text-[11px] opacity-70">Soni: {p.qty}</div>
                      </div>
                      <div className="text-xs font-semibold" style={{ color: accentColor.color }}>
                        {fmtNumber(p.revenue)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className="p-5 rounded-3xl border md:col-span-2"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                Soat bo‘yicha daromad
              </div>
              <div className="mt-4 space-y-3">
                {salesTrendByHour.length === 0 ? (
                  <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Ma’lumot yo‘q
                  </div>
                ) : (
                  (() => {
                    const max = Math.max(...salesTrendByHour.map((r) => r.revenue), 1);
                    return salesTrendByHour.map((r) => {
                      const w = Math.round((r.revenue / max) * 100);
                      return (
                        <div key={r.label} className="flex items-center gap-3">
                          <div className="w-[56px] text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                            {r.label}
                          </div>
                          <div className="flex-1 h-2 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${w}%`, background: accentColor.color }}
                            />
                          </div>
                          <div className="w-[88px] text-right text-[11px] font-semibold" style={{ color: accentColor.color }}>
                            {fmtNumber(r.revenue)}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </div>

          <div
            className="p-5 rounded-3xl border"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
              Ombor ta’siri (net o‘zgarish bo‘yicha)
            </div>
            <div className="mt-4 space-y-3">
              {inventoryImpactTopItems.length === 0 ? (
                <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                  Ma’lumot yo‘q
                </div>
              ) : (
                inventoryImpactTopItems.map((p) => (
                  <div key={p.name} className="flex items-center justify-between gap-3">
                    <div className="text-xs" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      {p.name}
                      <div className="text-[11px] opacity-70">Ta’sirlangan miqdor: {p.affectedQty}</div>
                    </div>
                    <div
                      className="text-xs font-semibold"
                      style={{ color: p.net >= 0 ? accentColor.color : '#ff6b6b' }}
                    >
                      Net: {fmtNumber(p.net)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

