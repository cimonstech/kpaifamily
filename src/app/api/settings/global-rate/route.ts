import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { DEFAULT_MONTHLY_RATE } from "@/lib/constants";
import { logEvent } from "@/lib/db/audit";
import { pickCurrentGlobalRateFromRows } from "@/lib/db/rates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function todayIsoDate(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

/** Public: default rate for forms (e.g. Add Member). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  /** Local calendar date — avoids UTC-only `toISOString()` being “yesterday” vs DB `date`. */
  const today = todayIsoDate();

  const { data: rows } = await supabase
    .from("global_rate_history")
    .select("rate, effective_from, created_at");

  const picked = pickCurrentGlobalRateFromRows(rows, today);
  const rate = picked?.rate ?? DEFAULT_MONTHLY_RATE;
  const effectiveFrom = picked?.effective_from ?? today;

  return NextResponse.json(
    {
      rate: Number.isNaN(rate) ? DEFAULT_MONTHLY_RATE : rate,
      effectiveFrom,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { rate?: number; effectiveFrom?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newRate = Number(body.rate);
  const effectiveFrom = body.effectiveFrom?.trim();
  if (!effectiveFrom || Number.isNaN(newRate) || newRate <= 0) {
    return NextResponse.json(
      { error: "rate (>0) and effectiveFrom (YYYY-MM-DD) required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const today = todayIsoDate();

  const { data: oldRows } = await supabase
    .from("global_rate_history")
    .select("rate, effective_from, created_at");

  const oldPicked = pickCurrentGlobalRateFromRows(oldRows, today);
  const oldRate = oldPicked?.rate ?? DEFAULT_MONTHLY_RATE;

  const { error: insErr } = await supabase.from("global_rate_history").insert({
    rate: newRate,
    effective_from: effectiveFrom,
    set_by: session.id,
  });

  if (insErr) {
    console.error("global_rate_history insert", insErr);
    return NextResponse.json({ error: "Could not save rate" }, { status: 500 });
  }

  const { data: actives } = await supabase.from("members").select("id").eq("active", true);

  let membersAffected = 0;
  for (const row of actives ?? []) {
    const mid = (row as { id: string }).id;
    const { data: latest } = await supabase
      .from("member_rates")
      .select("source, rate")
      .eq("member_id", mid)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cur = latest as { source: string; rate: number } | null;
    if (cur && cur.source === "override" && Number(cur.rate) >= newRate) {
      continue;
    }

    const { error: mrErr } = await supabase.from("member_rates").insert({
      member_id: mid,
      rate: newRate,
      effective_from: effectiveFrom,
      source: "global",
    });
    if (!mrErr) membersAffected++;
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "RATE_CHANGED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: {
      oldRate,
      newRate,
      effectiveFrom,
      membersAffected,
    },
  });

  return NextResponse.json({ success: true });
}
