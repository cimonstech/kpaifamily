"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/admin/ModalPortal";
import { useToast } from "@/components/admin/Toast";
import { formatGhsCurrency } from "@/lib/utils/currency";

function formatYmLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

function todayLocalIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  monthlyRate: number;
  creditBalance: number;
  unpaidMonthKeysOrdered: string[];
  onRecorded: () => void;
};

export function PaymentModal({
  open,
  onClose,
  memberId,
  memberName,
  monthlyRate,
  creditBalance,
  unpaidMonthKeysOrdered,
  onRecorded,
}: PaymentModalProps) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState(String(monthlyRate));
  const [datePaid, setDatePaid] = useState(todayLocalIso());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(String(monthlyRate));
      setDatePaid(todayLocalIso());
      setNote("");
      setError(null);
      setLoading(false);
    }
  }, [open, monthlyRate]);

  const numAmount = parseFloat(amount) || 0;

  const monthsPreview = useMemo(() => {
    if (monthlyRate <= 0) return 0;
    return Math.floor((numAmount + creditBalance) / monthlyRate);
  }, [numAmount, creditBalance, monthlyRate]);

  const coveredLabels = useMemo(() => {
    return unpaidMonthKeysOrdered
      .slice(0, monthsPreview)
      .map(formatYmLabel);
  }, [unpaidMonthKeysOrdered, monthsPreview]);

  const earliestLabel =
    unpaidMonthKeysOrdered.length > 0
      ? formatYmLabel(unpaidMonthKeysOrdered[0]!)
      : null;

  if (!open) return null;

  async function onConfirm() {
    setError(null);
    if (numAmount < 0) {
      setError("Amount must be positive.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          amount: numAmount,
          datePaid,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        return;
      }
      showToast(
        `${memberName} — ${formatCedis(numAmount)} recorded`,
        "success"
      );
      onRecorded();
      onClose();
    } catch {
      setError("Network error.");
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
        aria-labelledby="payment-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="neu-modal-handle sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pr-2">
            <h2
              id="payment-modal-title"
              className="font-serif text-lg font-bold"
              style={{ color: "var(--neu-text-primary)" }}
            >
              {memberName}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
              Monthly rate: {formatCedis(monthlyRate)}/mo
            </p>
          </div>
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

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Amount
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="neu-input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Date paid
            </label>
            <input
              type="date"
              value={datePaid}
              onChange={(e) => setDatePaid(e.target.value)}
              className="neu-input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. covering Jan–Mar"
              className="neu-input mt-1"
            />
          </div>
        </div>

        <div className="neu-card-sm mt-5 text-sm" style={{ boxShadow: "var(--neu-pressed-sm)" }}>
          <p className="font-semibold" style={{ color: "var(--neu-text-primary)" }}>
            This payment covers {monthsPreview} month(s).
          </p>
          {monthsPreview > 0 && earliestLabel ? (
            <p className="mt-2" style={{ color: "var(--neu-text-secondary)" }}>
              Starting from{" "}
              <span className="font-bold" style={{ color: "var(--neu-gold)" }}>
                {earliestLabel}
              </span>
              {coveredLabels.length > 1
                ? ` → ${coveredLabels[coveredLabels.length - 1]!}`
                : null}
              .
            </p>
          ) : null}
          {numAmount > monthlyRate && monthlyRate > 0 ? (
            <p className="mt-2" style={{ color: "var(--neu-text-secondary)" }}>
              Amount is greater than one month at the current rate — extra
              coverage is applied to the earliest unpaid months.
            </p>
          ) : null}
          {creditBalance > 0 ? (
            <p className="mt-2 font-medium" style={{ color: "var(--neu-success)" }}>
              Applies {formatCedis(creditBalance)} existing member credit toward
              coverage.
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="neu-error-box mt-4" role="alert">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="neu-button min-h-[44px] w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="neu-button-gold min-h-[44px] w-full sm:w-auto"
          >
            {loading ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
