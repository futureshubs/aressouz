import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { SMS_OPERATOR_RATES, currentBillingMonth, formatUzs } from '../../utils/smsOperatorRates';
import { formatUzPhoneDisplay } from '../../utils/uzPhoneInput';

type SmsEntry = {
  at: string;
  phone: string;
  operator: string;
  costUzs: number;
  smsKind: string;
  success: boolean;
};

type BillingSummary = {
  month: string;
  totalCount: number;
  totalCostUzs: number;
  paid: boolean;
  paidAt: string | null;
  byOperator: Record<string, { count: number; costUzs: number; rateUzs: number; label: string }>;
  entries?: SmsEntry[];
  recentEntries?: SmsEntry[];
};

type Props = {
  mode: 'seller' | 'restaurant' | 'branch';
  sellerToken?: string;
  restaurantId?: string;
  branchId?: string;
  merchantLabel?: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  shopBillings?: Array<{ shopId: string; shopName: string; billing: BillingSummary }>;
  onRefreshBranch?: () => void;
  onMarkShopPaid?: (shopId: string, paid: boolean) => Promise<void>;
};

const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

const SMS_KIND_LABELS: Record<string, string> = {
  debt_new: 'Yangi qarz',
  debt_merge: "Qarz qo'shildi",
  debt_reminder: 'Eslatma',
  debt_paid: "To'lov qabul",
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return currentBillingMonth(d);
}

function operatorLabel(id: string): string {
  return SMS_OPERATOR_RATES.find((r) => r.id === id)?.label || id;
}

function smsKindLabel(kind: string) {
  return SMS_KIND_LABELS[kind] || kind;
}

