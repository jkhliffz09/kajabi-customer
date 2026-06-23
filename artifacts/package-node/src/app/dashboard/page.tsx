import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SyncButtons } from "@/components/sync-buttons";
import { requireAdmin } from "@/lib/auth/session";
import { getDashboardData, getPurchases, getRecentCustomers, type DashboardCustomerRow } from "@/lib/supabase/queries";
import { formatDate } from "@/lib/utils";
import { PurchaseTable } from "@/components/purchase-table";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="text-sm text-zinc-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function CustomerList({ rows }: { rows: DashboardCustomerRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-600">
        No customers have been synced yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Kajabi ID</th>
            <th className="px-4 py-3">Net Revenue</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <Link href={`/customers/${row.id}`} className="font-medium text-zinc-950 hover:underline">
                  {row.name ?? "Unknown customer"}
                </Link>
                <div className="text-zinc-600">{row.email ?? "No email"}</div>
              </td>
              <td className="px-4 py-3 text-zinc-600">{row.kajabi_customer_id}</td>
              <td className="px-4 py-3">{row.net_revenue ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-600">
                {formatDate(row.updated_at_kajabi ?? row.created_at_kajabi)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DashboardPage() {
  await requireAdmin();
  const [dashboard, customers, latest] = await Promise.all([
    getDashboardData(),
    getRecentCustomers(8),
    getPurchases({ page: 1, pageSize: 8 }),
  ]);

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Last sync: {dashboard.lastSync?.finished_at ? formatDate(dashboard.lastSync.finished_at) : "No sync yet"}
          </p>
        </div>
        <SyncButtons />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total customers" value={dashboard.totalCustomers} />
        <Kpi label="Total purchases" value={dashboard.totalPurchases} />
        <Kpi label="Successful" value={dashboard.successfulPurchases} />
        <Kpi label="Declined / failed" value={dashboard.declinedFailedPurchases} />
        <Kpi label="Cancelled / deactivated" value={dashboard.cancelledDeactivatedPurchases} />
        <Kpi label="Last sync status" value={dashboard.lastSync?.status ?? "—"} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Synced Customers</h2>
          <Link href="/customers" className="text-sm font-medium text-zinc-700 hover:text-zinc-950">
            View all
          </Link>
        </div>
        <CustomerList rows={customers} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Latest Purchases</h2>
          <Link href="/customers" className="text-sm font-medium text-zinc-700 hover:text-zinc-950">
            View all
          </Link>
        </div>
        <PurchaseTable rows={latest.rows} />
      </section>
    </AppShell>
  );
}
