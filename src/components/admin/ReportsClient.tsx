"use client";

import { GenerateReportModal } from "@/components/admin/GenerateReportModal";
import { useToast } from "@/components/admin/Toast";
import type { Report } from "@/lib/types";
import { DEFAULT_REPORT_WHATSAPP_OPTIONS } from "@/lib/utils/report-formatter";
import { useRouter } from "next/navigation";
import { useState } from "react";

function ymFromReportMonth(monthIso: string): string {
  return monthIso.slice(0, 7);
}

function formatReportMonth(monthIso: string) {
  try {
    const d = new Date(monthIso);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  } catch {
    return monthIso;
  }
}

function formatGeneratedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ReportsClient({ initialReports }: { initialReports: Report[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function copyWhatsapp(text: string | null) {
    if (!text) {
      showToast("No summary stored", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied WhatsApp text", "success");
    } catch {
      showToast("Could not copy", "error");
    }
  }

  async function regenerate(r: Report) {
    const ym = ymFromReportMonth(r.month);
    setBusyId(r.id);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: ym,
          options: DEFAULT_REPORT_WHATSAPP_OPTIONS,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Regeneration failed");
      showToast("Report regenerated", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--neu-text-primary)" }}>
          Reports
        </h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="neu-button-gold flex min-h-[44px] w-full items-center justify-center rounded-full sm:w-auto"
        >
          Generate Report
        </button>
      </div>

      <ul className="mt-10 space-y-4">
        {initialReports.map((r) => (
          <li key={r.id} className="neu-card">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--neu-text-primary)" }}>
                  {formatReportMonth(r.month)}
                </h2>
                <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                  Generated {formatGeneratedAt(r.generated_at)}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                {r.pdf_url ? (
                  <a
                    href={r.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="neu-button-gold flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-center text-xs font-semibold sm:w-auto"
                  >
                    Download PDF
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => void copyWhatsapp(r.text_summary)}
                  className="neu-button flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-xs font-medium sm:w-auto"
                  style={{ color: "var(--neu-text-primary)" }}
                >
                  Copy WhatsApp Text
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void regenerate(r)}
                  className="neu-button flex min-h-[44px] w-full items-center justify-center rounded-full px-3 py-2 text-xs font-medium disabled:opacity-50 sm:w-auto"
                  style={{ color: "var(--neu-text-primary)" }}
                >
                  {busyId === r.id ? "Working…" : "Regenerate"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {initialReports.length === 0 ? (
        <p className="mt-10 text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          No reports yet. Generate one for the current month.
        </p>
      ) : null}

      <GenerateReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
