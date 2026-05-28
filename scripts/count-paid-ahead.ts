/**
 * Count members who are "paid ahead" for a given month (covered for the month
 * but no payment received in that calendar month). Uses the same rules as the
 * admin dashboard.
 *
 * Usage:
 *   npx tsx scripts/count-paid-ahead.ts
 *   npx tsx scripts/count-paid-ahead.ts 2026-05
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import type { MemberRate } from "../src/lib/types";
import {
  classifyMonthContribution,
  paidMemberIdsFromChecklistRows,
} from "../src/lib/utils/report-month-contribution";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

function parseMonthArg(): { ym: string; reportMonth: Date } {
  const arg = process.argv[2]?.trim();
  const ym =
    arg && /^\d{4}-\d{2}$/.test(arg)
      ? arg
      : (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        })();

  const [y, mo] = ym.split("-").map(Number);
  return { ym, reportMonth: new Date(y, mo - 1, 1) };
}

function monthRangeIso(ym: string): { start: string; end: string } {
  const [y, mo] = ym.split("-").map(Number);
  const last = new Date(y, mo, 0);
  return {
    start: `${ym}-01`,
    end: `${y}-${String(mo).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`,
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

async function main() {
  const { ym, reportMonth } = parseMonthArg();
  const { start, end } = monthRangeIso(ym);

  console.log(`\nMonth: ${ym} (${start} to ${end})\n`);

  const [
    { data: members, error: mErr },
    { data: ratesRaw, error: rErr },
    { data: paymentsRaw, error: pErr },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("active", true).order("name"),
    supabase.from("member_rates").select("*"),
    supabase.from("payments").select("*"),
  ]);

  if (mErr || rErr || pErr) {
    console.error("Query error:", mErr ?? rErr ?? pErr);
    process.exit(1);
  }

  const memberIds = (members ?? []).map((m) => String(m.id));

  const { data: checklistRows, error: cErr } =
    memberIds.length > 0
      ? await supabase
          .from("monthly_checklist")
          .select("member_id, month, paid")
          .in("member_id", memberIds)
          .eq("paid", true)
      : { data: [], error: null };

  if (cErr) {
    console.error("Checklist error:", cErr);
    process.exit(1);
  }

  const paidChecklistIds = paidMemberIdsFromChecklistRows(
    (checklistRows ?? []) as Array<{
      member_id: string;
      month: string;
      paid?: boolean | null;
    }>,
    ym
  );

  const ratesByMember = new Map<string, MemberRate[]>();
  for (const row of ratesRaw ?? []) {
    const mr = toMemberRate(row as Record<string, unknown>);
    const list = ratesByMember.get(mr.member_id) ?? [];
    list.push(mr);
    ratesByMember.set(mr.member_id, list);
  }

  const paymentInMonthByMember = new Map<string, number>();
  const totalPaidByMember = new Map<string, number>();
  for (const row of paymentsRaw ?? []) {
    const r = row as { member_id: string; amount: number; date_paid: string };
    const amt = Number(r.amount);
    totalPaidByMember.set(
      r.member_id,
      (totalPaidByMember.get(r.member_id) ?? 0) + amt
    );
    if (r.date_paid >= start && r.date_paid <= end) {
      paymentInMonthByMember.set(
        r.member_id,
        (paymentInMonthByMember.get(r.member_id) ?? 0) + amt
      );
    }
  }

  const paidAhead: string[] = [];
  const paidCash: string[] = [];
  const notCovered: string[] = [];
  let skippedVoluntary = 0;

  for (const raw of members ?? []) {
    const m = raw as Record<string, unknown>;
    const id = String(m.id);
    const name = String(m.name);
    const variable = Boolean(m.variable_contributor);

    if (variable) {
      skippedVoluntary++;
      continue;
    }

    const paymentInMonth = paymentInMonthByMember.get(id) ?? 0;
    const totalPaid = totalPaidByMember.get(id) ?? 0;

    const kind = classifyMonthContribution({
      member: {
        id,
        start_date: m.start_date == null ? "" : String(m.start_date),
        variable_contributor: false,
        credit_balance: Number(m.credit_balance ?? 0),
      },
      memberRates: ratesByMember.get(id) ?? [],
      reportMonth,
      checklistPaid: paidChecklistIds.has(id),
      paymentInReportMonth: paymentInMonth,
      totalPaidAllTime: totalPaid,
    });

    if (kind === "paid_ahead") paidAhead.push(name);
    else if (kind === "paid_cash") paidCash.push(name);
    else notCovered.push(name);
  }

  console.log("─── Summary ───");
  console.log(`Paid ahead:     ${paidAhead.length}`);
  console.log(`Paid (cash):    ${paidCash.length}`);
  console.log(`Not covered:    ${notCovered.length}`);
  console.log(`Voluntary:      ${skippedVoluntary} (excluded)`);
  console.log(
    `Paid up total:  ${paidAhead.length + paidCash.length} (ahead + cash)\n`
  );

  if (paidAhead.length > 0) {
    console.log("Paid ahead (no payment in this month):");
    paidAhead.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  } else {
    console.log("No members classified as paid ahead for this month.");
  }

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
