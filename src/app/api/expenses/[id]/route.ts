import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Expense, ExpenseItem } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: rawExpense, error: exErr } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (exErr || !rawExpense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const { data: rawItems, error: itemErr } = await supabase
    .from("expense_items")
    .select("*")
    .eq("expense_id", id)
    .order("sort_order", { ascending: true });

  if (itemErr) {
    return NextResponse.json({ error: "Could not load expense items" }, { status: 500 });
  }

  return NextResponse.json({
    ...toExpense(rawExpense as Record<string, unknown>),
    items: (rawItems ?? []).map((r) => toExpenseItem(r as Record<string, unknown>)),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
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

  const { error: upErr } = await supabase
    .from("expenses")
    .update({
      title,
      date,
      notes: body.notes?.trim() || null,
      total_amount: totalAmount,
    })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: "Could not update expense" }, { status: 500 });

  const { error: delErr } = await supabase.from("expense_items").delete().eq("expense_id", id);
  if (delErr) return NextResponse.json({ error: "Could not replace items" }, { status: 500 });

  const rows = items.map((it, idx) => ({
    expense_id: id,
    description: String(it.description).trim(),
    amount: Number(it.amount),
    sort_order: idx,
  }));
  const { error: insErr } = await supabase.from("expense_items").insert(rows);
  if (insErr) return NextResponse.json({ error: "Could not save items" }, { status: 500 });

  await logEvent({
    event_type: "EXPENSE_UPDATED",
    actor_id: session.id,
    actor_role: session.role,
    metadata: { expenseId: id, title, total_amount: totalAmount, itemCount: items.length },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getAdminSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete expense" }, { status: 500 });

  await logEvent({
    event_type: "EXPENSE_DELETED",
    actor_id: session.id,
    actor_role: session.role,
    metadata: { expenseId: id },
  });

  return NextResponse.json({ success: true });
}
