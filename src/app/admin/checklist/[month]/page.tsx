import type { Metadata } from "next";
import {
  ChecklistClient,
  type ChecklistMemberVM,
} from "@/components/admin/ChecklistClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  const d = new Date(`${month}-01T12:00:00`);
  const monthName = d.toLocaleDateString("en-GH", {
    month: "long",
    year: "numeric",
  });
  return { title: `Checklist — ${monthName} | Admin` };
}
import { calculateBalance, getMemberRateForMonth } from "@/lib/utils/rate-calculator";
import type { Member, MemberRate, Payment } from "@/lib/types";
import { notFound } from "next/navigation";

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

function toMember(r: Record<string, unknown>): Member {
  return {
    id: String(r.id),
    name: String(r.name),
    branch: String(r.branch ?? ""),
    active: Boolean(r.active),
    start_date: String(r.start_date ?? ""),
    anonymous: Boolean(r.anonymous),
    variable_contributor: Boolean(r.variable_contributor),
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

function lastDayIsoOfMonth(year: number, monthOneBased: number): string {
  const last = new Date(year, monthOneBased, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

export default async function ChecklistMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const raw = (await params).month;
  const mch = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (!mch) notFound();
  const year = Number(mch[1]);
  const moNum = Number(mch[2]);
  if (moNum < 1 || moNum > 12) notFound();
  const monthKey = `${year}-${String(moNum).padStart(2, "0")}`;

  const monthDate = new Date(year, moNum - 1, 1);
  const startStr = `${monthKey}-01`;
  const endStr = lastDayIsoOfMonth(year, moNum);

  const supabase = await createSupabaseServerClient();

  const [{ data: rawMembers }, { data: checklistRows }, { data: payMonthRows }] =
    await Promise.all([
      supabase.from("members").select("*").eq("active", true),
      // monthly_checklist stores month keys as YYYY-MM (legacy rows may be YYYY-MM-01).
      supabase
        .from("monthly_checklist")
        .select("*")
        .in("month", [monthKey, `${monthKey}-01`]),
      supabase
        .from("payments")
        .select("*")
        .gte("date_paid", startStr)
        .lte("date_paid", endStr),
    ]);

  const members = (rawMembers ?? []).map((r) =>
    toMember(r as Record<string, unknown>)
  );
  const memberIds = members.map((m) => m.id);
  if (memberIds.length === 0) {
    return (
      <ChecklistClient
        monthKey={monthKey}
        members={[]}
        summary={{ paidCount: 0, unpaidCount: 0, totalCollectedMonth: 0 }}
      />
    );
  }

  const [{ data: rawRates }, { data: rawAllPayments }] = await Promise.all([
    supabase.from("member_rates").select("*").in("member_id", memberIds),
    supabase.from("payments").select("*").in("member_id", memberIds),
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
  for (const row of rawAllPayments ?? []) {
    const p = toPayment(row as Record<string, unknown>);
    const list = paymentsByMember.get(p.member_id) ?? [];
    list.push(p);
    paymentsByMember.set(p.member_id, list);
  }

  const checklistByMember = new Map<
    string,
    { paid: boolean; payment_id: string | null }
  >();
  for (const row of checklistRows ?? []) {
    const r = row as {
      member_id: string;
      paid: boolean | null;
      payment_id: string | null;
    };
    checklistByMember.set(r.member_id, {
      paid: r.paid === true,
      payment_id: r.payment_id ?? null,
    });
  }

  const { data: allChecklistStatus } = await supabase
    .from("monthly_checklist")
    .select("member_id, month, paid")
    .in("member_id", memberIds);

  const paidMapByMember = new Map<string, Map<string, boolean>>();
  for (const row of allChecklistStatus ?? []) {
    const r = row as {
      member_id: string;
      month: string;
      paid: boolean | null;
    };
    if (!paidMapByMember.has(r.member_id)) {
      paidMapByMember.set(r.member_id, new Map());
    }
    paidMapByMember.get(r.member_id)!.set(String(r.month).slice(0, 7), r.paid === true);
  }

  const today = new Date();
  const vms: ChecklistMemberVM[] = [];

  for (const m of members) {
    const rates = ratesByMember.get(m.id) ?? [];
    const pays = paymentsByMember.get(m.id) ?? [];
    const totalPaid = pays.reduce((s, p) => s + p.amount, 0);
    const balance = calculateBalance(
      rates,
      new Date(m.start_date),
      totalPaid,
      m.credit_balance,
      m.variable_contributor
    );

    const paidMap = paidMapByMember.get(m.id) ?? new Map<string, boolean>();
    const monthKeys = listMonthKeysFromStart(m.start_date, today);
    const unpaidMonthKeysOrdered = monthKeys.filter(
      (ymk) => paidMap.get(ymk) !== true
    );

    const ch = checklistByMember.get(m.id);
    const checklistPaid = ch?.paid === true;
    const paymentId = ch?.payment_id ?? null;

    let paymentDetail: ChecklistMemberVM["paymentDetail"] = null;
    if (paymentId) {
      const p = pays.find((x) => x.id === paymentId);
      if (p) {
        paymentDetail = {
          id: p.id,
          amount: p.amount,
          date_paid: p.date_paid,
          single_month_only: p.single_month_only,
          note: p.note,
        };
      }
    }

    const monthlyRate = getMemberRateForMonth(rates, monthDate);

    vms.push({
      id: m.id,
      name: m.name,
      branch: m.branch,
      credit_balance: m.credit_balance,
      monthlyRate,
      balance,
      checklistPaid,
      paymentId,
      paymentDetail,
      unpaidMonthKeysOrdered,
      variableContributor: m.variable_contributor,
    });
  }

  const paidCount = vms.filter((r) => r.checklistPaid).length;
  const unpaidCount = vms.filter((r) => !r.checklistPaid).length;
  const totalCollectedMonth = (payMonthRows ?? []).reduce(
    (s, row) => s + Number((row as { amount?: number }).amount ?? 0),
    0
  );

  return (
    <ChecklistClient
      monthKey={monthKey}
      members={vms}
      summary={{
        paidCount,
        unpaidCount,
        totalCollectedMonth,
      }}
    />
  );
}
