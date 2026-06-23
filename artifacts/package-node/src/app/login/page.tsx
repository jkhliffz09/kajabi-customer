import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { createAdminSession, isAuthenticated } from "@/lib/auth/session";
import { getSupabaseAuthClient } from "@/lib/supabase/auth";

function isAllowedAdminEmail(email: string) {
  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST;
  if (!allowlist) return true;
  const allowed = allowlist
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

async function loginAction(formData: FormData) {
  "use server";

  try {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const supabase = getSupabaseAuthClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    const userEmail = data.user?.email;

    if (error || !data.user || !userEmail || !isAllowedAdminEmail(userEmail)) {
      redirect("/login?error=invalid");
    }

    await createAdminSession({ id: data.user.id, email: userEmail });
    redirect("/dashboard");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("Login failed", error);
    redirect("/login?error=config");
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  if (await isAuthenticated()) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-950">Admin Login</h1>
          <p className="mt-1 text-sm text-zinc-600">Sign in with your Supabase admin user.</p>
        </div>
        {params.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error === "config"
              ? "Login is not configured correctly. Check the cPanel Node.js environment variables."
              : "Invalid email or password."}
          </div>
        ) : null}
        {params.reset === "sent" ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            If that email exists, Supabase sent a password reset link.
          </div>
        ) : null}
        <form action={loginAction} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-800">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-zinc-950"
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-zinc-950"
              required
            />
          </label>
          <button className="h-10 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Login
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-zinc-700 hover:text-zinc-950">
            Forgot password?
          </Link>
        </div>
      </div>
    </main>
  );
}
