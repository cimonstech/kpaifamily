import type { Metadata } from "next";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import {
  DashboardMemberList,
  type DashboardMemberRow,
} from "@/components/public/dashboard-member-list";

export const metadata: Metadata = {
  title: "Dashboard | Kpai Family Contributions",
  description: "Family contributions dashboard",
};
import { pickCurrentGlobalRateFromRows } from "@/lib/db/rates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculateBalance,
  calculateExpectedTotal,
  isMemberPaidAhead,
  isMemberPaidUp,
} from "@/lib/utils/rate-calculator";
import type { Member, MemberRate, Payment } from "@/lib/types";

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

function toMember(m: Record<string, unknown>): Member {
  return {
    id: String(m.id),
    name: String(m.name),
    branch: String(m.branch ?? ""),
    active: Boolean(m.active),
    start_date: String(m.start_date ?? ""),
    anonymous: Boolean(m.anonymous),
    variable_contributor: Boolean(m.variable_contributor),
    credit_balance: Number(m.credit_balance ?? 0),
    created_at: String(m.created_at ?? ""),
  };
}

function todayLocalIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const updatedAt = new Date().toISOString();
  const today = todayLocalIso();

  const [
    { data: rawMembers },
    { data: rawRates },
    { data: rawPayments },
    { data: globalRateRows },
    { data: expensesData },
  ] = await Promise.all([
    supabase.from("members").select("*"),
    supabase.from("member_rates").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("global_rate_history").select("rate, effective_from, created_at"),
    supabase.from("expenses").select("total_amount"),
  ]);

  const globalPicked = pickCurrentGlobalRateFromRows(globalRateRows, today);
  const latestGlobalRate =
    globalPicked != null && !Number.isNaN(globalPicked.rate)
      ? globalPicked.rate
      : null;

  const members = (rawMembers ?? []).map((r) =>
    toMember(r as Record<string, unknown>)
  );
  // Standard members plus anonymous members (reports include anonymous even when voluntary).
  const publicMembers = members.filter(
    (m) => !m.variable_contributor || m.anonymous
  );
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

  const rows: DashboardMemberRow[] = publicMembers.map((m) => {
    const rates = ratesByMember.get(m.id) ?? [];
    const payments = paymentsByMember.get(m.id) ?? [];
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const displayName = m.anonymous ? "Anonymous" : m.name;
    const monthsPaidSum = payments.reduce((s, p) => s + p.months_covered, 0);

    let expectedTotal = 0;
    let balance = 0;
    let status: DashboardMemberRow["status"];

    if (!m.active) {
      status = "pending";
    } else if (m.variable_contributor) {
      status = "ok";
      expectedTotal = 0;
      balance = 0;
    } else if (!m.start_date) {
      status = "pending";
    } else {
      const startDate = new Date(m.start_date);
      expectedTotal = calculateExpectedTotal(rates, startDate);
      balance = calculateBalance(
        rates,
        startDate,
        totalPaid,
        m.credit_balance,
        false
      );
      if (balance > 0.01) status = "behind";
      else if (balance < -0.01) status = "ahead";
      else status = "ok";
    }

    return {
      id: m.id,
      branch: m.branch,
      active: m.active,
      anonymous: m.anonymous,
      variable_contributor: m.variable_contributor,
      displayName,
      totalPaid,
      expectedTotal,
      balance,
      status,
      monthsPaidSum,
      payments,
    };
  });

  const grossCollected = (rawPayments ?? []).reduce(
    (s, p) => s + Number((p as { amount?: number }).amount ?? 0),
    0
  );

  const activeRows = rows.filter((r) => r.active);
  const totalOutstanding = activeRows.reduce(
    (s, r) => s + Math.max(0, r.balance),
    0
  );
  let membersPaidUp = 0;
  let membersPaidAhead = 0;
  let membersBehind = 0;
  for (const r of activeRows) {
    if (r.status === "pending" || r.variable_contributor) continue;
    if (isMemberPaidUp(r.balance)) {
      membersPaidUp++;
      if (isMemberPaidAhead(r.balance)) membersPaidAhead++;
    } else if (r.status === "behind") {
      membersBehind++;
    }
  }
  const anonymousRows = activeRows.filter((r) => r.anonymous);
  const anonymousCount = anonymousRows.length;
  const anonymousTotalPaid = anonymousRows.reduce((s, r) => s + r.totalPaid, 0);
  const totalExpenses = (expensesData ?? []).reduce(
    (s, e) => s + Number((e as { total_amount?: number }).total_amount ?? 0),
    0
  );
  const totalCollected = grossCollected - totalExpenses;
  const expenseCount = (expensesData ?? []).length;

  const headerDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <DashboardMemberList
        members={rows}
        updatedAt={updatedAt}
        headerDate={headerDate}
        latestGlobalRate={latestGlobalRate}
        summary={{
          totalCollected,
          totalOutstanding,
          membersPaidUp,
          membersPaidAhead,
          membersBehind,
          anonymousCount,
          anonymousTotalPaid,
          totalExpenses,
          expenseCount,
        }}
      />
      <PWAInstallPrompt startUrl="/" />
    </>
  );
}
