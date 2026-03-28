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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f7f4] px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-sm text-center rounded-2xl border border-[#1a1a2e]/10 bg-white p-6 shadow-sm lg:p-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#e8b84b] sm:text-4xl">
          {APP_NAME}
        </h1>
        <p className="mt-2 text-sm text-[#1a1a2e]/75">
          Family Contributions Tracker
        </p>

        <div className="mx-auto mt-8 flex justify-center text-[#1a1a2e]/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-left">
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
              className="w-full rounded-lg border border-[#1a1a2e]/15 bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.2em] text-[#1a1a2e] shadow-sm outline-none ring-[#e8b84b]/30 transition placeholder:text-[#1a1a2e]/35 focus:ring-2"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#1a1a2e] py-3 text-sm font-semibold text-[#e8b84b] shadow transition hover:bg-[#252542] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Checking…" : "View Dashboard"}
          </button>
        </form>

        <p className="mt-6 text-xs text-[#1a1a2e]/50">
          Contact the family admin for your access code
        </p>
      </div>
    </div>
  );
}
