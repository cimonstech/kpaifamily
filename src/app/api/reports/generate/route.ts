import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import {
  formatWhatsAppReport,
  normalizeReportWhatsAppOptions,
} from "@/lib/utils/report-formatter";
import { generatePDF } from "@/lib/utils/pdf-generator";
import { isR2Configured, uploadPDF } from "@/lib/r2";
import {
  calculateBalance,
  calculateExpectedTotal,
  getMemberRateForMonth,
} from "@/lib/utils/rate-calculator";
import {
  amountForReportMonth,
  isPaidForReportMonth,
  paidMemberIdsFromChecklistRows,
} from "@/lib/utils/report-month-contribution";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRate, Payment, ReportData } from "@/lib/types";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

function toMemberRate(r: Record<string, unknown>): MemberRate {
  return {
    id: String(r.id),
    member_id: String(r.member_id),
    rate: Number(r.rate),
    effective_from: String(r.effective_from),
    source: r.source === "override" ? "override" : "global",
    created_at: String(r.created_at ?? ""),
  };
}

function toPayment(p: Record<string, unknown>): Payment {
  return {
    id: String(p.id),
    member_id: String(p.member_id),
    amount: Number(p.amount),
    date_paid: String(p.date_paid),
    months_covered: Number(p.months_covered ?? 0),
    credit_used: Number(p.credit_used ?? 0),
    credit_remainder: Number(p.credit_remainder ?? 0),
    single_month_only: Boolean(p.single_month_only),
    note: p.note == null ? null : String(p.note),
    created_at: String(p.created_at ?? ""),
  };
}

