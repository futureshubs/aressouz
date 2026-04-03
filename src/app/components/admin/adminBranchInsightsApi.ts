import { projectId } from '../../../../utils/supabase/info';
import { buildAdminHeaders } from '../../utils/requestAuth';

export type SeriesPoint = { date: string; orders: number; revenuePaid: number };

export type CompareWeeks = {
  ordersPrev7: number;
  ordersLast7: number;
  revenuePaidPrev7: number;
  revenuePaidLast7: number;
};

export type InsightMetricsCore = {
  orderCount: number;
  revenuePaid: number;
  revenueAll: number;
  cancelledCount: number;
  paidOrderCount: number;
  deliveredCount: number;
  byOrderType: Record<string, number>;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  byOrderTypeRevenuePaid: Record<string, number>;
  series14d: SeriesPoint[];
  hourly24: number[];
  uniqueCustomers: number;
  compareWeeks: CompareWeeks;
  avgOrderValuePaid: number;
  avgOrderValueAll: number;
  cancellationRatePct: number;
  paidSharePct: number;
  deliveredSharePct: number;
};

export type BranchInsightRow = InsightMetricsCore & { branchId: string; branchName: string };

export type BranchInsightsMeta = {
  kvOrderRows?: number;
  dedupedOrders?: number;
  branchesInKv?: number;
  branchesWithOrders?: number;
  topBranchesByRevenue?: Array<{
    branchId: string;
    branchName: string;
    revenuePaid: number;
    orderCount: number;
  }>;
};

export type BranchInsightsResponse = {
  success: boolean;
  generatedAt?: string;
  global: InsightMetricsCore;
  branches: BranchInsightRow[];
  meta?: BranchInsightsMeta;
  error?: string;
};

const INSIGHTS_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/branch-insights`;

function emptyCore(): InsightMetricsCore {
  return {
    orderCount: 0,
    revenuePaid: 0,
    revenueAll: 0,
    cancelledCount: 0,
    paidOrderCount: 0,
    deliveredCount: 0,
    byOrderType: {},
    byStatus: {},
    byPaymentStatus: {},
    byOrderTypeRevenuePaid: {},
    series14d: [],
    hourly24: Array.from({ length: 24 }, () => 0),
    uniqueCustomers: 0,
    compareWeeks: {
      ordersPrev7: 0,
      ordersLast7: 0,
      revenuePaidPrev7: 0,
      revenuePaidLast7: 0,
    },
    avgOrderValuePaid: 0,
    avgOrderValueAll: 0,
    cancellationRatePct: 0,
    paidSharePct: 0,
    deliveredSharePct: 0,
  };
}

function fixHourly24(h: unknown): number[] {
  const d = emptyCore().hourly24;
  if (!Array.isArray(h) || h.length !== 24) return d;
  return h.map((x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  });
}

function mergeMetrics(partial: Partial<InsightMetricsCore> | undefined): InsightMetricsCore {
  const d = emptyCore();
  if (!partial) return d;
  const cw = partial.compareWeeks;
  return {
    ...d,
    ...partial,
    byOrderType: partial.byOrderType ?? d.byOrderType,
    byStatus: partial.byStatus ?? d.byStatus,
    byPaymentStatus: partial.byPaymentStatus ?? d.byPaymentStatus,
    byOrderTypeRevenuePaid: partial.byOrderTypeRevenuePaid ?? d.byOrderTypeRevenuePaid,
    series14d: Array.isArray(partial.series14d) ? partial.series14d : d.series14d,
    hourly24: fixHourly24(partial.hourly24),
    compareWeeks: {
      ...d.compareWeeks,
      ...(cw && typeof cw === 'object' ? cw : {}),
    },
  };
}

function normalizeBranchRow(b: Partial<BranchInsightRow> & { branchId?: string; branchName?: string }): BranchInsightRow {
  const m = mergeMetrics(b);
  return {
    ...m,
    branchId: String(b.branchId ?? ''),
    branchName: String(b.branchName ?? 'Filial'),
  };
}

export async function fetchAdminBranchInsights(): Promise<BranchInsightsResponse> {
  const res = await fetch(INSIGHTS_URL, {
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
  });
  const j = (await res.json().catch(() => ({}))) as Partial<BranchInsightsResponse>;
  if (!res.ok || !j.success) {
    return {
      success: false,
      global: emptyCore(),
      branches: [],
      error: (j as { error?: string }).error || `HTTP ${res.status}`,
    };
  }
  return {
    success: true,
    generatedAt: j.generatedAt,
    global: mergeMetrics(j.global),
    branches: Array.isArray(j.branches) ? j.branches.map((b) => normalizeBranchRow(b)) : [],
    meta: j.meta,
  };
}
