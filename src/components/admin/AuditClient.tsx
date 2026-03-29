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

function eventBadgeClass(event: string): string {
  if (
    event.includes("FAILED") ||
    event.includes("DELETED") ||
    event === "PAYMENT_DELETED"
  ) {
    return "neu-badge-danger";
  }
  if (
    event.includes("LOGIN") ||
    event === "PASSWORD_RESET_COMPLETED" ||
    event === "MEMBER_ADDED"
  ) {
    return "neu-badge-success";
  }
  if (event.includes("RESET_REQUESTED") || event.includes("CODE")) {
    return "neu-badge-warning";
  }
  if (event === "REPORT_GENERATED" || event === "PAYMENT_LOGGED") {
    return "neu-badge-info";
  }
  if (event === "RATE_CHANGED" || event.includes("ADMIN_ACCOUNT")) {
    return "neu-badge-neutral";
  }
  if (event === "DASHBOARD_ACCESS") {
    return "neu-badge-success";
  }
  return "neu-badge-neutral";
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
        <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--neu-text-primary)" }}>
          Audit Log
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          Last 6 months of system events
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
            Event type
          </label>
          <select
            value={eventFilter}
            onChange={(e) => {
              setPage(0);
              setEventFilter(e.target.value);
            }}
            className="neu-input mt-1 cursor-pointer lg:max-w-md"
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
          <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
            Search by IP
          </label>
          <input
            value={ipQuery}
            onChange={(e) => {
              setPage(0);
              setIpQuery(e.target.value);
            }}
            placeholder="e.g. 192.168."
            className="neu-input mt-1 lg:max-w-md"
          />
        </div>
      </div>

      <ul className="mt-6 space-y-3 lg:hidden">
        {slice.map((log) => (
          <li key={log.id} className="neu-card-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className={`neu-badge ${eventBadgeClass(log.event_type)}`} style={{ fontSize: 10 }}>
                {log.event_type}
              </span>
              <span className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                {formatTimestamp(log.created_at)}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium" style={{ color: "var(--neu-text-primary)" }}>
              {actorLabel(log, adminEmails)}
              {log.ip_address ? (
                <span style={{ color: "var(--neu-text-secondary)" }}> · {log.ip_address}</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
              {formatDetails(log.event_type, log.metadata)}
            </p>
          </li>
        ))}
      </ul>

      <div className="neu-card mt-6 hidden overflow-x-auto p-0 lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="neu-table-head text-xs font-semibold uppercase tracking-wide">
            <tr style={{ color: "var(--neu-text-secondary)" }}>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Actor</th>
              <th className="hidden px-4 py-3 md:table-cell">IP</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((log) => (
              <tr
                key={log.id}
                className="neu-table-row-hover transition"
                style={{
                  borderBottom: "1px solid color-mix(in srgb, var(--neu-shadow-dark) 15%, transparent)",
                }}
              >
                <td className="whitespace-nowrap px-4 py-3 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                  {formatTimestamp(log.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span className={`neu-badge ${eventBadgeClass(log.event_type)}`} style={{ fontSize: 10 }}>
                    {log.event_type}
                  </span>
                </td>
                <td className="max-w-[140px] truncate px-4 py-3 text-xs" style={{ color: "var(--neu-text-primary)" }}>
                  {actorLabel(log, adminEmails)}
                </td>
                <td
                  className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs md:table-cell"
                  style={{ color: "var(--neu-text-secondary)" }}
                >
                  {log.ip_address ?? "—"}
                </td>
                <td className="max-w-md px-4 py-3 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                  {formatDetails(log.event_type, log.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          No entries match your filters.
        </p>
      ) : null}

      {filtered.length > pageSize ? (
        <div className="mt-4 flex items-center justify-between text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          <span>
            Page {safePage + 1} of {pageCount} ({filtered.length} entries)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="neu-button min-h-[44px] px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="neu-button min-h-[44px] px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
