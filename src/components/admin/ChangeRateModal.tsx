"use client";

import { ModalPortal } from "@/components/admin/ModalPortal";
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
    <ModalPortal>
    <div
      className="admin-modal-overlay motion-safe:animate-kpai-fade-in"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="admin-modal-card motion-safe:animate-kpai-scale-in"
        role="dialog"
        aria-modal
        aria-labelledby="change-rate-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="neu-modal-handle sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <h2
            id="change-rate-title"
            className="font-serif text-lg font-bold"
            style={{ color: "var(--neu-text-primary)" }}
          >
            Change global rate
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="neu-close-btn shrink-0"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              New contribution rate (GHS / month)
            </label>
            <input
              type="number"
              min={1}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={loading}
              className="neu-input mt-1 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Effective from (month)
            </label>
            <input
              type="month"
              value={effectiveMonth}
              onChange={(e) => setEffectiveMonth(e.target.value)}
              disabled={loading}
              className="neu-input mt-1 disabled:opacity-60"
            />
          </div>

          <div
            className="neu-card-sm text-sm"
            style={{
              boxShadow: "var(--neu-pressed-sm)",
              border: "1px solid color-mix(in srgb, var(--neu-warning) 35%, transparent)",
              color: "var(--neu-text-primary)",
            }}
          >
            This will update all members currently on the global rate. Members with
            individual overrides below this amount will also be updated to this new
            rate. Past months are not affected — only from{" "}
            <strong>{monthLabel(effectiveMonth)}</strong> onwards.
          </div>

          {error ? (
            <div className="neu-error-box text-sm" role="alert">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="neu-button min-h-[44px] w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="neu-button-gold min-h-[44px] w-full sm:w-auto"
            >
              {loading ? "Applying…" : "Apply New Rate"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
