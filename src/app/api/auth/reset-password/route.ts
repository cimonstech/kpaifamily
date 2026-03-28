import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db/audit";
import { hashToken } from "@/lib/security/hash-token";
import { rateLimit } from "@/lib/security/rate-limiter";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TOKEN_TTL_MS = 60 * 60 * 1000;
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

  const rl = await rateLimit(`reset:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawToken = body.token?.trim();
  const newPassword = body.newPassword;
  if (!rawToken || !newPassword) {
    return NextResponse.json(
      { error: "Token and new password required" },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (newPassword.length > MAX_PASSWORD_LEN) {
    return NextResponse.json(
      { error: "Password too long" },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get("user-agent");
  const supabase = await createSupabaseServerClient();

  const tokenHash = hashToken(rawToken);

  const { data: row, error: fetchError } = await supabase
    .from("password_reset_tokens")
    .select("id, admin_id, created_at")
    .eq("token", tokenHash)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 }
    );
  }

  const createdAt = new Date(row.created_at).getTime();
  if (Number.isNaN(createdAt) || Date.now() - createdAt > TOKEN_TTL_MS) {
    await supabase.from("password_reset_tokens").delete().eq("id", row.id);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 }
    );
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("id, role")
    .eq("id", row.admin_id)
    .maybeSingle();

  if (adminError || !admin) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 }
    );
  }

  const password_hash = await bcrypt.hash(newPassword, 12);

  const { error: updateError } = await supabase
    .from("admins")
    .update({ password_hash })
    .eq("id", row.admin_id);

  if (updateError) {
    console.error("admin password update:", updateError);
    return NextResponse.json(
      { error: "Could not update password" },
      { status: 500 }
    );
  }

  await supabase.from("password_reset_tokens").delete().eq("admin_id", row.admin_id);

  await logEvent({
    event_type: "PASSWORD_RESET_COMPLETED",
    actor_id: admin.id,
    actor_role: admin.role,
    ip_address: ip,
    user_agent: userAgent ?? undefined,
  });

  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
