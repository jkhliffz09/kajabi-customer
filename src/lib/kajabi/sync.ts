import "server-only";

import { describeUnknownError } from "@/lib/errors";
import { buildKajabiPath, kajabiFetch } from "@/lib/kajabi/client";
import { normalizeKajabiPurchaseStatus } from "@/lib/kajabi/status";
import type { BatchSyncResource, BatchSyncResult, JsonApiResource, KajabiResponse, SyncResult } from "@/lib/kajabi/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function attr<T>(resource: JsonApiResource | undefined | null, key: string): T | null {
  return (resource?.attributes?.[key] as T | undefined) ?? null;
}

function relationId(resource: JsonApiResource, key: string) {
  const data = resource.relationships?.[key]?.data;
  return data && !Array.isArray(data) ? data.id : null;
}

function relationIds(resource: JsonApiResource, key: string) {
  const data = resource.relationships?.[key]?.data;
  if (!Array.isArray(data)) return [];
  return data.map((item) => item.id);
}

function includedById(included: JsonApiResource[] | undefined, type: string, id: string | null) {
  if (!id) return null;
  return included?.find((resource) => resource.type === type && resource.id === id) ?? null;
}

function timestamp(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function safePositiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function customerPayload(customer: JsonApiResource) {
  return {
    kajabi_customer_id: customer.id,
    name: attr<string>(customer, "name"),
    email: attr<string>(customer, "email"),
    avatar: attr<string>(customer, "avatar"),
    net_revenue: attr<string>(customer, "net_revenue"),
    sign_in_count: attr<number>(customer, "sign_in_count"),
    last_request_at: timestamp(customer.attributes?.last_request_at),
    created_at_kajabi: timestamp(customer.attributes?.created_at),
    updated_at_kajabi: timestamp(customer.attributes?.updated_at),
    raw_json: customer,
  };
}

function offerPayload(offer: JsonApiResource) {
  return {
    kajabi_offer_id: offer.id,
    title: attr<string>(offer, "title"),
    internal_title: attr<string>(offer, "internal_title"),
    price_in_cents: attr<number>(offer, "price_in_cents"),
    currency: attr<string>(offer, "currency"),
    payment_type: attr<string>(offer, "payment_type"),
    checkout_url: attr<string>(offer, "checkout_url"),
    raw_json: offer,
  };
}

function productPayload(product: JsonApiResource) {
  return {
    kajabi_product_id: product.id,
    title: attr<string>(product, "title") ?? attr<string>(product, "name"),
    internal_title: attr<string>(product, "internal_title"),
    description: attr<string>(product, "description"),
    raw_json: product,
  };
}

type PurchaseEnrichment = {
  customers: Map<string, { name: string | null; email: string | null }>;
  offers: Map<string, { title: string | null }>;
};

function purchasePayload(purchase: JsonApiResource, included?: JsonApiResource[], enrichment?: PurchaseEnrichment) {
  const customerId = relationId(purchase, "customer");
  const offerId = relationId(purchase, "offer");
  const customer = includedById(included, "customers", customerId);
  const offer = includedById(included, "offers", offerId);
  const storedCustomer = customerId ? enrichment?.customers.get(customerId) : null;
  const storedOffer = offerId ? enrichment?.offers.get(offerId) : null;
  const active = !purchase.attributes?.deactivated_at;

  return {
    kajabi_purchase_id: purchase.id,
    kajabi_customer_id: customerId,
    kajabi_offer_id: offerId,
    customer_email: attr<string>(customer, "email") ?? storedCustomer?.email ?? null,
    customer_name: attr<string>(customer, "name") ?? storedCustomer?.name ?? null,
    offer_title: attr<string>(offer, "title") ?? storedOffer?.title ?? null,
    amount_in_cents: attr<number>(purchase, "amount_in_cents"),
    currency: attr<string>(purchase, "currency"),
    payment_type: attr<string>(purchase, "payment_type"),
    status: attr<string>(purchase, "status"),
    normalized_status: normalizeKajabiPurchaseStatus(purchase),
    active,
    deactivated_at: timestamp(purchase.attributes?.deactivated_at),
    deactivation_reason: attr<string>(purchase, "deactivation_reason"),
    coupon_code: attr<string>(purchase, "coupon_code"),
    source: attr<string>(purchase, "source"),
    referrer: attr<string>(purchase, "referrer"),
    quantity: attr<number>(purchase, "quantity"),
    effective_start_at: timestamp(purchase.attributes?.effective_start_at),
    kajabi_created_at: timestamp(purchase.attributes?.created_at),
    kajabi_updated_at: timestamp(purchase.attributes?.updated_at),
    raw_json: { ...purchase, included },
  };
}

async function upsertIncluded(included: JsonApiResource[] | undefined) {
  if (!included?.length) return;
  const supabase = getSupabaseAdmin();
  const customers = included.filter((resource) => resource.type === "customers").map(customerPayload);
  const offers = included.filter((resource) => resource.type === "offers").map(offerPayload);
  const products = included.filter((resource) => resource.type === "products").map(productPayload);

  if (customers.length) {
    const { error } = await supabase.from("kajabi_customers").upsert(customers, { onConflict: "kajabi_customer_id" });
    if (error) throw error;
  }

  if (offers.length) {
    const { error } = await supabase.from("kajabi_offers").upsert(offers, { onConflict: "kajabi_offer_id" });
    if (error) throw error;
  }

  if (products.length) {
    const { error } = await supabase.from("kajabi_products").upsert(products, { onConflict: "kajabi_product_id" });
    if (error) throw error;
  }
}

async function getPurchaseEnrichment(purchases: JsonApiResource[]) {
  const customerIds = Array.from(new Set(purchases.map((purchase) => relationId(purchase, "customer")).filter(Boolean)));
  const offerIds = Array.from(new Set(purchases.map((purchase) => relationId(purchase, "offer")).filter(Boolean)));
  const supabase = getSupabaseAdmin();
  const enrichment: PurchaseEnrichment = {
    customers: new Map(),
    offers: new Map(),
  };

  if (customerIds.length) {
    const { data, error } = await supabase
      .from("kajabi_customers")
      .select("kajabi_customer_id,name,email")
      .in("kajabi_customer_id", customerIds);
    if (error) throw error;
    for (const customer of data ?? []) {
      enrichment.customers.set(customer.kajabi_customer_id, {
        name: customer.name,
        email: customer.email,
      });
    }
  }

  if (offerIds.length) {
    const { data, error } = await supabase
      .from("kajabi_offers")
      .select("kajabi_offer_id,title")
      .in("kajabi_offer_id", offerIds);
    if (error) throw error;
    for (const offer of data ?? []) {
      enrichment.offers.set(offer.kajabi_offer_id, {
        title: offer.title,
      });
    }
  }

  return enrichment;
}

async function upsertPurchaseProducts(purchases: JsonApiResource[]) {
  const rows = purchases.flatMap((purchase) =>
    relationIds(purchase, "products").map((productId) => ({
      kajabi_purchase_id: purchase.id,
      kajabi_product_id: productId,
    })),
  );

  if (!rows.length) return;
  const { error } = await getSupabaseAdmin()
    .from("kajabi_purchase_products")
    .upsert(rows, { onConflict: "kajabi_purchase_id,kajabi_product_id" });
  if (error) throw error;
}

async function upsertPurchases(purchases: JsonApiResource[], included?: JsonApiResource[]) {
  if (!purchases.length) return 0;
  const enrichment = await getPurchaseEnrichment(purchases);
  const payloads = purchases.map((purchase) => purchasePayload(purchase, included, enrichment));
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("kajabi_purchases")
    .upsert(payloads, { onConflict: "kajabi_purchase_id" });
  if (error) throw error;
  await upsertPurchaseProducts(purchases);
  return payloads.length;
}

async function upsertResource(resource: BatchSyncResource, rows: JsonApiResource[], included?: JsonApiResource[]) {
  if (!rows.length) return 0;

  if (resource === "customers") {
    const { error } = await getSupabaseAdmin()
      .from("kajabi_customers")
      .upsert(rows.map(customerPayload), { onConflict: "kajabi_customer_id" });
    if (error) throw error;
    return rows.length;
  }

  if (resource === "offers") {
    const { error } = await getSupabaseAdmin()
      .from("kajabi_offers")
      .upsert(rows.map(offerPayload), { onConflict: "kajabi_offer_id" });
    if (error) throw error;
    return rows.length;
  }

  if (resource === "products") {
    const { error } = await getSupabaseAdmin()
      .from("kajabi_products")
      .upsert(rows.map(productPayload), { onConflict: "kajabi_product_id" });
    if (error) throw error;
    return rows.length;
  }

  await upsertIncluded(included);
  return upsertPurchases(rows, included);
}

const purchasePageSize = 25;

async function createSyncLog(syncType: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("sync_logs")
    .insert({ sync_type: syncType, status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function finishSyncLog(id: string, status: "completed" | "failed", result: SyncResult, errorMessage?: string) {
  await getSupabaseAdmin()
    .from("sync_logs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      records_processed: result.recordsProcessed,
      error_message: errorMessage ?? (result.errors.length ? result.errors.join("\n") : null),
      raw_response: result,
    })
    .eq("id", id);
}

export async function syncKajabiPurchases(syncType: "initial" | "latest") {
  const logId = await createSyncLog(syncType);
  const result: SyncResult = { recordsProcessed: 0, pagesFetched: 0, errors: [] };
  const pageSize = purchasePageSize;
  const maxPages = syncType === "initial" ? 10_000 : 5;
  let page = 1;
  let lastPath: string | null = null;

  try {
    while (page <= maxPages) {
      const path = buildKajabiPath("/v1/purchases", {
        "page[number]": page,
        "page[size]": pageSize,
        sort: syncType === "latest" ? "-updated_at" : "created_at",
        "filter[site_id]": process.env.KAJABI_SITE_ID,
      });
      lastPath = path;
      const response = await kajabiFetch<KajabiResponse<JsonApiResource[]>>(path);
      const purchases = response.data ?? [];
      result.pagesFetched += 1;

      result.recordsProcessed += await upsertResource("purchases", purchases, response.included);

      const totalPages = response.meta?.total_pages;
      const receivedFullPage = purchases.length === pageSize;
      const hasNextPage = Boolean(response.links?.next) || Boolean(totalPages && page < totalPages) || receivedFullPage;
      if (!purchases.length || !hasNextPage) break;
      page += 1;
    }

    await finishSyncLog(logId, result.errors.length ? "failed" : "completed", result);
    return result;
  } catch (error) {
    const message = describeUnknownError(error);
    result.failedReason = message;
    result.failedAt = { syncType, page, pageSize, path: lastPath };
    result.errors.push(message);
    await finishSyncLog(logId, "failed", result, message);
    throw error;
  }
}

async function syncKajabiCollection(
  resource: "customers" | "offers" | "products",
  options: {
    endpoint: string;
    pageSize?: number;
    maxPages?: number;
    upsert: (resources: JsonApiResource[]) => Promise<number>;
  },
) {
  const logId = await createSyncLog(resource);
  const result: SyncResult = { recordsProcessed: 0, pagesFetched: 0, errors: [] };
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 10_000;
  let page = 1;
  let lastPath: string | null = null;

  try {
    while (page <= maxPages) {
      const path = buildKajabiPath(options.endpoint, {
        "page[number]": page,
        "page[size]": pageSize,
        sort: "created_at",
        "filter[site_id]": process.env.KAJABI_SITE_ID,
      });
      lastPath = path;
      const response = await kajabiFetch<KajabiResponse<JsonApiResource[]>>(path);
      const rows = response.data ?? [];
      result.pagesFetched += 1;
      result.recordsProcessed += await options.upsert(rows);

      const totalPages = response.meta?.total_pages;
      const receivedFullPage = rows.length === pageSize;
      const hasNextPage = Boolean(response.links?.next) || Boolean(totalPages && page < totalPages) || receivedFullPage;
      if (!rows.length || !hasNextPage) break;
      page += 1;
    }

    await finishSyncLog(logId, result.errors.length ? "failed" : "completed", result);
    return result;
  } catch (error) {
    const message = describeUnknownError(error);
    result.failedReason = message;
    result.failedAt = { resource, page, pageSize, path: lastPath };
    result.errors.push(message);
    await finishSyncLog(logId, "failed", result, message);
    throw error;
  }
}

export function syncKajabiCustomers() {
  return syncKajabiCollection("customers", {
    endpoint: "/v1/customers",
    async upsert(resources) {
      if (!resources.length) return 0;
      const { error } = await getSupabaseAdmin()
        .from("kajabi_customers")
        .upsert(resources.map(customerPayload), { onConflict: "kajabi_customer_id" });
      if (error) throw error;
      return resources.length;
    },
  });
}

export function syncKajabiOffers() {
  return syncKajabiCollection("offers", {
    endpoint: "/v1/offers",
    async upsert(resources) {
      if (!resources.length) return 0;
      const { error } = await getSupabaseAdmin()
        .from("kajabi_offers")
        .upsert(resources.map(offerPayload), { onConflict: "kajabi_offer_id" });
      if (error) throw error;
      return resources.length;
    },
  });
}

export function syncKajabiProducts() {
  return syncKajabiCollection("products", {
    endpoint: "/v1/products",
    async upsert(resources) {
      if (!resources.length) return 0;
      const { error } = await getSupabaseAdmin()
        .from("kajabi_products")
        .upsert(resources.map(productPayload), { onConflict: "kajabi_product_id" });
      if (error) throw error;
      return resources.length;
    },
  });
}

function endpointForResource(resource: BatchSyncResource) {
  return `/v1/${resource}`;
}

function totalRecords(response: KajabiResponse<JsonApiResource[]>) {
  return response.meta?.total_count ?? response.meta?.count ?? null;
}

function totalPages(response: KajabiResponse<JsonApiResource[]>, pageSize: number) {
  if (response.meta?.total_pages) return response.meta.total_pages;
  const total = totalRecords(response);
  return total ? Math.ceil(total / pageSize) : null;
}

export async function syncKajabiResourcePage(
  resource: BatchSyncResource,
  page: number,
  pageSize = 200,
): Promise<BatchSyncResult> {
  const maxPageSize = resource === "purchases" ? purchasePageSize : 200;
  const safePage = safePositiveInteger(page, 1);
  const requestedPageSize = safePositiveInteger(pageSize, maxPageSize);
  const safePageSize = Math.min(requestedPageSize, maxPageSize);
  const logId = await createSyncLog(`${resource}:page:${safePage}`);
  const path = buildKajabiPath(endpointForResource(resource), {
    "page[number]": safePage,
    "page[size]": safePageSize,
    sort: resource === "purchases" ? "created_at" : "created_at",
    "filter[site_id]": process.env.KAJABI_SITE_ID,
  });

  try {
    const response = await kajabiFetch<KajabiResponse<JsonApiResource[]>>(path);
    const rows = response.data ?? [];
    const recordsProcessed = await upsertResource(resource, rows, response.included);
    const resolvedTotalPages = totalPages(response, safePageSize);
    const receivedFullPage = rows.length === safePageSize;
    const hasNextPage = Boolean(response.links?.next) || Boolean(resolvedTotalPages && safePage < resolvedTotalPages) || receivedFullPage;
    const result: BatchSyncResult = {
      resource,
      page: safePage,
      pageSize: safePageSize,
      recordsProcessed,
      totalRecords: totalRecords(response),
      totalPages: resolvedTotalPages,
      hasNextPage,
      nextPage: hasNextPage ? safePage + 1 : null,
    };

    await finishSyncLog(logId, "completed", {
      recordsProcessed,
      pagesFetched: 1,
      errors: [],
    });

    return result;
  } catch (error) {
    const message = describeUnknownError(error);
    await finishSyncLog(
      logId,
      "failed",
      {
        recordsProcessed: 0,
        pagesFetched: 0,
        errors: [message],
        failedReason: message,
        failedAt: {
          resource,
          page: safePage,
          requestedPageSize: pageSize,
          pageSize: safePageSize,
          path,
        },
      },
      message,
    );
    throw error;
  }
}

export async function upsertKajabiWebhookPurchase(payload: KajabiResponse<JsonApiResource> | JsonApiResource) {
  const response = "data" in payload ? payload : { data: payload };
  await upsertIncluded(response.included);
  return upsertPurchases([response.data], response.included);
}
