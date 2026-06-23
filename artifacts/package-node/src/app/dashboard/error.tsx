"use client";

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-md border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h1 className="text-lg font-semibold">Dashboard failed to load</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Check the Supabase environment variables, applied migration, and service-role access.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
              {error.message}
            </pre>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              >
                <RotateCw className="h-4 w-4" />
                Retry
              </button>
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
              >
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
