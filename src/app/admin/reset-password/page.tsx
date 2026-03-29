"use client";

import ParticleBackground from "@/components/ParticleBackground";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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

function ResetInner() {
  useAuthViewportLock();
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
              style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
            >
              New password
            </p>

            {success ? (
              <p className="text-center text-sm text-white/90">
                Password reset. Redirecting to login…
              </p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                {!token ? (
                  <div
                    role="alert"
                    className="rounded-lg border px-3.5 py-2.5 text-xs"
                    style={{
                      background: "rgba(252,129,129,0.15)",
                      borderColor: "rgba(252,129,129,0.3)",
                      color: "#fc8181",
                    }}
                  >
                    Invalid or missing link. Request a new reset from the login
                    page.
                  </div>
                ) : null}
                <div>
                  <label
                    className="mb-1.5 block"
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                  >
                    New password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[rgba(232,184,75,0.6)] focus:bg-white/[0.12]"
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block"
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                  >
                    Confirm password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[rgba(232,184,75,0.6)] focus:bg-white/[0.12]"
                  />
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
                  disabled={loading || !token}
                  className="w-full min-h-[48px] cursor-pointer rounded-xl border-none font-bold transition-all active:scale-[0.98] disabled:opacity-70"
                  style={{
                    background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
                    color: "#1a1a2e",
                    fontSize: 15,
                    boxShadow: "0 4px 20px rgba(232,184,75,0.4)",
                  }}
                >
                  {loading ? "Saving…" : "Reset Password"}
                </button>
                <Link
                  href="/admin/login"
                  className="mt-4 block text-center text-[13px] no-underline transition-colors hover:text-[#e8b84b]"
                  style={{ color: "rgba(232,184,75,0.8)" }}
                >
                  Back to login
                </Link>
              </form>
            )}
        </div>
      </div>
    </div>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="text-sm text-white/60"
          style={outerAuthLayout}
        >
          Loading…
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
