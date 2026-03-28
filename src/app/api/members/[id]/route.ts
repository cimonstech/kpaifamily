import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import {
  calculateBalance,
  calculateExpectedTotal,
} from "@/lib/utils/rate-calculator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Member, MemberRate, Payment } from "@/lib/types";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

function toMember(r: Record<string, unknown>): Member {
  return {
    id: String(r.id),
    name: String(r.name),
    branch: String(r.branch ?? ""),
    active: Boolean(r.active),
    start_date: String(r.start_date),
    anonymous: Boolean(r.anonymous),
    credit_balance: Number(r.credit_balance ?? 0),
    created_at: String(r.created_at ?? ""),
  };
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  const { data: rawMember, error: mErr } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (mErr || !rawMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const member = toMember(rawMember as Record<string, unknown>);

  const [{ data: rawRates }, { data: rawPayments }] = await Promise.all([
    supabase
      .from("member_rates")
      .select("*")
      .eq("member_id", id)
      .order("effective_from", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("member_id", id)
      .order("date_paid", { ascending: false }),
  ]);

  const rates = (rawRates ?? []).map((row) =>
    toMemberRate(row as Record<string, unknown>)
  );
  const payments = (rawPayments ?? []).map((row) =>
    toPayment(row as Record<string, unknown>)
  );

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const startDate = new Date(member.start_date);
  const expectedTotal = calculateExpectedTotal(rates, startDate);
  const balance = calculateBalance(
    rates,
    startDate,
    totalPaid,
    member.credit_balance
  );

  return NextResponse.json({
    member,
    rates,
    payments,
    totalPaid,
    expectedTotal,
    balance,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: {
    name?: string;
    branch?: string;
    active?: boolean;
    start_date?: string;
    anonymous?: boolean;
    monthly_rate?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: exErr } = await supabase
    .from("members")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (exErr || !existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.branch !== undefined) update.branch = body.branch;
  if (body.active !== undefined) update.active = body.active;
  if (body.start_date !== undefined) update.start_date = body.start_date;
  if (body.anonymous !== undefined) update.anonymous = body.anonymous;

  if (Object.keys(update).length > 0) {
    const { error: upErr } = await supabase
      .from("members")
      .update(update)
      .eq("id", id);

    if (upErr) {
      console.error("member update", upErr);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  if (
    body.monthly_rate !== undefined &&
    !Number.isNaN(Number(body.monthly_rate))
  ) {
    const now = new Date();
    const effective_from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const { error: rateErr } = await supabase.from("member_rates").insert({
      member_id: id,
      rate: Number(body.monthly_rate),
      effective_from,
      source: "override",
    });

    if (rateErr) {
      console.error("member rate insert", rateErr);
      return NextResponse.json({ error: "Could not add rate" }, { status: 500 });
    }
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "MEMBER_UPDATED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { memberId: id, fields: Object.keys(body) },
  });

  return NextResponse.json({ success: true });
}
