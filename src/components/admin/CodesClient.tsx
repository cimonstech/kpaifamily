"use client";

import { useToast } from "@/components/admin/Toast";
import type { AccessCode } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function formatCreated(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function CodesClient({
  initialCodes,
  appUrl,
}: {
  initialCodes: AccessCode[];
  appUrl: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyGen, setBusyGen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of initialCodes) next[c.id] = c.label ?? "";
    setLabelDrafts(next);
  }, [initialCodes]);

  const accessBase = appUrl.replace(/\/$/, "") || "";

  const copyToClipboard = useCallback(
    async (text: string, kind: "code" | "url", id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        if (kind === "code") {
          setCopiedCodeId(id);
          window.setTimeout(() => setCopiedCodeId((x) => (x === id ? null : x)), 2000);
        } else {
          setCopiedUrlId(id);
          window.setTimeout(() => setCopiedUrlId((x) => (x === id ? null : x)), 2000);
        }
      } catch {
        showToast("Could not copy", "error");
      }
    },
    [showToast]
  );

  async function onGenerate() {
    const labelIn = window.prompt("Label (optional)", "")?.trim() ?? "";
    setBusyGen(true);
    try {
      const res = await fetch("/api/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(labelIn ? { label: labelIn } : {}),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Could not generate code");
      }
      showToast("New code generated", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusyGen(false);
    }
  }

  async function onSaveLabel(id: string, original: string) {
    const v = (labelDrafts[id] ?? "").trim();
    if (v === original.trim()) return;
    try {
      const res = await fetch(`/api/codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: v }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Update failed");
      }
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
      setLabelDrafts((m) => ({ ...m, [id]: original }));
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm(
      "Delete this code? A new code will be auto-generated immediately."
    );
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/codes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      showToast("Code deleted. New code auto-generated.", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--neu-text-primary)" }}>
            Access Codes
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--neu-text-secondary)" }}>
            Share these codes with family members to grant dashboard access
          </p>
        </div>
        <button
          type="button"
          disabled={busyGen}
          onClick={() => void onGenerate()}
          className="neu-button-gold flex min-h-[44px] w-full shrink-0 items-center justify-center disabled:opacity-60 lg:w-auto"
        >
          {busyGen ? "Generating…" : "Generate New Code"}
        </button>
      </div>

      <div className="neu-card-sm mt-6 text-sm" role="note" style={{ boxShadow: "var(--neu-flat)" }}>
        <p style={{ color: "var(--neu-text-primary)" }}>
          Each code grants read-only access to the family dashboard. When a code is
          deleted, a new one is automatically generated. Share different codes with
          different groups to track access.
        </p>
      </div>

      <ul className="mt-8 space-y-4">
        {initialCodes.map((c) => {
          const url =
            accessBase === ""
              ? `/?code=${encodeURIComponent(c.code)}`
              : `${accessBase}/?code=${encodeURIComponent(c.code)}`;
          return (
            <li key={c.id} className="neu-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="font-mono font-semibold"
                    style={{
                      fontSize: 20,
                      letterSpacing: "0.15em",
                      color: "var(--neu-navy)",
                    }}
                  >
                    {c.code}
                  </p>
                  <label className="mt-2 block text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
                    Label
                  </label>
                  <input
                    value={labelDrafts[c.id] ?? c.label ?? ""}
                    onChange={(e) =>
                      setLabelDrafts((m) => ({ ...m, [c.id]: e.target.value }))
                    }
                    onBlur={() => void onSaveLabel(c.id, c.label ?? "")}
                    className="neu-input mt-0.5 w-full max-w-md"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
                    <span className="neu-badge neu-badge-success" style={{ fontSize: 10 }}>
                      Active
                    </span>
                    <span>Created {formatCreated(c.created_at)}</span>
                  </div>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(c.code, "code", c.id)}
                    className="neu-button flex min-h-[40px] w-full items-center justify-center rounded-full px-3 py-2 text-xs sm:w-auto"
                  >
                    {copiedCodeId === c.id ? "Copied!" : "Copy code"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => void onDelete(c.id)}
                    className="neu-button-danger flex min-h-[40px] w-full items-center justify-center rounded-full px-3 py-2 text-xs disabled:opacity-50 sm:w-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div
                className="neu-card-sm mt-4"
                style={{ boxShadow: "var(--neu-pressed-sm)" }}
              >
                <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--neu-text-secondary)" }}>
                  Access URL
                </p>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <code
                    className="break-all font-mono text-[11px]"
                    style={{ color: "var(--neu-text-secondary)" }}
                  >
                    {url}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(url, "url", c.id)}
                    className="neu-button flex min-h-[40px] w-full shrink-0 items-center justify-center rounded-full px-3 py-1 text-xs sm:w-auto"
                  >
                    {copiedUrlId === c.id ? "Copied!" : "Copy URL"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {initialCodes.length === 0 ? (
        <p className="mt-8 text-center text-sm" style={{ color: "var(--neu-text-secondary)" }}>
          No access codes yet. Generate one to get started.
        </p>
      ) : null}
    </div>
  );
}
