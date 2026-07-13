/**
 * Backfill monthly_checklist for members who paid ahead before the fix in
 * src/app/api/payments/route.ts. Previously, months covered beyond the
 * current month were never marked paid, so paid-ahead members show red
 * (unpaid) months in the Monthly status grid even though their balance and
 * coverage metrics are correct.
 *
 * For each active fixed-rate member with a start date, this compares total
 * months covered (sum of payments.months_covered) against the number of paid
 * checklist rows, and marks the shortfall into the earliest unpaid months
 * (walking forward from the start month, past the current month if needed).
 * Backfilled rows are tagged with the member's most recent multi-month
 * payment so deleting that payment unmarks them, matching normal behavior.
 *
 * Usage:
 *   npx tsx scripts/backfill-paid-ahead-checklist.ts          # dry run
 *   npx tsx scripts/backfill-paid-ahead-checklist.ts --apply  # write changes
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

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
const apply = process.argv.includes("--apply");

async function main() {
  console.log(apply ? "\nMode: APPLY (writing changes)\n" : "\nMode: dry run (pass --apply to write)\n");

  const [{ data: members, error: mErr }, { data: payments, error: pErr }] =
    await Promise.all([
      supabase.from("members").select("*").order("name"),
      supabase
        .from("payments")
        .select("id, member_id, months_covered, single_month_only, date_paid, created_at")
        .order("date_paid", { ascending: true }),
    ]);

  if (mErr || pErr) {
    console.error("Query error:", mErr ?? pErr);
    process.exit(1);
  }

  const { data: checklistRows, error: cErr } = await supabase
    .from("monthly_checklist")
    .select("member_id, month, paid")
    .eq("paid", true);

  if (cErr) {
    console.error("Checklist error:", cErr);
    process.exit(1);
  }

  const paidMonthsByMember = new Map<string, Set<string>>();
  for (const row of checklistRows ?? []) {
    const r = row as { member_id: string; month: string };
    const set = paidMonthsByMember.get(r.member_id) ?? new Set<string>();
    // Accept either YYYY-MM or YYYY-MM-01 in DB.
    set.add(String(r.month).slice(0, 7));
    paidMonthsByMember.set(r.member_id, set);
  }

  const paymentsByMember = new Map<
    string,
    Array<{ id: string; months_covered: number; single_month_only: boolean }>
  >();
  for (const row of payments ?? []) {
    const r = row as {
      id: string;
      member_id: string;
      months_covered: number | null;
      single_month_only: boolean | null;
    };
    const list = paymentsByMember.get(r.member_id) ?? [];
    list.push({
      id: String(r.id),
      months_covered: Number(r.months_covered ?? 0),
      single_month_only: r.single_month_only === true,
    });
    paymentsByMember.set(r.member_id, list);
  }

  let membersFixed = 0;
  let rowsWritten = 0;

  for (const raw of members ?? []) {
    const m = raw as Record<string, unknown>;
    const id = String(m.id);
    const name = String(m.name);

    if (Boolean(m.variable_contributor)) continue;
    if (m.start_date == null) continue;

    const memberPayments = paymentsByMember.get(id) ?? [];
    const totalCovered = memberPayments.reduce(
      (s, p) => s + p.months_covered,
      0
    );
    const paidSet = paidMonthsByMember.get(id) ?? new Set<string>();
    const shortfall = totalCovered - paidSet.size;

    if (shortfall <= 0) continue;

    // Tag backfilled rows with the latest multi-month payment (the one that
    // created the paid-ahead coverage), falling back to the latest payment.
    const multiMonth = memberPayments.filter((p) => !p.single_month_only);
    const tagPayment =
      multiMonth[multiMonth.length - 1] ??
      memberPayments[memberPayments.length - 1];

    if (!tagPayment) continue;

    const startDate = new Date(String(m.start_date));
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const monthsToMark: string[] = [];
    const maxMonthsScanned = 1200;
    for (
      let i = 0;
      i < maxMonthsScanned && monthsToMark.length < shortfall;
      i++
    ) {
      const monthStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      if (!paidSet.has(monthStr)) {
        monthsToMark.push(monthStr);
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    membersFixed++;
    console.log(
      `${name}: covered=${totalCovered}, checklist=${paidSet.size}, marking ${monthsToMark.join(", ")}`
    );

    if (apply) {
      for (const monthStr of monthsToMark) {
        // month is a date column — values must be YYYY-MM-01.
        const { error } = await supabase.from("monthly_checklist").upsert(
          {
            member_id: id,
            month: `${monthStr}-01`,
            paid: true,
            payment_id: tagPayment.id,
          },
          { onConflict: "member_id,month" }
        );
        if (error) {
          console.error(`  FAILED to mark ${monthStr}:`, error.message);
        } else {
          rowsWritten++;
        }
      }
    }
  }

  console.log(
    `\n${membersFixed} member(s) with missing paid-ahead months.` +
      (apply ? ` ${rowsWritten} checklist row(s) written.` : " No changes written (dry run).")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
