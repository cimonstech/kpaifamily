"use client";

import { AuthPoweredBy } from "@/components/AuthPoweredBy";
import ParticleBackground from "@/components/ParticleBackground";
import { APP_NAME, CODE_LENGTH } from "@/lib/constants";
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
  textAlign: "center",
};

export default function Page() {
  useAuthViewportLock();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setLoading(true);
    try {
      const res = await fetch("/api/codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      if (res.ok) {
        router.push("/dashboard");
        return;
      }
      if (res.status === 401) {
        setError("Invalid code. Please try again.");
        return;
      }
      setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
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
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#e8b84b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <form onSubmit={onSubmit} className="text-left">
              <label className="block">
                <span className="sr-only">Access code</span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={CODE_LENGTH}
                  placeholder="Enter access code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  className="mb-4 w-full rounded-[10px] border border-white/[0.12] bg-white/[0.08] px-4 py-3 text-center font-mono text-base font-semibold tracking-[0.2em] text-white outline-none transition-all placeholder:text-white/30 focus:border-[rgba(232,184,75,0.6)] focus:bg-white/[0.12]"
                />
              </label>

              {error ? (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border px-3.5 py-2.5 text-center text-xs"
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
                disabled={loading || code.trim().length === 0}
                className="w-full min-h-[48px] cursor-pointer rounded-xl border-none font-bold transition-all active:scale-[0.98] disabled:opacity-70"
                style={{
                  background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
                  color: "#1a1a2e",
                  fontSize: 15,
                  boxShadow: "0 4px 20px rgba(232,184,75,0.4)",
                }}
              >
                {loading ? "Checking…" : "View Dashboard"}
              </button>
            </form>

            <p
              className="mt-4 text-center text-xs"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Contact your family admin for the code
            </p>
        </div>

        <AuthPoweredBy />
      </div>
    </div>
  );
}
