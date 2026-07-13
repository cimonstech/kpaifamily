"use client";

import { useToast } from "@/components/admin/Toast";
import type { MemberRate, Payment } from "@/lib/types";
import { formatGhsCurrency } from "@/lib/utils/currency";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type MemberDetailMember = {
  id: string;
  name: string;
  branch: string;
  active: boolean;
  start_date: string | null;
  anonymous: boolean;
  variable_contributor: boolean;
  credit_balance: number;
  created_at: string;
};

export type MemberDetailVM = {
  member: MemberDetailMember;
  rates: MemberRate[];
  payments: Payment[];
  totalPaid: number;
  balance: number;
  expectedTotal: number;
  credit_balance: number;
  monthsContributing: number;
  monthsPaidSum: number;
  monthsExpected: number;
  checklist: { month: string; paid: boolean; payment_id: string | null }[];
  currentMonthLabel: string;
  currentRate: number;
};

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

function shortMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GH", {
    month: "short",
    year: "2-digit",
  });
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]![0]!}${p[1]![0]!}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function MemberDetailClient({ data }: { data: MemberDetailVM }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { member: initialMember } = data;

  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState(initialMember.name);
  const [headerBranch, setHeaderBranch] = useState(initialMember.branch);

  const [editOpen, setEditOpen] = useState(false);
  const [formName, setFormName] = useState(initialMember.name);
  const [formBranch, setFormBranch] = useState(initialMember.branch);
  const [formActive, setFormActive] = useState(initialMember.active);
  const [formStartMonth, setFormStartMonth] = useState(
    initialMember.start_date ? initialMember.start_date.slice(0, 7) : ""
  );
  const [formAnonymous, setFormAnonymous] = useState(initialMember.anonymous);
  const [formVariableContributor, setFormVariableContributor] = useState(
    initialMember.variable_contributor
  );
  const [formRate, setFormRate] = useState(String(data.currentRate));
  const [saving, setSaving] = useState(false);

  const memberId = initialMember.id;

  useEffect(() => {
    setHeaderName(data.member.name);
    setHeaderBranch(data.member.branch);
    setFormName(data.member.name);
    setFormBranch(data.member.branch);
    setFormActive(data.member.active);
    setFormStartMonth(
      data.member.start_date ? data.member.start_date.slice(0, 7) : ""
    );
    setFormAnonymous(data.member.anonymous);
    setFormVariableContributor(data.member.variable_contributor);
    setFormRate(String(data.currentRate));
  }, [
    data.member.name,
    data.member.branch,
    data.member.active,
    data.member.start_date,
    data.member.anonymous,
    data.member.variable_contributor,
    data.currentRate,
  ]);

  const balanceLabel = useMemo(() => {
    if (data.member.variable_contributor) {
      return { text: "Voluntary", color: "white" };
    }
    if (!data.member.start_date && !data.member.active) {
      return { text: "—", color: "var(--neu-text-secondary)" };
    }
    if (data.balance > 0.01) {
      return {
        text: `${formatCedis(data.balance)} behind`,
        color: "var(--neu-danger)",
      };
    }
    if (data.balance < -0.01) {
      return {
        text: `${formatCedis(-data.balance)} ahead`,
        color: "var(--neu-info)",
      };
    }
    return {
      text: `${formatCedis(0)} even`,
      color: "var(--neu-success)",
    };
  }, [
    data.balance,
    data.member.active,
    data.member.start_date,
    data.member.variable_contributor,
  ]);

  // Which months each payment covered, from checklist rows tagged with the
  // covering payment. Used to show e.g. "Apr 26 – Dec 26" in payment history.
  const paymentCoverageLabel = useMemo(() => {
    const monthsByPayment = new Map<string, string[]>();
    for (const c of data.checklist) {
      if (!c.paid || !c.payment_id) continue;
      const key = String(c.month).slice(0, 7);
      const list = monthsByPayment.get(c.payment_id) ?? [];
      list.push(key);
      monthsByPayment.set(c.payment_id, list);
    }
    const labels = new Map<string, string>();
    for (const [paymentId, months] of monthsByPayment) {
      months.sort();
      const first = shortMonthLabel(months[0]!);
      const last = shortMonthLabel(months[months.length - 1]!);
      labels.set(paymentId, months.length === 1 ? first : `${first} – ${last}`);
    }
    return labels;
  }, [data.checklist]);

  const monthStatusGrid = useMemo(() => {
    type CellStatus = "paid" | "ahead" | "unpaid" | "before-start";
    const months: Array<{
      label: string;
      monthStr: string;
      status: CellStatus;
    }> = [];

    const now = new Date();
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 23, 1);

    let startMonth: Date;
    if (data.member.start_date) {
      const start = new Date(`${data.member.start_date}T12:00:00`);
      startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    } else {
      startMonth = windowStart;
    }

    const displayStart = new Date(
      Math.min(startMonth.getTime(), windowStart.getTime())
    );

    const checklistMap = new Map<string, boolean>();
    for (const c of data.checklist) {
      const d = new Date(c.month);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      checklistMap.set(key, c.paid);
    }

    const current = new Date(displayStart);
    while (current <= endMonth) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
      const label = current.toLocaleDateString("en-GH", {
        month: "short",
        year: "2-digit",
      });

      let status: CellStatus;
      if (current.getTime() < startMonth.getTime()) {
        status = "before-start";
      } else if (checklistMap.get(key) === true) {
        status = "paid";
      } else {
        status = "unpaid";
      }

      months.push({ label, monthStr: key, status });
      current.setMonth(current.getMonth() + 1);
    }

    // Paid-ahead: keep going past the current month while future months are
    // already marked paid in the checklist.
    while (true) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
      if (checklistMap.get(key) !== true) break;
      const label = current.toLocaleDateString("en-GH", {
        month: "short",
        year: "2-digit",
      });
      months.push({ label, monthStr: key, status: "ahead" });
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [data.checklist, data.member.start_date]);

  async function patchMember(body: Record<string, unknown>) {
    const res = await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(typeof err.error === "string" ? err.error : "Update failed");
    }
  }

  async function saveHeader() {
    setSaving(true);
    try {
      await patchMember({
        name: headerName.trim(),
        branch: headerBranch.trim(),
      });
      showToast("Member updated", "success");
      setEditingHeader(false);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function savePanel() {
    const rateNum = parseFloat(formRate);
    if (!formVariableContributor && (Number.isNaN(rateNum) || rateNum <= 0)) {
      showToast("Monthly rate must be greater than 0", "error");
      return;
    }
    if (formActive && !formStartMonth) {
      showToast("Contributing since is required for active members.", "error");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        branch: formBranch.trim(),
        active: formActive,
        anonymous: formAnonymous,
        variable_contributor: formVariableContributor,
      };
      if (formActive && formStartMonth) {
        body.start_date = `${formStartMonth}-01`;
      } else if (!formActive) {
        body.start_date = null;
      }
      const rateChanged =
        !formVariableContributor && Math.abs(rateNum - data.currentRate) > 0.005;
      if (rateChanged) {
        body.monthly_rate = rateNum;
      }
      await patchMember(body);
      showToast("Member updated", "success");
      setEditOpen(false);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(paymentId: string) {
    if (
      !window.confirm(
        "Remove this payment? This will mark those months as unpaid."
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(typeof d.error === "string" ? d.error : "Delete failed", "error");
        return;
      }
      showToast("Payment removed", "success");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <Link
        href="/admin/members"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium hover:underline"
        style={{ color: "var(--neu-text-secondary)" }}
      >
        ← Back to members
      </Link>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className="neu-avatar flex h-16 w-16 shrink-0 items-center justify-center text-lg font-bold"
          style={{
            background: "linear-gradient(145deg, #f0c05a, #d4a43c)",
            color: "var(--neu-navy)",
          }}
        >
          {initials(data.member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {editingHeader ? (
              <>
                <input
                  value={headerName}
                  onChange={(e) => setHeaderName(e.target.value)}
                  className="neu-input max-w-xs font-serif text-xl font-bold"
                />
                <input
                  value={headerBranch}
                  onChange={(e) => setHeaderBranch(e.target.value)}
                  className="neu-input max-w-xs text-sm"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveHeader}
                  className="neu-button-gold min-h-[44px] px-3 py-2 text-xs"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderName(data.member.name);
                    setHeaderBranch(data.member.branch);
                    setEditingHeader(false);
                  }}
                  className="text-xs hover:underline"
                  style={{ color: "var(--neu-text-secondary)" }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--neu-text-primary)" }}>
                  {data.member.name}
                </h1>
                <button
                  type="button"
                  aria-label="Edit name and branch"
                  onClick={() => setEditingHeader(true)}
                  className="neu-button min-h-0 p-2"
                  style={{ boxShadow: "var(--neu-flat)" }}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {!editingHeader ? (
            <p className="mt-1" style={{ color: "var(--neu-text-secondary)" }}>
              {data.member.branch}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {data.member.active ? (
              <span className="neu-badge neu-badge-neutral" style={{ fontSize: 11 }}>
                Active
              </span>
            ) : (
              <span className="neu-badge neu-badge-neutral" style={{ fontSize: 11 }}>
                Not Active
              </span>
            )}
            {data.member.anonymous ? (
              <span className="neu-badge neu-badge-warning" style={{ fontSize: 11 }}>
                Anonymous on dashboard
              </span>
            ) : null}
            {data.member.variable_contributor ? (
              <span
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  color: "white",
                  boxShadow: "var(--neu-flat)",
                }}
              >
                Voluntary
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="neu-metric">
          <span className="label">Total paid</span>
          <span className="value text-lg sm:text-xl">{formatCedis(data.totalPaid)}</span>
        </div>
        <div className="neu-metric">
          <span className="label">Credit</span>
          <span className="value text-lg sm:text-xl" style={{ color: "var(--neu-success)" }}>
            {formatCedis(data.credit_balance)}
          </span>
        </div>
        <div
          className="neu-metric col-span-2 overflow-hidden lg:col-span-1"
          style={
            data.member.variable_contributor
              ? {
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  color: "white",
                }
              : undefined
          }
        >
          <span
            className="label"
            style={
              data.member.variable_contributor
                ? { color: "rgba(255,255,255,0.9)" }
                : undefined
            }
          >
            Balance
          </span>
          <span
            className="value text-lg sm:text-xl"
            style={{ color: balanceLabel.color }}
          >
            {balanceLabel.text}
          </span>
          {data.member.variable_contributor ? (
            <span className="sub" style={{ color: "rgba(255,255,255,0.88)" }}>
              No fixed commitment
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
        Months contributing:{" "}
        <span className="font-semibold" style={{ color: "var(--neu-text-primary)" }}>
          {data.monthsContributing}
        </span>
        {" · "}
        Months paid (coverage):{" "}
        <span className="font-semibold" style={{ color: "var(--neu-text-primary)" }}>
          {data.monthsPaidSum}
        </span>
        {data.member.variable_contributor ? null : (
          <>
            {" · "}
            Months expected (through today):{" "}
            <span className="font-semibold" style={{ color: "var(--neu-text-primary)" }}>
              {data.monthsExpected}
            </span>
          </>
        )}
      </p>
      {data.member.variable_contributor ? (
        <p
          className="mt-2 text-xs italic"
          style={{ color: "var(--neu-text-secondary)" }}
        >
          Voluntary contributor — contributes freely without a fixed monthly commitment
        </p>
      ) : null}

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setEditOpen((o) => !o)}
          className="neu-button flex min-h-[44px] w-full items-center justify-center sm:w-auto"
        >
          {editOpen ? "Close Edit Member" : "Edit Member"}
        </button>

        {editOpen ? (
          <div className="neu-card mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                  Name
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="neu-input mt-1 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                  Branch
                </label>
                <input
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  className="neu-input mt-1 w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="neu-checkbox"
                />
                <span style={{ color: "var(--neu-text-primary)" }}>Active (contributing)</span>
              </label>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                  Contributing since (month)
                </label>
                <input
                  type="month"
                  value={formStartMonth}
                  onChange={(e) => setFormStartMonth(e.target.value)}
                  className="neu-input mt-1 w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-sm lg:col-span-2">
                <input
                  type="checkbox"
                  checked={formAnonymous}
                  onChange={(e) => setFormAnonymous(e.target.checked)}
                  className="neu-checkbox"
                />
                <span style={{ color: "var(--neu-text-primary)" }}>
                  Anonymous on public dashboard
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm lg:col-span-2">
                <input
                  type="checkbox"
                  checked={formVariableContributor}
                  onChange={(e) => setFormVariableContributor(e.target.checked)}
                  className="neu-checkbox mt-0.5"
                />
                <span style={{ color: "var(--neu-text-primary)" }}>
                  Voluntary contributor
                  <span
                    className="mt-1 block text-xs font-normal"
                    style={{ color: "var(--neu-text-secondary)" }}
                  >
                    Excludes this member from outstanding balance calculations and hides them from
                    the public dashboard.
                  </span>
                </span>
              </label>
              <div className="lg:col-span-2">
                <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                  Monthly rate (GHS)
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  className="neu-input mt-1 w-full max-w-xs"
                  style={
                    formVariableContributor
                      ? { opacity: 0.4, pointerEvents: "none" as const }
                      : undefined
                  }
                />
                {formVariableContributor ? (
                  <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                    Monthly rate not applicable
                  </p>
                ) : (
                  <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                    Changing rate applies from {data.currentMonthLabel} onwards.
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={savePanel}
              className="neu-button-gold mt-6 flex min-h-[44px] w-full items-center justify-center disabled:opacity-60 sm:w-auto"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
          Rate history
        </h2>
        {data.member.variable_contributor ? (
          <p className="mt-2 text-xs italic" style={{ color: "var(--neu-text-secondary)" }}>
            Rate history does not affect balance calculations for voluntary contributors.
          </p>
        ) : null}
        {data.rates.length === 0 ? (
          <p
            className="neu-card-sm mt-3 py-6 text-center text-sm"
            style={{ color: "var(--neu-text-secondary)" }}
          >
            No rate history yet.
          </p>
        ) : (
          <div className="neu-card mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="neu-table-head text-xs uppercase">
                <tr style={{ color: "var(--neu-text-secondary)" }}>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Effective from</th>
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.rates.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: "1px solid color-mix(in srgb, var(--neu-shadow-dark) 12%, transparent)",
                    }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--neu-text-primary)" }}>
                      {formatCedis(r.rate)}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--neu-text-secondary)" }}>
                      {new Date(r.effective_from).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 capitalize" style={{ color: "var(--neu-text-secondary)" }}>
                      {r.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
          Payment history
        </h2>
        {data.payments.length === 0 ? (
          <p
            className="neu-card-sm mt-3 py-6 text-center text-sm"
            style={{ color: "var(--neu-text-secondary)" }}
          >
            No payments yet.
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 lg:hidden">
              {data.payments.map((p) => (
                <li key={p.id} className="neu-card-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--neu-text-primary)" }}>
                        {new Date(p.date_paid).toLocaleDateString()} —{" "}
                        {formatCedis(p.amount)}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                        {paymentCoverageLabel.has(p.id)
                          ? `Covers ${paymentCoverageLabel.get(p.id)}`
                          : `${p.months_covered} month${p.months_covered === 1 ? "" : "s"}`}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePayment(p.id)}
                      className="neu-button-danger min-h-[40px] px-2 py-1 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="neu-card mt-3 hidden overflow-x-auto p-0 lg:block">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="neu-table-head text-xs uppercase">
                <tr style={{ color: "var(--neu-text-secondary)" }}>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Months</th>
                  <th className="px-4 py-2">Note</th>
                  <th className="w-20 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid color-mix(in srgb, var(--neu-shadow-dark) 12%, transparent)",
                    }}
                  >
                    <td className="px-4 py-3" style={{ color: "var(--neu-text-secondary)" }}>
                      {new Date(p.date_paid).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--neu-text-primary)" }}>
                      {formatCedis(p.amount)}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--neu-text-secondary)" }}>
                      {p.months_covered}
                      {paymentCoverageLabel.has(p.id) ? (
                        <span className="block text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                          {paymentCoverageLabel.get(p.id)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--neu-text-secondary)" }}>
                      {p.note ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => deletePayment(p.id)}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: "var(--neu-danger)" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  className="font-semibold"
                  style={{
                    background: "var(--neu-bg)",
                    boxShadow: "inset 0 2px 4px var(--neu-shadow-dark)",
                    color: "var(--neu-text-primary)",
                  }}
                >
                  <td className="px-4 py-3">Running total</td>
                  <td className="px-4 py-3" colSpan={4}>
                    {formatCedis(data.totalPaid)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
          Monthly status
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
          Green = paid · Light green = paid ahead · Red = unpaid · Gray = before start
        </p>
        {data.member.variable_contributor ? (
          <p className="mt-1 text-xs italic" style={{ color: "var(--neu-text-secondary)" }}>
            Shows months where a payment was recorded
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {monthStatusGrid.map((cell) => {
            const style =
              cell.status === "paid"
                ? {
                    background: "linear-gradient(135deg, #68d391, #38a169)",
                    color: "white",
                    boxShadow: "var(--neu-raised)",
                  }
                : cell.status === "ahead"
                  ? {
                      background: "linear-gradient(135deg, #d9f7e3, #9ae6b4)",
                      color: "#276749",
                      boxShadow: "var(--neu-raised)",
                    }
                  : cell.status === "unpaid"
                  ? {
                      background: "linear-gradient(135deg, #fc8181, #e53e3e)",
                      color: "white",
                      boxShadow:
                        "3px 3px 6px #c5cad3, -3px -3px 6px #ffffff",
                    }
                  : {
                      background: "var(--neu-bg)",
                      color: "var(--neu-text-secondary)",
                      boxShadow: "var(--neu-pressed-sm)",
                    };
            return (
              <span
                key={cell.monthStr}
                title={cell.monthStr}
                className="text-center font-medium"
                style={{
                  ...style,
                  padding: "6px 10px",
                  borderRadius: 20,
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                {cell.label}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
