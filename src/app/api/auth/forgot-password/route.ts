import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db/audit";
import { hashToken } from "@/lib/security/hash-token";
import { rateLimit } from "@/lib/security/rate-limiter";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

const PUBLIC_MESSAGE =
  "If that email exists, a reset link has been sent";

export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";

  const rl = await rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: true, message: PUBLIC_MESSAGE },
      { headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");
  const supabase = await createSupabaseServerClient();

  const { data: admin } = await supabase
    .from("admins")
    .select("id, email, role")
    .eq("email", email)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({
      success: true,
      message: PUBLIC_MESSAGE,
    });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  const { error: insertError } = await supabase
    .from("password_reset_tokens")
    .insert({
      admin_id: admin.id,
      token: tokenHash,
    });

  if (insertError) {
    console.error("password_reset_tokens insert:", insertError);
    return NextResponse.json({
      success: true,
      message: PUBLIC_MESSAGE,
    });
  }

  await logEvent({
    event_type: "PASSWORD_RESET_REQUESTED",
    actor_id: admin.id,
    actor_role: admin.role,
    ip_address: ip,
    user_agent: userAgent ?? undefined,
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEV ONLY] Reset link: ${base}/admin/reset-password?token=${rawToken}`);
  }

  return NextResponse.json({
    success: true,
    message: PUBLIC_MESSAGE,
  });
}
