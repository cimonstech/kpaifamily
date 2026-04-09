import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { DEFAULT_MONTHLY_RATE } from "@/lib/constants";
import { logEvent } from "@/lib/db/audit";
import { pickCurrentGlobalRateFromRows } from "@/lib/db/rates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

function todayIsoDate(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });

  if (mErr) {
    console.error("members list", mErr);
    return NextResponse.json({ error: "Could not load members" }, { status: 500 });
  }

  const list = members ?? [];
  if (list.length === 0) {
    return NextResponse.json([]);
  }

  const ids = list.map((m) => (m as { id: string }).id);
  const { data: allRates, error: rErr } = await supabase
    .from("member_rates")
    .select("*")
    .in("member_id", ids);

  if (rErr) {
    console.error("member rates", rErr);
    return NextResponse.json({ error: "Could not load rates" }, { status: 500 });
  }

  const latestByMember = new Map<string, { rate: number; effective_from: string }>();
  for (const row of allRates ?? []) {
    const r = row as { member_id: string; rate: number; effective_from: string };
    const prev = latestByMember.get(r.member_id);
    if (
      !prev ||
      new Date(r.effective_from).getTime() > new Date(prev.effective_from).getTime()
    ) {
      latestByMember.set(r.member_id, {
        rate: Number(r.rate),
        effective_from: r.effective_from,
      });
    }
  }

  const result = list.map((raw) => {
    const m = raw as Record<string, unknown>;
    const id = String(m.id);
    const latest = latestByMember.get(id);
    return {
      ...m,
      currentRate: latest?.rate ?? null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    branch?: string;
    active?: boolean;
    start_date?: string | null;
    anonymous?: boolean;
    monthly_rate?: number;
    variable_contributor?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const branch = body.branch?.trim();
  if (!name || !branch) {
    return NextResponse.json(
      { error: "Name and branch are required" },
      { status: 400 }
    );
  }

  const active = Boolean(body.active);
  const start_date = body.start_date?.trim() || null;
  if (active && !start_date) {
    return NextResponse.json(
      { error: "Start date is required for active members" },
      { status: 400 }
    );
  }

  const variable_contributor = Boolean(body.variable_contributor);

  const supabase = await createSupabaseServerClient();
  const todayStr = todayIsoDate();

  const { data: gRows } = await supabase
    .from("global_rate_history")
    .select("rate, effective_from, created_at");

  const gPicked = pickCurrentGlobalRateFromRows(gRows, todayStr);
  const globalDefault = gPicked?.rate ?? DEFAULT_MONTHLY_RATE;

  const globalRate = Number.isNaN(globalDefault) ? DEFAULT_MONTHLY_RATE : globalDefault;

  let monthly_rate = Number(body.monthly_rate);
  if (variable_contributor) {
    monthly_rate = globalRate;
  } else if (Number.isNaN(monthly_rate) || monthly_rate <= 0) {
    return NextResponse.json(
      { error: "Monthly rate must be greater than 0" },
      { status: 400 }
    );
  }

  const source =
    Math.abs(monthly_rate - globalRate) < 0.005 ? ("global" as const) : ("override" as const);

  const effective_from = start_date || todayStr;

  const { data: newMember, error: insErr } = await supabase
    .from("members")
    .insert({
      name,
      branch,
      active,
      start_date: start_date ?? null,
      anonymous: Boolean(body.anonymous),
      variable_contributor,
      credit_balance: 0,
    })
    .select()
    .single();

  if (insErr || !newMember) {
    console.error("member insert", insErr);
    return NextResponse.json({ error: "Could not create member" }, { status: 500 });
  }

  const memberId = String((newMember as { id: string }).id);

  const { error: rateErr } = await supabase.from("member_rates").insert({
    member_id: memberId,
    rate: monthly_rate,
    effective_from,
    source,
  });

  if (rateErr) {
    await supabase.from("members").delete().eq("id", memberId);
    console.error("member rate insert", rateErr);
    return NextResponse.json({ error: "Could not add initial rate" }, { status: 500 });
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "MEMBER_ADDED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { name, branch },
  });

  return NextResponse.json(
    { success: true, member: newMember },
    { status: 201 }
  );
}
