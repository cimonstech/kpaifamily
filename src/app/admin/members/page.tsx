import type { Metadata } from "next";
import { MembersClient, type MemberRowVM } from "@/components/admin/MembersClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Members | Admin",
};
import {
  calculateBalance,
  calculateExpectedTotal,
  getMemberRateForMonth,
} from "@/lib/utils/rate-calculator";
import type { Member, MemberRate, Payment } from "@/lib/types";

function toMember(r: Record<string, unknown>): Member {
  return {
    id: String(r.id),
    name: String(r.name),
    branch: String(r.branch ?? ""),
    active: Boolean(r.active),
    start_date: r.start_date == null ? "" : String(r.start_date),
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
    single_month_only: Boolean(p.single_month_only),
    note: p.note == null ? null : String(p.note),
    created_at: String(p.created_at ?? ""),
  };
}

export default async function AdminMembersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: rawMembers } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });

  const members = (rawMembers ?? []).map((r) =>
    toMember(r as Record<string, unknown>)
  );

  const ids = members.map((m) => m.id);
  if (ids.length === 0) {
    return <MembersClient members={[]} />;
  }

  const [{ data: rawRates }, { data: rawPayments }] = await Promise.all([
    supabase.from("member_rates").select("*").in("member_id", ids),
    supabase.from("payments").select("*").in("member_id", ids),
  ]);

  const ratesByMember = new Map<string, MemberRate[]>();
  for (const row of rawRates ?? []) {
    const mr = toMemberRate(row as Record<string, unknown>);
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
  for (const row of rawPayments ?? []) {
    const p = toPayment(row as Record<string, unknown>);
    const list = paymentsByMember.get(p.member_id) ?? [];
    list.push(p);
    paymentsByMember.set(p.member_id, list);
  }

  const today = new Date();
  const rows: MemberRowVM[] = members.map((m) => {
    const rates = ratesByMember.get(m.id) ?? [];
    const pays = paymentsByMember.get(m.id) ?? [];
    const totalPaid = pays.reduce((s, p) => s + p.amount, 0);
    const currentRate = getMemberRateForMonth(rates, today);

    let expectedTotal = 0;
    let balance = 0;
    let status: MemberRowVM["status"];

    if (!m.active) {
      status = "pending";
      expectedTotal = 0;
      balance = 0;
    } else if (!m.start_date) {
      status = "pending";
      expectedTotal = 0;
      balance = 0;
    } else {
      const startDate = new Date(m.start_date);
      expectedTotal = calculateExpectedTotal(rates, startDate);
      balance = calculateBalance(rates, startDate, totalPaid, m.credit_balance);
      if (balance > 0.01) status = "behind";
      else if (balance < -0.01) status = "ahead";
      else status = "ok";
    }

    return {
      id: m.id,
      name: m.name,
      branch: m.branch,
      active: m.active,
      anonymous: m.anonymous,
      currentRate,
      totalPaid,
      expectedTotal,
      balance,
      credit_balance: m.credit_balance,
      status,
    };
  });

  return <MembersClient members={rows} />;
}
