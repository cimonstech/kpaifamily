"use client";

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
    if (Number.isNaN(rateNum) || rateNum <= 0) {
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
          monthly_rate: rateNum,
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
      onSuccess();
      onClose();
    } catch {
      setError("Network error.");
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
        aria-labelledby="add-member-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2
          id="add-member-title"
          className="font-serif text-lg font-semibold text-[#1a1a2e]"
        >
          Add member
        </h2>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Full name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Branch
            </label>
            <select
              value={branchSelect}
              onChange={(e) => setBranchSelect(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 bg-white px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2"
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
                className="mt-2 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2"
              />
            ) : null}
          </div>

          <fieldset className="rounded-lg border border-[#1a1a2e]/10 p-3">
            <legend className="px-1 text-xs font-medium text-[#1a1a2e]/60">
              Status
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#1a1a2e]">
              <input
                type="radio"
                name="mstatus"
                checked={active}
                onChange={() => setActive(true)}
              />
              Active
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[#1a1a2e]">
              <input
                type="radio"
                name="mstatus"
                checked={!active}
                onChange={() => setActive(false)}
              />
              Not yet contributing
            </label>
          </fieldset>

          <div>
            <label
              className={`text-xs font-medium ${active ? "text-[#1a1a2e]/60" : "text-[#1a1a2e]/35"}`}
            >
              Contributing since
            </label>
            <input
              type="month"
              disabled={!active}
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#f8f7f4] disabled:text-[#1a1a2e]/40"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Monthly contribution (GHS)
            </label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#1a1a2e]">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            List as anonymous on public dashboard
          </label>

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
              {loading ? "Saving…" : "Add member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
