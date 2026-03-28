import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import { generateAccessCode } from "@/lib/utils/code-generator";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("access_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("access_codes list", error);
    return NextResponse.json({ error: "Could not load codes" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { label?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";

  const supabase = await createSupabaseServerClient();
  let codeStr = "";
  let inserted = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    codeStr = generateAccessCode();
    const { data, error } = await supabase
      .from("access_codes")
      .insert({
        code: codeStr,
        label: label || "Access code",
        active: true,
        created_by: session.id,
      })
      .select()
      .single();

    if (!error && data) {
      inserted = data;
      break;
    }
    if (
      error &&
      !String(error.message ?? "").toLowerCase().includes("unique")
    ) {
      console.error("access_codes insert", error);
      return NextResponse.json({ error: "Could not create code" }, { status: 500 });
    }
  }

  if (!inserted) {
    return NextResponse.json({ error: "Could not generate unique code" }, { status: 500 });
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "CODE_CREATED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { label: label || null, code: codeStr },
  });

  return NextResponse.json({ success: true, code: inserted }, { status: 201 });
}
