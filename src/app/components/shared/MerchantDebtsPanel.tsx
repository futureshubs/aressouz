import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Plus,
  Phone,
  User,
  Calendar,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ChevronDown,
  ChevronUp,
  History,
  Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import UzPhoneInput from './UzPhoneInput';
import { formatUzPhoneDisplay } from '../../utils/uzPhoneInput';

export type MerchantDebtPurchaseEntry = {
  saleId?: string | null;
  at: string;
  totalUzs: number;
  paidAtSaleUzs: number;
  debtAddedUzs: number;
  itemsSummary?: string;
  note?: string;
};

export type MerchantDebtPaymentEntry = {
  at: string;
  amountUzs: number;
  remainingAfterUzs: number;
};

export type MerchantDebtRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  amountUzs: number;
  paidUzs: number;
  remainingUzs: number;
  dueDate: string | null;
  status: 'open' | 'overdue' | 'paid';
  createdAt: string;
  updatedAt?: string;
  saleId?: string | null;
  purchases?: MerchantDebtPurchaseEntry[];
  payments?: MerchantDebtPaymentEntry[];
};

type Props = {
  mode: 'seller' | 'restaurant';
  merchantName: string;
  sellerToken?: string;
  restaurantId?: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
};

const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

function formatUzs(n: number) {
  return `${Math.max(0, Math.floor(n)).toLocaleString('uz-UZ')} so'm`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('uz-UZ');
}

function formatDateTime(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('uz-UZ');
}

function statusLabel(s: MerchantDebtRow['status']) {
  if (s === 'paid') return 'Yopilgan';
  if (s === 'overdue') return 'Muddati o\'tgan';
  return 'Ochiq';
}

