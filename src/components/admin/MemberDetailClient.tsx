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
  monthGrid: { key: string; label: string; state: "before" | "paid" | "unpaid" }[];
  currentMonthLabel: string;
  currentRate: number;
};

function formatCedis(n: number) {
  return formatGhsCurrency(n);
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
    setFormRate(String(data.currentRate));
  }, [
    data.member.name,
    data.member.branch,
    data.member.active,
    data.member.start_date,
    data.member.anonymous,
    data.currentRate,
  ]);

  const balanceLabel = useMemo(() => {
    if (!data.member.start_date && !data.member.active) {
      return { text: "—", className: "text-[#1a1a2e]/50" };
    }
    if (data.balance > 0.01) {
      return {
        text: `${formatCedis(data.balance)} behind`,
        className: "text-red-700",
      };
    }
    if (data.balance < -0.01) {
      return {
        text: `${formatCedis(-data.balance)} ahead`,
        className: "text-blue-700",
      };
    }
    return {
      text: `${formatCedis(0)} even`,
      className: "text-emerald-700",
    };
  }, [data.balance, data.member.active, data.member.start_date]);

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
    if (Number.isNaN(rateNum) || rateNum <= 0) {
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
      };
      if (formActive && formStartMonth) {
        body.start_date = `${formStartMonth}-01`;
      } else if (!formActive) {
        body.start_date = null;
      }
      const rateChanged =
        Math.abs(rateNum - data.currentRate) > 0.005;
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
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[#1a1a2e]/70 hover:text-[#1a1a2e]"
      >
        ← Back to members
      </Link>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#e8b84b] text-lg font-bold text-[#1a1a2e]">
          {initials(data.member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {editingHeader ? (
              <>
                <input
                  value={headerName}
                  onChange={(e) => setHeaderName(e.target.value)}
                  className="max-w-xs rounded-lg border border-[#1a1a2e]/20 px-2 py-1 font-serif text-2xl font-semibold text-[#1a1a2e]"
                />
                <input
                  value={headerBranch}
                  onChange={(e) => setHeaderBranch(e.target.value)}
                  className="max-w-xs rounded-lg border border-[#1a1a2e]/20 px-2 py-1 text-sm text-[#1a1a2e]"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveHeader}
                  className="flex min-h-[44px] items-center rounded-lg bg-[#1a1a2e] px-3 py-2 text-xs font-semibold text-[#e8b84b]"
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
                  className="text-xs text-[#1a1a2e]/60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h1 className="font-serif text-2xl font-semibold text-[#1a1a2e]">
                  {data.member.name}
                </h1>
                <button
                  type="button"
                  aria-label="Edit name and branch"
                  onClick={() => setEditingHeader(true)}
                  className="rounded p-1 text-[#1a1a2e]/45 hover:bg-[#1a1a2e]/5 hover:text-[#1a1a2e]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {!editingHeader ? (
            <p className="mt-1 text-[#1a1a2e]/65">{data.member.branch}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {data.member.active ? (
              <span className="rounded-full bg-[#1a1a2e]/10 px-2 py-0.5 text-xs font-medium text-[#1a1a2e]">
                Active
              </span>
            ) : (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800">
                Not Active
              </span>
            )}
            {data.member.anonymous ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Anonymous on dashboard
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#1a1a2e]/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-[#1a1a2e]/50">
            Total paid
          </p>
          <p className="mt-1 font-serif text-lg font-semibold text-[#1a1a2e] sm:text-xl">
            {formatCedis(data.totalPaid)}
          </p>
        </div>
        <div className="rounded-xl border border-[#1a1a2e]/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-[#1a1a2e]/50">
            Credit
          </p>
          <p className="mt-1 font-serif text-lg font-semibold text-emerald-700 sm:text-xl">
            {formatCedis(data.credit_balance)}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-[#1a1a2e]/10 bg-white p-4 shadow-sm lg:col-span-1">
          <p className="text-xs font-medium uppercase text-[#1a1a2e]/50">
            Balance
          </p>
          <p className={`mt-1 font-serif text-lg font-semibold sm:text-xl ${balanceLabel.className}`}>
            {balanceLabel.text}
          </p>
        </div>
      </div>

      <p className="mt-6 text-sm text-[#1a1a2e]/65">
        Months contributing:{" "}
        <span className="font-semibold text-[#1a1a2e]">
          {data.monthsContributing}
        </span>
        {" · "}
        Months paid (coverage):{" "}
        <span className="font-semibold text-[#1a1a2e]">
          {data.monthsPaidSum}
        </span>
        {" · "}
        Months expected (through today):{" "}
        <span className="font-semibold text-[#1a1a2e]">
          {data.monthsExpected}
        </span>
      </p>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setEditOpen((o) => !o)}
          className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 bg-white px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow-sm hover:bg-[#f8f7f4] sm:w-auto"
        >
          {editOpen ? "Close Edit Member" : "Edit Member"}
        </button>

        {editOpen ? (
          <div className="mt-4 rounded-xl border border-[#1a1a2e]/10 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[#1a1a2e]/60">
                  Name
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a2e]/60">
                  Branch
                </label>
                <input
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#1a1a2e]">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                />
                Active (contributing)
              </label>
              <div>
                <label className="text-xs font-medium text-[#1a1a2e]/60">
                  Contributing since (month)
                </label>
                <input
                  type="month"
                  value={formStartMonth}
                  onChange={(e) => setFormStartMonth(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#1a1a2e] lg:col-span-2">
                <input
                  type="checkbox"
                  checked={formAnonymous}
                  onChange={(e) => setFormAnonymous(e.target.checked)}
                />
                Anonymous on public dashboard
              </label>
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-[#1a1a2e]/60">
                  Monthly rate (GHS)
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  className="mt-1 w-full max-w-xs rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-[#1a1a2e]/50">
                  Changing rate applies from {data.currentMonthLabel} onwards.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={savePanel}
              className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#1a1a2e] px-4 py-2 text-sm font-semibold text-[#e8b84b] hover:bg-[#252542] disabled:opacity-60 sm:w-auto"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold text-[#1a1a2e]">
          Rate history
        </h2>
        {data.rates.length === 0 ? (
          <p className="mt-3 rounded-xl border border-[#1a1a2e]/10 bg-white py-6 text-center text-sm text-[#1a1a2e]/50">
            No rate history yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[#1a1a2e]/10 bg-white shadow-sm">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="border-b border-[#1a1a2e]/10 bg-[#f8f7f4] text-xs uppercase text-[#1a1a2e]/55">
                <tr>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Effective from</th>
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.rates.map((r) => (
                  <tr key={r.id} className="border-b border-[#1a1a2e]/5">
                    <td className="px-4 py-3 font-medium text-[#1a1a2e]">
                      {formatCedis(r.rate)}
                    </td>
                    <td className="px-4 py-3 text-[#1a1a2e]/70">
                      {new Date(r.effective_from).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 capitalize text-[#1a1a2e]/70">
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
        <h2 className="font-serif text-lg font-semibold text-[#1a1a2e]">
          Payment history
        </h2>
        {data.payments.length === 0 ? (
          <p className="mt-3 rounded-xl border border-[#1a1a2e]/10 bg-white py-6 text-center text-sm text-[#1a1a2e]/50">
            No payments yet.
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-[#1a1a2e]/10 rounded-xl border border-[#1a1a2e]/10 bg-white shadow-sm lg:hidden">
              {data.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1a1a2e]">
                      {new Date(p.date_paid).toLocaleDateString()} —{" "}
                      {formatCedis(p.amount)}
                    </p>
                    <p className="mt-1 text-xs text-[#1a1a2e]/65">
                      {p.note ?? "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePayment(p.id)}
                    className="flex min-h-[44px] shrink-0 items-center text-xs font-semibold text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 hidden overflow-x-auto rounded-xl border border-[#1a1a2e]/10 bg-white shadow-sm lg:block">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-[#1a1a2e]/10 bg-[#f8f7f4] text-xs uppercase text-[#1a1a2e]/55">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Months</th>
                  <th className="px-4 py-2">Note</th>
                  <th className="w-20 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-[#1a1a2e]/5">
                    <td className="px-4 py-3 text-[#1a1a2e]/75">
                      {new Date(p.date_paid).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1a1a2e]">
                      {formatCedis(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-[#1a1a2e]/70">
                      {p.months_covered}
                    </td>
                    <td className="px-4 py-3 text-[#1a1a2e]/65">
                      {p.note ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => deletePayment(p.id)}
                        className="inline-flex min-h-[44px] items-center text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f8f7f4] font-semibold text-[#1a1a2e]">
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
        <h2 className="font-serif text-lg font-semibold text-[#1a1a2e]">
          Monthly status (last 24 months)
        </h2>
        <p className="mt-1 text-xs text-[#1a1a2e]/55">
          Green = paid · Red = unpaid · Gray = before start
        </p>
        <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {data.monthGrid.map((cell) => {
            const cls =
              cell.state === "paid"
                ? "bg-emerald-500 text-white"
                : cell.state === "unpaid"
                  ? "bg-red-500 text-white"
                  : "bg-gray-200 text-gray-600";
            return (
              <span
                key={cell.key}
                title={cell.key}
                className={`rounded-full px-1.5 py-0.5 text-center text-[10px] font-medium sm:px-2 sm:py-1 sm:text-xs ${cls}`}
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
