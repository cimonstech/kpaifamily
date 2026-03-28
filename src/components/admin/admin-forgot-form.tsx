"use client";

import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { useState } from "react";

export function AdminForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setDone(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a2e] px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 shadow-xl ring-1 ring-black/20 sm:p-8">
        <h1 className="text-center font-serif text-2xl font-semibold text-[#e8b84b]">
          {APP_NAME}
        </h1>
        <p className="mt-2 text-center text-sm text-white/60">Reset password</p>

        {done ? (
          <div className="mt-8 space-y-6 text-center">
            <p className="text-sm text-white/85">
              If that email exists, a reset link has been sent. Check your
              email.
            </p>
            <Link
              href="/admin/login"
              className="inline-block text-sm font-medium text-[#e8b84b] underline-offset-4 hover:underline"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none ring-[#e8b84b]/30 placeholder:text-white/35 focus:ring-2"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] py-3 text-sm font-semibold text-[#1a1a2e] shadow transition hover:bg-[#f0c35c] disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send Reset Link"}
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
