"use client";

import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
        role?: string;
        mustResetPassword?: boolean;
      };
      if (res.ok && data.success) {
        if (data.mustResetPassword) {
          router.push("/admin/first-time-reset");
        } else {
          router.push("/admin");
          router.refresh();
        }
        return;
      }
      setError(
        typeof data.error === "string" ? data.error : "Sign in failed."
      );
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
        <p className="mt-2 text-center text-sm text-white/60">Admin Portal</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none ring-[#e8b84b]/30 placeholder:text-white/35 focus:ring-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">
              Password
            </label>
            <div className="relative mt-1">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 py-2.5 pl-3 pr-24 text-sm text-white outline-none ring-[#e8b84b]/30 placeholder:text-white/35 focus:ring-2"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-[#e8b84b] hover:bg-white/10"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] py-3 text-sm font-semibold text-[#1a1a2e] shadow transition hover:bg-[#f0c35c] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link
            href="/admin/forgot-password"
            className="text-[#e8b84b] underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
