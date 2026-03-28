"use client";

import { useToast } from "@/components/admin/Toast";
import { useEffect, useState } from "react";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type GenerateReportModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function GenerateReportModal({
  open,
  onClose,
  onSuccess,
}: GenerateReportModalProps) {
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentMonthValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [textSummary, setTextSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMonth(currentMonthValue());
    setError(null);
    setPdfUrl(null);
    setTextSummary(null);
    setLoading(false);
  }, [open]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setTextSummary(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pdfUrl?: string;
        textSummary?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setPdfUrl(data.pdfUrl ?? null);
      setTextSummary(data.textSummary ?? null);
      showToast("Report generated", "success");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function copyText() {
    if (!textSummary) return;
    try {
      await navigator.clipboard.writeText(textSummary);
      showToast("Copied WhatsApp text", "success");
    } catch {
      showToast("Could not copy", "error");
    }
  }

  const showForm = !pdfUrl;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[#1a1a2e]/10 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6"
        role="dialog"
        aria-modal
        aria-labelledby="gen-report-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2
          id="gen-report-title"
          className="font-serif text-lg font-semibold text-[#1a1a2e]"
        >
          Generate report
        </h2>

        {showForm ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-[#1a1a2e]/60">
                Month
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 disabled:opacity-60"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 px-4 py-2 text-sm text-[#1a1a2e]/70 hover:bg-[#f8f7f4] sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !month}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow hover:bg-[#f0c35c] disabled:opacity-60 sm:w-auto"
              >
                {loading ? "Generating PDF…" : "Generate Report"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-[#1a1a2e]/70">Report ready.</p>
            <a
              href={pdfUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg bg-[#e8b84b] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow hover:bg-[#f0c35c]"
            >
              Download PDF
            </a>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-[#1a1a2e]/60">
                  WhatsApp text
                </label>
                <button
                  type="button"
                  onClick={() => void copyText()}
                  className="min-h-[44px] px-1 text-xs font-semibold text-[#e8b84b] hover:underline sm:min-h-0"
                >
                  Copy WhatsApp Text
                </button>
              </div>
              <textarea
                readOnly
                value={textSummary ?? ""}
                rows={12}
                className="mt-1 w-full resize-y rounded-lg border border-[#1a1a2e]/12 bg-[#f8f7f4] px-3 py-2 font-mono text-xs text-[#1a1a2e] outline-none"
              />
            </div>
            <div className="flex justify-stretch sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 px-4 py-2 text-sm text-[#1a1a2e]/70 hover:bg-[#f8f7f4] sm:w-auto"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
