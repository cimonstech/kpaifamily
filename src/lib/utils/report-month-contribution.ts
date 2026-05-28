import type { MemberRate } from "@/lib/types";
import { getMemberRateForMonth } from "@/lib/utils/rate-calculator";

/** Normalize checklist `month` values (YYYY-MM or YYYY-MM-01) to YYYY-MM. */
export function normalizeChecklistYm(month: string): string {
  return String(month).slice(0, 7);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Expected dues from member start through the report month (inclusive). */
export function expectedThroughMonth(
  memberRates: MemberRate[],
  startDate: Date,
  reportMonth: Date
): number {
  const start = startOfMonth(startDate);
  const end = startOfMonth(reportMonth);
  if (start > end) return 0;

  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    total += getMemberRateForMonth(memberRates, cursor);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return total;
}

export type ReportMonthMember = {
  id: string;
  start_date: string;
  variable_contributor: boolean;
  credit_balance: number;
};

/**
 * Whether the member has satisfied the report month (checklist, payment in month,
 * or total paid/credit covers dues through that month — i.e. paid ahead).
 */
export function isPaidForReportMonth(params: {
  member: ReportMonthMember;
  memberRates: MemberRate[];
  reportMonth: Date;
  checklistPaid: boolean;
  paymentInReportMonth: number;
  totalPaidAllTime: number;
}): boolean {
  const {
    member,
    memberRates,
    reportMonth,
    checklistPaid,
    paymentInReportMonth,
    totalPaidAllTime,
  } = params;

  if (member.variable_contributor) {
    return paymentInReportMonth > 0.01;
  }
  if (!member.start_date) return false;

  const start = new Date(member.start_date);
  if (startOfMonth(start) > startOfMonth(reportMonth)) return false;
  if (checklistPaid || paymentInReportMonth > 0.01) return true;

  const expected = expectedThroughMonth(memberRates, start, reportMonth);
  return totalPaidAllTime + member.credit_balance >= expected - 0.01;
}

/** Line amount for WhatsApp/PDF (matches historical reports: monthly rate, not cash in month). */
export function amountForReportMonth(params: {
  member: ReportMonthMember;
  memberRates: MemberRate[];
  reportMonth: Date;
  singleMonthPaymentAmount: number | undefined;
  paymentInReportMonth: number;
}): number {
  const {
    member,
    memberRates,
    reportMonth,
    singleMonthPaymentAmount,
    paymentInReportMonth,
  } = params;

  if (member.variable_contributor) {
    return paymentInReportMonth;
  }
  if (singleMonthPaymentAmount != null && singleMonthPaymentAmount > 0) {
    return singleMonthPaymentAmount;
  }
  return getMemberRateForMonth(memberRates, reportMonth);
}

export type MonthContributionKind = "not_covered" | "paid_cash" | "paid_ahead";

/**
 * How the member relates to a given report month:
 * - paid_cash: payment received in that calendar month
 * - paid_ahead: covered for the month (checklist or prepayment) but no cash in that month
 * - not_covered: still owes for that month
 */
export function classifyMonthContribution(params: {
  member: ReportMonthMember;
  memberRates: MemberRate[];
  reportMonth: Date;
  checklistPaid: boolean;
  paymentInReportMonth: number;
  totalPaidAllTime: number;
}): MonthContributionKind {
  if (
    !isPaidForReportMonth({
      member: params.member,
      memberRates: params.memberRates,
      reportMonth: params.reportMonth,
      checklistPaid: params.checklistPaid,
      paymentInReportMonth: params.paymentInReportMonth,
      totalPaidAllTime: params.totalPaidAllTime,
    })
  ) {
    return "not_covered";
  }
  if (params.member.variable_contributor) {
    return params.paymentInReportMonth > 0.01 ? "paid_cash" : "not_covered";
  }
  if (params.paymentInReportMonth > 0.01) {
    return "paid_cash";
  }
  return "paid_ahead";
}

/** Build set of member ids marked paid on checklist for YYYY-MM (any legacy month format). */
export function paidMemberIdsFromChecklistRows(
  rows: Array<{ member_id: string; month: string; paid?: boolean | null }>,
  reportYm: string
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.paid !== true) continue;
    if (normalizeChecklistYm(row.month) === reportYm) {
      ids.add(String(row.member_id));
    }
  }
  return ids;
}
