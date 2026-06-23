import { AppShell } from "@/components/app-shell";

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Block className="h-8 w-40" />
          <Block className="mt-2 h-4 w-56" />
        </div>
        <div className="flex gap-3">
          <Block className="h-10 w-48" />
          <Block className="h-10 w-32" />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-md border border-zinc-200 bg-white p-5">
            <Block className="h-4 w-28" />
            <Block className="mt-3 h-8 w-16" />
          </div>
        ))}
      </section>

      <section className="mt-8">
        <Block className="mb-3 h-6 w-40" />
        <Block className="h-72 w-full border border-zinc-200 bg-zinc-100" />
      </section>

      <section className="mt-8">
        <Block className="mb-3 h-6 w-36" />
        <Block className="h-72 w-full border border-zinc-200 bg-zinc-100" />
      </section>
    </AppShell>
  );
}
