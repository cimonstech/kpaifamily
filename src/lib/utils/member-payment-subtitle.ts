import { formatGhsCurrency } from "@/lib/utils/currency";

function cedis(n: number) {
  return formatGhsCurrency(n);
}

export type MemberPaymentSubtitleStatus =
  | "ahead"
  | "ok"
  | "behind"
  | "pending"
  | "voluntary";

/**
 * Display line under member name: "GHS X paid · …" with color by balance state.
 * `balance` is expectedTotal − totalPaid − creditBalance (same as rate-calculator).
 */
export function getMemberPaymentSubtitle(
  totalPaid: number,
  balance: number,
  status: MemberPaymentSubtitleStatus
): { text: string; colorVar: string } {
  const paid = `${cedis(totalPaid)} paid`;
  if (status === "voluntary") {
    return {
      text: `${cedis(totalPaid)} total contributed`,
      colorVar: "var(--neu-text-secondary)",
    };
  }
  if (status === "pending") {
    return { text: paid, colorVar: "var(--neu-text-secondary)" };
  }
  if (balance > 0.01) {
    return {
      text: `${paid} · ${cedis(balance)} remaining`,
      colorVar: "var(--neu-danger)",
    };
  }
  if (balance < -0.01) {
    return {
      text: `${paid} · ${cedis(-balance)} ahead`,
      colorVar: "var(--neu-info)",
    };
  }
  return {
    text: `${paid} · Fully paid up`,
    colorVar: "var(--neu-success)",
  };
}

export function memberPaymentProgressPercent(
  totalPaid: number,
  expectedTotal: number
): number {
  if (expectedTotal > 0) {
    return Math.min(100, (totalPaid / expectedTotal) * 100);
  }
  return totalPaid > 0 ? 100 : 0;
}
