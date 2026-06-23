import Link from "next/link";
import { LogOut } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="font-semibold">
            Kajabi Customers
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-950">
              Dashboard
            </Link>
            <Link href="/customers" className="text-zinc-600 hover:text-zinc-950">
              Customers
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
