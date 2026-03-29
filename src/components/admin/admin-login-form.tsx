"use client";

import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function EyeIcon({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

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
          Admin Portal
        </p>
        <div className="neu-divider" />

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
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="neu-input mt-1"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              className="block text-xs font-medium"
              style={{ color: "var(--neu-text-secondary)" }}
            >
              Password
            </label>
            <div className="relative mt-1">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neu-input pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0 text-[var(--neu-gold)]"
                style={{ background: "none", border: "none", cursor: "pointer", boxShadow: "none" }}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                <EyeIcon show={showPw} />
              </button>
            </div>
          </div>

          {error ? (
            <div className="neu-error-box" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="neu-button-gold min-h-[48px] w-full"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/admin/forgot-password" className="neu-link-gold">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
