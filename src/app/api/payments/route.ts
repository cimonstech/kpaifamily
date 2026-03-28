import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import { allocatePayment } from "@/lib/utils/allocation";
import { getMemberRateForMonth } from "@/lib/utils/rate-calculator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRate } from "@/lib/types";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatYm(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function listMonthKeysFromStart(startDateStr: string, through: Date): string[] {
  const start = startOfMonth(new Date(startDateStr));
  const end = startOfMonth(through);
  if (start > end) return [];
  const out: string[] = [];
  const c = new Date(start);
  while (c <= end) {
    out.push(formatYm(c));
    c.setMonth(c.getMonth() + 1);
  }
  return out;
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

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    memberId?: string;
    amount?: number;
    datePaid?: string;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = body.memberId?.trim();
  const amount = body.amount;
  const datePaid = body.datePaid?.trim();
  if (!memberId || amount == null || Number.isNaN(Number(amount)) || !datePaid) {
    return NextResponse.json(
      { error: "memberId, amount, and datePaid are required" },
      { status: 400 }
    );
  }

  const numAmount = Number(amount);
  if (numAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: rawMember, error: mErr } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();

  if (mErr || !rawMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const creditBalance = Number(
    (rawMember as { credit_balance?: number }).credit_balance ?? 0
  );

  const { data: rawRates, error: rErr } = await supabase
    .from("member_rates")
    .select("*")
    .eq("member_id", memberId)
    .order("effective_from", { ascending: true });

  if (rErr) {
    return NextResponse.json({ error: "Could not load rates" }, { status: 500 });
  }

  const rates = (rawRates ?? []).map((row) =>
    toMemberRate(row as Record<string, unknown>)
  );

  const today = new Date();
  const memberRate = getMemberRateForMonth(rates, today);

  const alloc = allocatePayment({
    amount: numAmount,
    memberRate,
    existingCredit: creditBalance,
  });

  const { data: checklistRows } = await supabase
    .from("monthly_checklist")
    .select("month, paid")
    .eq("member_id", memberId);

  const paidByMonth = new Map<string, boolean>();
  for (const row of checklistRows ?? []) {
    const rec = row as { month: string; paid: boolean | null };
    paidByMonth.set(rec.month, rec.paid === true);
  }

  const monthKeys = listMonthKeysFromStart(
    String((rawMember as { start_date: string }).start_date),
    today
  );
  const monthsToMark: string[] = [];
  for (const ym of monthKeys) {
    if (monthsToMark.length >= alloc.monthsCovered) break;
    if (paidByMonth.get(ym) !== true) {
      monthsToMark.push(ym);
    }
  }

  const { data: inserted, error: payErr } = await supabase
    .from("payments")
    .insert({
      member_id: memberId,
      amount: numAmount,
      date_paid: datePaid,
      months_covered: alloc.monthsCovered,
      credit_used: alloc.creditUsed,
      credit_remainder: alloc.creditRemainder,
      note: body.note?.trim() || null,
    })
    .select()
    .single();

  if (payErr || !inserted) {
    console.error("payment insert", payErr);
    return NextResponse.json(
      { error: "Could not record payment" },
      { status: 500 }
    );
  }

  const paymentId = String((inserted as { id: string }).id);

  const { error: memErr } = await supabase
    .from("members")
    .update({ credit_balance: alloc.creditRemainder })
    .eq("id", memberId);

  if (memErr) {
    console.error("member credit update", memErr);
  }

  for (const ym of monthsToMark) {
    const { data: existing } = await supabase
      .from("monthly_checklist")
      .select("id")
      .eq("member_id", memberId)
      .eq("month", ym)
      .maybeSingle();

    if (existing && (existing as { id: string }).id) {
      await supabase
        .from("monthly_checklist")
        .update({ paid: true, payment_id: paymentId })
        .eq("id", (existing as { id: string }).id);
    } else {
      await supabase.from("monthly_checklist").insert({
        member_id: memberId,
        month: ym,
        paid: true,
        payment_id: paymentId,
      });
    }
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "PAYMENT_LOGGED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: {
      memberId,
      amount: numAmount,
      monthsCovered: alloc.monthsCovered,
    },
  });

  return NextResponse.json({
    success: true,
    payment: inserted,
    monthsCovered: alloc.monthsCovered,
  });
}
