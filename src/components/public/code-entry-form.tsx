"use client";

import { APP_NAME, CODE_LENGTH } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CodeEntryForm() {
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
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:py-16"
      style={{ background: "var(--neu-bg)" }}
    >
      <div
        className="neu-card mx-auto w-full max-w-[380px] p-10 text-center motion-safe:animate-kpai-scale-in"
      >
        <h1
          className="font-serif text-[28px] font-bold"
          style={{ color: "var(--neu-gold)" }}
        >
          {APP_NAME}
        </h1>
        <p
          className="mb-8 mt-2 text-sm"
          style={{ color: "var(--neu-text-secondary)" }}
        >
          Family Contributions Tracker
        </p>

        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ boxShadow: "var(--neu-raised)" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--neu-gold)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-left">
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
              className="neu-input text-center font-mono text-base font-semibold tracking-[0.2em]"
            />
          </label>

          {error ? (
            <p
              className="rounded-full px-3 py-2 text-center text-sm"
              style={{
                background: "rgba(252, 129, 129, 0.25)",
                color: "#c53030",
              }}
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            className="neu-button-gold mt-4 min-h-[48px] w-full"
          >
            {loading ? "Checking…" : "View Dashboard"}
          </button>
        </form>

        <p
          className="mt-4 text-center text-xs"
          style={{ color: "var(--neu-text-secondary)" }}
        >
          Contact your family admin for the code
        </p>
      </div>
    </div>
  );
}
