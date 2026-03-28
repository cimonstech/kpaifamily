"use client";

import { PaymentModal } from "@/components/admin/PaymentModal";
import { useToast } from "@/components/admin/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type ChecklistMemberVM = {
  id: string;
  name: string;
  branch: string;
  credit_balance: number;
  monthlyRate: number;
  balance: number;
  checklistPaid: boolean;
  paymentId: string | null;
  paymentDetail: {
    id: string;
    amount: number;
    date_paid: string;
    note: string | null;
  } | null;
  unpaidMonthKeysOrdered: string[];
};

function formatCedis(n: number) {
  return `₵${n.toFixed(2)}`;
}

function addMonthsYm(ym: string, delta: number): string {
  const [y, mo] = ym.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitleFromYm(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function ChecklistClient({
  monthKey,
  members,
  summary,
}: {
  monthKey: string;
  members: ChecklistMemberVM[];
  summary: {
    paidCount: number;
    unpaidCount: number;
    totalCollectedMonth: number;
  };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [showPaid, setShowPaid] = useState(false);
  const [modalMember, setModalMember] = useState<ChecklistMemberVM | null>(
    null
  );

  const title = monthTitleFromYm(monthKey);
  const prev = addMonthsYm(monthKey, -1);
  const next = addMonthsYm(monthKey, 1);

  const unpaid = useMemo(
    () =>
      members
        .filter((m) => !m.checklistPaid)
        .filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, search]
  );

  const paid = useMemo(
    () =>
      members
        .filter((m) => m.checklistPaid)
        .filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, search]
  );

  async function deletePayment(paymentId: string, memberName: string) {
    if (!window.confirm(`Remove payment for ${memberName}?`)) return;
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(
          typeof data.error === "string" ? data.error : "Could not delete",
          "error"
        );
        return;
      }
      showToast("Payment removed", "success");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    }
  }

  function balanceBadge(balance: number) {
    if (balance > 0.01) {
      return (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {formatCedis(balance)} behind
        </span>
      );
    }
    if (balance < -0.01) {
      return (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          {formatCedis(-balance)} ahead
        </span>
      );
    }
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        On track
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <div className="flex flex-col gap-4 border-b border-[#1a1a2e]/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-xl font-semibold text-[#1a1a2e] sm:text-2xl">
            Checklist — {title}
          </h1>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={`/admin/checklist/${prev}`}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 bg-white px-3 py-2 text-sm font-medium text-[#1a1a2e] shadow-sm transition hover:bg-[#f8f7f4] sm:w-auto"
            >
              ← Previous month
            </Link>
            <Link
              href={`/admin/checklist/${next}`}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 bg-white px-3 py-2 text-sm font-medium text-[#1a1a2e] shadow-sm transition hover:bg-[#f8f7f4] sm:w-auto"
            >
              Next month →
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col flex-wrap gap-3 text-sm text-[#1a1a2e]/80 sm:flex-row sm:items-center sm:gap-4">
        <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#1a1a2e]/10">
          <span className="font-semibold text-emerald-700">
            {summary.paidCount}
          </span>{" "}
          paid
        </span>
        <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#1a1a2e]/10">
          <span className="font-semibold text-amber-700">
            {summary.unpaidCount}
          </span>{" "}
          unpaid
        </span>
        <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#1a1a2e]/10 sm:flex-1 lg:flex-initial">
          Total collected this month:{" "}
          <span className="font-semibold text-[#1a1a2e]">
            {formatCedis(summary.totalCollectedMonth)}
          </span>
        </span>
      </div>

      <input
        type="search"
        placeholder="Search members…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full max-w-md rounded-lg border border-[#1a1a2e]/15 bg-white px-4 py-2.5 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 placeholder:text-[#1a1a2e]/35 focus:ring-2"
      />

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#1a1a2e]/50">
          Unpaid
        </h2>
        <ul className="mt-3 space-y-2">
          {unpaid.length === 0 ? (
            <li className="rounded-lg bg-white px-4 py-6 text-center text-sm text-[#1a1a2e]/50 ring-1 ring-[#1a1a2e]/10">
              No unpaid members in this view.
            </li>
          ) : (
            unpaid.map((m) => (
              <li key={m.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setModalMember(m)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setModalMember(m);
                  }}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl border border-[#1a1a2e]/10 bg-white px-4 py-3 shadow-sm outline-none ring-[#e8b84b]/30 hover:border-[#e8b84b]/35 focus-visible:ring-2 lg:flex-row lg:items-center lg:gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-[#1a1a2e]/25 bg-white"
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#1a1a2e]">{m.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-[56px] lg:ml-auto lg:shrink-0 lg:pl-0">
                    <span className="text-xs text-[#1a1a2e]/55">
                      {formatCedis(m.monthlyRate)}/mo
                    </span>
                    {balanceBadge(m.balance)}
                    {m.credit_balance > 0.01 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                        {formatCedis(m.credit_balance)} credit
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10">
        <button
          type="button"
          onClick={() => setShowPaid((v) => !v)}
          className="flex min-h-[48px] w-full items-center justify-between rounded-lg border border-[#1a1a2e]/10 bg-[#f8f7f4] px-4 py-3 text-left text-sm font-medium text-[#1a1a2e] transition hover:bg-[#efeee9]"
        >
          Show paid ({paid.length})
          <span className="text-[#1a1a2e]/50">{showPaid ? "▾" : "▸"}</span>
        </button>
        {showPaid ? (
          <ul className="mt-3 space-y-2">
            {paid.length === 0 ? (
              <li className="text-center text-sm text-[#1a1a2e]/50">
                No paid members this month.
              </li>
            ) : (
              paid.map((m) => (
                <li key={m.id}>
                  <div className="flex flex-col gap-2 rounded-xl border border-[#1a1a2e]/10 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-[#e8b84b] bg-[#e8b84b] text-xs font-bold text-[#1a1a2e]"
                          aria-hidden
                        >
                          ✓
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#1a1a2e]">{m.name}</p>
                        {m.paymentDetail ? (
                          <>
                            <p className="text-xs text-[#1a1a2e]/60">
                              {formatCedis(m.paymentDetail.amount)} ·{" "}
                              {new Date(
                                m.paymentDetail.date_paid
                              ).toLocaleDateString()}
                            </p>
                            {m.paymentDetail.note ? (
                              <p className="mt-1 text-xs text-[#1a1a2e]/55">
                                {m.paymentDetail.note}
                              </p>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                    {m.paymentId ? (
                      <button
                        type="button"
                        onClick={() => deletePayment(m.paymentId!, m.name)}
                        className="flex min-h-[44px] shrink-0 items-center justify-center self-start rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 sm:self-center"
                      >
                        Undo
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </section>

      {modalMember ? (
        <PaymentModal
          open={!!modalMember}
          onClose={() => setModalMember(null)}
          memberId={modalMember.id}
          memberName={modalMember.name}
          monthlyRate={modalMember.monthlyRate}
          creditBalance={modalMember.credit_balance}
          unpaidMonthKeysOrdered={modalMember.unpaidMonthKeysOrdered}
          onRecorded={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
