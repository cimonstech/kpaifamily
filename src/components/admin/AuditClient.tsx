"use client";

import type { AuditLog } from "@/lib/types";
import { formatGhsCurrency } from "@/lib/utils/currency";
import { useMemo, useState } from "react";

const EVENT_TYPES = [
  "ADMIN_LOGIN",
  "ADMIN_LOGOUT",
  "FAILED_LOGIN",
  "PAYMENT_LOGGED",
  "PAYMENT_DELETED",
  "MEMBER_ADDED",
  "MEMBER_UPDATED",
  "CODE_CREATED",
  "CODE_DELETED",
  "DASHBOARD_ACCESS",
  "FAILED_CODE_ATTEMPT",
  "REPORT_GENERATED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "RATE_CHANGED",
  "ADMIN_ACCOUNT_CREATED",
  "ADMIN_ACCOUNT_DELETED",
] as const;

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function eventBadgeClass(event: string) {
  if (
    event.includes("FAILED") ||
    event.includes("DELETED") ||
    event === "PAYMENT_DELETED"
  ) {
    return "bg-red-100 text-red-900";
  }
  if (
    event.includes("LOGIN") ||
    event === "PASSWORD_RESET_COMPLETED" ||
    event === "MEMBER_ADDED"
  ) {
    return "bg-emerald-100 text-emerald-900";
  }
  if (event.includes("RESET_REQUESTED") || event.includes("CODE")) {
    return "bg-amber-100 text-amber-900";
  }
  if (event === "REPORT_GENERATED" || event === "PAYMENT_LOGGED") {
    return "bg-sky-100 text-sky-900";
  }
  if (event === "RATE_CHANGED" || event.includes("ADMIN_ACCOUNT")) {
    return "bg-violet-100 text-violet-900";
  }
  if (event === "DASHBOARD_ACCESS") {
    return "bg-teal-100 text-teal-900";
  }
  return "bg-gray-100 text-gray-800";
}

function formatDetails(event: string, meta: Record<string, unknown> | null) {
  if (!meta || Object.keys(meta).length === 0) return "—";
  if (event === "CODE_DELETED" && "deletedCode" in meta && "replacedWith" in meta) {
    return `Removed ${String(meta.deletedCode)} → ${String(meta.replacedWith)}`;
  }
  if (event === "RATE_CHANGED") {
    const oldR = meta.oldRate;
    const newR = meta.newRate;
    const eff = meta.effectiveFrom;
    const n = meta.membersAffected;
    return `${formatGhsCurrency(Number(oldR))} → ${formatGhsCurrency(Number(newR))}, effective ${String(eff)}, ${n} member(s)`;
  }
  if (event === "REPORT_GENERATED" && meta.month) {
    return `Month ${String(meta.month)}`;
  }
  if (event === "MEMBER_ADDED" && meta.name) {
    return String(meta.name);
  }
  if (event === "PAYMENT_LOGGED" && meta.amount != null && meta.member_id) {
    return `Amount ${formatGhsCurrency(Number(meta.amount))}, member ${String(meta.member_id).slice(0, 8)}…`;
  }
  if (event === "ADMIN_ACCOUNT_CREATED" && meta.email) {
    return String(meta.email);
  }
  try {
    return Object.entries(meta)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
  } catch {
    return "—";
  }
}

function actorLabel(log: AuditLog, adminEmails: Record<string, string>): string {
  if (
    log.event_type === "DASHBOARD_ACCESS" ||
    log.event_type === "FAILED_CODE_ATTEMPT"
  ) {
    return "Viewer";
  }
  if (log.actor_id && adminEmails[log.actor_id]) {
    return adminEmails[log.actor_id]!;
  }
  if (log.actor_id) {
    return `${log.actor_id.slice(0, 8)}…`;
  }
  return "System";
}

export function AuditClient({
  initialLogs,
  adminEmails,
}: {
  initialLogs: AuditLog[];
  adminEmails: Record<string, string>;
}) {
  const [eventFilter, setEventFilter] = useState<string>("");
  const [ipQuery, setIpQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    const ip = ipQuery.trim().toLowerCase();
    return initialLogs.filter((log) => {
      if (eventFilter && log.event_type !== eventFilter) return false;
      if (ip) {
        const addr = (log.ip_address ?? "").toLowerCase();
        if (!addr.includes(ip)) return false;
      }
      return true;
    });
  }, [initialLogs, eventFilter, ipQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-[#1a1a2e]">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-[#1a1a2e]/70">
          Last 6 months of system events
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-[#1a1a2e]/60">Event type</label>
          <select
            value={eventFilter}
            onChange={(e) => {
              setPage(0);
              setEventFilter(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 bg-white px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 lg:max-w-md"
          >
            <option value="">All</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-[#1a1a2e]/60">
            Search by IP
          </label>
          <input
            value={ipQuery}
            onChange={(e) => {
              setPage(0);
              setIpQuery(e.target.value);
            }}
            placeholder="e.g. 192.168."
            className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 lg:max-w-md"
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-[#1a1a2e]/10 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#1a1a2e]/10 bg-[#f8f7f4] text-xs font-semibold uppercase tracking-wide text-[#1a1a2e]/55">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Actor</th>
              <th className="hidden px-4 py-3 md:table-cell">IP</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a2e]/8">
            {slice.map((log) => (
              <tr key={log.id} className="text-[#1a1a2e]/90">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[#1a1a2e]/80">
                  {formatTimestamp(log.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${eventBadgeClass(log.event_type)}`}
                  >
                    {log.event_type}
                  </span>
                </td>
                <td className="max-w-[140px] truncate px-4 py-3 text-xs">
                  {actorLabel(log, adminEmails)}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-[#1a1a2e]/70 md:table-cell">
                  {log.ip_address ?? "—"}
                </td>
                <td className="max-w-md px-4 py-3 text-xs text-[#1a1a2e]/75">
                  {formatDetails(log.event_type, log.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-[#1a1a2e]/55">
          No entries match your filters.
        </p>
      ) : null}

      {filtered.length > pageSize ? (
        <div className="mt-4 flex items-center justify-between text-sm text-[#1a1a2e]/70">
          <span>
            Page {safePage + 1} of {pageCount} ({filtered.length} entries)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex min-h-[44px] items-center rounded-lg border border-[#1a1a2e]/15 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="flex min-h-[44px] items-center rounded-lg border border-[#1a1a2e]/15 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
