"use client";

import { AddMemberModal } from "@/components/admin/AddMemberModal";
import { formatGhsCurrency } from "@/lib/utils/currency";
import {
  getMemberPaymentSubtitle,
  memberPaymentProgressPercent,
} from "@/lib/utils/member-payment-subtitle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type MemberRowVM = {
  id: string;
  name: string;
  branch: string;
  active: boolean;
  anonymous: boolean;
  variable_contributor: boolean;
  currentRate: number;
  totalPaid: number;
  expectedTotal: number;
  balance: number;
  credit_balance: number;
  status: "ahead" | "ok" | "behind" | "pending" | "voluntary";
};

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]![0]!}${p[1]![0]!}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

type Tab = "all" | "active" | "behind" | "paidUp" | "ahead" | "voluntary" | "inactive";

export function MembersClient({ members }: { members: MemberRowVM[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q) {
        const hay = `${m.name} ${m.branch}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (tab) {
        case "active":
          return m.active;
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
        case "voluntary":
          return m.active && m.variable_contributor;
        case "inactive":
          return !m.active;
        default:
          return true;
      }
    });
  }, [members, tab, search]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.active);
    const standardActive = active.filter((m) => !m.variable_contributor);
    const behind = standardActive.filter((m) => m.status === "behind");
    const outstanding = behind.reduce((s, m) => s + Math.max(0, m.balance), 0);
    return {
      activeCount: active.length,
      behindCount: behind.length,
      outstanding,
    };
  }, [members]);

  function statusBadge(m: MemberRowVM) {
    if (!m.active) {
      return (
        <span className="neu-badge neu-badge-neutral" style={{ fontSize: 11 }}>
          Not Active
        </span>
      );
    }
    if (m.variable_contributor) {
      return (
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
      );
    }
    switch (m.status) {
      case "behind":
        return (
          <span className="neu-badge neu-badge-danger" style={{ fontSize: 11 }}>
            Behind
          </span>
        );
      case "ahead":
        return (
          <span className="neu-badge neu-badge-info" style={{ fontSize: 11 }}>
            Ahead
          </span>
        );
      case "ok":
        return (
          <span className="neu-badge neu-badge-success" style={{ fontSize: 11 }}>
            Paid Up
          </span>
        );
      default:
        return (
          <span className="neu-badge neu-badge-neutral" style={{ fontSize: 11 }}>
            Active
          </span>
        );
    }
  }

  function balanceCell(m: MemberRowVM) {
    if (m.variable_contributor) {
      return (
        <span className="text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          —
        </span>
      );
    }
    if (!m.active || m.status === "pending") {
      return (
        <span className="text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          —
        </span>
      );
    }
    if (m.status === "behind") {
      return (
        <span className="text-sm font-semibold" style={{ color: "var(--neu-danger)" }}>
          {formatCedis(m.balance)}
        </span>
      );
    }
    if (m.status === "ahead") {
      return (
        <span className="text-sm font-semibold" style={{ color: "var(--neu-info)" }}>
          +{formatCedis(-m.balance)}
        </span>
      );
    }
    return (
      <span className="text-sm font-semibold" style={{ color: "var(--neu-success)" }}>
        {formatCedis(0)}
      </span>
    );
  }

  function rateBadge(m: MemberRowVM) {
    if (m.variable_contributor) {
      return (
        <span
          className="neu-badge neu-badge-neutral shrink-0"
          style={{ fontSize: 11 }}
        >
          —
        </span>
      );
    }
    return (
      <span
        className="neu-badge neu-badge-neutral shrink-0"
        style={{ fontSize: 11 }}
      >
        {formatCedis(m.currentRate)}/mo
      </span>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "behind", label: "Behind" },
    { id: "paidUp", label: "Paid Up" },
    { id: "ahead", label: "Paid Ahead" },
    { id: "voluntary", label: "Voluntary" },
    { id: "inactive", label: "Not Active" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="font-serif text-2xl font-bold"
            style={{ color: "var(--neu-text-primary)" }}
          >
            Members
          </h1>
          <span className="neu-badge neu-badge-neutral">{members.length} total</span>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="neu-button-gold flex min-h-[48px] w-full items-center justify-center sm:w-auto"
        >
          Add Member
        </button>
      </div>

      <div className="-mx-1 mt-6 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`neu-button shrink-0 rounded-full px-4 py-2 text-xs min-h-[44px] lg:min-h-0 lg:py-1.5 ${
              tab === t.id ? "neu-tab-active" : ""
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="Search name or branch…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="neu-input mt-4 w-full max-w-md"
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="neu-metric">
          <span className="label">Active members</span>
          <span className="value">{stats.activeCount}</span>
        </div>
        <div className="neu-metric">
          <span className="label">Behind</span>
          <span className="value" style={{ color: "var(--neu-danger)" }}>
            {stats.behindCount}
          </span>
        </div>
        <div className="neu-metric">
          <span className="label">Total outstanding</span>
          <span className="value">{formatCedis(stats.outstanding)}</span>
        </div>
      </div>

      <ul className="mt-8 space-y-3 lg:hidden">
        {filtered.map((m) => {
          const pct = memberPaymentProgressPercent(m.totalPaid, m.expectedTotal);
          const sub = getMemberPaymentSubtitle(
            m.totalPaid,
            m.balance,
            m.variable_contributor ? "voluntary" : m.status
          );
          return (
          <li key={m.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/admin/members/${m.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  router.push(`/admin/members/${m.id}`);
              }}
              className="neu-card-sm neu-card-sm-interactive flex cursor-pointer items-start gap-3 text-left outline-none"
            >
              <div className="neu-avatar h-10 w-10 shrink-0 text-xs">
                {initials(m.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium" style={{ color: "var(--neu-text-primary)" }}>
                  {m.name}
                </p>
                {m.branch ? (
                  <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                    {m.branch}
                  </p>
                ) : null}
                {m.variable_contributor ? null : (
                <div className="neu-progress-track mt-2 h-2 w-full">
                  <div
                    className="neu-progress-fill transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                )}
                <p className="mt-1.5 text-xs" style={{ color: sub.colorVar }}>
                  {sub.text}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {statusBadge(m)}
                  {rateBadge(m)}
                  <span className="text-sm" style={{ color: "var(--neu-text-primary)" }}>
                    {balanceCell(m)}
                  </span>
                </div>
              </div>
              <Link
                href={`/admin/members/${m.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex min-h-[44px] shrink-0 items-center text-xs font-semibold hover:underline"
                style={{ color: "var(--neu-gold)" }}
              >
                View
              </Link>
            </div>
          </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p
          className="mt-8 py-10 text-center text-sm lg:hidden"
          style={{ color: "var(--neu-text-secondary)" }}
        >
          No members match your filters.
        </p>
      ) : null}

      <div className="neu-card mt-8 hidden overflow-hidden p-0 lg:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="neu-table-head text-xs font-semibold uppercase tracking-wide">
            <tr style={{ color: "var(--neu-text-secondary)" }}>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const pct = memberPaymentProgressPercent(m.totalPaid, m.expectedTotal);
              const sub = getMemberPaymentSubtitle(
                m.totalPaid,
                m.balance,
                m.variable_contributor ? "voluntary" : m.status
              );
              return (
              <tr
                key={m.id}
                className="neu-table-row-hover cursor-pointer transition"
                style={{
                  borderBottom: "1px solid color-mix(in srgb, var(--neu-shadow-dark) 20%, transparent)",
                }}
                onClick={() => router.push(`/admin/members/${m.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex max-w-xs flex-col gap-2 sm:max-w-md">
                    <div className="flex items-center gap-3">
                      <div className="neu-avatar h-10 w-10 shrink-0 text-xs">
                        {initials(m.name)}
                      </div>
                      <span className="font-medium" style={{ color: "var(--neu-text-primary)" }}>
                        {m.name}
                      </span>
                    </div>
                    <div className="min-w-0 pl-[52px]">
                      {m.variable_contributor ? null : (
                      <div className="neu-progress-track h-2 w-full max-w-[220px]">
                        <div
                          className="neu-progress-fill transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      )}
                      <p className="mt-1 text-xs" style={{ color: sub.colorVar }}>
                        {sub.text}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: "var(--neu-text-secondary)" }}>
                  {m.branch}
                </td>
                <td className="px-4 py-3">{statusBadge(m)}</td>
                <td className="px-4 py-3" style={{ color: "var(--neu-text-primary)" }}>
                  {m.variable_contributor ? "—" : `${formatCedis(m.currentRate)}/mo`}
                </td>
                <td className="px-4 py-3">{balanceCell(m)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/members/${m.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex min-h-[44px] items-center text-xs font-semibold hover:underline"
                    style={{ color: "var(--neu-gold)" }}
                  >
                    View
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
            No members match your filters.
          </p>
        ) : null}
      </div>

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
