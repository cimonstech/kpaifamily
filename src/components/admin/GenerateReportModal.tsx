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
    <label className="neu-card-sm flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={loading}
        className="neu-checkbox mt-0.5"
      />
      <span className="text-sm" style={{ color: "var(--neu-text-primary)" }}>
        {label}
      </span>
    </label>
  );

  return (
    <div
      className="neu-modal-backdrop motion-safe:animate-kpai-fade-in"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="neu-modal-sheet neu-modal-sheet--lg motion-safe:animate-kpai-scale-in max-h-[92vh]"
        role="dialog"
        aria-modal
        aria-labelledby="gen-report-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="neu-modal-handle sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <h2
            id="gen-report-title"
            className="font-serif text-lg font-bold pr-2"
            style={{ color: "var(--neu-text-primary)" }}
          >
            {step === 1 ? "Generate report" : "Report ready"}
          </h2>
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

        {step === 1 ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                Month
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={loading}
                className="neu-input mt-1 disabled:opacity-60"
              />
            </div>

            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--neu-text-primary)" }}>
                What to include in this report
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                Choose sections for the WhatsApp message (PDF always includes full detail).
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
              className={`neu-card-sm space-y-2 border-0 p-3 ${!options.includeUnpaidMembers ? "opacity-50" : ""}`}
            >
              <legend className="px-1 text-xs font-bold" style={{ color: "var(--neu-text-secondary)" }}>
                For “Members who have not paid”
              </legend>
              {unpaidFilters.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="unpaidFilter"
                    checked={options.unpaidFilter === f.id}
                    onChange={() =>
                      setOptions((o) => ({ ...o, unpaidFilter: f.id }))
                    }
                    disabled={loading || !options.includeUnpaidMembers}
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ accentColor: "var(--neu-gold)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--neu-text-primary)" }}>
                    {f.label}
                  </span>
                </label>
              ))}
            </fieldset>

            {error ? (
              <div className="neu-error-box text-sm" role="alert">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="neu-button min-h-[44px] w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !month}
                className="neu-button-gold min-h-[44px] w-full rounded-full sm:w-auto"
              >
                {loading ? "Generating…" : "Generate Report"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold"
                style={{
                  background: "linear-gradient(145deg, #68d391, #38a169)",
                  color: "white",
                  boxShadow: "var(--neu-flat)",
                }}
                aria-hidden
              >
                ✓
              </span>
              <p className="font-bold" style={{ color: "var(--neu-text-primary)" }}>
                Report ready!
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={pdfUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="neu-button-gold flex min-h-[44px] w-full items-center justify-center rounded-full text-center text-sm sm:flex-1"
              >
                Download PDF
              </a>
              <button
                type="button"
                onClick={() => void copyText()}
                className="neu-button flex min-h-[44px] w-full items-center justify-center rounded-full text-sm font-semibold sm:flex-1"
                style={{ color: "var(--neu-text-primary)" }}
              >
                Copy WhatsApp Message
              </button>
            </div>

            <div>
              <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                WhatsApp preview
              </label>
              <pre
                className="neu-card-sm mt-1 max-h-52 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed"
                style={{
                  boxShadow: "var(--neu-pressed-sm)",
                  color: "var(--neu-text-secondary)",
                }}
              >
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
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--neu-gold)" }}
            >
              Regenerate with different options
            </button>

            <div className="neu-divider" style={{ margin: "1rem 0" }} />

            <div className="flex justify-stretch pt-2 sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="neu-button min-h-[44px] w-full sm:w-auto"
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
