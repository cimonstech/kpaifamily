"use client";

import { APP_NAME } from "@/lib/constants";
import type { Payment } from "@/lib/types";
import { useMemo, useState } from "react";

export type DashboardMemberRow = {
  id: string;
  branch: string;
  active: boolean;
  anonymous: boolean;
  displayName: string;
  totalPaid: number;
  expectedTotal: number;
  balance: number;
  status: "ahead" | "ok" | "behind" | "pending";
  monthsPaidSum: number;
  payments: Payment[];
};

const AVATAR_PALETTE = [
  "bg-[#dbeafe] text-[#1e3a5f]",
  "bg-[#fce7f3] text-[#831843]",
  "bg-[#dcfce7] text-[#14532d]",
  "bg-[#fef3c7] text-[#78350f]",
  "bg-[#e0e7ff] text-[#312e81]",
  "bg-[#cffafe] text-[#164e63]",
];

type FilterTab = "all" | "behind" | "paidUp" | "ahead" | "inactive";

function getInitials(displayName: string) {
  if (displayName === "Anonymous") return "A";
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase() || "?";
}

function formatCedis(n: number) {
  return `₵${n.toFixed(2)}`;
}

function StatusBadge({ row }: { row: DashboardMemberRow }) {
  if (!row.active) {
    return (
      <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
        Not active
      </span>
    );
  }
  if (row.status === "behind") {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        Behind −{formatCedis(row.balance)}
      </span>
    );
  }
  if (row.status === "ahead") {
    return (
      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
        Ahead +{formatCedis(-row.balance)}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      Paid up
    </span>
  );
}

