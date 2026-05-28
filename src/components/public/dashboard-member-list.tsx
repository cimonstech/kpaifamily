"use client";

import { APP_NAME } from "@/lib/constants";
import type { Payment } from "@/lib/types";
import { formatGhsCurrency } from "@/lib/utils/currency";
import {
  getMemberPaymentSubtitle,
  memberPaymentProgressPercent,
} from "@/lib/utils/member-payment-subtitle";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type DashboardMemberRow = {
  id: string;
  branch: string;
  active: boolean;
  anonymous: boolean;
  variable_contributor: boolean;
  displayName: string;
  totalPaid: number;
  expectedTotal: number;
  balance: number;
  status: "ahead" | "ok" | "behind" | "pending";
  monthsPaidSum: number;
  payments: Payment[];
};

type FilterTab =
  | "all"
  | "behind"
  | "paidUp"
  | "ahead"
  | "anonymous"
  | "inactive";

function getInitials(displayName: string) {
  if (displayName === "Anonymous") return "A";
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase() || "?";
}

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

function StatusBadge({ row }: { row: DashboardMemberRow }) {
  if (!row.active) {
    return (
      <span className="neu-badge neu-badge-neutral" style={{ fontSize: 11 }}>
        Not active
      </span>
    );
  }
  if (row.status === "behind") {
    return (
      <span className="neu-badge neu-badge-danger" style={{ fontSize: 11 }}>
        Behind −{formatCedis(row.balance)}
      </span>
    );
  }
  if (row.status === "ahead") {
    return (
      <span className="neu-badge neu-badge-info" style={{ fontSize: 11 }}>
        Ahead +{formatCedis(-row.balance)}
      </span>
    );
  }
  return (
    <span className="neu-badge neu-badge-success" style={{ fontSize: 11 }}>
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
      className="neu-modal-backdrop motion-safe:animate-kpai-fade-in"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="neu-modal-sheet neu-modal-sheet--480 motion-safe:animate-kpai-scale-in max-h-[100dvh] sm:max-h-[90vh]"
        role="dialog"
        aria-modal
        aria-labelledby="member-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="neu-modal-handle sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="neu-avatar h-[60px] w-[60px] shrink-0 text-base font-bold">
              {getInitials(row.displayName)}
            </div>
            <div>
              <h2
                id="member-modal-title"
                className="font-serif text-lg font-bold"
                style={{ color: "var(--neu-text-primary)" }}
              >
                {row.displayName}
              </h2>
              {!row.anonymous ? (
                <p className="mt-1 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
                  {row.branch}
                </p>
              ) : null}
            </div>
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

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="neu-metric">
            <span className="label">Total paid</span>
            <span className="value text-base sm:text-xl">{formatCedis(row.totalPaid)}</span>
          </div>
          <div className="neu-metric">
            <span className="label">{owedOrCredit.label}</span>
            <span className="value text-base sm:text-xl">{owedOrCredit.value}</span>
          </div>
          <div className="neu-metric sm:col-span-1">
            <span className="label">Months covered</span>
            <span className="value text-base sm:text-xl">{row.monthsPaidSum}</span>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-bold" style={{ color: "var(--neu-text-primary)" }}>
            Payment history
          </h3>
          <ul className="mt-3">
            {sortedPayments.length === 0 ? (
              <li className="py-3 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
                No payments yet
              </li>
            ) : (
              sortedPayments.map((p, i) => (
                <li key={p.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      {!row.anonymous ? (
                        <span style={{ color: "var(--neu-text-secondary)" }}>
                          {new Date(p.date_paid).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ) : null}
                      {p.note ? (
                        <p style={{ color: "var(--neu-text-primary)" }}>{p.note}</p>
                      ) : !row.anonymous ? null : (
                        <span style={{ color: "var(--neu-text-secondary)" }}>Payment</span>
                      )}
                    </div>
                    <span className="font-semibold" style={{ color: "var(--neu-text-primary)" }}>
                      {formatCedis(p.amount)}
                    </span>
                  </div>
                  {i < sortedPayments.length - 1 ? (
                    <div className="neu-divider" style={{ margin: 0 }} />
                  ) : null}
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
    membersPaidAhead: number;
    membersBehind: number;
    anonymousCount: number;
    anonymousTotalPaid: number;
    totalExpenses: number;
    expenseCount: number;
  };
  headerDate: string;
  updatedAt: string;
  latestGlobalRate?: number | null;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<DashboardMemberRow | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !m.displayName.toLowerCase().includes(q)) return false;
      switch (tab) {
        case "behind":
          return m.active && m.status === "behind";
        case "paidUp":
          return (
            m.active &&
            !m.variable_contributor &&
            (m.status === "ok" || m.status === "ahead")
          );
        case "ahead":
          return m.active && !m.variable_contributor && m.status === "ahead";
        case "anonymous":
          return m.active && m.anonymous;
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
    { id: "ahead", label: "Paid Ahead" },
    { id: "anonymous", label: "Anonymous" },
    { id: "inactive", label: "Not Active" },
  ];

  return (
    <div className="min-h-screen pb-16" style={{ background: "var(--neu-bg)" }}>
      <header
        className="border-b"
        style={{
          background: "var(--neu-bg)",
          borderColor: "color-mix(in srgb, var(--neu-shadow-dark) 25%, transparent)",
          boxShadow: "0 4px 12px color-mix(in srgb, var(--neu-shadow-dark) 35%, transparent)",
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 lg:flex-row lg:items-end lg:justify-between lg:py-10">
          <div>
            <h1 className="font-serif text-[32px] font-bold" style={{ color: "var(--neu-gold)" }}>
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm sm:text-base" style={{ color: "var(--neu-text-secondary)" }}>
              Family Contributions Tracker
            </p>
          </div>
          <div className="lg:text-right">
            <p className="text-sm" style={{ color: "var(--neu-text-secondary)" }}>
              {headerDate}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
              {latestGlobalRate != null ? (
                <p
                  className="neu-card-sm inline-block text-xs"
                  style={{ color: "var(--neu-text-secondary)" }}
                >
                  Family reference rate: {formatCedis(latestGlobalRate)}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => router.push("/expenses")}
                className="inline-flex min-h-[32px] items-center rounded-[99px] px-[14px] py-[6px] text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
                  color: "#1a1a2e",
                  boxShadow: "var(--neu-raised)",
                }}
              >
                View Expenses
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <div className="neu-metric">
            <span className="label">Total collected</span>
            <span className="value metric-value">{formatCedis(summary.totalCollected)}</span>
            <span className="sub">All time</span>
          </div>
          <div className="neu-metric">
            <span className="label">Total outstanding</span>
            <span className="value metric-value">
              {formatCedis(summary.totalOutstanding)}
            </span>
          </div>
          <div className="neu-metric">
            <span className="label">Member status</span>
            <span className="value metric-value" style={{ color: "var(--neu-success)" }}>
              {summary.membersPaidUp} paid up
            </span>
            {summary.membersPaidAhead > 0 ? (
              <span className="sub" style={{ color: "var(--neu-info)" }}>
                {summary.membersPaidAhead} paid ahead
              </span>
            ) : null}
            <span className="sub" style={{ color: "var(--neu-danger)" }}>
              {summary.membersBehind} not yet paid
            </span>
          </div>
          <div
            className="neu-metric"
            style={{
              background: "linear-gradient(135deg, #4a5568, #2d3748)",
              color: "white",
            }}
          >
            <span className="label" style={{ color: "rgba(255,255,255,0.9)" }}>
              Anonymous
            </span>
            <span className="value metric-value" style={{ color: "white" }}>
              {formatCedis(summary.anonymousTotalPaid)}
            </span>
            <span className="sub" style={{ color: "rgba(255,255,255,0.85)" }}>
              {summary.anonymousCount} member
              {summary.anonymousCount === 1 ? "" : "s"} · all time paid
            </span>
          </div>
          <div className="neu-metric col-span-2 lg:col-span-1">
            <span className="label">Total expenses</span>
            <span className="value metric-value" style={{ color: "var(--neu-gold)" }}>
              {formatCedis(summary.totalExpenses)}
            </span>
            <span className="sub">{summary.expenseCount} records</span>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="neu-input w-full"
          />

          <div className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`neu-button shrink-0 rounded-full px-4 py-2 text-xs min-h-[44px] sm:min-h-0 sm:py-1.5 ${
                  tab === t.id ? "neu-tab-active" : ""
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ul className="space-y-3">
            {filtered.map((row) => {
              const pct = memberPaymentProgressPercent(
                row.totalPaid,
                row.expectedTotal
              );
              const sub = getMemberPaymentSubtitle(
                row.totalPaid,
                row.balance,
                row.status
              );
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    className="neu-card-sm neu-card-sm-interactive flex w-full flex-col gap-3 text-left outline-none motion-safe:active:scale-[0.98] motion-reduce:active:scale-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="neu-avatar h-12 w-12 shrink-0 text-sm font-semibold">
                        {getInitials(row.displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="font-medium" style={{ color: "var(--neu-text-primary)" }}>
                            {row.displayName}
                          </span>
                          <StatusBadge row={row} />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 w-full">
                      <div className="neu-progress-track h-2 w-full">
                        <div
                          className="neu-progress-fill transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs" style={{ color: sub.colorVar }}>
                        {sub.text}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
              No members match your filters.
            </p>
          ) : null}
        </div>
      </div>

      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-6 text-center text-xs" style={{ color: "var(--neu-text-secondary)" }}>
        <p>
          Last updated:{" "}
          {new Date(updatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        <p className="mt-4" style={{ color: "var(--neu-text-secondary)" }}>
          Powered by Cimons Technologies
        </p>
      </footer>

      {selected ? (
        <MemberModal row={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
