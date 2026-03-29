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
          Reset password
        </p>
        <div className="neu-divider" />

        {done ? (
          <div className="space-y-6 text-center">
            <p className="text-sm" style={{ color: "var(--neu-text-primary)" }}>
              If that email exists, a reset link has been sent. Check your
              email.
            </p>
            <Link href="/admin/login" className="neu-link-gold inline-block text-sm font-medium">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                className="block text-xs font-medium"
                style={{ color: "var(--neu-text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neu-input mt-1"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="neu-button-gold min-h-[48px] w-full"
            >
              {loading ? "Sending…" : "Send Reset Link"}
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
