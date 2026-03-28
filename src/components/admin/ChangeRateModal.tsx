"use client";

import { useToast } from "@/components/admin/Toast";
import { useEffect, useState } from "react";

function nextMonthValue() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  try {
    return new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return ym;
  }
}

type ChangeRateModalProps = {
  open: boolean;
  onClose: () => void;
  currentRate: number;
  onSuccess: () => void;
};

export function ChangeRateModal({
  open,
  onClose,
  currentRate,
  onSuccess,
}: ChangeRateModalProps) {
  const { showToast } = useToast();
  const [rate, setRate] = useState(String(currentRate));
  const [effectiveMonth, setEffectiveMonth] = useState(nextMonthValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRate(String(currentRate));
    setEffectiveMonth(nextMonthValue());
    setError(null);
    setLoading(false);
  }, [open, currentRate]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(rate);
    if (!Number.isFinite(n) || n < 1) {
      setError("Rate must be at least 1.");
      return;
    }
    const effectiveFrom = `${effectiveMonth}-01`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/global-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: n, effectiveFrom }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not apply rate");
      showToast("Global rate updated", "success");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[#1a1a2e]/10 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6"
        role="dialog"
        aria-modal
        aria-labelledby="change-rate-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2
          id="change-rate-title"
          className="font-serif text-lg font-semibold text-[#1a1a2e]"
        >
          Change global rate
        </h2>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              New contribution rate (GHS / month)
            </label>
            <input
              type="number"
              min={1}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Effective from (month)
            </label>
            <input
              type="month"
              value={effectiveMonth}
              onChange={(e) => setEffectiveMonth(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 disabled:opacity-60"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-[#1a1a2e]/85">
            This will update all members currently on the global rate. Members with
            individual overrides below this amount will also be updated to this new
            rate. Past months are not affected — only from{" "}
            <strong>{monthLabel(effectiveMonth)}</strong> onwards.
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 px-4 py-2 text-sm text-[#1a1a2e]/70 hover:bg-[#f8f7f4] sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow hover:bg-[#f0c35c] disabled:opacity-60 sm:w-auto"
            >
              {loading ? "Applying…" : "Apply New Rate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