export function SmsRatesTable({ isDark }: { isDark: boolean }) {
  return (
    <div className="rounded-2xl border overflow-hidden text-sm">
      <table className="w-full">
        <thead>
          <tr style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <th className="text-left p-3 font-bold">Operator</th>
            <th className="text-right p-3 font-bold">Servis SMS</th>
          </tr>
        </thead>
        <tbody>
          {SMS_OPERATOR_RATES.map((r) => (
            <tr
              key={r.id}
              className="border-t"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
            >
              <td className="p-3 font-medium">{r.label}</td>
              <td className="p-3 text-right tabular-nums font-bold">{formatUzs(r.serviceTypeUzs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SmsEntriesTable({
  entries,
  isDark,
  accentColor,
}: {
  entries: SmsEntry[];
  isDark: boolean;
  accentColor: { color: string; gradient: string };
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-center py-6 opacity-60">Bu oy SMS yuborilmagan</p>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: isDark ? 'rgba(30,30,30,0.98)' : 'rgba(249,250,251,0.98)' }}>
              <th className="text-left p-3 font-bold">Vaqt</th>
              <th className="text-left p-3 font-bold">Telefon</th>
              <th className="text-left p-3 font-bold">Operator</th>
              <th className="text-left p-3 font-bold">Tur</th>
              <th className="text-right p-3 font-bold">Narx</th>
              <th className="text-center p-3 font-bold">Holat</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={`${e.at}-${e.phone}-${i}`}
                className="border-t"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
              >
                <td className="p-3 whitespace-nowrap text-xs">
                  {new Date(e.at).toLocaleString('uz-UZ')}
                </td>
                <td className="p-3 font-medium tabular-nums whitespace-nowrap">
                  {formatUzPhoneDisplay(e.phone) || e.phone}
                </td>
                <td className="p-3">{operatorLabel(e.operator)}</td>
                <td className="p-3">{smsKindLabel(e.smsKind)}</td>
                <td className="p-3 text-right font-bold tabular-nums" style={{ color: accentColor.color }}>
                  {formatUzs(e.costUzs)}
                </td>
                <td className="p-3 text-center">
                  {e.success ? (
                    <span className="text-emerald-500 text-xs font-bold">OK</span>
                  ) : (
                    <span className="text-red-400 text-xs font-bold">Xato</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BillingCard({
  billing,
  title,
  isDark,
  accentColor,
  busy,
  allowMarkPaid,
  readOnlyAnalytics,
  onTogglePaid,
}: {
  billing: BillingSummary;
  title?: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  busy?: boolean;
  allowMarkPaid?: boolean;
  readOnlyAnalytics?: boolean;
  onTogglePaid?: (paid: boolean) => void;
}) {
  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  const ops = Object.values(billing.byOperator || {}).filter((o) => o.count > 0);
  const entries = billing.entries?.length
    ? billing.entries
    : billing.recentEntries || [];

  return (
    <div className="rounded-2xl border p-4 space-y-4" style={cardStyle}>
      {title ? <h4 className="font-bold text-lg">{title}</h4> : null}

      <div className={`grid gap-3 ${readOnlyAnalytics ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
        <div>
          <p className="text-xs opacity-60">SMS (oy)</p>
          <p className="text-xl font-bold tabular-nums">{billing.totalCount}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">Hisoblangan summa</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: accentColor.color }}>
            {formatUzs(billing.totalCostUzs)}
          </p>
        </div>
        {!readOnlyAnalytics ? (
          <div>
            <p className="text-xs opacity-60">To&apos;lov holati</p>
            <p
              className="text-sm font-bold flex items-center gap-1 mt-1"
              style={{ color: billing.paid ? '#22c55e' : '#f59e0b' }}
            >
              {billing.paid ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {billing.paid ? "To'landi" : "To'lanmagan"}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs opacity-60">Filial to&apos;lovi</p>
            <p
              className="text-sm font-bold flex items-center gap-1 mt-1"
              style={{ color: billing.paid ? '#22c55e' : '#94a3b8' }}
            >
              {billing.paid ? "To'langan" : "Kutilmoqda"}
            </p>
          </div>
        )}
      </div>

      {ops.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold opacity-70 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" />
            Operator bo&apos;yicha analitika
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ops.map((o) => (
              <div
                key={o.label}
                className="rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
              >
                <div className="font-bold">{o.label}</div>
                <div className="tabular-nums mt-1">{o.count} ta · {formatUzs(o.costUzs)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {allowMarkPaid && onTogglePaid ? (
        <button
          type="button"
          disabled={busy || billing.totalCostUzs <= 0}
          onClick={() => onTogglePaid(!billing.paid)}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: billing.paid ? '#64748b' : accentColor.gradient }}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin inline" />
          ) : billing.paid ? (
            "To'lanmagan deb belgilash"
          ) : (
            "To'landi deb belgilash"
          )}
        </button>
      ) : null}

      <div>
        <p className="text-sm font-bold mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: accentColor.color }} />
          Kimga yuborilgan ({entries.length})
        </p>
        <SmsEntriesTable entries={entries} isDark={isDark} accentColor={accentColor} />
      </div>
    </div>
  );
}

export default function MerchantSmsBillingPanel({
  mode,
  sellerToken = '',
  restaurantId = '',
  merchantLabel = '',
  isDark,
  accentColor,
  shopBillings,
  onRefreshBranch,
  onMarkShopPaid,
}: Props) {
  const [month, setMonth] = useState(currentBillingMonth());
  const [loading, setLoading] = useState(mode !== 'branch');
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [smsConfigured, setSmsConfigured] = useState(true);
  const isBranch = mode === 'branch';
  const readOnly = !isBranch;

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
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

  const load = useCallback(async () => {
    if (isBranch) return;
    setLoading(true);
    try {
      const url =
        mode === 'seller'
          ? `${apiBase}/seller/sms-billing?token=${encodeURIComponent(sellerToken)}&month=${encodeURIComponent(month)}`
          : `${apiBase}/restaurants/${encodeURIComponent(restaurantId)}/sms-billing?month=${encodeURIComponent(month)}`;
      const res = await fetch(url, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
      setBilling(data.billing);
      setSmsConfigured(data.smsConfigured !== false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yuklab bo\'lmadi');
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }, [isBranch, mode, sellerToken, restaurantId, month, headers]);

  useEffect(() => {
    if (!isBranch) void load();
  }, [load, isBranch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: accentColor.color }} />
            SMS {readOnly ? 'statistikasi' : 'hisobi'}
          </h2>
          <p className="text-xs mt-1 opacity-70">
            {merchantLabel || (isBranch ? 'Filial do\'konlari' : 'Qarz SMS')}
            {readOnly
              ? ' — faqat ko\'rish. To\'lovni filial belgilaydi.'
              : ' — operator narxi bo\'yicha, to\'lovni shu yerda belgilang'}
          </p>
          {!smsConfigured && !isBranch ? (
            <p className="text-xs text-amber-500 mt-1">Eskiz sozlanmagan</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="p-2 rounded-xl border" style={cardStyle}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold tabular-nums min-w-[5rem] text-center">{month}</span>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="p-2 rounded-xl border" style={cardStyle}>
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isBranch ? (
            <button type="button" onClick={() => void load()} className="p-2 rounded-xl border" style={cardStyle}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          ) : onRefreshBranch ? (
            <button type="button" onClick={() => onRefreshBranch()} className="p-2 rounded-xl border" style={cardStyle}>
              <RefreshCw className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-2 opacity-80">Operator narxlari (servis turdagi SMS)</h3>
        <SmsRatesTable isDark={isDark} />
      </div>

      {isBranch && shopBillings ? (
        <div className="space-y-3">
          {shopBillings.map((s) => (
            <BillingCard
              key={s.shopId}
              title={s.shopName}
              billing={s.billing}
              isDark={isDark}
              accentColor={accentColor}
              busy={busy}
              allowMarkPaid
              onTogglePaid={
                onMarkShopPaid
                  ? (paid) => {
                      setBusy(true);
                      void onMarkShopPaid(s.shopId, paid).finally(() => setBusy(false));
                    }
                  : undefined
              }
            />
          ))}
        </div>
      ) : loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        </div>
      ) : billing ? (
        <BillingCard
          billing={billing}
          isDark={isDark}
          accentColor={accentColor}
          readOnlyAnalytics
        />
      ) : null}
    </div>
  );
}
