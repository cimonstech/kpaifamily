"use client";

import { PaymentModal } from "@/components/admin/PaymentModal";
import { useToast } from "@/components/admin/Toast";
import { formatGhsCurrency } from "@/lib/utils/currency";
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
    single_month_only: boolean;
    note: string | null;
  } | null;
  unpaidMonthKeysOrdered: string[];
};

function formatCedis(n: number) {
  return formatGhsCurrency(n);
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
        <span className="neu-badge neu-badge-danger">
          {formatCedis(balance)} behind
        </span>
      );
    }
    if (balance < -0.01) {
      return (
        <span className="neu-badge neu-badge-info">
          {formatCedis(-balance)} ahead
        </span>
      );
    }
    return <span className="neu-badge neu-badge-neutral">On track</span>;
  }

  return (
    <>
    <div className="mx-auto max-w-4xl pb-8">
      <div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1
            className="font-serif text-xl font-bold sm:text-2xl"
            style={{ color: "var(--neu-text-primary)" }}
          >
            Checklist — {title}
          </h1>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={`/admin/checklist/${prev}`}
              className="neu-button min-h-[44px] w-full rounded-[99px] px-5 py-2.5 text-sm sm:w-auto"
            >
              ← Prev
            </Link>
            <Link
              href={`/admin/checklist/${next}`}
              className="neu-button min-h-[44px] w-full rounded-[99px] px-5 py-2.5 text-sm sm:w-auto"
            >
              Next →
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="neu-card-sm text-center text-sm">
          <span className="font-bold" style={{ color: "var(--neu-success)" }}>
            {summary.paidCount}
          </span>{" "}
          <span style={{ color: "var(--neu-text-secondary)" }}>paid</span>
        </div>
        <div className="neu-card-sm text-center text-sm">
          <span className="font-bold" style={{ color: "#c53030" }}>
            {summary.unpaidCount}
          </span>{" "}
          <span style={{ color: "var(--neu-text-secondary)" }}>unpaid</span>
        </div>
        <div className="neu-card-sm text-center text-sm sm:col-span-1">
          <span style={{ color: "var(--neu-text-secondary)" }}>Collected: </span>
          <span className="font-bold" style={{ color: "var(--neu-gold)" }}>
            {formatCedis(summary.totalCollectedMonth)}
          </span>
        </div>
      </div>

      <input
        type="search"
        placeholder="Search members…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="neu-input mt-6 max-w-md"
      />

      <section className="mt-8">
        <h2
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--neu-text-secondary)" }}
        >
          Unpaid
        </h2>
        <ul className="mt-3 space-y-2">
          {unpaid.length === 0 ? (
            <li className="neu-card-sm py-6 text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
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
                  className="neu-card-sm neu-card-sm-interactive flex cursor-pointer flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 outline-none"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
                      <span className="neu-check-placeholder" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold" style={{ color: "var(--neu-text-primary)" }}>
                        {m.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-[56px] lg:ml-auto lg:shrink-0 lg:pl-0">
                    <span className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                      {formatCedis(m.monthlyRate)}/mo
                    </span>
                    {balanceBadge(m.balance)}
                    {m.credit_balance > 0.01 ? (
                      <span className="neu-badge neu-badge-success">
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
          className="neu-button flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
        >
          Show paid ({paid.length})
          <span style={{ color: "var(--neu-text-secondary)" }}>{showPaid ? "▾" : "▸"}</span>
        </button>
        {showPaid ? (
          <ul className="mt-3 space-y-2">
            {paid.length === 0 ? (
              <li className="text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
                No paid members this month.
              </li>
            ) : (
              paid.map((m) => (
                <li key={m.id}>
                  <div
                    className="neu-card-sm flex flex-col gap-2 opacity-85 sm:flex-row sm:items-center sm:gap-3"
                    style={{ boxShadow: "var(--neu-pressed-sm)" }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                          style={{
                            width: 24,
                            height: 24,
                            background: "linear-gradient(145deg, #f0c05a, #d4a43c)",
                            color: "var(--neu-navy)",
                            boxShadow: "var(--neu-raised)",
                          }}
                          aria-hidden
                        >
                          ✓
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold" style={{ color: "var(--neu-text-primary)" }}>
                          {m.name}
                        </p>
                        {m.paymentDetail ? (
                          <>
                            <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                              {formatCedis(m.paymentDetail.amount)} ·{" "}
                              {new Date(
                                m.paymentDetail.date_paid
                              ).toLocaleDateString()}
                              {m.paymentDetail.single_month_only ? (
                                <>
                                  {" "}
                                  <span className="neu-badge neu-badge-neutral">
                                    single month
                                  </span>
                                </>
                              ) : null}
                            </p>
                            {m.paymentDetail.note ? (
                              <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
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
                        className="neu-button-danger min-h-[44px] self-start rounded-[99px] px-4 py-2 text-xs sm:self-center"
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

    </div>

    {modalMember ? (
      <PaymentModal
        open={!!modalMember}
        onClose={() => setModalMember(null)}
        memberId={modalMember.id}
        memberName={modalMember.name}
        checklistMonthKey={monthKey}
        monthlyRate={modalMember.monthlyRate}
        creditBalance={modalMember.credit_balance}
        unpaidMonthKeysOrdered={modalMember.unpaidMonthKeysOrdered}
        onRecorded={() => router.refresh()}
      />
    ) : null}
    </>
  );
}
