import type { Metadata } from "next";
import {
  MemberDetailClient,
  type MemberDetailMember,
  type MemberDetailVM,
} from "@/components/admin/MemberDetailClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .from("members")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const name = member ? String((member as { name: string }).name) : null;
  return {
    title: name ? `${name} | Members | Admin` : "Member Detail | Admin",
  };
}
import {
  calculateBalance,
  calculateExpectedTotal,
  getMemberRateForMonth,
  getMonthsElapsed,
} from "@/lib/utils/rate-calculator";
import type { MemberRate, Payment } from "@/lib/types";
import { notFound } from "next/navigation";

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

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: rawMember, error: mErr } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (mErr || !rawMember) notFound();

  const rec = rawMember as Record<string, unknown>;
  const member: MemberDetailMember = {
    id: String(rec.id),
    name: String(rec.name),
    branch: String(rec.branch ?? ""),
    active: Boolean(rec.active),
    start_date: rec.start_date == null ? null : String(rec.start_date).slice(0, 10),
    anonymous: Boolean(rec.anonymous),
    credit_balance: Number(rec.credit_balance ?? 0),
    created_at: String(rec.created_at ?? ""),
  };

  const [{ data: rawRates }, { data: rawPayments }, { data: rawChecklist }] =
    await Promise.all([
      supabase
        .from("member_rates")
        .select("*")
        .eq("member_id", id)
        .order("effective_from", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .eq("member_id", id)
        .order("date_paid", { ascending: false }),
      supabase
        .from("monthly_checklist")
        .select("month, paid")
        .eq("member_id", id)
        .order("month", { ascending: true }),
    ]);

  const ratesAsc = (rawRates ?? [])
    .map((row) => toMemberRate(row as Record<string, unknown>))
    .sort(
      (a, b) =>
        new Date(a.effective_from).getTime() -
        new Date(b.effective_from).getTime()
    );
  const ratesDesc = [...ratesAsc].sort(
    (a, b) =>
      new Date(b.effective_from).getTime() -
      new Date(a.effective_from).getTime()
  );

  const payments = (rawPayments ?? []).map((row) =>
    toPayment(row as Record<string, unknown>)
  );

  const checklist: { month: string; paid: boolean }[] = (rawChecklist ?? []).map(
    (row) => {
      const r = row as { month: string; paid: boolean | null };
      return {
        month: String(r.month),
        paid: r.paid === true,
      };
    }
  );

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const monthsPaidSum = payments.reduce((s, p) => s + p.months_covered, 0);

  let expectedTotal = 0;
  let balance = 0;
  let monthsContributing = 0;

  if (member.start_date && member.active) {
    const sd = new Date(member.start_date);
    expectedTotal = calculateExpectedTotal(ratesAsc, sd);
    balance = calculateBalance(ratesAsc, sd, totalPaid, member.credit_balance);
    monthsContributing = getMonthsElapsed(sd);
  } else if (member.start_date) {
    const sd = new Date(member.start_date);
    expectedTotal = calculateExpectedTotal(ratesAsc, sd);
    balance = calculateBalance(ratesAsc, sd, totalPaid, member.credit_balance);
    monthsContributing = getMonthsElapsed(sd);
  }

  const currentMonthLabel = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const vm: MemberDetailVM = {
    member,
    rates: ratesDesc,
    payments,
    totalPaid,
    balance,
    expectedTotal,
    credit_balance: member.credit_balance,
    monthsContributing,
    monthsPaidSum,
    monthsExpected: member.start_date ? monthsContributing : 0,
    checklist,
    currentMonthLabel,
    currentRate: getMemberRateForMonth(ratesAsc, new Date()),
  };

  return <MemberDetailClient data={vm} />;
}
