"use client";

import ParticleBackground from "@/components/ParticleBackground";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
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

export default function ForgotPasswordPage() {
  useAuthViewportLock();
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
              Reset password
            </p>

            {done ? (
              <div className="space-y-6 text-center">
                <p className="text-sm text-white/90">
                  If that email exists, a reset link has been sent. Check your
                  email.
                </p>
                <Link
                  href="/admin/login"
                  className="inline-block text-sm font-medium text-[rgba(232,184,75,0.9)] no-underline hover:text-[#e8b84b]"
                >
                  Back to login
                </Link>
              </div>
            ) : (
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
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-[rgba(232,184,75,0.6)] focus:bg-white/[0.12]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] cursor-pointer rounded-xl border-none font-bold transition-all active:scale-[0.98] disabled:opacity-70"
                  style={{
                    background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
                    color: "#1a1a2e",
                    fontSize: 15,
                    boxShadow: "0 4px 20px rgba(232,184,75,0.4)",
                  }}
                >
                  {loading ? "Sending…" : "Send Reset Link"}
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
