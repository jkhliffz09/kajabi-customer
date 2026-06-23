import type { JsonApiResource, NormalizedStatus } from "@/lib/kajabi/types";

const statusMap: Record<string, NormalizedStatus> = {
  success: "success",
  successful: "success",
  succeeded: "success",
  paid: "success",
  complete: "success",
  completed: "success",
  active: "active",
  inactive: "inactive",
  cancelled: "cancelled",
  canceled: "cancelled",
  cancel: "cancelled",
  deactivated: "deactivated",
  disabled: "deactivated",
  declined: "declined",
  denied: "denied",
  failed: "failed",
  failure: "failed",
  initialized: "unknown",
  pending: "unknown",
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replaceAll(" ", "_") : "";
}

export function normalizeKajabiPurchaseStatus(purchase: JsonApiResource): NormalizedStatus {
  const attributes = purchase.attributes ?? {};

  const explicitValues = [
    attributes.status,
    attributes.state,
    attributes.payment_status,
    attributes.transaction_status,
    attributes.subscription_status,
  ];

  for (const value of explicitValues) {
    const normalized = statusMap[normalizeString(value)];
    if (normalized) return normalized;
  }

  if (attributes.deactivated_at || attributes.deactivation_reason) {
    const reason = normalizeString(attributes.deactivation_reason);
    if (reason.includes("cancel")) return "cancelled";
    return "deactivated";
  }

  if (attributes.active === true) return "active";
  if (attributes.active === false) return "inactive";

  const raw = JSON.stringify(purchase).toLowerCase();
  if (raw.includes("declined")) return "declined";
  if (raw.includes("denied")) return "denied";
  if (raw.includes("failed")) return "failed";
  if (raw.includes("succeeded") || raw.includes("successful")) return "success";

  return "unknown";
}
