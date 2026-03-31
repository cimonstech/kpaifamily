"use client";

import { ModalPortal } from "@/components/admin/ModalPortal";
import { useToast } from "@/components/admin/Toast";
import type { Expense } from "@/lib/types";
import { formatGhsCurrency } from "@/lib/utils/currency";
import { useEffect, useMemo, useState } from "react";

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DraftItem = { description: string; amount: string };

export function AddExpenseModal({
  open,
  onClose,
  onSuccess,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editing?: Expense | null;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ description: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(false);
    if (editing) {
      setTitle(editing.title);
      setDate(editing.date.slice(0, 10));
      setNotes(editing.notes ?? "");
      setItems(
        editing.items && editing.items.length > 0
          ? editing.items.map((it) => ({
              description: it.description,
              amount: String(it.amount),
            }))
          : [{ description: "", amount: "" }]
      );
    } else {
      setTitle("");
      setDate(todayIso());
      setNotes("");
      setItems([{ description: "", amount: "" }]);
    }
  }, [open, editing]);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [items]
  );

  if (!open) return null;

  function setItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = items.map((it) => ({
      description: it.description.trim(),
      amount: Number(it.amount),
    }));

    if (!title.trim()) return setError("Title is required.");
    if (!date) return setError("Date is required.");
    if (cleaned.length < 1) return setError("At least 1 item is required.");
    if (cleaned.some((it) => !it.description || !(it.amount > 0))) {
      return setError("Each item needs description and amount > 0.");
    }

    setLoading(true);
    try {
      const url = editing ? `/api/expenses/${editing.id}` : "/api/expenses";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          date,
          notes: notes.trim() || undefined,
          items: cleaned,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save expense.");
        return;
      }
      showToast(`Expense recorded - ${formatCedis(total)}`, "success");
      onSuccess();
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
          className="admin-modal-card admin-modal-card--lg motion-safe:animate-kpai-scale-in"
          role="dialog"
          aria-modal
          onClick={(e) => e.stopPropagation()}
        >
          <div className="neu-modal-handle sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-serif text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
              {editing ? "Edit Expense" : "Add Expense"}
            </h2>
            <button type="button" onClick={onClose} className="neu-close-btn" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                Title
              </label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="neu-input mt-1" required />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                Date
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="neu-input mt-1" required />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                Notes
              </label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="neu-input mt-1" />
            </div>

            <div>
              <p className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                Expense breakdown
              </p>
              <div className="mt-2 space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_44px] gap-2">
                    <input
                      value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                      placeholder="Description"
                      className="neu-input"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.amount}
                      onChange={(e) => setItem(i, { amount: e.target.value })}
                      placeholder="Amount"
                      className="neu-input"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      disabled={items.length <= 1}
                      className="neu-button min-h-[44px] px-0 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { description: "", amount: "" }])}
                className="neu-button mt-2 min-h-[44px] text-xs"
              >
                Add item
              </button>
            </div>

            <p className="text-lg font-bold" style={{ color: "var(--neu-gold)" }}>
              Total: {formatCedis(total)}
            </p>

            {error ? <div className="neu-error-box text-sm">{error}</div> : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="neu-button min-h-[44px]">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="neu-button-gold min-h-[44px]">
                {loading ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
