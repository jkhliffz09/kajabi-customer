"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Status = "checking" | "ready" | "saving" | "saved" | "error";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("Checking recovery link...");

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      return null;
    }

    return createClient(url, anonKey);
  }, []);

  useEffect(() => {
    async function prepareRecoverySession() {
      if (!supabase) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.");
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error("The reset link is invalid or expired. Request a new password reset email.");
      }

      window.history.replaceState({}, document.title, "/reset-password");
      setStatus("ready");
      setMessage("Enter a new password for your Supabase admin user.");
    }

    prepareRecoverySession().catch((error: unknown) => {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to verify the reset link.");
    });
  }, [supabase]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setStatus("error");
      setMessage("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("saving");
    setMessage("Updating password...");
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setStatus("saved");
    setMessage("Password updated. You can sign in with the new password.");
  }

  const canEdit = Boolean(supabase) && (status === "ready" || status === "error");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-950">Set New Password</h1>
          <p className="mt-1 text-sm text-zinc-600">{message}</p>
        </div>
        {status === "saved" ? (
          <Link
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Back to login
          </Link>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-zinc-800">
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-zinc-950 disabled:bg-zinc-100"
                disabled={!canEdit}
                minLength={8}
                required
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-zinc-950 disabled:bg-zinc-100"
                disabled={!canEdit}
                minLength={8}
                required
              />
            </label>
            <button
              className="h-10 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canEdit}
            >
              Update password
            </button>
          </form>
        )}
        <div className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-zinc-700 hover:text-zinc-950">
            Request a new link
          </Link>
        </div>
      </div>
    </main>
  );
}
