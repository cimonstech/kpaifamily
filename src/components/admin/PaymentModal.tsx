"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/admin/Toast";

function formatYmLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatCedis(n: number) {
  return `₵${n.toFixed(2)}`;
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
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#1a1a2e]/10 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6"
        role="dialog"
        aria-modal
        aria-labelledby="payment-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="payment-modal-title"
          className="font-serif text-lg font-semibold text-[#1a1a2e]"
        >
          {memberName}
        </h2>
        <p className="mt-1 text-sm text-[#1a1a2e]/60">
          Monthly rate: {formatCedis(monthlyRate)}/mo
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Amount
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Date paid
            </label>
            <input
              type="date"
              value={datePaid}
              onChange={(e) => setDatePaid(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. covering Jan–Mar"
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 placeholder:text-[#1a1a2e]/35 focus:ring-2"
            />
          </div>
        </div>

        <div className="mt-5 rounded-lg bg-[#f8f7f4] p-4 text-sm text-[#1a1a2e]/80">
          <p className="font-medium text-[#1a1a2e]">
            This payment covers {monthsPreview} month(s).
          </p>
          {monthsPreview > 0 && earliestLabel ? (
            <p className="mt-2">
              Starting from{" "}
              <span className="font-semibold text-[#1a1a2e]">
                {earliestLabel}
              </span>
              {coveredLabels.length > 1
                ? ` → ${coveredLabels[coveredLabels.length - 1]!}`
                : null}
              .
            </p>
          ) : null}
          {numAmount > monthlyRate && monthlyRate > 0 ? (
            <p className="mt-2 text-[#1a1a2e]/70">
              Amount is greater than one month at the current rate — extra
              coverage is applied to the earliest unpaid months.
            </p>
          ) : null}
          {creditBalance > 0 ? (
            <p className="mt-2 text-emerald-800">
              Applies {formatCedis(creditBalance)} existing member credit toward
              coverage.
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 px-4 py-2 text-sm font-medium text-[#1a1a2e]/70 transition hover:bg-[#f8f7f4] sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#1a1a2e] px-4 py-2 text-sm font-semibold text-[#e8b84b] shadow transition hover:bg-[#252542] disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
