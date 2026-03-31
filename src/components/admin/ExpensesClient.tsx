"use client";

import { AddExpenseModal } from "@/components/admin/AddExpenseModal";
import type { Expense } from "@/lib/types";
import { formatGhsCurrency } from "@/lib/utils/currency";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

export function ExpensesClient({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totalSpent = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.total_amount), 0),
    [expenses]
  );
  const thisMonthSpent = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return expenses
      .filter((e) => e.date.startsWith(ym))
      .reduce((s, e) => s + Number(e.total_amount), 0);
  }, [expenses]);

  async function onDelete(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--neu-text-primary)" }}>
            Expenses
          </h1>
          <span className="neu-badge neu-badge-warning mt-2 inline-block">
            Total spent: {formatCedis(totalSpent)}
          </span>
        </div>
        <button onClick={() => setOpenAdd(true)} className="neu-button-gold min-h-[44px]">
          Add Expense
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="neu-metric">
          <span className="label">Total Spent</span>
          <span className="value">{formatCedis(totalSpent)}</span>
        </div>
        <div className="neu-metric">
          <span className="label">Number of expenses</span>
          <span className="value">{expenses.length}</span>
        </div>
        <div className="neu-metric">
          <span className="label">This month</span>
          <span className="value">{formatCedis(thisMonthSpent)}</span>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {expenses.length === 0 ? (
          <li className="neu-card text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
            No expenses recorded yet
          </li>
        ) : (
          expenses.map((e) => {
            const isOpen = expanded[e.id] ?? true;
            return (
              <li key={e.id} className="neu-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-lg font-bold" style={{ color: "var(--neu-text-primary)" }}>
                      {e.title}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                      {new Date(e.date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: "var(--neu-gold)" }}>
                      {formatCedis(e.total_amount)}
                    </span>
                    <button className="neu-button min-h-[44px] text-xs" onClick={() => setExpanded((p) => ({ ...p, [e.id]: !isOpen }))}>
                      {isOpen ? "Hide" : "Show"}
                    </button>
                    <button className="neu-button min-h-[44px] text-xs" onClick={() => setEditing(e)}>
                      Edit
                    </button>
                    <button className="neu-button-danger min-h-[44px] text-xs" onClick={() => void onDelete(e.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="neu-card-sm mt-4">
                    <div className="grid grid-cols-[1fr_auto] gap-2 text-xs font-semibold" style={{ color: "var(--neu-text-secondary)" }}>
                      <span>Description</span><span>Amount</span>
                    </div>
                    {(e.items ?? []).map((it, idx) => (
                      <div key={it.id} className="mt-2">
                        {idx > 0 ? <div className="neu-divider" style={{ margin: "6px 0" }} /> : null}
                        <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                          <span style={{ color: "var(--neu-text-primary)" }}>{it.description}</span>
                          <span style={{ color: "var(--neu-text-primary)" }}>{formatCedis(it.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      <AddExpenseModal open={openAdd} onClose={() => setOpenAdd(false)} onSuccess={() => router.refresh()} />
      <AddExpenseModal open={!!editing} onClose={() => setEditing(null)} onSuccess={() => router.refresh()} editing={editing} />
    </div>
  );
}
