import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db/audit";
import { signAdminToken } from "@/lib/auth/session";
import { cookieSecure } from "@/lib/cookies";
import { rateLimit } from "@/lib/security/rate-limiter";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_PASSWORD_LEN = 128;

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";

  const rl = await rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length > MAX_PASSWORD_LEN) {
    return NextResponse.json({ error: "Password too long" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");

  const supabase = await createSupabaseServerClient();
  const { data: admin, error } = await supabase
    .from("admins")
    .select("id, email, password_hash, role, must_reset_password")
    .eq("email", email)
    .maybeSingle();

  if (error || !admin) {
    await logEvent({
      event_type: "FAILED_LOGIN",
      ip_address: ip,
      user_agent: userAgent ?? undefined,
      metadata: { reason: "unknown_email" },
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) {
    await logEvent({
      event_type: "FAILED_LOGIN",
      actor_id: admin.id,
      ip_address: ip,
      user_agent: userAgent ?? undefined,
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await logEvent({
    event_type: "ADMIN_LOGIN",
    actor_id: admin.id,
    actor_role: admin.role,
    ip_address: ip,
    user_agent: userAgent ?? undefined,
  });

  if (admin.must_reset_password) {
    const res = NextResponse.json({ success: true, mustResetPassword: true });
    res.cookies.set("reset_required", admin.id, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    });
    return res;
  }

  const token = await signAdminToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });

  const res = NextResponse.json({ success: true, role: admin.role });
  res.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return res;
}
