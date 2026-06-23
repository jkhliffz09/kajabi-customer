import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PurchaseTable } from "@/components/purchase-table";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { getCustomerById, getCustomerPurchases } from "@/lib/supabase/queries";
import { formatDate } from "@/lib/utils";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const purchases = await getCustomerPurchases(customer.kajabi_customer_id);
  const latest = purchases[0];
  const cancelled = purchases.filter((purchase) => ["cancelled", "deactivated", "inactive"].includes(purchase.normalized_status));
  const offers = Array.from(new Set(purchases.map((purchase) => purchase.offer_title).filter(Boolean)));

  return (
    <AppShell>
      <div className="mb-6 rounded-md border border-zinc-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name ?? "Unknown customer"}</h1>
            <p className="mt-1 text-zinc-600">{customer.email ?? "No email"}</p>
            <p className="mt-2 text-sm text-zinc-500">Kajabi customer ID: {customer.kajabi_customer_id}</p>
          </div>
          {latest ? <StatusBadge status={latest.normalized_status} className="self-start" /> : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-sm text-zinc-500">Net revenue</div>
            <div className="font-medium">{customer.net_revenue ?? "—"}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500">Sign-ins</div>
            <div className="font-medium">{customer.sign_in_count ?? "—"}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500">Last request</div>
            <div className="font-medium">{formatDate(customer.last_request_at)}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500">Created in Kajabi</div>
            <div className="font-medium">{formatDate(customer.created_at_kajabi)}</div>
          </div>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">All purchases</div>
          <div className="mt-2 text-2xl font-semibold">{purchases.length}</div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">Offers purchased</div>
          <div className="mt-2 text-2xl font-semibold">{offers.length}</div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">Cancelled/deactivated</div>
          <div className="mt-2 text-2xl font-semibold">{cancelled.length}</div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Purchases</h2>
        <PurchaseTable rows={purchases} />
      </section>

      <details className="rounded-md border border-zinc-200 bg-white p-5">
        <summary className="cursor-pointer font-medium">Raw Kajabi JSON</summary>
        <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">
          {JSON.stringify(customer.raw_json, null, 2)}
        </pre>
      </details>
    </AppShell>
  );
}
