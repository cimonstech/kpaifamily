"use client";

import { AddAdminModal } from "@/components/admin/AddAdminModal";
import { ChangeRateModal } from "@/components/admin/ChangeRateModal";
import { useToast } from "@/components/admin/Toast";
import type { Admin, GlobalRateHistory } from "@/lib/types";
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
      <h1 className="font-serif text-2xl font-semibold text-[#1a1a2e]">
        Settings
      </h1>

      <section className="rounded-xl border border-[#1a1a2e]/10 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#1a1a2e]/55">
          Global contribution rate
        </h2>
        <p className="mt-4 text-lg font-semibold text-[#1a1a2e]">
          Current rate: ₵{currentRate.toFixed(0)}/month
        </p>
        <p className="mt-1 text-sm text-[#1a1a2e]/65">
          Effective since: {formatDate(effectiveSince)}
        </p>
        <button
          type="button"
          onClick={() => setRateOpen(true)}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] px-4 py-2.5 text-sm font-semibold text-[#1a1a2e] shadow hover:bg-[#f0c35c] sm:w-auto"
        >
          Change Global Rate
        </button>

        {globalHistory.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#1a1a2e]/50">
              Rate history
            </h3>
            <div className="mt-2 overflow-x-auto rounded-lg border border-[#1a1a2e]/8">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f8f7f4] text-xs text-[#1a1a2e]/55">
                  <tr>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">Effective from</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a2e]/8">
                  {globalHistory.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">₵{Number(row.rate).toFixed(2)}</td>
                      <td className="px-3 py-2 text-[#1a1a2e]/75">
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

      <section className="rounded-xl border border-[#1a1a2e]/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#1a1a2e]/55">
            Admin accounts
          </h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow hover:bg-[#f0c35c] lg:w-auto"
          >
            Add Admin
          </button>
        </div>

        <ul className="mt-6 divide-y divide-[#1a1a2e]/8">
          {admins.map((a) => {
            const disableDelete =
              a.id === currentAdminId || a.role === "super";
            return (
              <li
                key={a.id}
                className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#1a1a2e]">{a.email}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        a.role === "super"
                          ? "bg-[#e8b84b]/25 text-[#1a1a2e]"
                          : "bg-[#1a1a2e]/10 text-[#1a1a2e]"
                      }`}
                    >
                      {a.role}
                    </span>
                    <p className="text-xs text-[#1a1a2e]/55">
                      Added {formatDate(a.created_at)}
                    </p>
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
                  className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
                >
                  {busyDelete === a.id ? "…" : "Delete"}
                </button>
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
