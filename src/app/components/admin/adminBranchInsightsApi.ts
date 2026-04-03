import { projectId } from '../../../../utils/supabase/info';
import { buildAdminHeaders } from '../../utils/requestAuth';

export type SeriesPoint = { date: string; orders: number; revenuePaid: number };

export type InsightMetricsCore = {
  orderCount: number;
  revenuePaid: number;
  revenueAll: number;
  cancelledCount: number;
  byOrderType: Record<string, number>;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  series14d: SeriesPoint[];
};

export type BranchInsightRow = InsightMetricsCore & { branchId: string; branchName: string };

export type BranchInsightsResponse = {
  success: boolean;
  generatedAt?: string;
  global: InsightMetricsCore;
  branches: BranchInsightRow[];
  error?: string;
};

const INSIGHTS_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/branch-insights`;

export async function fetchAdminBranchInsights(): Promise<BranchInsightsResponse> {
  const res = await fetch(INSIGHTS_URL, {
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
  });
  const j = (await res.json().catch(() => ({}))) as BranchInsightsResponse;
  if (!res.ok || !j.success) {
    return {
      success: false,
      global: emptyCore(),
      branches: [],
      error: j.error || `HTTP ${res.status}`,
    };
  }
  return j;
}

function emptyCore(): InsightMetricsCore {
  return {
    orderCount: 0,
    revenuePaid: 0,
    revenueAll: 0,
    cancelledCount: 0,
    byOrderType: {},
    byStatus: {},
    byPaymentStatus: {},
    series14d: [],
  };
}
