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

  const memberStartDate = (rawMember as { start_date: string | null })
    .start_date;
  if (memberStartDate) {
    const startDate = new Date(memberStartDate);
    const endMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const allMonths: string[] = [];
    const cursor = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      1
    );
    while (cursor <= endMonth) {
      allMonths.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const { data: paidMonths } = await supabase
      .from("monthly_checklist")
      .select("month")
      .eq("member_id", memberId)
      .eq("paid", true);

    const paidSet = new Set(
      (paidMonths ?? []).map((p) => {
        const row = p as { month: string };
        const d = new Date(row.month);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      })
    );

    const unpaidMonths = allMonths.filter((m) => !paidSet.has(m));
    const monthsToMark = unpaidMonths.slice(
      0,
      Math.max(1, alloc.monthsCovered)
    );

    for (const monthStr of monthsToMark) {
      await supabase.from("monthly_checklist").upsert(
        {
          member_id: memberId,
          month: monthStr,
          paid: true,
          payment_id: paymentId,
        },
        { onConflict: "member_id,month" }
      );
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
