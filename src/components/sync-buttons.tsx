"use client";

import { useRef, useState } from "react";
import { Boxes, RotateCw, ShoppingCart, Square, Tag, Users } from "lucide-react";

type SyncState = {
  status: "idle" | "syncing" | "completed" | "failed";
  message?: string;
  resource?: SyncResource;
  page?: number;
  totalPages?: number | null;
  processed?: number;
  totalRecords?: number | null;
};

type SyncResource = "customers" | "offers" | "products" | "purchases";

type BatchResponse = {
  resource: SyncResource;
  page: number;
  pageSize: number;
  recordsProcessed: number;
  totalRecords: number | null;
  totalPages: number | null;
  hasNextPage: boolean;
  nextPage: number | null;
};

async function runBatch(resource: SyncResource, page: number, pageSize: number) {
  const response = await fetch("/api/kajabi/sync/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resource, page, pageSize }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Sync failed.");
  return payload as BatchResponse;
}

export function SyncButtons() {
  const [state, setState] = useState<SyncState>({ status: "idle" });
  const stopRequested = useRef(false);

  async function onSync(resource: SyncResource, label: string) {
    const pageSize = resource === "purchases" ? 25 : 200;
    let page = 1;
    let processed = 0;
    stopRequested.current = false;
    setState({ status: "syncing", resource, page, processed, message: `${label}: fetching page 1...` });

    try {
      while (!stopRequested.current) {
        const payload = await runBatch(resource, page, pageSize);
        processed += payload.recordsProcessed;
        setState({
          status: "syncing",
          resource,
          page: payload.page,
          totalPages: payload.totalPages,
          processed,
          totalRecords: payload.totalRecords,
          message: `${label}: synced page ${payload.page}${payload.totalPages ? ` of ${payload.totalPages}` : ""}.`,
        });

        if (!payload.hasNextPage || !payload.nextPage) {
          break;
        }
        page = payload.nextPage;
      }

      setState({
        status: stopRequested.current ? "idle" : "completed",
        resource,
        page,
        processed,
        message: stopRequested.current
          ? `${label}: stopped after ${processed} records.`
          : `${label}: completed ${processed} records.`,
      });
      if (!stopRequested.current) window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setState({
        status: "failed",
        resource,
        page,
        processed,
        message: error instanceof Error ? error.message : "Failed",
      });
    }
  }

  const disabled = state.status === "syncing";
  const buttons = [
    { resource: "customers" as const, label: "Fetch Customers", icon: Users },
    { resource: "offers" as const, label: "Fetch Offers", icon: Tag },
    { resource: "products" as const, label: "Fetch Products", icon: Boxes },
    { resource: "purchases" as const, label: "Fetch Purchases", icon: ShoppingCart },
  ];
  const progressPercent =
    state.totalPages && state.page
      ? Math.min(Math.round((state.page / state.totalPages) * 100), 100)
      : state.totalRecords && state.processed
        ? Math.min(Math.round((state.processed / state.totalRecords) * 100), 100)
        : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {buttons.map((button, index) => {
          const Icon = button.icon;
          return (
            <button
              key={button.resource}
              type="button"
              disabled={disabled}
              onClick={() => onSync(button.resource, button.label)}
              className={
                index === 0
                  ? "inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  : "inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              <Icon className="h-4 w-4" />
              {button.label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={!disabled}
          onClick={() => {
            stopRequested.current = true;
          }}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => window.location.reload()}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
      {state.message ? (
        <div className="min-w-72 max-w-xl">
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <p className={state.status === "failed" ? "text-red-700" : "text-zinc-600"}>
              {state.status === "syncing" ? "Syncing... " : ""}
              {state.message}
            </p>
            {state.status === "syncing" ? <span className="text-zinc-500">{progressPercent}%</span> : null}
          </div>
          {state.status === "syncing" ? (
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-zinc-950 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          ) : null}
          {state.status === "syncing" ? (
            <p className="mt-1 text-xs text-zinc-500">
              {state.processed ?? 0} records processed
              {state.totalRecords ? ` of ${state.totalRecords}` : ""}. Page size: {state.resource === "purchases" ? 25 : 200}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
