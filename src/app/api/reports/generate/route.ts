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
    note: p.note == null ? null : String(p.note),
    created_at: String(p.created_at ?? ""),
  };
}

function lastDayOfMonthYm(ym: string): string {
  const [y, mo] = ym.split("-").map(Number);
  const last = new Date(y, mo, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
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

  const ym = body.month?.trim();
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
  }

  const firstDayOfMonth = new Date(`${ym}-01T12:00:00`);
  const monthDate = firstDayOfMonth;
  const monthFirst = `${ym}-01`;
  const rangeEnd = lastDayOfMonthYm(ym);

  const supabase = await createSupabaseServerClient();

  const [{ data: rawMembers }, { data: rawRates }, { data: rawPayments }] =
    await Promise.all([
      supabase.from("members").select("*").eq("active", true),
      supabase.from("member_rates").select("*"),
      supabase.from("payments").select("*"),
    ]);

  const members = (rawMembers ?? []) as Record<string, unknown>[];
  const memberIds = members.map((m) => String(m.id));
  const memberIdSet = new Set(memberIds);

  const [{ data: checklistForMonth }, { data: monthPaymentsRaw }] =
    await Promise.all([
      supabase
        .from("monthly_checklist")
        .select("member_id, paid, payment_id")
        .eq("month", monthFirst)
        .eq("paid", true),
      supabase
        .from("payments")
        .select("member_id, amount")
        .gte("date_paid", monthFirst)
        .lte("date_paid", rangeEnd),
    ]);

  const paidMemberIds = new Set(
    (checklistForMonth ?? []).map((c) =>
      String((c as { member_id: string }).member_id)
    )
  );

  const paymentAmountMap = new Map<string, number>();
  for (const row of monthPaymentsRaw ?? []) {
    const p = row as { member_id: string; amount: number };
    if (!memberIdSet.has(p.member_id)) continue;
    const existing = paymentAmountMap.get(p.member_id) ?? 0;
    paymentAmountMap.set(p.member_id, existing + Number(p.amount));
  }

  const totalCollectedThisMonth = Array.from(paymentAmountMap.values()).reduce(
    (s, v) => s + v,
    0
  );

  const ratesByMember = new Map<string, MemberRate[]>();
  for (const row of rawRates ?? []) {
    const mr = toMemberRate(row as Record<string, unknown>);
    if (!memberIds.includes(mr.member_id)) continue;
    const list = ratesByMember.get(mr.member_id) ?? [];
    list.push(mr);
    ratesByMember.set(mr.member_id, list);
  }
  for (const [, list] of ratesByMember) {
    list.sort(
      (a, b) =>
        new Date(a.effective_from).getTime() -
        new Date(b.effective_from).getTime()
    );
  }

  const paymentsByMember = new Map<string, Payment[]>();
  const allPayments: Payment[] = [];
  for (const row of rawPayments ?? []) {
    const p = toPayment(row as Record<string, unknown>);
    if (!memberIds.includes(p.member_id)) continue;
    allPayments.push(p);
    const list = paymentsByMember.get(p.member_id) ?? [];
    list.push(p);
    paymentsByMember.set(p.member_id, list);
  }

  const totalCollectedAllTime = allPayments.reduce((s, p) => s + p.amount, 0);

  type ActiveMember = {
    id: string;
    name: string;
    anonymous: boolean;
    credit_balance: number;
    start_date: string;
  };

  const activeMembers: ActiveMember[] = members.map((raw) => ({
    id: String(raw.id),
    name: String(raw.name),
    anonymous: Boolean(raw.anonymous),
    credit_balance: Number(raw.credit_balance ?? 0),
    start_date: raw.start_date == null ? "" : String(raw.start_date),
  }));

  const totalPaidMap = new Map<string, number>();
  for (const id of memberIds) {
    const pays = paymentsByMember.get(id) ?? [];
    totalPaidMap.set(
      id,
      pays.reduce((s, p) => s + p.amount, 0)
    );
  }

  const paidMembersWhatsapp = activeMembers
    .filter((m) => paidMemberIds.has(m.id))
    .map((m) => ({
      name: m.name,
      anonymous: m.anonymous,
      amountPaidThisMonth: paymentAmountMap.get(m.id) ?? 0,
    }))
    .sort((a, b) =>
      (a.anonymous ? "Anonymous" : a.name).localeCompare(
        b.anonymous ? "Anonymous" : b.name,
        undefined,
        { sensitivity: "base" }
      )
    );

  const unpaidMembersWhatsapp = activeMembers
    .filter((m) => !paidMemberIds.has(m.id))
    .map((m) => {
      const memberRateHistory = ratesByMember.get(m.id) ?? [];
      const currentRate = getMemberRateForMonth(memberRateHistory, new Date());
      const totalPaidForMember = totalPaidMap.get(m.id) ?? 0;
      let balance = 0;
      let monthsBehind = 0;
      if (m.start_date) {
        const sd = new Date(m.start_date);
        const expectedTotal = calculateExpectedTotal(memberRateHistory, sd);
        balance =
          expectedTotal - totalPaidForMember - (m.credit_balance || 0);
        monthsBehind =
          currentRate > 0.01
            ? Math.max(0, Math.round(balance / currentRate))
            : 0;
      }
      return {
        name: m.name,
        anonymous: m.anonymous,
        amountBehind: balance,
        monthsBehind,
      };
    })
    .filter((m) => m.amountBehind > 0.01)
    .sort((a, b) => b.amountBehind - a.amountBehind);

  type Row = ReportData["members"][number] & { name: string; memberId: string };

  const pdfAndRows: Row[] = [];
  let totalOutstanding = 0;

  for (const raw of members) {
    const id = String(raw.id);
    const name = String(raw.name);
    const branch = String(raw.branch ?? "");
    const anonymous = Boolean(raw.anonymous);
    const credit_balance = Number(raw.credit_balance ?? 0);
    const start_date = raw.start_date == null ? "" : String(raw.start_date);
    const rates = ratesByMember.get(id) ?? [];
    const pays = paymentsByMember.get(id) ?? [];
    const totalPaid = pays.reduce((s, p) => s + p.amount, 0);

    let balance = 0;
    if (start_date) {
      const sd = new Date(start_date);
      balance = calculateBalance(rates, sd, totalPaid, credit_balance);
    }

    if (balance > 0.01) totalOutstanding += balance;

    const paidThisMonth = paidMemberIds.has(id);
    const amountPaidThisMonth = paymentAmountMap.get(id) ?? 0;

    let status = "Paid up";
    if (!start_date) status = "Pending";
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
      const rates = ratesByMember.get(r.memberId) ?? [];
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
