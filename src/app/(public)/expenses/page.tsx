import Link from "next/link";
import ParticleBackground from "@/components/ParticleBackground";
import { APP_NAME } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatGhsCurrency } from "@/lib/utils/currency";
import type { Expense, ExpenseItem } from "@/lib/types";

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

function toExpense(r: Record<string, unknown>): Expense {
  return {
    id: String(r.id),
    title: String(r.title),
    date: String(r.date),
    notes: r.notes == null ? null : String(r.notes),
    total_amount: Number(r.total_amount ?? 0),
    created_by: r.created_by == null ? null : String(r.created_by),
    created_at: String(r.created_at ?? ""),
  };
}

function toExpenseItem(r: Record<string, unknown>): ExpenseItem {
  return {
    id: String(r.id),
    expense_id: String(r.expense_id),
    description: String(r.description),
    amount: Number(r.amount ?? 0),
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
  };
}

export default async function ExpensesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: rawExpenses } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  const expenses = (rawExpenses ?? []).map((r) => toExpense(r as Record<string, unknown>));
  const ids = expenses.map((e) => e.id);
  const { data: rawItems } =
    ids.length > 0
      ? await supabase
          .from("expense_items")
          .select("*")
          .in("expense_id", ids)
          .order("sort_order", { ascending: true })
      : { data: [] as Record<string, unknown>[] };

  const byExpense = new Map<string, ExpenseItem[]>();
  for (const row of rawItems ?? []) {
    const it = toExpenseItem(row as Record<string, unknown>);
    const list = byExpense.get(it.expense_id) ?? [];
    list.push(it);
    byExpense.set(it.expense_id, list);
  }

  const withItems = expenses.map((e) => ({ ...e, items: byExpense.get(e.id) ?? [] }));
  const totalExpenses = withItems.reduce((s, e) => s + e.total_amount, 0);
  const mostRecent = withItems[0]?.date ?? null;

  return (
    <div className="min-h-screen">
      <section style={{ background: "#080818", position: "relative" }}>
        <ParticleBackground />
        <div className="relative z-[1] mx-auto max-w-5xl px-4 py-10 text-center">
          <h1 className="font-serif text-3xl font-bold" style={{ color: "#e8b84b" }}>
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
            Family Expenses
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex min-h-[44px] items-center rounded-[99px] px-5 py-2 text-sm font-semibold"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </section>

      <section style={{ background: "var(--neu-bg)" }} className="min-h-[60vh]">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="neu-card grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>Total Expenses</p>
              <p className="text-lg font-bold" style={{ color: "var(--neu-gold)" }}>{formatCedis(totalExpenses)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>Number of expense records</p>
              <p className="text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>{withItems.length}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>Most recent</p>
              <p className="text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
                {mostRecent ? new Date(mostRecent).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "-"}
              </p>
            </div>
          </div>

          {withItems.length === 0 ? (
            <div className="neu-card mt-6 text-center">
              <p style={{ color: "var(--neu-text-secondary)" }}>No expenses recorded yet</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {withItems.map((e) => (
                <li key={e.id} className="neu-card">
                  <details open className="group">
                    <summary className="list-none cursor-pointer">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="text-[18px] font-bold" style={{ color: "var(--neu-text-primary)" }}>{e.title}</h2>
                          <p className="text-sm" style={{ color: "var(--neu-text-secondary)" }}>
                            {new Date(e.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold" style={{ color: "var(--neu-gold)" }}>{formatCedis(e.total_amount)}</p>
                          <span className="text-xs sm:hidden" style={{ color: "var(--neu-text-secondary)" }}>
                            Tap to expand/collapse
                          </span>
                        </div>
                      </div>
                    </summary>

                  <div className="neu-card-sm mt-3">
                    <div className="grid grid-cols-[1fr_auto] text-xs font-semibold" style={{ color: "var(--neu-text-secondary)" }}>
                      <span>Description</span>
                      <span>Amount</span>
                    </div>
                    {(e.items ?? []).map((it, idx) => (
                      <div key={it.id}>
                        {idx > 0 ? <div className="neu-divider" style={{ margin: "6px 0" }} /> : null}
                        <div className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                          <span style={{ color: "var(--neu-text-primary)" }}>{it.description}</span>
                          <span style={{ color: "var(--neu-text-primary)" }}>{formatCedis(it.amount)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="neu-divider" style={{ margin: "8px 0" }} />
                    <div className="grid grid-cols-[1fr_auto] text-sm font-bold">
                      <span style={{ color: "var(--neu-text-primary)" }}>Total</span>
                      <span style={{ color: "var(--neu-text-primary)" }}>{formatCedis(e.total_amount)}</span>
                    </div>
                  </div>

                  {e.notes ? (
                    <div className="mt-3">
                      <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>Notes</p>
                      <p className="text-sm" style={{ color: "var(--neu-text-primary)" }}>{e.notes}</p>
                    </div>
                  ) : null}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
