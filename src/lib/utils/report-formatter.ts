import { APP_NAME } from "@/lib/constants";

function displayName(entry: { name: string; anonymous: boolean }): string {
  return entry.anonymous ? "Anonymous" : entry.name;
}

function monthHeading(month: Date): string {
  return month.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function formatWhatsAppReport(params: {
  month: Date;
  totalCollectedThisMonth: number;
  totalCollectedAllTime: number;
  totalOutstanding: number;
  paidMembers: Array<{ name: string; anonymous: boolean }>;
  unpaidMembers: Array<{
    name: string;
    anonymous: boolean;
    amountBehind: number;
  }>;
  aheadMembers: Array<{
    name: string;
    anonymous: boolean;
    amountAhead: number;
  }>;
}): string {
  const {
    month,
    totalCollectedThisMonth,
    totalCollectedAllTime,
    totalOutstanding,
    paidMembers,
    unpaidMembers,
    aheadMembers,
  } = params;

  const lines: string[] = [];

  lines.push(`${APP_NAME}`);
  lines.push(monthHeading(month));
  lines.push("");
  lines.push(
    `This month: $${totalCollectedThisMonth.toFixed(2)} collected`
  );
  lines.push(
    `All time: $${totalCollectedAllTime.toFixed(2)} collected | Outstanding: $${totalOutstanding.toFixed(2)}`
  );
  lines.push("");
  lines.push(`Paid (${paidMembers.length}):`);
  for (const m of paidMembers) {
    lines.push(`• ${displayName(m)}`);
  }
  lines.push("");
  lines.push(`Still owe (${unpaidMembers.length}):`);
  for (const m of unpaidMembers) {
    lines.push(
      `• ${displayName(m)} — $${m.amountBehind.toFixed(2)} behind`
    );
  }

  if (aheadMembers.length > 0) {
    lines.push("");
    lines.push(`Ahead / credit (${aheadMembers.length}):`);
    for (const m of aheadMembers) {
      lines.push(
        `• ${displayName(m)} — $${m.amountAhead.toFixed(2)} ahead`
      );
    }
  }

  return lines.join("\n");
}
