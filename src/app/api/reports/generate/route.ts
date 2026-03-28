import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import { formatWhatsAppReport } from "@/lib/utils/report-formatter";
import { generatePDF } from "@/lib/utils/pdf-generator";
import { uploadPDF } from "@/lib/r2";
import { calculateBalance } from "@/lib/utils/rate-calculator";
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

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { month?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ym = body.month?.trim();
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
  }

  const monthDate = new Date(`${ym}-01T12:00:00`);
  const monthFirst = `${ym}-01`;
  const rangeStart = monthFirst;
  const rangeEnd = lastDayOfMonthYm(ym);

  const supabase = await createSupabaseServerClient();

  const [
    { data: rawMembers },
    { data: rawRates },
    { data: rawPayments },
    { data: checklistRows },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("active", true),
    supabase.from("member_rates").select("*"),
    supabase.from("payments").select("*"),
    supabase
      .from("monthly_checklist")
      .select("member_id, paid")
      .eq("month", ym),
  ]);

  const members = (rawMembers ?? []) as Record<string, unknown>[];
  const memberIds = members.map((m) => String(m.id));

  const paidThisMonthMap = new Map<string, boolean>();
  for (const row of checklistRows ?? []) {
    const r = row as { member_id: string; paid: boolean | null };
    paidThisMonthMap.set(r.member_id, r.paid === true);
  }

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

  const paymentsInMonth = allPayments.filter((p) => {
    const d = p.date_paid.slice(0, 10);
    return d >= rangeStart && d <= rangeEnd;
  });
  const totalCollectedThisMonth = paymentsInMonth.reduce((s, p) => s + p.amount, 0);

  type Row = ReportData["members"][number] & { name: string };

  const pdfAndRows: Row[] = [];
  let totalOutstanding = 0;

  const paidMembersWhatsapp: Array<{ name: string; anonymous: boolean }> = [];
  const unpaidMembersWhatsapp: Array<{
    name: string;
    anonymous: boolean;
    amountBehind: number;
  }> = [];
  const aheadMembersWhatsapp: Array<{
    name: string;
    anonymous: boolean;
    amountAhead: number;
  }> = [];

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

    const paidThisMonth = paidThisMonthMap.get(id) === true;
    const amountPaidThisMonth = pays
      .filter((p) => {
        const d = p.date_paid.slice(0, 10);
        return d >= rangeStart && d <= rangeEnd;
      })
      .reduce((s, p) => s + p.amount, 0);

    let status = "Paid up";
    if (!start_date) status = "Pending";
    else if (paidThisMonth) status = "Paid up";
    else if (balance > 0.01) status = "Behind";
    else if (balance < -0.01) status = "Ahead";
    else status = "Paid up";

    const displayName = anonymous ? "Anonymous" : name;

    pdfAndRows.push({
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

    if (paidThisMonth) {
      paidMembersWhatsapp.push({ name, anonymous });
    } else if (balance > 0.01) {
      unpaidMembersWhatsapp.push({ name, anonymous, amountBehind: balance });
    } else if (balance < -0.01) {
      aheadMembersWhatsapp.push({
        name,
        anonymous,
        amountAhead: -balance,
      });
    }
  }

  const whatsappText = formatWhatsAppReport({
    month: monthDate,
    totalCollectedThisMonth,
    totalCollectedAllTime,
    totalOutstanding,
    paidMembers: paidMembersWhatsapp,
    unpaidMembers: unpaidMembersWhatsapp,
    aheadMembers: aheadMembersWhatsapp,
  });

  const reportData: ReportData = {
    month: monthDate,
    generatedAt: new Date(),
    totalCollectedThisMonth,
    totalCollectedAllTime,
    totalOutstanding,
    members: pdfAndRows.map(({ name: _omit, ...rest }) => rest),
  };

  const pdfBytes = await generatePDF(reportData);

  let publicUrl: string;
  try {
    publicUrl = await uploadPDF(`report-${ym}.pdf`, pdfBytes);
  } catch (e) {
    console.error("R2 upload", e);
    return NextResponse.json(
      { error: "Could not upload PDF. Check R2 configuration." },
      { status: 500 }
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
    metadata: { month: ym },
  });

  return NextResponse.json({
    success: true,
    pdfUrl: publicUrl,
    textSummary: whatsappText,
  });
}
