import type { Metadata } from "next";
import { ExpensesClient } from "@/components/admin/ExpensesClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Expense, ExpenseItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "Expenses | Admin",
};

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

export default async function AdminExpensesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: rawExpenses } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  const expenses = (rawExpenses ?? []).map((r) => toExpense(r as Record<string, unknown>));
  const ids = expenses.map((e) => e.id);
  let byExpense = new Map<string, ExpenseItem[]>();
  if (ids.length > 0) {
    const { data: rawItems } = await supabase
      .from("expense_items")
      .select("*")
      .in("expense_id", ids)
      .order("sort_order", { ascending: true });
    byExpense = new Map();
    for (const row of rawItems ?? []) {
      const item = toExpenseItem(row as Record<string, unknown>);
      const list = byExpense.get(item.expense_id) ?? [];
      list.push(item);
      byExpense.set(item.expense_id, list);
    }
  }

  return <ExpensesClient expenses={expenses.map((e) => ({ ...e, items: byExpense.get(e.id) ?? [] }))} />;
}
