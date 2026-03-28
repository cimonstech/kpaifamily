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

async function recalculateCreditBalance(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  memberId: string,
  rates: MemberRate[]
): Promise<void> {
  const { data: payRows } = await supabase
    .from("payments")
    .select("*")
    .eq("member_id", memberId)
    .order("date_paid", { ascending: true })
    .order("id", { ascending: true });

  let credit = 0;
  for (const row of payRows ?? []) {
    const p = row as {
      amount: number;
      date_paid: string;
    };
    const rate = getMemberRateForMonth(rates, new Date(p.date_paid));
    const alloc = allocatePayment({
      amount: Number(p.amount),
      memberRate: rate,
      existingCredit: credit,
    });
    credit = alloc.creditRemainder;
  }

  await supabase
    .from("members")
    .update({ credit_balance: credit })
    .eq("id", memberId);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: paymentId } = await context.params;

  const supabase = await createSupabaseServerClient();

  const { data: payment, error: pErr } = await supabase
    .from("payments")
    .select("id, member_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (pErr || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const memberId = String((payment as { member_id: string }).member_id);

  await supabase
    .from("monthly_checklist")
    .update({ paid: false, payment_id: null })
    .eq("payment_id", paymentId);

  const { error: delErr } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);

  if (delErr) {
    console.error("payment delete", delErr);
    return NextResponse.json({ error: "Could not delete payment" }, { status: 500 });
  }

  const { data: rawRates } = await supabase
    .from("member_rates")
    .select("*")
    .eq("member_id", memberId)
    .order("effective_from", { ascending: true });

  const rates = (rawRates ?? []).map((row) =>
    toMemberRate(row as Record<string, unknown>)
  );

  await recalculateCreditBalance(supabase, memberId, rates);

  const ip = getClientIp(request);
  await logEvent({
    event_type: "PAYMENT_DELETED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { paymentId, memberId },
  });

  return NextResponse.json({ success: true });
}
