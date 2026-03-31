import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type BagRow = {
  id: string;
  branch_id: string;
  bag_number: string;
  bag_code: string;
  qr_code: string;
  bag_type: string;
  capacity_level: string;
  status: string;
  notes: string;
  current_courier_id: string | null;
  current_order_id: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
};

type AssignmentRow = {
  id: string;
  bag_id: string;
  branch_id: string;
  courier_id: string;
  assigned_at: string;
  released_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OrderLinkRow = {
  id: string;
  bag_id: string;
  order_id: string;
  courier_id: string;
  attached_at: string;
  detached_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NormalizedCourierBag = {
  id: string;
  branchId: string;
  bagNumber: string;
  bagCode: string;
  qrCode: string;
  bagType: string;
  capacityLevel: string;
  status: string;
  notes: string;
  currentCourierId: string | null;
  currentOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
};

const rowToBag = (r: BagRow): NormalizedCourierBag => ({
  id: r.id,
  branchId: r.branch_id || '',
  bagNumber: String(r.bag_number || '').trim(),
  bagCode: String(r.bag_code || '').trim(),
  qrCode: String(r.qr_code || '').trim(),
  bagType: String(r.bag_type || 'standard').trim() || 'standard',
  capacityLevel: String(r.capacity_level || 'single_order').trim() || 'single_order',
  status: String(r.status || 'available_in_branch').trim() || 'available_in_branch',
  notes: String(r.notes || '').trim(),
  currentCourierId: r.current_courier_id || null,
  currentOrderId: r.current_order_id || null,
  createdAt: r.created_at || new Date().toISOString(),
  updatedAt: r.updated_at || new Date().toISOString(),
  deleted: Boolean(r.deleted),
});

const bagToRow = (b: NormalizedCourierBag): Record<string, unknown> => ({
  id: b.id,
  branch_id: b.branchId,
  bag_number: b.bagNumber,
  bag_code: b.bagCode,
  qr_code: b.qrCode,
  bag_type: b.bagType,
  capacity_level: b.capacityLevel,
  status: b.status,
  notes: b.notes,
  current_courier_id: b.currentCourierId,
  current_order_id: b.currentOrderId,
  created_at: b.createdAt,
  updated_at: b.updatedAt,
  deleted: b.deleted,
});

const rowToAssignment = (r: AssignmentRow) => ({
  id: r.id,
  bagId: r.bag_id,
  branchId: r.branch_id,
  courierId: r.courier_id,
  assignedAt: r.assigned_at,
  releasedAt: r.released_at,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const rowToOrderLink = (r: OrderLinkRow) => ({
  id: r.id,
  bagId: r.bag_id,
  orderId: r.order_id,
  courierId: r.courier_id,
  attachedAt: r.attached_at,
  detachedAt: r.detached_at,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function createCourierBagStore(sb: SupabaseClient) {
  return {
    async listBags(): Promise<NormalizedCourierBag[]> {
      const { data, error } = await sb
        .from("courier_bags")
        .select("*")
        .eq("deleted", false);
      if (error) throw error;
      return (data as BagRow[]).map(rowToBag);
    },

    async getBagById(id: string): Promise<NormalizedCourierBag | null> {
      const { data, error } = await sb
        .from("courier_bags")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data || (data as BagRow).deleted) return null;
      return rowToBag(data as BagRow);
    },

    async findBagByBranchAndCode(branchId: string, raw: string): Promise<NormalizedCourierBag | null> {
      const q = String(raw || "").trim();
      if (!q || !branchId) return null;
      const ql = q.toLowerCase();
      const { data, error } = await sb
        .from("courier_bags")
        .select("*")
        .eq("branch_id", branchId)
        .eq("deleted", false);
      if (error) throw error;
      const rows = (data as BagRow[]) || [];
      const exact = rows.find((r) => r.id === q)
        || rows.find((r) => String(r.bag_code).trim().toLowerCase() === ql)
        || rows.find((r) => String(r.qr_code).trim() === q)
        || rows.find((r) => String(r.bag_number).trim() === q);
      return exact ? rowToBag(exact) : null;
    },

    async insertBag(bag: NormalizedCourierBag): Promise<void> {
      const { error } = await sb.from("courier_bags").insert(bagToRow(bag));
      if (error) throw error;
    },

    async updateBag(bag: NormalizedCourierBag): Promise<void> {
      const { error } = await sb.from("courier_bags").update(bagToRow(bag)).eq("id", bag.id);
      if (error) throw error;
    },

    async listAssignments(): Promise<ReturnType<typeof rowToAssignment>[]> {
      const { data, error } = await sb.from("courier_bag_assignments").select("*");
      if (error) throw error;
      return ((data as AssignmentRow[]) || []).map(rowToAssignment);
    },

    async insertAssignment(a: {
      id: string;
      bagId: string;
      branchId: string;
      courierId: string;
      assignedAt: string;
      releasedAt: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }): Promise<void> {
      const { error } = await sb.from("courier_bag_assignments").insert({
        id: a.id,
        bag_id: a.bagId,
        branch_id: a.branchId,
        courier_id: a.courierId,
        assigned_at: a.assignedAt,
        released_at: a.releasedAt,
        is_active: a.isActive,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      });
      if (error) throw error;
    },

    async updateAssignment(
      id: string,
      patch: { isActive?: boolean; releasedAt?: string | null; updatedAt?: string },
    ): Promise<void> {
      const row: Record<string, unknown> = {};
      if (patch.isActive !== undefined) row.is_active = patch.isActive;
      if (patch.releasedAt !== undefined) row.released_at = patch.releasedAt;
      if (patch.updatedAt !== undefined) row.updated_at = patch.updatedAt;
      const { error } = await sb.from("courier_bag_assignments").update(row).eq("id", id);
      if (error) throw error;
    },

    async listOrderLinks(): Promise<ReturnType<typeof rowToOrderLink>[]> {
      const { data, error } = await sb.from("courier_bag_order_links").select("*");
      if (error) throw error;
      return ((data as OrderLinkRow[]) || []).map(rowToOrderLink);
    },

    async insertOrderLink(link: {
      id: string;
      bagId: string;
      orderId: string;
      courierId: string;
      attachedAt: string;
      detachedAt: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }): Promise<void> {
      const { error } = await sb.from("courier_bag_order_links").insert({
        id: link.id,
        bag_id: link.bagId,
        order_id: link.orderId,
        courier_id: link.courierId,
        attached_at: link.attachedAt,
        detached_at: link.detachedAt,
        is_active: link.isActive,
        created_at: link.createdAt,
        updated_at: link.updatedAt,
      });
      if (error) throw error;
    },

    async updateOrderLink(
      id: string,
      patch: { isActive?: boolean; detachedAt?: string | null; updatedAt?: string },
    ): Promise<void> {
      const row: Record<string, unknown> = {};
      if (patch.isActive !== undefined) row.is_active = patch.isActive;
      if (patch.detachedAt !== undefined) row.detached_at = patch.detachedAt;
      if (patch.updatedAt !== undefined) row.updated_at = patch.updatedAt;
      const { error } = await sb.from("courier_bag_order_links").update(row).eq("id", id);
      if (error) throw error;
    },

    async insertHistory(entry: {
      id: string;
      bagId: string;
      branchId?: string;
      courierId?: string | null;
      orderId?: string | null;
      actorType: string;
      actorId?: string | null;
      fromStatus?: string | null;
      toStatus: string;
      note: string;
      createdAt: string;
    }): Promise<void> {
      const { error } = await sb.from("courier_bag_history").insert({
        id: entry.id,
        bag_id: entry.bagId,
        branch_id: entry.branchId || null,
        courier_id: entry.courierId ?? null,
        order_id: entry.orderId ?? null,
        actor_type: entry.actorType,
        actor_id: entry.actorId ?? null,
        from_status: entry.fromStatus ?? null,
        to_status: entry.toStatus,
        note: entry.note,
        created_at: entry.createdAt,
      });
      if (error) throw error;
    },
  };
}

export type CourierBagStore = ReturnType<typeof createCourierBagStore>;
