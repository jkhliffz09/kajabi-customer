import { cn } from "@/lib/utils";

const classes: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  declined: "border-red-200 bg-red-50 text-red-700",
  denied: "border-red-200 bg-red-50 text-red-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-amber-200 bg-amber-50 text-amber-800",
  deactivated: "border-zinc-300 bg-zinc-100 text-zinc-700",
  inactive: "border-zinc-300 bg-zinc-100 text-zinc-700",
  unknown: "border-zinc-200 bg-white text-zinc-600",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize", classes[status] ?? classes.unknown, className)}>
      {status}
    </span>
  );
}
