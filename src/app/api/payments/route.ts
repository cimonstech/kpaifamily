import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import { allocatePayment } from "@/lib/utils/allocation";
import { getMemberRateForMonth } from "@/lib/utils/rate-calculator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRate } from "@/lib/types";

// NOTE: Run this SQL if not already done:
// ALTER TABLE payments ADD COLUMN single_month_only
// boolean NOT NULL DEFAULT false;

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
    single_month_only?: boolean;
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
  const singleMonthOnly = body.single_month_only === true;
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

  const paidAt = new Date(datePaid);
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "Invalid datePaid" }, { status: 400 });
  }
  const today = new Date();
  const memberRate = getMemberRateForMonth(rates, today);

  const alloc = singleMonthOnly
    ? {
        monthsCovered: 1,
        creditUsed: 0,
        creditRemainder: 0,
      }
    : allocatePayment({
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
      single_month_only: singleMonthOnly,
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

  if (!singleMonthOnly) {
    const { error: memErr } = await supabase
      .from("members")
      .update({ credit_balance: alloc.creditRemainder })
      .eq("id", memberId);

    if (memErr) {
      console.error("member credit update", memErr);
    }
  }

  if (singleMonthOnly) {
    // month is a date column — values must be YYYY-MM-01.
    const checklistMonth = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, "0")}-01`;
    const { error: checklistErr } = await supabase
      .from("monthly_checklist")
      .upsert(
        {
          member_id: memberId,
          month: checklistMonth,
          paid: true,
          payment_id: paymentId,
        },
        { onConflict: "member_id,month" }
      );
    if (checklistErr) {
      console.error("checklist upsert", checklistMonth, checklistErr);
    }
  } else {
    const memberStartDate = (rawMember as { start_date: string | null })
      .start_date;
    if (memberStartDate) {
    const startDate = new Date(memberStartDate);

    const { data: paidMonths } = await supabase
      .from("monthly_checklist")
      .select("month")
      .eq("member_id", memberId)
      .eq("paid", true);

    const paidSet = new Set(
      (paidMonths ?? []).map((p) => {
        const row = p as { month: string };
        // Accept either YYYY-MM or YYYY-MM-01 in DB.
        return String(row.month).slice(0, 7);
      })
    );

    // Fill oldest unpaid months first, continuing past the current month so
    // paid-ahead coverage is reflected in the checklist.
    const monthsNeeded = Math.max(1, alloc.monthsCovered);
    const monthsToMark: string[] = [];
    const cursor = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      1
    );
    const maxMonthsScanned = 1200;
    for (
      let i = 0;
      i < maxMonthsScanned && monthsToMark.length < monthsNeeded;
      i++
    ) {
      const monthStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      if (!paidSet.has(monthStr)) {
        monthsToMark.push(monthStr);
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const monthStr of monthsToMark) {
      // month is a date column — values must be YYYY-MM-01.
      const { error: checklistErr } = await supabase
        .from("monthly_checklist")
        .upsert(
          {
            member_id: memberId,
            month: `${monthStr}-01`,
            paid: true,
            payment_id: paymentId,
          },
          { onConflict: "member_id,month" }
        );
      if (checklistErr) {
        console.error("checklist upsert", monthStr, checklistErr);
      }
    }
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
      singleMonthOnly,
    },
  });

  return NextResponse.json({
    success: true,
    payment: inserted,
    monthsCovered: alloc.monthsCovered,
  });
}
