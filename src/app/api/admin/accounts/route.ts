import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (password.length > 128) {
    return NextResponse.json(
      { error: "Password too long" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: dup } = await supabase
    .from("admins")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (dup) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { error: insErr } = await supabase.from("admins").insert({
    email,
    password_hash,
    role: "admin",
    must_reset_password: true,
    created_by: session.id,
  });

  if (insErr) {
    console.error("admin insert", insErr);
    return NextResponse.json({ error: "Could not create admin" }, { status: 500 });
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "ADMIN_ACCOUNT_CREATED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { email },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
