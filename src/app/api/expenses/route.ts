/*
 * SUPABASE SQL — run before deploying:
 *
 * CREATE TABLE expenses (
 *   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   title text NOT NULL,
 *   date date NOT NULL,
 *   notes text,
 *   total_amount numeric(10,2) NOT NULL DEFAULT 0,
 *   created_by uuid REFERENCES admins(id) ON DELETE SET NULL,
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * CREATE TABLE expense_items (
 *   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
 *   description text NOT NULL,
 *   amount numeric(10,2) NOT NULL,
 *   sort_order int NOT NULL DEFAULT 0,
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX idx_expense_items_expense_id ON expense_items(expense_id);
 * CREATE INDEX idx_expenses_date ON expenses(date);
 * ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "service role only" ON expenses FOR ALL USING (auth.role() = 'service_role');
 * CREATE POLICY "service role only" ON expense_items FOR ALL USING (auth.role() = 'service_role');
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Expense, ExpenseItem } from "@/lib/types";

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

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: rawExpenses, error: exErr } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  if (exErr) {
    return NextResponse.json({ error: "Could not load expenses" }, { status: 500 });
  }

  const expenses = (rawExpenses ?? []).map((r) => toExpense(r as Record<string, unknown>));
  if (expenses.length === 0) return NextResponse.json([]);

  const ids = expenses.map((e) => e.id);
  const { data: rawItems, error: itemErr } = await supabase
    .from("expense_items")
    .select("*")
    .in("expense_id", ids)
    .order("sort_order", { ascending: true });

  if (itemErr) {
    return NextResponse.json({ error: "Could not load expense items" }, { status: 500 });
  }

  const byExpense = new Map<string, ExpenseItem[]>();
  for (const row of rawItems ?? []) {
    const it = toExpenseItem(row as Record<string, unknown>);
    const list = byExpense.get(it.expense_id) ?? [];
    list.push(it);
    byExpense.set(it.expense_id, list);
  }

  return NextResponse.json(
    expenses.map((e) => ({ ...e, items: byExpense.get(e.id) ?? [] }))
  );
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    date?: string;
    notes?: string;
    items?: Array<{ description?: string; amount?: number }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const date = body.date?.trim();
  const items = body.items ?? [];
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Valid date is required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length < 1) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }
  for (const it of items) {
    if (!it.description?.trim() || Number(it.amount) <= 0) {
      return NextResponse.json(
        { error: "Each item requires description and amount > 0" },
        { status: 400 }
      );
    }
  }

  const totalAmount = items.reduce((s, it) => s + Number(it.amount ?? 0), 0);
  const supabase = await createSupabaseServerClient();

  const { data: insertedExpense, error: exErr } = await supabase
    .from("expenses")
    .insert({
      title,
      date,
      notes: body.notes?.trim() || null,
      total_amount: totalAmount,
      created_by: session.id,
    })
    .select("*")
    .single();

  if (exErr || !insertedExpense) {
    return NextResponse.json({ error: "Could not create expense" }, { status: 500 });
  }

  const expenseId = String((insertedExpense as { id: string }).id);
  const rows = items.map((it, idx) => ({
    expense_id: expenseId,
    description: String(it.description).trim(),
    amount: Number(it.amount),
    sort_order: idx,
  }));

  const { error: itemsErr } = await supabase.from("expense_items").insert(rows);
  if (itemsErr) {
    return NextResponse.json({ error: "Could not create expense items" }, { status: 500 });
  }

  await logEvent({
    event_type: "EXPENSE_ADDED",
    actor_id: session.id,
    actor_role: session.role,
    metadata: { title, total_amount: totalAmount, itemCount: items.length },
  });

  const expense: Expense = toExpense(insertedExpense as Record<string, unknown>);
  return NextResponse.json(
    { success: true, expense: { ...expense, items: rows } },
    { status: 201 }
  );
}
