import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PurchaseFilters = {
  search?: string;
  status?: string;
  offer?: string;
  paymentType?: string;
  active?: string;
  declinedOnly?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export type PurchaseRow = {
  id: string;
  kajabi_purchase_id: string;
  kajabi_customer_id: string | null;
  kajabi_offer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  offer_title: string | null;
  amount_in_cents: number | null;
  currency: string | null;
  payment_type: string | null;
  status: string | null;
  normalized_status: string;
  active: boolean | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  coupon_code: string | null;
  source: string | null;
  referrer: string | null;
  effective_start_at: string | null;
  kajabi_created_at: string | null;
  raw_json?: unknown;
};

export type CustomerRow = {
  id: string;
  kajabi_customer_id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  net_revenue: string | null;
  sign_in_count: number | null;
  last_request_at: string | null;
  created_at_kajabi: string | null;
  updated_at_kajabi: string | null;
  raw_json: unknown;
};

export type DashboardCustomerRow = Pick<
  CustomerRow,
  "id" | "kajabi_customer_id" | "name" | "email" | "net_revenue" | "created_at_kajabi" | "updated_at_kajabi"
>;

const pageSizeDefault = 25;

function countOrThrow(result: { count: number | null; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export async function getDashboardData() {
  const supabase = getSupabaseAdmin();
  const [
    customers,
    purchases,
    successful,
    declined,
    cancelled,
    lastSync,
  ] = await Promise.all([
    supabase.from("kajabi_customers").select("id", { count: "exact", head: true }),
    supabase.from("kajabi_purchases").select("id", { count: "exact", head: true }),
    supabase.from("kajabi_purchases").select("id", { count: "exact", head: true }).in("normalized_status", ["success", "active"]),
    supabase.from("kajabi_purchases").select("id", { count: "exact", head: true }).in("normalized_status", ["declined", "denied", "failed"]),
    supabase.from("kajabi_purchases").select("id", { count: "exact", head: true }).in("normalized_status", ["cancelled", "deactivated", "inactive"]),
    supabase.from("sync_logs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (lastSync.error) throw lastSync.error;

  return {
    totalCustomers: countOrThrow(customers),
    totalPurchases: countOrThrow(purchases),
    successfulPurchases: countOrThrow(successful),
    declinedFailedPurchases: countOrThrow(declined),
    cancelledDeactivatedPurchases: countOrThrow(cancelled),
    lastSync: lastSync.data,
  };
}

export async function getRecentCustomers(limit = 8) {
  const { data, error } = await getSupabaseAdmin()
    .from("kajabi_customers")
    .select("id,kajabi_customer_id,name,email,net_revenue,created_at_kajabi,updated_at_kajabi")
    .order("updated_at_kajabi", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DashboardCustomerRow[];
}

export async function getOfferOptions() {
  const { data, error } = await getSupabaseAdmin()
    .from("kajabi_offers")
    .select("kajabi_offer_id,title")
    .order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPurchaseFilterOptions() {
  const { data, error } = await getSupabaseAdmin()
    .from("kajabi_purchases")
    .select("payment_type")
    .not("payment_type", "is", null)
    .order("payment_type", { ascending: true });
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.payment_type).filter(Boolean)));
}

export async function getPurchases(filters: PurchaseFilters) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? pageSizeDefault, 5), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = getSupabaseAdmin()
    .from("kajabi_purchases")
    .select("*", { count: "exact" })
    .order("kajabi_created_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters.search) {
    const search = filters.search.replaceAll("%", "\\%");
    query = query.or(
      [
        `customer_name.ilike.%${search}%`,
        `customer_email.ilike.%${search}%`,
        `kajabi_customer_id.ilike.%${search}%`,
        `kajabi_purchase_id.ilike.%${search}%`,
        `offer_title.ilike.%${search}%`,
        `coupon_code.ilike.%${search}%`,
      ].join(","),
    );
  }

  if (filters.status) query = query.eq("normalized_status", filters.status);
  if (filters.offer) query = query.eq("kajabi_offer_id", filters.offer);
  if (filters.paymentType) query = query.eq("payment_type", filters.paymentType);
  if (filters.active === "active") query = query.eq("active", true);
  if (filters.active === "deactivated") query = query.eq("active", false);
  if (filters.declinedOnly) query = query.in("normalized_status", ["declined", "denied", "failed"]);
  if (filters.startDate) query = query.gte("kajabi_created_at", filters.startDate);
  if (filters.endDate) query = query.lte("kajabi_created_at", `${filters.endDate}T23:59:59.999Z`);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as PurchaseRow[],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil((count ?? 0) / pageSize), 1),
  };
}

export async function getCustomerById(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("kajabi_customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as CustomerRow | null;
}

export async function getCustomerPurchases(kajabiCustomerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("kajabi_purchases")
    .select("*")
    .eq("kajabi_customer_id", kajabiCustomerId)
    .order("kajabi_created_at", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as PurchaseRow[];
}

export async function getCustomerIdByKajabiId(kajabiCustomerId: string | null) {
  if (!kajabiCustomerId) return null;
  const { data } = await getSupabaseAdmin()
    .from("kajabi_customers")
    .select("id")
    .eq("kajabi_customer_id", kajabiCustomerId)
    .maybeSingle();
  return data?.id ?? null;
}
