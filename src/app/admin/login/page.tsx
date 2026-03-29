"use client";

import { AuthPoweredBy } from "@/components/AuthPoweredBy";
import ParticleBackground from "@/components/ParticleBackground";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function useAuthViewportLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);
}

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

const outerAuthLayout: React.CSSProperties = {
  minHeight: "100vh",
  height: "100vh",
  overflow: "hidden",
  background: "#080818",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  padding: "20px",
};

const innerAuthContent: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: "400px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const glassCard: React.CSSProperties = {
  width: "min(380px, calc(100% - 40px))",
  margin: "0 auto",
  background: "rgba(255, 255, 255, 0.07)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 24,
  padding: "clamp(1.5rem, 4vh, 2rem)",
  boxShadow:
    "0 25px 45px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
  position: "relative",
  zIndex: 1,
};

export default function AdminLoginPage() {
  useAuthViewportLock();
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
    <div style={outerAuthLayout}>
      <ParticleBackground />

      <div style={innerAuthContent}>
        <header className="w-full shrink-0 text-center">
          <h1
            className="mb-1.5 font-serif font-bold"
            style={{
              fontSize: "clamp(20px, 4vw, 28px)",
              color: "#e8b84b",
              textShadow: "0 0 30px rgba(232,184,75,0.3)",
            }}
          >
            {APP_NAME}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginBottom: "clamp(1.5rem, 4vh, 2.5rem)",
            }}
          >
            Family Contributions Tracker
          </p>
        </header>

        <div style={glassCard} className="w-full">
            <p
              className="mb-6 text-center font-semibold uppercase tracking-[0.15em]"
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Admin Portal
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block"
                  style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-[rgba(232,184,75,0.6)] focus:bg-white/[0.12]"
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block"
                  style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.08] py-3 pl-4 pr-12 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-[rgba(232,184,75,0.6)] focus:bg-white/[0.12]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 border-none bg-transparent text-white/40 hover:text-white/80"
                    style={{ cursor: "pointer" }}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <EyeIcon show={showPw} />
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border px-3.5 py-2.5 text-xs"
                  style={{
                    background: "rgba(252,129,129,0.15)",
                    borderColor: "rgba(252,129,129,0.3)",
                    color: "#fc8181",
                  }}
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full min-h-[48px] cursor-pointer rounded-xl border-none font-bold transition-all active:scale-[0.98] disabled:opacity-70"
                style={{
                  background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
                  color: "#1a1a2e",
                  fontSize: 15,
                  boxShadow: "0 4px 20px rgba(232,184,75,0.4)",
                }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <Link
              href="/admin/forgot-password"
              className="mt-4 block text-center text-[13px] no-underline transition-colors hover:text-[#e8b84b]"
              style={{ color: "rgba(232,184,75,0.8)" }}
            >
              Forgot password?
            </Link>
        </div>

        <AuthPoweredBy />
      </div>

      <PWAInstallPrompt startUrl="/admin/login" />
    </div>
  );
}
