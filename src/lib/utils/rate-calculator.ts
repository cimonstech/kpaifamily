import { DEFAULT_MONTHLY_RATE } from "@/lib/constants";
import type { MemberRate } from "@/lib/types";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}


/**
 * Rate in effect for `month`: the most recent `effective_from` that is on or
 * before the 1st of that calendar month. Falls back to the earliest rate in
 * the array, then DEFAULT_MONTHLY_RATE.
 */
export function getMemberRateForMonth(
  memberRates: MemberRate[],
  month: Date
): number {
  if (memberRates.length === 0) {
    return DEFAULT_MONTHLY_RATE;
  }

  const monthStart = startOfMonth(month);

  const sorted = [...memberRates].sort(
    (a, b) =>
      new Date(b.effective_from).getTime() -
      new Date(a.effective_from).getTime()
  );

  const applicable = sorted.find(
    (r) => new Date(r.effective_from) <= monthStart
  );

  return applicable?.rate ?? sorted[sorted.length - 1]?.rate ?? DEFAULT_MONTHLY_RATE;
}

/** Sum of expected monthly dues from `startDate` through current month (inclusive). */
export function calculateExpectedTotal(
  memberRates: MemberRate[],
  startDate: Date
): number {
  const start = startOfMonth(startDate);
  const end = startOfMonth(new Date());
  let total = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    total += getMemberRateForMonth(memberRates, cursor);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return total;
}

/**
 * Positive = behind, negative = ahead.
 * expectedTotal − totalPaid − creditBalance
 */
export function calculateBalance(
  memberRates: MemberRate[],
  startDate: Date,
  totalPaid: number,
  creditBalance: number,
  variableContributor = false
): number {
  if (variableContributor) return 0;
  const expectedTotal = calculateExpectedTotal(memberRates, startDate);
  return expectedTotal - totalPaid - creditBalance;
}

export function getMemberStatus(
  balance: number,
  active: boolean,
  variableContributor: boolean
): "ahead" | "ok" | "behind" | "pending" | "voluntary" {
  if (!active) return "pending";
  if (variableContributor) return "voluntary";
  if (balance < -0.01) return "ahead";
  if (balance <= 0.01) return "ok";
  return "behind";
}

/** Zero balance or overpaid (Paid Up + Ahead badges on Members). */
export function isMemberPaidUp(balance: number): boolean {
  return balance <= 0.01;
}

/** Overpaid only (blue Ahead badge). */
export function isMemberPaidAhead(balance: number): boolean {
  return balance < -0.01;
}

export function isMemberBehind(balance: number): boolean {
  return balance > 0.01;
}

/** Calendar months from `startDate` through today, inclusive (same bounds as expected total). */
export function getMonthsElapsed(startDate: Date): number {
  const start = startOfMonth(startDate);
  const end = startOfMonth(new Date());
  if (start > end) return 0;

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    count++;
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return count;
}
