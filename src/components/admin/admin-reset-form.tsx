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
    <div className="neu-auth-page flex items-center justify-center px-4 py-12 sm:py-16">
      <div className="neu-auth-card mx-auto motion-safe:animate-kpai-scale-in">
        <h1
          className="text-center font-serif text-2xl font-bold"
          style={{ color: "var(--neu-gold)" }}
        >
          {APP_NAME}
        </h1>
        <p
          className="mt-2 text-center text-sm"
          style={{ color: "var(--neu-text-secondary)" }}
        >
          New password
        </p>
        <div className="neu-divider" />

        {success ? (
          <p className="text-center text-sm" style={{ color: "var(--neu-text-primary)" }}>
            Password reset. Redirecting to login…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {!token ? (
              <p className="neu-error-box" role="alert">
                Invalid or missing link. Request a new reset from the login
                page.
              </p>
            ) : null}
            <div>
              <label
                className="block text-xs font-medium"
                style={{ color: "var(--neu-text-secondary)" }}
              >
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neu-input mt-1"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium"
                style={{ color: "var(--neu-text-secondary)" }}
              >
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="neu-input mt-1"
              />
            </div>
            {error ? (
              <div className="neu-error-box" role="alert">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading || !token}
              className="neu-button-gold min-h-[48px] w-full"
            >
              {loading ? "Saving…" : "Reset Password"}
            </button>
            <p className="text-center text-sm">
              <Link href="/admin/login" className="neu-link-gold">
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
        <div
          className="neu-auth-page flex min-h-screen items-center justify-center text-sm"
          style={{ color: "var(--neu-text-secondary)" }}
        >
          Loading…
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
