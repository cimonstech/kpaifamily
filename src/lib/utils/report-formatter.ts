import { formatGhsCurrency } from "@/lib/utils/currency";

function displayName(entry: { name: string; anonymous: boolean }): string {
  return entry.anonymous ? "Anonymous" : entry.name;
}

function monthHeading(month: Date): string {
  return month.toLocaleString("en-GH", { month: "long", year: "numeric" });
}

export type UnpaidFilter =
  | "all"
  | "moreThan1Month"
  | "moreThan3Months"
  | "countOnly";

export type ReportWhatsAppOptions = {
  includeCollectedThisMonth: boolean;
  includeOutstanding: boolean;
  includePaidMembers: boolean;
  includeUnpaidMembers: boolean;
  includeAheadMembers: boolean;
  includeTotalAllTime: boolean;
  unpaidFilter: UnpaidFilter;
};

export const DEFAULT_REPORT_WHATSAPP_OPTIONS: ReportWhatsAppOptions = {
  includeCollectedThisMonth: true,
  includeOutstanding: true,
  includePaidMembers: true,
  includeUnpaidMembers: true,
  includeAheadMembers: false,
  includeTotalAllTime: false,
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
    includeCollectedThisMonth: bool(
      "includeCollectedThisMonth",
      d.includeCollectedThisMonth
    ),
    includeOutstanding: bool("includeOutstanding", d.includeOutstanding),
    includePaidMembers: bool("includePaidMembers", d.includePaidMembers),
    includeUnpaidMembers: bool("includeUnpaidMembers", d.includeUnpaidMembers),
    includeAheadMembers: bool("includeAheadMembers", d.includeAheadMembers),
    includeTotalAllTime: bool("includeTotalAllTime", d.includeTotalAllTime),
    unpaidFilter,
  };
}

type PaidMemberRow = {
  name: string;
  anonymous: boolean;
  amountThisMonth: number;
};

type UnpaidMemberRow = {
  name: string;
  anonymous: boolean;
  amountBehind: number;
  monthsBehind: number;
};

type AheadMemberRow = {
  name: string;
  anonymous: boolean;
  amountAhead: number;
};

export function formatWhatsAppReport(params: {
  month: Date;
  totalCollectedThisMonth: number;
  totalCollectedAllTime: number;
  totalOutstanding: number;
  paidMembers: PaidMemberRow[];
  unpaidMembers: UnpaidMemberRow[];
  aheadMembers: AheadMemberRow[];
  options: ReportWhatsAppOptions;
}): string {
  const {
    month,
    totalCollectedThisMonth,
    totalCollectedAllTime,
    totalOutstanding,
    paidMembers,
    unpaidMembers,
    aheadMembers,
    options,
  } = params;

  const lines: string[] = [];

  lines.push("🌟 *Kpai Family Contributions*");
  lines.push(`📅 *${monthHeading(month)} Report*`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");

  if (options.includeCollectedThisMonth) {
    lines.push("");
    lines.push(
      `💰 *This Month:* ${formatGhsCurrency(totalCollectedThisMonth)} collected`
    );
  }

  if (options.includeOutstanding) {
    lines.push("");
    lines.push(`📊 *Outstanding Balance:* ${formatGhsCurrency(totalOutstanding)}`);
  }

  if (options.includeTotalAllTime) {
    lines.push("");
    lines.push(
      `🏦 *Total Collected (All Time):* ${formatGhsCurrency(totalCollectedAllTime)}`
    );
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");

  const byName = <T extends { name: string; anonymous: boolean }>(a: T, b: T) =>
    displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" });

  if (options.includePaidMembers && paidMembers.length > 0) {
    const sortedPaid = [...paidMembers].sort(byName);
    lines.push("");
    lines.push(`✅ *Paid this month (${sortedPaid.length}):*`);
    for (const m of sortedPaid) {
      lines.push(
        `✔ ${displayName(m)} — ${formatGhsCurrency(m.amountThisMonth)}`
      );
    }
  }

  if (options.includeUnpaidMembers) {
    const filterUnpaid = (): UnpaidMemberRow[] => {
      switch (options.unpaidFilter) {
        case "moreThan1Month":
          return unpaidMembers.filter((m) => m.monthsBehind > 1);
        case "moreThan3Months":
          return unpaidMembers.filter((m) => m.monthsBehind > 3);
        case "countOnly":
        case "all":
        default:
          return unpaidMembers;
      }
    };

    const filtered = filterUnpaid().sort(byName);
    const count =
      options.unpaidFilter === "countOnly"
        ? unpaidMembers.length
        : filtered.length;

    if (unpaidMembers.length === 0) {
      // no section
    } else if (options.unpaidFilter === "countOnly") {
      lines.push("");
      lines.push(
        `⚠️ *${count} member(s) are yet to pay this month.*`
      );
      lines.push("Please make your contribution. Thank you! 🙏");
    } else if (options.unpaidFilter === "all") {
      lines.push("");
      lines.push(`❌ *Yet to pay this month (${filtered.length}):*`);
      for (const m of filtered) {
        lines.push(
          `• ${displayName(m)} (${m.monthsBehind} month${m.monthsBehind === 1 ? "" : "s"} behind)`
        );
      }
    } else if (options.unpaidFilter === "moreThan1Month") {
      lines.push("");
      lines.push(`⚠️ *Behind by more than 1 month (${filtered.length}):*`);
      for (const m of filtered) {
        lines.push(
          `• ${displayName(m)} (${m.monthsBehind} months behind)`
        );
      }
    } else if (options.unpaidFilter === "moreThan3Months") {
      lines.push("");
      lines.push(
        `🚨 *Significantly behind — over 3 months (${filtered.length}):*`
      );
      for (const m of filtered) {
        lines.push(
          `• ${displayName(m)} (${m.monthsBehind} months behind)`
        );
      }
    }
  }

  if (options.includeAheadMembers && aheadMembers.length > 0) {
    const sortedAhead = [...aheadMembers].sort(byName);
    lines.push("");
    lines.push(`🌟 *Ahead of schedule (${sortedAhead.length}):*`);
    for (const m of sortedAhead) {
      lines.push(
        `• ${displayName(m)} — ${formatGhsCurrency(m.amountAhead)} ahead`
      );
    }
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("_Thank you all for your continued support._");
  lines.push("_Together we are stronger! 💛_");
  lines.push("_— Kpai Family Admin_");

  return lines.join("\n");
}