function trendMonthLabel(d: Date): string {
  const mon = d.toLocaleString("en-GB", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${mon} ${yy}`;
}

function buildMonthlyTrendFromPayments(
  payments: Payment[],
  reportMonthStart: Date
): Array<{ month: string; amount: number }> {
  const start = new Date(reportMonthStart);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  start.setHours(12, 0, 0, 0);

  const byYm = new Map<string, number>();
  for (const p of payments) {
    const key = p.date_paid.slice(0, 7);
    byYm.set(key, (byYm.get(key) ?? 0) + p.amount);
  }

  const out: Array<{ month: string; amount: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const ymKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      month: trendMonthLabel(d),
      amount: byYm.get(ymKey) ?? 0,
    });
  }
  return out;
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { month?: string; options?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reportOptions = normalizeReportWhatsAppOptions(body.options);

  const monthStr = body.month?.trim();
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
  }

  const firstDayOfMonth = new Date(`${monthStr}-01`);
  firstDayOfMonth.setUTCHours(0, 0, 0, 0);
  const ym = monthStr;
  const monthDate = firstDayOfMonth;
  const monthFirst = firstDayOfMonth.toISOString().slice(0, 10);
  const lastDayOfMonth = new Date(
    firstDayOfMonth.getUTCFullYear(),
    firstDayOfMonth.getUTCMonth() + 1,
    0
  );
  lastDayOfMonth.setUTCHours(0, 0, 0, 0);

  const supabase = await createSupabaseServerClient();

  const [{ data: rawMembers }, { data: allMemberRatesRaw }, { data: rawPayments }] =
    await Promise.all([
      supabase.from("members").select("*").eq("active", true),
      supabase
        .from("member_rates")
        .select("*")
        .order("effective_from", { ascending: true }),
      supabase.from("payments").select("*"),
    ]);

  const members = (rawMembers ?? []) as Record<string, unknown>[];
  const memberIds = members.map((m) => String(m.id));
  const memberIdSet = new Set(memberIds);

  const { data: checklistPaidRows } =
    memberIds.length > 0
      ? await supabase
          .from("monthly_checklist")
          .select("member_id, month, paid")
          .in("member_id", memberIds)
          .eq("paid", true)
      : { data: [] };

  const paidMemberIds = paidMemberIdsFromChecklistRows(
    (checklistPaidRows ?? []) as Array<{
      member_id: string;
      month: string;
      paid?: boolean | null;
    }>,
    ym
  );

  const { data: singleMonthPayments } = await supabase
    .from("payments")
    .select("member_id, amount")
    .eq("single_month_only", true)
    .gte("date_paid", firstDayOfMonth.toISOString().slice(0, 10))
    .lte("date_paid", lastDayOfMonth.toISOString().slice(0, 10));

  const singleMonthPaymentMap = new Map<string, number>();
  for (const p of singleMonthPayments ?? []) {
    const row = p as { member_id: string; amount: number };
    const existing = singleMonthPaymentMap.get(row.member_id) ?? 0;
    singleMonthPaymentMap.set(row.member_id, existing + Number(row.amount));
  }

  const memberRatesMap = new Map<string, MemberRate[]>();
  for (const row of allMemberRatesRaw ?? []) {
    const mr = toMemberRate(row as Record<string, unknown>);
    if (!memberIdSet.has(mr.member_id)) continue;
    const list = memberRatesMap.get(mr.member_id) ?? [];
    list.push(mr);
    memberRatesMap.set(mr.member_id, list);
  }

  const paymentsByMember = new Map<string, Payment[]>();
  const allPayments: Payment[] = [];
  for (const row of rawPayments ?? []) {
    const p = toPayment(row as Record<string, unknown>);
    if (!memberIdSet.has(p.member_id)) continue;
    allPayments.push(p);
    const list = paymentsByMember.get(p.member_id) ?? [];
    list.push(p);
    paymentsByMember.set(p.member_id, list);
  }

  type ActiveMember = {
    id: string;
    name: string;
    anonymous: boolean;
    credit_balance: number;
    start_date: string;
    variable_contributor: boolean;
  };

  const activeMembers: ActiveMember[] = members.map((raw) => ({
    id: String(raw.id),
    name: String(raw.name),
    anonymous: Boolean(raw.anonymous),
    credit_balance: Number(raw.credit_balance ?? 0),
    start_date: raw.start_date == null ? "" : String(raw.start_date),
    variable_contributor: Boolean(raw.variable_contributor),
  }));

  const totalPaidMap = new Map<string, number>();
  for (const p of allPayments) {
    const existing = totalPaidMap.get(p.member_id) ?? 0;
    totalPaidMap.set(p.member_id, existing + Number(p.amount));
  }

  const monthStartStr = firstDayOfMonth.toISOString().slice(0, 10);
  const monthEndStr = lastDayOfMonth.toISOString().slice(0, 10);

  const paymentsInMonthMap = new Map<string, number>();
  for (const p of allPayments) {
    if (p.date_paid < monthStartStr || p.date_paid > monthEndStr) continue;
    paymentsInMonthMap.set(
      p.member_id,
      (paymentsInMonthMap.get(p.member_id) ?? 0) + p.amount
    );
  }

  function paymentsInReportMonth(memberId: string): number {
    return paymentsInMonthMap.get(memberId) ?? 0;
  }

  const paidMemberIdsUnified = new Set<string>();
  const paidMembersWhatsapp: Array<{
    name: string;
    anonymous: boolean;
    amountPaidThisMonth: number;
  }> = [];

  for (const m of activeMembers) {
    const rates = memberRatesMap.get(m.id) ?? [];
    const totalPaid = totalPaidMap.get(m.id) ?? 0;
    if (
      !isPaidForReportMonth({
        member: m,
        memberRates: rates,
        reportMonth: firstDayOfMonth,
        checklistPaid: paidMemberIds.has(m.id),
        paymentInReportMonth: paymentsInReportMonth(m.id),
        totalPaidAllTime: totalPaid,
      })
    ) {
      continue;
    }
    const amountToShow = amountForReportMonth({
      member: m,
      memberRates: rates,
      reportMonth: firstDayOfMonth,
      singleMonthPaymentAmount: singleMonthPaymentMap.get(m.id),
      paymentInReportMonth: paymentsInReportMonth(m.id),
    });
    if (amountToShow <= 0.01) continue;
    paidMemberIdsUnified.add(m.id);
    paidMembersWhatsapp.push({
      name: m.name,
      anonymous: m.anonymous,
      amountPaidThisMonth: amountToShow,
    });
  }

  paidMembersWhatsapp.sort((a, b) =>
    (a.anonymous ? "Anonymous" : a.name).localeCompare(
      b.anonymous ? "Anonymous" : b.name,
      undefined,
      { sensitivity: "base" }
    )
  );

  const totalCollectedThisMonth = paidMembersWhatsapp.reduce(
    (sum, m) => sum + m.amountPaidThisMonth,
    0
  );

  const totalCollectedAllTime = Array.from(totalPaidMap.values()).reduce(
    (s, v) => s + v,
    0
  );

  const unpaidMembersWhatsapp = activeMembers
    .filter((m) => {
      if (m.variable_contributor) return false;
      if (paidMemberIdsUnified.has(m.id)) return false;
      if (!m.start_date) return false;
      const startDate = new Date(m.start_date);
      return startDate <= firstDayOfMonth;
    })
    .map((m) => {
      const memberRateHistory = memberRatesMap.get(m.id) ?? [];
      const currentRate = getMemberRateForMonth(memberRateHistory, new Date());
      const totalPaidForMember = totalPaidMap.get(m.id) ?? 0;
      const sd = new Date(m.start_date);
      const expectedTotal = calculateExpectedTotal(memberRateHistory, sd);
      const balance = expectedTotal - totalPaidForMember - (m.credit_balance || 0);
      const monthsBehind =
        currentRate > 0.01 ? Math.max(0, Math.round(balance / currentRate)) : 0;
      return {
        name: m.name,
        anonymous: m.anonymous,
        amountBehind: Math.max(0, balance),
        monthsBehind,
      };
    })
    .filter((m) => m.amountBehind > 0.01)
    .sort((a, b) => b.amountBehind - a.amountBehind);

  type Row = ReportData["members"][number] & { name: string; memberId: string };

  const totalOutstanding = activeMembers.reduce((sum, m) => {
    if (m.variable_contributor) return sum;
    const memberRateHistory = memberRatesMap.get(m.id) ?? [];
    if (!m.start_date) return sum;
    const expectedTotal = calculateExpectedTotal(memberRateHistory, new Date(m.start_date));
    const totalPaid = totalPaidMap.get(m.id) ?? 0;
    const balance = expectedTotal - totalPaid - (m.credit_balance || 0);
    return sum + Math.max(0, balance);
  }, 0);

  const pdfAndRows: Row[] = [];

  for (const raw of members) {
    const id = String(raw.id);
    const name = String(raw.name);
    const branch = String(raw.branch ?? "");
    const anonymous = Boolean(raw.anonymous);
    const credit_balance = Number(raw.credit_balance ?? 0);
    const start_date = raw.start_date == null ? "" : String(raw.start_date);
    const variable_contributor = Boolean(raw.variable_contributor);
    const rates = memberRatesMap.get(id) ?? [];
    const totalPaid = totalPaidMap.get(id) ?? 0;

    let balance = 0;
    if (start_date) {
      const sd = new Date(start_date);
      balance = calculateBalance(
        rates,
        sd,
        totalPaid,
        credit_balance,
        variable_contributor
      );
    }

    const paidThisMonth = paidMemberIdsUnified.has(id);
    const amountPaidThisMonth = paidThisMonth
      ? amountForReportMonth({
          member: {
            id,
            start_date,
            variable_contributor,
            credit_balance,
          },
          memberRates: rates,
          reportMonth: firstDayOfMonth,
          singleMonthPaymentAmount: singleMonthPaymentMap.get(id),
          paymentInReportMonth: paymentsInReportMonth(id),
        })
      : 0;

    let status = "Paid up";
    if (variable_contributor) status = "Voluntary";
    else if (!start_date) status = "Pending";
    else if (paidThisMonth) status = "Paid up";
    else if (balance > 0.01) status = "Behind";
    else if (balance < -0.01) status = "Ahead";
    else status = "Paid up";

    const displayName = anonymous ? "Anonymous" : name;

    pdfAndRows.push({
      memberId: id,
      displayName,
      branch,
      anonymous,
      totalPaid,
      balance,
      paidThisMonth,
      amountPaidThisMonth,
      status,
      name,
    });
  }

  console.log("Report data:", {
    paidCount: paidMembersWhatsapp.length,
    unpaidCount: unpaidMembersWhatsapp.length,
    totalCollectedThisMonth,
    totalOutstanding,
    month: firstDayOfMonth,
  });

  const whatsappText = formatWhatsAppReport({
    month: firstDayOfMonth,
    options: {
      includePaidMembers: reportOptions.includePaidMembers,
      includeUnpaidMembers: reportOptions.includeUnpaidMembers,
      includeOutstanding: reportOptions.includeOutstanding,
      unpaidFilter: reportOptions.unpaidFilter,
    },
    paidMembers: paidMembersWhatsapp,
    unpaidMembers: unpaidMembersWhatsapp,
    totalCollectedThisMonth,
    totalCollectedAllTime,
    totalOutstanding,
  });

  const monthlyTrend = buildMonthlyTrendFromPayments(allPayments, monthDate);

  const topBehindMembers = [...pdfAndRows]
    .filter((r) => r.balance > 0.01)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10)
    .map((r) => {
      const rates = memberRatesMap.get(r.memberId) ?? [];
      const rate = getMemberRateForMonth(rates, monthDate);
      const monthsBehind =
        rate > 0.01 ? Math.max(1, Math.round(r.balance / rate)) : 1;
      return {
        displayName: r.displayName,
        amountBehind: r.balance,
        monthsBehind,
      };
    });

  const reportData: ReportData = {
    month: monthDate,
    generatedAt: new Date(),
    totalCollectedThisMonth,
    totalCollectedAllTime,
    totalOutstanding,
    monthlyTrend,
    topBehindMembers,
    members: pdfAndRows.map(({ name: _n, memberId: _m, ...rest }) => rest),
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generatePDF(reportData);
  } catch (e) {
    console.error("generatePDF", e);
    const message = e instanceof Error ? e.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let publicUrl: string | null = null;
  if (isR2Configured()) {
    try {
      publicUrl = await uploadPDF(`report-${ym}.pdf`, pdfBytes);
    } catch (e) {
      console.error("R2 upload", e);
      return NextResponse.json(
        { error: "Could not upload PDF. Check R2 configuration and credentials." },
        { status: 500 }
      );
    }
  } else {
    console.warn(
      "reports/generate: R2 not configured; skipping PDF upload (text summary and DB row still saved)"
    );
  }

  const genIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("month", monthFirst)
    .maybeSingle();

  if (existing && (existing as { id: string }).id) {
    await supabase
      .from("reports")
      .update({
        generated_at: genIso,
        pdf_url: publicUrl,
        text_summary: whatsappText,
        triggered_by: session.id,
      })
      .eq("id", (existing as { id: string }).id);
  } else {
    await supabase.from("reports").insert({
      month: monthFirst,
      generated_at: genIso,
      pdf_url: publicUrl,
      text_summary: whatsappText,
      triggered_by: session.id,
    });
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "REPORT_GENERATED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { month: ym, whatsappOptions: reportOptions },
  });

  return NextResponse.json({
    success: true,
    pdfUrl: publicUrl,
    textSummary: whatsappText,
  });
}
