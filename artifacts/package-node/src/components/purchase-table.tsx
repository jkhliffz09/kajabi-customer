import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getCustomerIdByKajabiId, type PurchaseRow } from "@/lib/supabase/queries";
import { formatDate, formatMoney, truncate } from "@/lib/utils";

export async function PurchaseTable({ rows }: { rows: PurchaseRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-600">
        No purchases match the current filters.
      </div>
    );
  }

  const customerLinks = new Map<string, string | null>();
  await Promise.all(
    rows.map(async (row) => {
      if (row.kajabi_customer_id && !customerLinks.has(row.kajabi_customer_id)) {
        customerLinks.set(row.kajabi_customer_id, await getCustomerIdByKajabiId(row.kajabi_customer_id));
      }
    }),
  );

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Latest Offer</th>
            <th className="px-4 py-3">Purchase Date</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Coupon</th>
            <th className="px-4 py-3">Source / Referrer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => {
            const customerId = row.kajabi_customer_id ? customerLinks.get(row.kajabi_customer_id) : null;
            return (
              <tr key={row.id} className="align-top hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-950">
                    {customerId ? <Link className="hover:underline" href={`/customers/${customerId}`}>{row.customer_name ?? "Unknown customer"}</Link> : row.customer_name ?? "Unknown customer"}
                  </div>
                  <div className="text-zinc-600">{row.customer_email ?? "—"}</div>
                </td>
                <td className="px-4 py-3">{row.offer_title ?? "—"}</td>
                <td className="px-4 py-3">{formatDate(row.kajabi_created_at ?? row.effective_start_at)}</td>
                <td className="px-4 py-3">{formatMoney(row.amount_in_cents, row.currency ?? "USD")}</td>
                <td className="px-4 py-3">
                  <div>{row.payment_type ?? "—"}</div>
                  <div className="text-xs uppercase text-zinc-500">{row.currency ?? ""}</div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={row.normalized_status} /></td>
                <td className="px-4 py-3 text-zinc-600">{truncate(row.deactivation_reason, 32)}</td>
                <td className="px-4 py-3">{row.coupon_code ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">
                  <div>{truncate(row.source, 28)}</div>
                  <div>{truncate(row.referrer, 28)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
