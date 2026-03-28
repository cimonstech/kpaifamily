"use client";

import { useToast } from "@/components/admin/Toast";
import {
  DEFAULT_REPORT_WHATSAPP_OPTIONS,
  type ReportWhatsAppOptions,
  type UnpaidFilter,
} from "@/lib/utils/report-formatter";
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
  const [step, setStep] = useState<1 | 2>(1);
  const [month, setMonth] = useState(currentMonthValue);
  const [options, setOptions] = useState<ReportWhatsAppOptions>(() => ({
    ...DEFAULT_REPORT_WHATSAPP_OPTIONS,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [textSummary, setTextSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMonth(currentMonthValue());
    setOptions({ ...DEFAULT_REPORT_WHATSAPP_OPTIONS });
    setError(null);
    setPdfUrl(null);
    setTextSummary(null);
    setLoading(false);
  }, [open]);

  if (!open) return null;

  type BoolOptionKey = Exclude<keyof ReportWhatsAppOptions, "unpaidFilter">;
  function setBool<K extends BoolOptionKey>(key: K, value: boolean) {
    setOptions((o) => ({ ...o, [key]: value }));
  }

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
        body: JSON.stringify({ month, options }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pdfUrl?: string;
        textSummary?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setPdfUrl(data.pdfUrl ?? null);
      setTextSummary(data.textSummary ?? null);
      setStep(2);
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
      showToast("WhatsApp message copied", "success");
    } catch {
      showToast("Could not copy", "error");
    }
  }

  const unpaidFilters: { id: UnpaidFilter; label: string }[] = [
    { id: "all", label: "All members who haven't paid this month" },
    { id: "moreThan1Month", label: "Only members behind by more than 1 month" },
    { id: "moreThan3Months", label: "Only members behind by more than 3 months" },
    { id: "countOnly", label: "Don't include individual names (count only)" },
  ];

  const toggleRow = (
    key: keyof ReportWhatsAppOptions,
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void
  ) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#1a1a2e]/10 bg-[#f8f7f4]/80 px-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={loading}
        className="mt-1 h-4 w-4 shrink-0 rounded border-[#1a1a2e]/25 text-[#e8b84b] focus:ring-[#e8b84b]"
      />
      <span className="text-sm text-[#1a1a2e]">{label}</span>
    </label>
  );

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
          {step === 1 ? "Generate report" : "Report ready"}
        </h2>

        {step === 1 ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-6">
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

            <div>
              <h3 className="text-sm font-semibold text-[#1a1a2e]">
                What to include in this report
              </h3>
              <p className="mt-1 text-xs text-[#1a1a2e]/55">
                Choose sections for the WhatsApp message (PDF always includes full
                detail).
              </p>
              <div className="mt-3 space-y-2">
                {toggleRow(
                  "includeCollectedThisMonth",
                  "Total collected this month",
                  options.includeCollectedThisMonth,
                  (v) => setBool("includeCollectedThisMonth", v)
                )}
                {toggleRow(
                  "includeOutstanding",
                  "Total outstanding (all time)",
                  options.includeOutstanding,
                  (v) => setBool("includeOutstanding", v)
                )}
                {toggleRow(
                  "includePaidMembers",
                  "Members who paid this month",
                  options.includePaidMembers,
                  (v) => setBool("includePaidMembers", v)
                )}
                {toggleRow(
                  "includeUnpaidMembers",
                  "Members who have not paid this month",
                  options.includeUnpaidMembers,
                  (v) => setBool("includeUnpaidMembers", v)
                )}
                {toggleRow(
                  "includeAheadMembers",
                  "Members ahead of schedule",
                  options.includeAheadMembers,
                  (v) => setBool("includeAheadMembers", v)
                )}
                {toggleRow(
                  "includeTotalAllTime",
                  "Total collected all time",
                  options.includeTotalAllTime,
                  (v) => setBool("includeTotalAllTime", v)
                )}
              </div>
            </div>

            <fieldset
              className={`space-y-2 rounded-lg border border-[#1a1a2e]/10 p-3 ${!options.includeUnpaidMembers ? "opacity-50" : ""}`}
            >
              <legend className="px-1 text-xs font-semibold text-[#1a1a2e]/70">
                For “Members who have not paid”
              </legend>
              {unpaidFilters.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-start gap-2"
                >
                  <input
                    type="radio"
                    name="unpaidFilter"
                    checked={options.unpaidFilter === f.id}
                    onChange={() =>
                      setOptions((o) => ({ ...o, unpaidFilter: f.id }))
                    }
                    disabled={loading || !options.includeUnpaidMembers}
                    className="mt-0.5 h-4 w-4 shrink-0 border-[#1a1a2e]/25 text-[#e8b84b] focus:ring-[#e8b84b]"
                  />
                  <span className="text-sm text-[#1a1a2e]">{f.label}</span>
                </label>
              ))}
            </fieldset>

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
                {loading ? "Generating…" : "Generate Report"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-lg"
                aria-hidden
              >
                ✓
              </span>
              <p className="font-semibold text-[#1a1a2e]">Report ready!</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={pdfUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow hover:bg-[#f0c35c] sm:flex-1"
              >
                Download PDF
              </a>
              <button
                type="button"
                onClick={() => void copyText()}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 px-4 py-2 text-sm font-semibold text-[#1a1a2e] hover:bg-[#f8f7f4] sm:flex-1"
              >
                Copy WhatsApp Message
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-[#1a1a2e]/60">
                WhatsApp preview
              </label>
              <pre className="mt-1 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#1a1a2e]/12 bg-[#f8f7f4] px-3 py-2 font-sans text-xs leading-relaxed text-[#1a1a2e]">
                {textSummary ?? ""}
              </pre>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setPdfUrl(null);
                setTextSummary(null);
                setError(null);
              }}
              className="text-sm font-medium text-[#e8b84b] underline-offset-2 hover:underline"
            >
              Regenerate with different options
            </button>

            <div className="flex justify-stretch border-t border-[#1a1a2e]/10 pt-4 sm:justify-end">
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
