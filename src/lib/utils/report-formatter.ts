export type UnpaidFilter =
  | "all"
  | "moreThan1Month"
  | "moreThan3Months"
  | "countOnly";

export type ReportWhatsAppOptions = {
  includePaidMembers: boolean;
  includeUnpaidMembers: boolean;
  includeOutstanding: boolean;
  unpaidFilter: UnpaidFilter;
};

export const DEFAULT_REPORT_WHATSAPP_OPTIONS: ReportWhatsAppOptions = {
  includePaidMembers: true,
  includeUnpaidMembers: false,
  includeOutstanding: false,
  unpaidFilter: "all",
};

export function normalizeReportWhatsAppOptions(
  raw: unknown
): ReportWhatsAppOptions {
  const d = DEFAULT_REPORT_WHATSAPP_OPTIONS;
  if (raw == null || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  const uf = o.unpaidFilter;
  const unpaidFilter =
    uf === "all" ||
    uf === "moreThan1Month" ||
    uf === "moreThan3Months" ||
    uf === "countOnly"
      ? uf
      : d.unpaidFilter;
  const bool = (k: keyof ReportWhatsAppOptions, def: boolean) =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : def;
  return {
    includePaidMembers: bool("includePaidMembers", d.includePaidMembers),
    includeUnpaidMembers: bool("includeUnpaidMembers", d.includeUnpaidMembers),
    includeOutstanding: bool("includeOutstanding", d.includeOutstanding),
    unpaidFilter,
  };
}

function displayName(entry: { name: string; anonymous: boolean }): string {
  return entry.anonymous ? "Anonymous" : entry.name;
}

/** Plain amount for list lines / monthly total: no "GHS", integers when whole. */
function formatPlainAmount(n: number): string {
  const x = Math.round(n * 100) / 100;
  if (Math.abs(x - Math.round(x)) < 0.001) {
    return String(Math.round(x));
  }
  return x.toLocaleString("en-GH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatWhatsAppReport(params: {
  month: Date;
  options: {
    includePaidMembers: boolean;
    includeUnpaidMembers: boolean;
    includeOutstanding: boolean;
    unpaidFilter: UnpaidFilter;
  };
  paidMembers: Array<{
    name: string;
    anonymous: boolean;
    amountPaidThisMonth: number;
  }>;
  unpaidMembers: Array<{
    name: string;
    anonymous: boolean;
    amountBehind: number;
    monthsBehind: number;
  }>;
  totalCollectedThisMonth: number;
  totalCollectedAllTime: number;
  totalOutstanding: number;
}): string {
  console.log("formatWhatsAppReport called with:", {
    paidCount: params.paidMembers.length,
    unpaidCount: params.unpaidMembers.length,
    options: params.options,
  });

  const monthName = params.month
    .toLocaleDateString("en-GH", { month: "long", year: "numeric" })
    .toUpperCase();

  let text = `${monthName} CONTRIBUTION\n\n`;

  if (params.options.includePaidMembers && params.paidMembers.length > 0) {
    params.paidMembers.forEach((m, i) => {
      const name = displayName(m);
      text += `${i + 1}. ${name} - ${formatPlainAmount(m.amountPaidThisMonth)}\n`;
    });
    text += `\nTotal - ${formatPlainAmount(params.totalCollectedThisMonth)}\n`;
  }

  if (params.options.includeUnpaidMembers) {
    if (params.options.unpaidFilter === "countOnly") {
      if (
        params.options.includePaidMembers &&
        params.paidMembers.length > 0
      ) {
        text += "\n";
      }
      text += `${params.unpaidMembers.length} member(s) are yet to pay.\n`;
    } else {
      let filtered = params.unpaidMembers;
      if (params.options.unpaidFilter === "moreThan1Month") {
        filtered = params.unpaidMembers.filter((m) => m.monthsBehind > 1);
      } else if (params.options.unpaidFilter === "moreThan3Months") {
        filtered = params.unpaidMembers.filter((m) => m.monthsBehind > 3);
      }

      if (filtered.length > 0) {
        if (
          params.options.includePaidMembers &&
          params.paidMembers.length > 0
        ) {
          text += "\n";
        }

        text += `Yet to pay (${filtered.length}):\n`;
        filtered.forEach((m, i) => {
          const name = displayName(m);
          const behindNote =
            m.monthsBehind > 1 ? ` (${m.monthsBehind} months behind)` : "";
          text += `${i + 1}. ${name}${behindNote}\n`;
        });
      }
    }
  }

  if (params.options.includeOutstanding) {
    text += `\nTotal outstanding - GHS ${params.totalOutstanding.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    text += `Total collected (all time) - GHS ${params.totalCollectedAllTime.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  }

  return text.trim();
}