export default function MerchantDebtsPanel({
  mode,
  merchantName,
  sellerToken = '',
  restaurantId = '',
  isDark,
  accentColor,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<MerchantDebtRow[]>([]);
  const [smsConfigured, setSmsConfigured] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'overdue' | 'paid'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    amountUzs: '',
    paidUzs: '0',
    dueDate: '',
  });

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  const headers = useMemo(() => {
    if (mode === 'seller') {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
        'X-Seller-Token': sellerToken,
      };
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
    };
  }, [mode, sellerToken]);

  const listUrl =
    mode === 'seller'
      ? `${apiBase}/seller/debts?token=${encodeURIComponent(sellerToken)}`
      : `${apiBase}/restaurants/${encodeURIComponent(restaurantId)}/debts`;

  const loadDebts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
      setDebts(Array.isArray(data.debts) ? data.debts : []);
      setSmsConfigured(data.smsConfigured !== false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Qarzlarni yuklab bo\'lmadi');
      setDebts([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl, headers]);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  const summary = useMemo(() => {
    const open = debts.filter((d) => d.status === 'open' || d.status === 'overdue');
    return {
      openCount: open.length,
      overdueCount: debts.filter((d) => d.status === 'overdue').length,
      remainingUzs: open.reduce((s, d) => s + d.remainingUzs, 0),
    };
  }, [debts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return debts;
    if (filter === 'open') return debts.filter((d) => d.status === 'open');
    if (filter === 'overdue') return debts.filter((d) => d.status === 'overdue');
    return debts.filter((d) => d.status === 'paid');
  }, [debts, filter]);

  const createDebt = async () => {
    const amountUzs = Math.max(0, Math.floor(Number(form.amountUzs) || 0));
    const paidUzs = Math.max(0, Math.floor(Number(form.paidUzs) || 0));
    if (!form.customerName.trim()) {
      toast.error('Mijoz ismini kiriting');
      return;
    }
    if (form.customerPhone.replace(/\D/g, '').length < 12) {
      toast.error('Telefon raqamini to\'liq kiriting (+998 va 9 ta raqam)');
      return;
    }
    if (amountUzs <= 0) {
      toast.error('Qarz summasini kiriting');
      return;
    }
    if (amountUzs - paidUzs <= 0) {
      toast.error('Qolgan qarz 0 dan katta bo\'lishi kerak');
      return;
    }

    const url =
      mode === 'seller'
        ? `${apiBase}/seller/debts?token=${encodeURIComponent(sellerToken)}`
        : `${apiBase}/restaurants/${encodeURIComponent(restaurantId)}/debts`;

    try {
      setBusyId('create');
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim(),
          amountUzs,
          paidUzs,
          dueDate: form.dueDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Saqlanmadi');
      if (data.merged) toast.success('Mavjud mijoz qarziga qo\'shildi, SMS yuborildi');
      else if (data.smsError) toast.warning(`Qarz saqlandi, SMS: ${data.smsError}`);
      else toast.success('Qarz qo\'shildi, SMS yuborildi');
      setShowAdd(false);
      setForm({ customerName: '', customerPhone: '', amountUzs: '', paidUzs: '0', dueDate: '' });
      await loadDebts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusyId(null);
    }
  };

  const payDebt = async (debt: MerchantDebtRow, amountUzs?: number) => {
    const pay = Math.max(0, Math.floor(Number(amountUzs) || 0));
    if (pay <= 0) {
      toast.error('To\'lov summasini kiriting');
      return;
    }
    if (pay > debt.remainingUzs) {
      toast.error(`Maksimum ${formatUzs(debt.remainingUzs)}`);
      return;
    }

    const url =
      mode === 'seller'
        ? `${apiBase}/seller/debts/${encodeURIComponent(debt.id)}/pay?token=${encodeURIComponent(sellerToken)}`
        : `${apiBase}/restaurants/${encodeURIComponent(restaurantId)}/debts/${encodeURIComponent(debt.id)}/pay`;

    try {
      setBusyId(debt.id);
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amountUzs: pay }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Xatolik');
      if (data.fullyPaid) {
        if (data.smsError) toast.warning(`Qarz yopildi. SMS: ${data.smsError}`);
        else toast.success('Qarz to\'liq yopildi, mijozga SMS yuborildi');
      } else {
        toast.success(`${formatUzs(pay)} qabul qilindi. Qolgan: ${formatUzs(data.debt?.remainingUzs ?? 0)}`);
      }
      setPayDraft((p) => ({ ...p, [debt.id]: '' }));
      await loadDebts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusyId(null);
    }
  };

  const remindDebt = async (debt: MerchantDebtRow) => {
    const url =
      mode === 'seller'
        ? `${apiBase}/seller/debts/${encodeURIComponent(debt.id)}/remind?token=${encodeURIComponent(sellerToken)}`
        : `${apiBase}/restaurants/${encodeURIComponent(restaurantId)}/debts/${encodeURIComponent(debt.id)}/remind`;
    try {
      setBusyId(`remind-${debt.id}`);
      const res = await fetch(url, { method: 'POST', headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'SMS yuborilmadi');
      toast.success('Eslatma SMS yuborildi');
      await loadDebts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: accentColor.color }} />
            Qarzlar
          </h2>
          <p className="text-xs mt-1" style={{ opacity: 0.7 }}>
            {merchantName} — ochiq qarz: {summary.openCount} ta ({formatUzs(summary.remainingUzs)})
          </p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.55 }}>
            Bir telefon uchun yangi qarz avtomatik mavjud yozuvga qo&apos;shiladi
          </p>
          {!smsConfigured ? (
            <p className="text-xs mt-1 text-amber-500">SMS (Eskiz) sozlanmagan — xabarlar yuborilmaydi.</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: accentColor.gradient }}
        >
          <Plus className="w-4 h-4" />
          Qarz qo&apos;shish
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { id: 'all', label: 'Hammasi' },
          { id: 'open', label: 'Ochiq' },
          { id: 'overdue', label: 'Kechikkan' },
          { id: 'paid', label: 'Yopilgan' },
        ] as const).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="py-2 rounded-xl border text-xs font-bold"
            style={{
              ...cardStyle,
              ...(filter === f.id
                ? { background: accentColor.gradient, color: '#fff', borderColor: 'transparent' }
                : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showAdd ? (
        <div className="rounded-3xl border p-4 space-y-3" style={cardStyle}>
          <h3 className="font-bold">Yangi qarz</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="opacity-70 flex items-center gap-1 mb-1"><User className="w-3.5 h-3.5" /> Ism</span>
              <input
                value={form.customerName}
                onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ background: isDark ? '#111' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
              />
            </label>
            <label className="block text-sm">
              <span className="opacity-70 flex items-center gap-1 mb-1"><Phone className="w-3.5 h-3.5" /> Telefon</span>
              <UzPhoneInput
                value={form.customerPhone}
                onChange={(v) => setForm((p) => ({ ...p, customerPhone: v }))}
                isDark={isDark}
              />
            </label>
            <label className="block text-sm">
              <span className="opacity-70 mb-1 block">Jami qarz (so&apos;m)</span>
              <input
                type="number"
                min={0}
                value={form.amountUzs}
                onChange={(e) => setForm((p) => ({ ...p, amountUzs: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ background: isDark ? '#111' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
              />
            </label>
            <label className="block text-sm">
              <span className="opacity-70 mb-1 block">Hozir to&apos;langan (ixtiyoriy)</span>
              <input
                type="number"
                min={0}
                value={form.paidUzs}
                onChange={(e) => setForm((p) => ({ ...p, paidUzs: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ background: isDark ? '#111' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="opacity-70 flex items-center gap-1 mb-1"><Calendar className="w-3.5 h-3.5" /> Qaytarish sanasi (ixtiyoriy)</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                style={{ background: isDark ? '#111' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busyId === 'create'}
            onClick={() => void createDebt()}
            className="w-full py-2.5 rounded-xl font-bold text-white disabled:opacity-50"
            style={{ background: accentColor.gradient }}
          >
            {busyId === 'create' ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Saqlash va SMS yuborish'}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center text-sm" style={{ ...cardStyle, opacity: 0.8 }}>
          Qarzlar yo&apos;q
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const busy = busyId === d.id || busyId === `remind-${d.id}`;
            const overdue = d.status === 'overdue';
            const expanded = expandedId === d.id;
            const purchases = Array.isArray(d.purchases) ? d.purchases : [];
            const payments = Array.isArray(d.payments) ? d.payments : [];
            const payVal = payDraft[d.id] ?? '';
            const payNum = Math.floor(Number(payVal) || 0);
            const totalPurchased = purchases.reduce((s, p) => s + (p.debtAddedUzs || 0), 0);

            return (
              <div key={d.id} className="rounded-2xl border p-4" style={cardStyle}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-bold flex items-center gap-2 flex-wrap">
                      {d.customerName}
                      {purchases.length > 1 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ background: `${accentColor.color}22`, color: accentColor.color }}>
                          {purchases.length} ta savdo
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm opacity-70 tabular-nums">
                      {formatUzPhoneDisplay(d.customerPhone) || d.customerPhone}
                    </div>
                    <div className="text-xs mt-1 opacity-60">
                      {formatDateTime(d.updatedAt || d.createdAt)}
                      {d.dueDate ? ` · muddat: ${formatDate(d.dueDate)}` : ''}
                    </div>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{
                      background: d.status === 'paid' ? '#22c55e22' : overdue ? '#ef444422' : '#f59e0b22',
                      color: d.status === 'paid' ? '#22c55e' : overdue ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {statusLabel(d.status)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="opacity-60 text-xs">Qolgan qarz</div>
                    <div className="font-bold tabular-nums" style={{ color: accentColor.color }}>{formatUzs(d.remainingUzs)}</div>
                  </div>
                  <div>
                    <div className="opacity-60 text-xs">Jami xarid</div>
                    <div className="font-semibold tabular-nums">{formatUzs(d.amountUzs)}</div>
                  </div>
                  <div>
                    <div className="opacity-60 text-xs">To&apos;langan</div>
                    <div className="font-semibold tabular-nums">{formatUzs(d.paidUzs)}</div>
                  </div>
                  <div>
                    <div className="opacity-60 text-xs">Qarzga qo&apos;shilgan</div>
                    <div className="font-semibold tabular-nums">{formatUzs(totalPurchased || d.remainingUzs)}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : d.id)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-bold"
                  style={cardStyle}
                >
                  <History className="w-3.5 h-3.5" />
                  Tarix ({purchases.length} xarid, {payments.length} to&apos;lov)
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {expanded ? (
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <div className="text-xs font-bold opacity-70 mb-2">Nima olgan (xaridlar)</div>
                      {purchases.length === 0 ? (
                        <p className="text-xs opacity-50">Tarix yo&apos;q</p>
                      ) : (
                        <div className="space-y-2">
                          {[...purchases].reverse().map((p, i) => (
                            <div
                              key={`${p.at}-${i}`}
                              className="rounded-xl border px-3 py-2 text-xs"
                              style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
                            >
                              <div className="font-semibold">{formatDateTime(p.at)}</div>
                              <div className="mt-1 opacity-80">{p.itemsSummary || 'Savdo'}</div>
                              <div className="mt-1 flex flex-wrap gap-3 tabular-nums">
                                <span>Jami: {formatUzs(p.totalUzs)}</span>
                                <span>To&apos;langan: {formatUzs(p.paidAtSaleUzs)}</span>
                                <span style={{ color: accentColor.color }}>Qarz: +{formatUzs(p.debtAddedUzs)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {payments.length > 0 ? (
                      <div>
                        <div className="text-xs font-bold opacity-70 mb-2">To&apos;lovlar</div>
                        <div className="space-y-2">
                          {[...payments].reverse().map((p, i) => (
                            <div
                              key={`${p.at}-${i}`}
                              className="rounded-xl border px-3 py-2 text-xs flex justify-between gap-2"
                              style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
                            >
                              <span>{formatDateTime(p.at)}</span>
                              <span className="font-bold text-emerald-500 tabular-nums">+{formatUzs(p.amountUzs)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {d.status !== 'paid' ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={d.remainingUzs}
                        placeholder="Qisman to'lov summasi"
                        value={payVal}
                        onChange={(e) => setPayDraft((p) => ({ ...p, [d.id]: e.target.value }))}
                        className="flex-1 min-w-[140px] rounded-xl border px-3 py-2 text-sm font-bold tabular-nums"
                        style={{
                          background: isDark ? '#111' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                        }}
                      />
                      <button
                        type="button"
                        disabled={busy || payNum <= 0}
                        onClick={() => void payDebt(d, payNum)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-50"
                        style={cardStyle}
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
                        Qisman to&apos;lash
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void payDebt(d, d.remainingUzs)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                        style={{ background: accentColor.gradient }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Hammasini
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remindDebt(d)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-50"
                        style={cardStyle}
                      >
                        <Bell className="w-3.5 h-3.5" />
                        Eslatma
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Yopilgan
                  </div>
                )}

                {overdue ? (
                  <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Muddati o&apos;tgan
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
