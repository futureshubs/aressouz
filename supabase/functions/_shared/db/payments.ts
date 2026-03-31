import { getAdminDb } from "./client.ts";

interface PaymentEventInput {
  paymentId: string;
  transactionType: string;
  providerEventId?: string | null;
  providerStatus?: string | null;
  amount?: number | null;
  rawPayload?: Record<string, unknown>;
}

interface MarkPaymentStatusArgs {
  paymentId: string;
  status:
    | "initiated"
    | "pending"
    | "authorized"
    | "paid"
    | "failed"
    | "cancelled"
    | "refunded"
    | "partially_refunded";
  providerPaymentRef?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
}

export const markPaymentStatus = async (args: MarkPaymentStatusArgs) => {
  const db = getAdminDb();
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    status: args.status,
    provider_payment_ref: args.providerPaymentRef || null,
    failure_code: args.failureCode || null,
    failure_reason: args.failureReason || null,
    updated_at: now,
  };

  if (args.status === "authorized") {
    payload.authorized_at = now;
  }
  if (args.status === "paid") {
    payload.paid_at = now;
  }
  if (args.status === "failed") {
    payload.failed_at = now;
  }
  if (args.status === "refunded" || args.status === "partially_refunded") {
    payload.refunded_at = now;
  }

  const { data, error } = await db
    .from("payments")
    .update(payload)
    .eq("id", args.paymentId)
    .select("id, order_id, status, provider, provider_payment_ref")
    .single();

  if (error) {
    throw new Error(`Failed to update payment status: ${error.message}`);
  }

  return data;
};

export const recordPaymentEvent = async (args: PaymentEventInput) => {
  const db = getAdminDb();

  const { data, error } = await db
    .from("payment_transactions")
    .insert({
      payment_id: args.paymentId,
      transaction_type: args.transactionType,
      provider_event_id: args.providerEventId || null,
      provider_status: args.providerStatus || null,
      amount: args.amount ?? null,
      raw_payload: args.rawPayload ?? {},
    })
    .select("id, payment_id, provider_event_id, provider_status, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to record payment transaction: ${error.message}`);
  }

  return data;
};
