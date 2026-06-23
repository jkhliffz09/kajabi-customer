import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PurchaseTable } from "@/components/purchase-table";
import { requireAdmin } from "@/lib/auth/session";
import { getOfferOptions, getPurchaseFilterOptions, getPurchases } from "@/lib/supabase/queries";

const statuses = ["success", "active", "declined", "denied", "failed", "cancelled", "deactivated", "inactive", "unknown"];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const declinedOnly = params.declinedOnly === "on";
  const [offers, paymentTypes, purchases] = await Promise.all([
    getOfferOptions(),
    getPurchaseFilterOptions(),
    getPurchases({
      search: params.search,
      status: params.status,
      offer: params.offer,
      paymentType: params.paymentType,
      active: params.active,
      startDate: params.startDate,
      endDate: params.endDate,
      declinedOnly,
      page,
      pageSize: 25,
    }),
  ]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Customers and Purchases</h1>
        <p className="mt-1 text-sm text-zinc-600">{purchases.count} matching purchases</p>
      </div>

      <form className="mb-6 grid gap-3 rounded-md border border-zinc-200 bg-white p-4 md:grid-cols-6">
        <input name="search" defaultValue={params.search} placeholder="Search customers, purchases, offers" className="h-10 rounded-md border border-zinc-300 px-3 text-sm md:col-span-2" />
        <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select name="offer" defaultValue={params.offer ?? ""} className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
          <option value="">All offers</option>
          {offers.map((offer) => <option key={offer.kajabi_offer_id} value={offer.kajabi_offer_id}>{offer.title ?? offer.kajabi_offer_id}</option>)}
        </select>
        <select name="paymentType" defaultValue={params.paymentType ?? ""} className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
          <option value="">Payment type</option>
          {paymentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select name="active" defaultValue={params.active ?? ""} className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
          <option value="">Active/deactivated</option>
          <option value="active">Active only</option>
          <option value="deactivated">Deactivated only</option>
        </select>
        <input name="startDate" type="date" defaultValue={params.startDate} className="h-10 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="endDate" type="date" defaultValue={params.endDate} className="h-10 rounded-md border border-zinc-300 px-3 text-sm" />
        <label className="flex h-10 items-center gap-2 text-sm text-zinc-700">
          <input name="declinedOnly" type="checkbox" defaultChecked={declinedOnly} />
          Declined/failed only
        </label>
        <div className="flex gap-2 md:col-span-3">
          <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">Apply filters</button>
          <Link href="/customers" className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
        </div>
      </form>

      <PurchaseTable rows={purchases.rows} />

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-zinc-600">Page {purchases.page} of {purchases.totalPages}</span>
        <div className="flex gap-2">
          <Link className="rounded-md border border-zinc-300 px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40" aria-disabled={purchases.page <= 1} href={{ pathname: "/customers", query: { ...params, page: Math.max(purchases.page - 1, 1) } }}>Previous</Link>
          <Link className="rounded-md border border-zinc-300 px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40" aria-disabled={purchases.page >= purchases.totalPages} href={{ pathname: "/customers", query: { ...params, page: Math.min(purchases.page + 1, purchases.totalPages) } }}>Next</Link>
        </div>
      </div>
    </AppShell>
  );
}
