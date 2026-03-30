import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatGhsCurrency } from "@/lib/utils/currency";

export const metadata: Metadata = {
  title: "Home | Admin",
};
import { getMemberPaymentSubtitle } from "@/lib/utils/member-payment-subtitle";
import { calculateBalance } from "@/lib/utils/rate-calculator";
import type { Member, MemberRate, Payment } from "@/lib/types";

function formatCedis(n: number) {
  return formatGhsCurrency(n);
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function joinMemberName(members: unknown): string {
  if (members && typeof members === "object" && "name" in members) {
    return String((members as { name: unknown }).name);
  }
  if (Array.isArray(members) && members[0] && typeof members[0] === "object") {
    const row = members[0] as { name?: unknown };
    if (row.name != null) return String(row.name);
  }
  return "Unknown";
}

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const ym = `${y}-${mo}`;

  const monthHeading = now.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const [
    { data: rawMembers },
    { data: rawRates },
    { data: rawPayments },
    { data: checklistRows },
    { data: recentRaw },
  ] = await Promise.all([
    supabase.from("members").select("*"),
    supabase.from("member_rates").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("monthly_checklist").select("member_id, paid").eq("month", ym),
    supabase
      .from("payments")
      .select("id, amount, date_paid, note, member_id, members(name)")
      .order("date_paid", { ascending: false })
      .limit(10),
  ]);

  const members = (rawMembers ?? []).map((r) =>
    toMember(r as Record<string, unknown>)
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

  const payments = (rawPayments ?? []).map((r) =>
    toPayment(r as Record<string, unknown>)
  );

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

  const sm = startOfMonth(now);
  const em = endOfMonth(now);
  const paidThisMonth = payments
    .filter((p) => {
      const d = new Date(p.date_paid);
      return d >= sm && d <= em;
    })
    .reduce((s, p) => s + p.amount, 0);

  const activeMembers = members.filter((m) => m.active);
  const paidMemberIds = new Set(
    (checklistRows ?? [])
      .filter((row) => (row as { paid?: boolean }).paid === true)
      .map((row) => String((row as { member_id: string }).member_id))
  );

  const paidUpThisMonthCount = activeMembers.filter((m) =>
    paidMemberIds.has(m.id)
  ).length;
  const notYetPaidThisMonth = Math.max(
    0,
    activeMembers.length - paidUpThisMonthCount
  );

  const behindRows: { id: string; name: string; owed: number; totalPaid: number }[] =
    [];
  let totalOutstanding = 0;

  for (const m of activeMembers) {
    const rates = ratesByMember.get(m.id) ?? [];
    const memberPayments = payments.filter((p) => p.member_id === m.id);
    const totalPair = memberPayments.reduce((s, p) => s + p.amount, 0);
    const startDate = new Date(m.start_date);
    const balance = calculateBalance(
      rates,
      startDate,
      totalPair,
      m.credit_balance
    );
    if (balance > 0.01) {
      behindRows.push({
        id: m.id,
        name: m.name,
        owed: balance,
        totalPaid: totalPair,
      });
      totalOutstanding += balance;
    }
  }

  behindRows.sort((a, b) => b.owed - a.owed);
  const quickBehind = behindRows.slice(0, 5);

  const recentPayments = (recentRaw ?? []).map((row) => ({
    id: String((row as { id: unknown }).id),
    amount: Number((row as { amount: unknown }).amount),
    date_paid: String((row as { date_paid: unknown }).date_paid),
    note:
      (row as { note: unknown }).note == null
        ? null
        : String((row as { note: unknown }).note),
    memberName: joinMemberName((row as { members: unknown }).members),
  }));

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8 lg:p-0" style={{ background: "transparent" }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-[22px] font-bold" style={{ color: "var(--neu-text-primary)" }}>
            Month of {monthHeading}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
            Overview and recent activity
          </p>
        </div>
        <Link href={`/admin/checklist/${ym}`} className="neu-button-gold inline-flex min-h-[48px] w-full items-center justify-center lg:w-auto">
          View Full Checklist
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="neu-metric relative overflow-hidden">
          <div
            className="neu-avatar absolute right-3 top-3 h-8 w-8 text-[var(--neu-info)]"
            style={{ fontSize: "14px", boxShadow: "var(--neu-flat)" }}
          >
            ◎
          </div>
          <span className="label">Total collected</span>
          <span className="value metric-value">{formatCedis(totalCollected)}</span>
          <span className="sub">All time</span>
        </div>
        <div className="neu-metric relative overflow-hidden">
          <div
            className="neu-avatar absolute right-3 top-3 h-8 w-8 text-[var(--neu-warning)]"
            style={{ fontSize: "14px", boxShadow: "var(--neu-flat)" }}
          >
            ◇
          </div>
          <span className="label">Outstanding</span>
          <span className="value metric-value">{formatCedis(totalOutstanding)}</span>
        </div>
        <div className="neu-metric relative overflow-hidden">
          <div
            className="neu-avatar absolute right-3 top-3 h-8 w-8 text-[var(--neu-success)]"
            style={{ fontSize: "14px", boxShadow: "var(--neu-flat)" }}
          >
            ✓
          </div>
          <span className="label">Paid this month</span>
          <span className="value metric-value">{formatCedis(paidThisMonth)}</span>
        </div>
        <div className="neu-metric relative overflow-hidden">
          <div
            className="neu-avatar absolute right-3 top-3 h-8 w-8 text-[var(--neu-danger)]"
            style={{ fontSize: "14px", boxShadow: "var(--neu-flat)" }}
          >
            !
          </div>
          <span className="label">Not yet paid</span>
          <span className="value metric-value">{notYetPaidThisMonth}</span>
          <span className="sub">Active members</span>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="neu-card">
          <h2 className="font-serif text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
            Recent payments
          </h2>
          <ul className="mt-4 list-none p-0">
            {recentPayments.length === 0 ? (
              <li className="py-4 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
                No payments yet
              </li>
            ) : (
              recentPayments.map((p, idx) => (
                <li key={p.id}>
                  {idx > 0 ? <div className="neu-divider" style={{ margin: "0" }} /> : null}
                  <div className="flex flex-wrap items-start justify-between gap-2 py-4 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="neu-avatar h-9 w-9 shrink-0 text-xs">
                        {p.memberName
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: "var(--neu-text-primary)" }}>
                          {p.memberName}
                        </p>
                        <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                          {new Date(p.date_paid).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        {p.note ? (
                          <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                            {p.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="font-bold" style={{ color: "var(--neu-gold)" }}>
                      {formatCedis(p.amount)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="neu-card">
          <h2 className="font-serif text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
            Most behind
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
            Top 5 active members by amount owed
          </p>
          <ul className="mt-4 list-none p-0">
            {quickBehind.length === 0 ? (
              <li className="py-4 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
                Everyone is caught up.
              </li>
            ) : (
              quickBehind.map((r, idx) => {
                const sub = getMemberPaymentSubtitle(
                  r.totalPaid,
                  r.owed,
                  "behind"
                );
                return (
                <li key={r.id}>
                  {idx > 0 ? <div className="neu-divider" style={{ margin: "0" }} /> : null}
                  <div className="flex items-start justify-between gap-2 py-4 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <div
                          className="neu-avatar flex h-6 w-6 shrink-0 text-[11px]"
                          style={{ boxShadow: "var(--neu-flat)" }}
                        >
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium" style={{ color: "var(--neu-text-primary)" }}>
                            {r.name}
                          </span>
                          <p className="mt-0.5 text-xs" style={{ color: sub.colorVar }}>
                            {sub.text}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 font-bold" style={{ color: "#c53030" }}>
                      {formatCedis(r.owed)}
                    </span>
                  </div>
                </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
