import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getSupabaseAuthClient } from "@/lib/supabase/auth";

async function getAppOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) throw new Error("APP_URL must be configured for password reset emails.");
  return `${proto}://${host}`;
}

async function forgotPasswordAction(formData: FormData) {
  "use server";

  try {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) redirect("/forgot-password?sent=1");

    const supabase = getSupabaseAuthClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await getAppOrigin()}/reset-password`,
    });

    redirect("/login?reset=sent");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("Forgot password failed", error);
    redirect("/forgot-password?error=config");
  }
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-950">Reset Password</h1>
          <p className="mt-1 text-sm text-zinc-600">Send a Supabase password reset link.</p>
        </div>
        {params.sent ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            If that email exists, Supabase sent a password reset link.
          </div>
        ) : null}
        {params.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Password reset is not configured correctly. Check the cPanel Node.js environment variables and Supabase redirect URLs.
          </div>
        ) : null}
        <form action={forgotPasswordAction} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-800">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-zinc-950"
              required
            />
          </label>
          <button className="h-10 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Send reset link
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-zinc-700 hover:text-zinc-950">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
