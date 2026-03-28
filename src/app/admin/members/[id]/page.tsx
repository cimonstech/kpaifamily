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
    note: p.note == null ? null : String(p.note),
    created_at: String(p.created_at ?? ""),
  };
}

function formatYm(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Oldest → newest (24 months). */
function monthKeysLast24(): string[] {
  const keys: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 24; i++) {
    keys.push(formatYm(d));
    d.setMonth(d.getMonth() - 1);
  }
  return keys.reverse();
}

function pillLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
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
        .eq("member_id", id),
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

  const paidByMonth = new Map<string, boolean>();
  for (const row of rawChecklist ?? []) {
    const r = row as { month: string; paid: boolean | null };
    paidByMonth.set(r.month, r.paid === true);
  }

  const startYm = member.start_date
    ? formatYm(new Date(member.start_date + "T12:00:00"))
    : null;

  const gridKeys = monthKeysLast24();
  const monthGrid = gridKeys.map((key) => {
    let state: "before" | "paid" | "unpaid";
    if (!startYm || key < startYm) {
      state = "before";
    } else if (paidByMonth.get(key) === true) {
      state = "paid";
    } else {
      state = "unpaid";
    }
    return { key, label: pillLabel(key), state };
  });

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
    monthGrid,
    currentMonthLabel,
    currentRate: getMemberRateForMonth(ratesAsc, new Date()),
  };

  return <MemberDetailClient data={vm} />;
}
