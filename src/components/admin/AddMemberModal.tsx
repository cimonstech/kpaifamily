"use client";

import { ModalPortal } from "@/components/admin/ModalPortal";
import { useToast } from "@/components/admin/Toast";
import { useEffect, useState } from "react";

const BRANCH_OPTIONS = [
  "Hellen Kpai",
  "Josphine Kpai",
  "Emmanuel Adanuvor",
  "Salomey Kpai-Feyi",
  "Dora Ziga",
  "Rose Kpai",
  "Simon Kpai",
  "Patience Kpai",
  "Paul Kpai",
  "Paulina Kpai",
  "Great-grandchild",
] as const;

const OTHER_VALUE = "__other__";

type AddMemberModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddMemberModal({ open, onClose, onSuccess }: AddMemberModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [branchSelect, setBranchSelect] = useState<string>(BRANCH_OPTIONS[0]!);
  const [branchOther, setBranchOther] = useState("");
  const [active, setActive] = useState(true);
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyRate, setMonthlyRate] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [variableContributor, setVariableContributor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(false);
    (async () => {
      try {
        const res = await fetch("/api/settings/global-rate");
        const data = (await res.json()) as { rate?: number };
        if (res.ok && typeof data.rate === "number") {
          setMonthlyRate(String(data.rate));
        } else {
          setMonthlyRate("50");
        }
      } catch {
        setMonthlyRate("50");
      }
    })();
  }, [open]);

  if (!open) return null;

  function resolvedBranch(): string {
    if (branchSelect === OTHER_VALUE) return branchOther.trim();
    return branchSelect;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const branch = resolvedBranch();
    if (!branch) {
      setError("Branch is required.");
      return;
    }
    if (active) {
      if (!startMonth) {
        setError("Contributing since is required for active members.");
        return;
      }
    }
    const rateNum = parseFloat(monthlyRate);
    if (!variableContributor && (Number.isNaN(rateNum) || rateNum <= 0)) {
      setError("Monthly rate must be greater than 0.");
      return;
    }

    const start_date = active ? `${startMonth}-01` : null;

    setLoading(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          branch,
          active,
          start_date,
          anonymous,
          variable_contributor: variableContributor,
          monthly_rate: variableContributor ? rateNum || 0 : rateNum,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not add member");
        return;
      }
      showToast(`Added ${name.trim()}`, "success");
      setName("");
      setBranchOther("");
      setBranchSelect(BRANCH_OPTIONS[0]!);
      setActive(true);
      setAnonymous(false);
      setVariableContributor(false);
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
        aria-labelledby="add-member-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="neu-modal-handle sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <h2
            id="add-member-title"
            className="font-serif text-lg font-bold"
            style={{ color: "var(--neu-text-primary)" }}
          >
            Add member
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
              Full name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="neu-input mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Branch
            </label>
            <select
              value={branchSelect}
              onChange={(e) => setBranchSelect(e.target.value)}
              className="neu-input mt-1 cursor-pointer"
            >
              {BRANCH_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value={OTHER_VALUE}>Other (type below)</option>
            </select>
            {branchSelect === OTHER_VALUE ? (
              <input
                value={branchOther}
                onChange={(e) => setBranchOther(e.target.value)}
                placeholder="Branch name"
                className="neu-input mt-2"
              />
            ) : null}
          </div>

          <fieldset className="neu-card-sm border-0 space-y-2">
            <legend className="px-1 text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Status
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="mstatus"
                checked={active}
                onChange={() => setActive(true)}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: "var(--neu-gold)" }}
              />
              <span style={{ color: "var(--neu-text-primary)" }}>Active</span>
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="mstatus"
                checked={!active}
                onChange={() => setActive(false)}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: "var(--neu-gold)" }}
              />
              <span style={{ color: "var(--neu-text-primary)" }}>Not yet contributing</span>
            </label>
          </fieldset>

          <div>
            <label
              className="text-xs font-medium"
              style={{
                color: active ? "var(--neu-text-secondary)" : "var(--neu-text-secondary)",
                opacity: active ? 1 : 0.55,
              }}
            >
              Contributing since
            </label>
            <input
              type="month"
              disabled={!active}
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="neu-input mt-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Monthly contribution (GHS)
            </label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
              className="neu-input mt-1"
              style={
                variableContributor
                  ? { opacity: 0.4, pointerEvents: "none" as const }
                  : undefined
              }
            />
            {variableContributor ? (
              <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                Monthly rate not applicable
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="neu-checkbox"
            />
            <span style={{ color: "var(--neu-text-primary)" }}>
              List as anonymous on public dashboard
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={variableContributor}
              onChange={(e) => setVariableContributor(e.target.checked)}
              className="neu-checkbox mt-0.5"
            />
            <span style={{ color: "var(--neu-text-primary)" }}>
              Voluntary contributor
              <span
                className="mt-1 block text-xs font-normal"
                style={{ color: "var(--neu-text-secondary)" }}
              >
                This person contributes freely without a fixed monthly commitment. They will be
                hidden from the public dashboard.
              </span>
            </span>
          </label>

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
              {loading ? "Saving…" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
