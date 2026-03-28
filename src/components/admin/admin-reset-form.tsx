"use client";

import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not reset password."
        );
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/admin/login");
      }, 2000);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a2e] px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 shadow-xl ring-1 ring-black/20 sm:p-8">
        <h1 className="text-center font-serif text-2xl font-semibold text-[#e8b84b]">
          {APP_NAME}
        </h1>
        <p className="mt-2 text-center text-sm text-white/60">New password</p>

        {success ? (
          <p className="mt-8 text-center text-sm text-white/85">
            Password reset. Redirecting to login…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {!token ? (
              <p className="text-sm text-amber-200/90" role="alert">
                Invalid or missing link. Request a new reset from the login
                page.
              </p>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-white/60">
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none ring-[#e8b84b]/30 focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60">
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none ring-[#e8b84b]/30 focus:ring-2"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading || !token}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] py-3 text-sm font-semibold text-[#1a1a2e] shadow transition hover:bg-[#f0c35c] disabled:opacity-60"
            >
              {loading ? "Saving…" : "Reset Password"}
            </button>
            <p className="text-center text-sm">
              <Link
                href="/admin/login"
                className="text-[#e8b84b] underline-offset-4 hover:underline"
              >
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminResetForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#1a1a2e] text-sm text-white/60">
          Loading…
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
