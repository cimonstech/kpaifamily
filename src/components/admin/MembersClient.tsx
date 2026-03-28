"use client";

import { AddMemberModal } from "@/components/admin/AddMemberModal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type MemberRowVM = {
  id: string;
  name: string;
  branch: string;
  active: boolean;
  anonymous: boolean;
  currentRate: number;
  totalPaid: number;
  expectedTotal: number;
  balance: number;
  credit_balance: number;
  status: "ahead" | "ok" | "behind" | "pending";
};

const BRANCH_AVATAR = [
  "bg-rose-200 text-rose-900",
  "bg-amber-200 text-amber-900",
  "bg-emerald-200 text-emerald-900",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
  "bg-orange-200 text-orange-900",
  "bg-cyan-200 text-cyan-900",
  "bg-fuchsia-200 text-fuchsia-900",
  "bg-lime-200 text-lime-900",
  "bg-indigo-200 text-indigo-900",
];

function branchAvatarClass(branch: string): string {
  let h = 0;
  for (let i = 0; i < branch.length; i++) {
    h = branch.charCodeAt(i) + ((h << 5) - h);
  }
  return BRANCH_AVATAR[Math.abs(h) % BRANCH_AVATAR.length]!;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]![0]!}${p[1]![0]!}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatCedis(n: number) {
  return `₵${n.toFixed(2)}`;
}

type Tab = "all" | "active" | "behind" | "paidUp" | "inactive";

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
          return m.active && m.status === "ok";
        case "inactive":
          return !m.active;
        default:
          return true;
      }
    });
  }, [members, tab, search]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.active);
    const behind = active.filter((m) => m.status === "behind");
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
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800">
          Not Active
        </span>
      );
    }
    switch (m.status) {
      case "behind":
        return (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            Behind
          </span>
        );
      case "ahead":
        return (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            Ahead
          </span>
        );
      case "ok":
        return (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Paid Up
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-[#1a1a2e]/10 px-2 py-0.5 text-xs font-medium text-[#1a1a2e]">
            Active
          </span>
        );
    }
  }

  function balanceCell(m: MemberRowVM) {
    if (!m.active || m.status === "pending") {
      return <span className="text-sm text-[#1a1a2e]/40">—</span>;
    }
    if (m.status === "behind") {
      return (
        <span className="text-sm font-semibold text-red-700">
          {formatCedis(m.balance)}
        </span>
      );
    }
    if (m.status === "ahead") {
      return (
        <span className="text-sm font-semibold text-blue-700">
          +{formatCedis(-m.balance)}
        </span>
      );
    }
    return (
      <span className="text-sm font-semibold text-emerald-700">
        {formatCedis(0)}
      </span>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "behind", label: "Behind" },
    { id: "paidUp", label: "Paid Up" },
    { id: "inactive", label: "Not Active" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-2xl font-semibold text-[#1a1a2e]">
            Members
          </h1>
          <span className="rounded-full bg-[#1a1a2e]/10 px-3 py-1 text-xs font-semibold text-[#1a1a2e]">
            {members.length} total
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] px-4 py-2.5 text-sm font-semibold text-[#1a1a2e] shadow transition hover:bg-[#f0c35c] sm:w-auto"
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
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition min-h-[44px] lg:min-h-0 lg:py-1.5 ${
              tab === t.id
                ? "bg-[#1a1a2e] text-[#e8b84b]"
                : "bg-white text-[#1a1a2e]/70 ring-1 ring-[#1a1a2e]/10 hover:bg-[#f8f7f4]"
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
        className="mt-4 w-full max-w-md rounded-lg border border-[#1a1a2e]/15 bg-white px-4 py-2.5 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 placeholder:text-[#1a1a2e]/35 focus:ring-2"
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-[#1a1a2e]/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#1a1a2e]/50">
            Active members
          </p>
          <p className="mt-1 font-serif text-xl font-semibold text-[#1a1a2e]">
            {stats.activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#1a1a2e]/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#1a1a2e]/50">
            Behind
          </p>
          <p className="mt-1 font-serif text-xl font-semibold text-red-700">
            {stats.behindCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#1a1a2e]/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[#1a1a2e]/50">
            Total outstanding
          </p>
          <p className="mt-1 font-serif text-xl font-semibold text-[#1a1a2e]">
            {formatCedis(stats.outstanding)}
          </p>
        </div>
      </div>

      <ul className="mt-8 space-y-3 lg:hidden">
        {filtered.map((m) => (
          <li key={m.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/admin/members/${m.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  router.push(`/admin/members/${m.id}`);
              }}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#1a1a2e]/10 bg-white p-4 text-left shadow-sm outline-none ring-[#e8b84b]/30 transition hover:border-[#e8b84b]/35 focus-visible:ring-2"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${branchAvatarClass(m.branch)}`}
              >
                {initials(m.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#1a1a2e]">{m.name}</p>
                {m.branch ? (
                  <p className="text-xs text-[#1a1a2e]/55">{m.branch}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {statusBadge(m)}
                  <span className="text-sm text-[#1a1a2e]">
                    {balanceCell(m)}
                  </span>
                </div>
              </div>
              <Link
                href={`/admin/members/${m.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex min-h-[44px] shrink-0 items-center text-xs font-semibold text-[#e8b84b] hover:underline"
              >
                View
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? (
        <p className="mt-8 py-10 text-center text-sm text-[#1a1a2e]/50 lg:hidden">
          No members match your filters.
        </p>
      ) : null}

      <div className="mt-8 hidden overflow-hidden rounded-xl border border-[#1a1a2e]/10 bg-white shadow-sm lg:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#1a1a2e]/10 bg-[#f8f7f4] text-xs font-semibold uppercase tracking-wide text-[#1a1a2e]/55">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                className="cursor-pointer border-b border-[#1a1a2e]/5 transition hover:bg-[#f8f7f4]/80"
                onClick={() => router.push(`/admin/members/${m.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${branchAvatarClass(m.branch)}`}
                    >
                      {initials(m.name)}
                    </div>
                    <span className="font-medium text-[#1a1a2e]">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#1a1a2e]/70">{m.branch}</td>
                <td className="px-4 py-3">{statusBadge(m)}</td>
                <td className="px-4 py-3 text-[#1a1a2e]">
                  {formatCedis(m.currentRate)}/mo
                </td>
                <td className="px-4 py-3">{balanceCell(m)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/members/${m.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex min-h-[44px] items-center text-xs font-semibold text-[#e8b84b] hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#1a1a2e]/50">
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