function MemberModal({
  row,
  onClose,
}: {
  row: DashboardMemberRow;
  onClose: () => void;
}) {
  const owedOrCredit =
    row.balance > 0
      ? { label: "Amount owed", value: formatCedis(row.balance) }
      : row.balance < 0
        ? { label: "Credit / ahead", value: formatCedis(-row.balance) }
        : { label: "Balance", value: formatCedis(0) };

  const sortedPayments = [...row.payments].sort(
    (a, b) =>
      new Date(b.date_paid).getTime() - new Date(a.date_paid).getTime()
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#1a1a2e]/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-h-[100dvh] overflow-y-auto rounded-none bg-white p-6 shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl"
        role="dialog"
        aria-modal
        aria-labelledby="member-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="member-modal-title"
              className="font-serif text-xl font-semibold text-[#1a1a2e]"
            >
              {row.displayName}
            </h2>
            {!row.anonymous ? (
              <p className="mt-1 text-sm text-[#1a1a2e]/60">{row.branch}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-[#1a1a2e]/50 transition hover:bg-[#f8f7f4] hover:text-[#1a1a2e]"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[#1a1a2e]/50">Total paid</dt>
            <dd className="font-semibold text-[#1a1a2e]">
              {formatCedis(row.totalPaid)}
            </dd>
          </div>
          <div>
            <dt className="text-[#1a1a2e]/50">{owedOrCredit.label}</dt>
            <dd className="font-semibold text-[#1a1a2e]">{owedOrCredit.value}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[#1a1a2e]/50">Months covered (payments)</dt>
            <dd className="font-semibold text-[#1a1a2e]">{row.monthsPaidSum}</dd>
          </div>
        </dl>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-[#1a1a2e]">
            Payment history
          </h3>
          <ul className="mt-3 divide-y divide-[#1a1a2e]/10">
            {sortedPayments.length === 0 ? (
              <li className="py-3 text-sm text-[#1a1a2e]/50">No payments yet</li>
            ) : (
              sortedPayments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    {!row.anonymous ? (
                      <span className="text-[#1a1a2e]/60">
                        {new Date(p.date_paid).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : null}
                    {p.note ? (
                      <p className="text-[#1a1a2e]">{p.note}</p>
                    ) : !row.anonymous ? null : (
                      <span className="text-[#1a1a2e]/60">Payment</span>
                    )}
                  </div>
                  <span className="font-medium text-[#1a1a2e]">
                    {formatCedis(p.amount)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DashboardMemberList({
  members,
  summary,
  headerDate,
  updatedAt,
  latestGlobalRate,
}: {
  members: DashboardMemberRow[];
  summary: {
    totalCollected: number;
    totalOutstanding: number;
    membersPaidUp: number;
    membersBehind: number;
  };
  headerDate: string;
  updatedAt: string;
  latestGlobalRate?: number | null;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<DashboardMemberRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !m.displayName.toLowerCase().includes(q)) return false;
      switch (tab) {
        case "behind":
          return m.active && m.status === "behind";
        case "paidUp":
          return m.active && m.status === "ok";
        case "ahead":
          return m.active && m.status === "ahead";
        case "inactive":
          return !m.active;
        default:
          return true;
      }
    });
  }, [members, search, tab]);

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "behind", label: "Behind" },
    { id: "paidUp", label: "Paid Up" },
    { id: "ahead", label: "Ahead" },
    { id: "inactive", label: "Not Active" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f7f4] pb-16">
      <header className="border-b border-[#1a1a2e]/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 lg:flex-row lg:items-end lg:justify-between lg:py-10">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[#e8b84b] sm:text-3xl">
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-[#1a1a2e]/70 sm:text-base">
              Family Contributions Tracker
            </p>
          </div>
          <div className="lg:text-right">
            <p className="text-sm text-[#1a1a2e]/50">{headerDate}</p>
            {latestGlobalRate != null ? (
              <p className="mt-1 text-xs text-[#1a1a2e]/45">
                Family reference rate: {formatCedis(latestGlobalRate)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-[#1a1a2e]/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#1a1a2e]/50">
              Total collected
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#1a1a2e]">
              {formatCedis(summary.totalCollected)}
            </p>
            <p className="mt-1 text-xs text-[#1a1a2e]/45">All time</p>
          </div>
          <div className="rounded-xl border border-[#1a1a2e]/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#1a1a2e]/50">
              Total outstanding
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#1a1a2e]">
              {formatCedis(summary.totalOutstanding)}
            </p>
          </div>
          <div className="rounded-xl border border-[#1a1a2e]/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#1a1a2e]/50">
              Members paid up
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#1a1a2e]">
              {summary.membersPaidUp}
            </p>
          </div>
          <div className="rounded-xl border border-[#1a1a2e]/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#1a1a2e]/50">
              Members behind
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#1a1a2e]">
              {summary.membersBehind}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#1a1a2e]/15 bg-white px-4 py-2.5 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 placeholder:text-[#1a1a2e]/35 focus:ring-2"
          />

          <div className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition min-h-[44px] sm:min-h-0 sm:py-1.5 ${
                  tab === t.id
                    ? "bg-[#1a1a2e] text-[#e8b84b]"
                    : "bg-white text-[#1a1a2e]/70 ring-1 ring-[#1a1a2e]/10 hover:bg-[#f8f7f4]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ul className="space-y-3">
            {filtered.map((row, i) => {
              const pct =
                row.expectedTotal > 0
                  ? Math.min(100, (row.totalPaid / row.expectedTotal) * 100)
                  : row.totalPaid > 0
                    ? 100
                    : 0;
              const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length]!;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    className="grid w-full grid-cols-[auto,minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl border border-[#1a1a2e]/10 bg-white p-4 text-left shadow-sm transition hover:border-[#e8b84b]/40 lg:items-center"
                  >
                    <div
                      className={`row-start-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${palette}`}
                    >
                      {getInitials(row.displayName)}
                    </div>
                    <div className="col-start-2 row-start-1 min-w-0 self-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[#1a1a2e]">
                          {row.displayName}
                        </span>
                        <StatusBadge row={row} />
                      </div>
                    </div>
                    <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-2">
                      <div className="h-2 overflow-hidden rounded-full bg-[#1a1a2e]/10">
                        <div
                          className="h-full rounded-full bg-[#e8b84b] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-2 hidden text-xs text-[#1a1a2e]/55 lg:block">
                        {formatCedis(row.totalPaid)} paid ·{" "}
                        {formatCedis(row.expectedTotal)} expected
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#1a1a2e]/50">
              No members match your filters.
            </p>
          ) : null}
        </div>
      </div>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-[#1a1a2e]/45">
        <p>
          Last updated:{" "}
          {new Date(updatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        <p className="mt-2">Powered by Cimons Technologies</p>
      </footer>

      {selected ? (
        <MemberModal row={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
