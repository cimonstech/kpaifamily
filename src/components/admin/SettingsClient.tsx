"use client";

import { AddAdminModal } from "@/components/admin/AddAdminModal";
import { ChangeRateModal } from "@/components/admin/ChangeRateModal";
import { useToast } from "@/components/admin/Toast";
import type { Admin, GlobalRateHistory } from "@/lib/types";
import { formatGhsCurrency } from "@/lib/utils/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminRow = Pick<Admin, "id" | "email" | "role" | "created_at">;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function adminInitials(email: string) {
  const local = email.split("@")[0] ?? "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

export function SettingsClient({
  currentAdminId,
  currentRate,
  effectiveSince,
  globalHistory,
  admins,
}: {
  currentAdminId: string;
  currentRate: number;
  effectiveSince: string;
  globalHistory: GlobalRateHistory[];
  admins: AdminRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [rateOpen, setRateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);

  async function deleteAdmin(target: AdminRow) {
    if (target.role === "super" || target.id === currentAdminId) return;
    const ok = window.confirm(`Remove admin access for ${target.email}?`);
    if (!ok) return;
    setBusyDelete(target.id);
    try {
      const res = await fetch(`/api/admin/accounts/${target.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      showToast("Admin removed", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusyDelete(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--neu-text-primary)" }}>
        Settings
      </h1>

      <section className="neu-card">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--neu-text-secondary)" }}>
          Global contribution rate
        </h2>
        <p className="mt-4 text-2xl font-bold" style={{ color: "var(--neu-gold)" }}>
          {formatGhsCurrency(currentRate).replace(/\.00$/, "")}
          <span className="text-lg font-semibold" style={{ color: "var(--neu-text-secondary)" }}>
            /month
          </span>
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          Effective since: {formatDate(effectiveSince)}
        </p>
        <button
          type="button"
          onClick={() => setRateOpen(true)}
          className="neu-button-gold mt-4 flex min-h-[44px] w-full items-center justify-center sm:w-auto"
        >
          Change Global Rate
        </button>

        {globalHistory.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--neu-text-secondary)" }}>
              Rate history
            </h3>
            <div className="neu-card-sm mt-2 overflow-x-auto p-0">
              <table className="min-w-full text-left text-sm">
                <thead className="neu-table-head text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                  <tr>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">Effective from</th>
                  </tr>
                </thead>
                <tbody>
                  {globalHistory.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: "1px solid color-mix(in srgb, var(--neu-shadow-dark) 12%, transparent)",
                      }}
                    >
                      <td className="px-3 py-2" style={{ color: "var(--neu-text-primary)" }}>
                        {formatGhsCurrency(Number(row.rate))}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--neu-text-secondary)" }}>
                        {formatDate(row.effective_from)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="neu-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--neu-text-secondary)" }}>
            Admin accounts
          </h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="neu-button-gold flex min-h-[44px] w-full items-center justify-center lg:w-auto"
          >
            Add Admin
          </button>
        </div>

        <ul className="mt-6 space-y-3">
          {admins.map((a) => {
            const disableDelete =
              a.id === currentAdminId || a.role === "super";
            return (
              <li key={a.id} className="neu-card-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="neu-avatar flex h-12 w-12 shrink-0 items-center justify-center text-sm font-bold"
                      style={{
                        background: "linear-gradient(145deg, #f0c05a, #d4a43c)",
                        color: "var(--neu-navy)",
                      }}
                    >
                      {adminInitials(a.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ color: "var(--neu-text-primary)" }}>
                        {a.email}
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <span
                          className={`neu-badge w-fit ${
                            a.role === "super" ? "neu-badge-warning" : "neu-badge-neutral"
                          }`}
                          style={{ fontSize: 10, textTransform: "uppercase" as const }}
                        >
                          {a.role}
                        </span>
                        <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                          Added {formatDate(a.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={disableDelete || busyDelete === a.id}
                    title={
                      disableDelete
                        ? a.role === "super"
                          ? "Cannot delete super admin"
                          : "Cannot delete your own account"
                        : "Remove admin"
                    }
                    onClick={() => void deleteAdmin(a)}
                    className="neu-button-danger min-h-[44px] w-full px-3 py-2 text-xs lg:w-auto"
                  >
                    {busyDelete === a.id ? "…" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <ChangeRateModal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        currentRate={currentRate}
        onSuccess={() => router.refresh()}
      />
      <AddAdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
