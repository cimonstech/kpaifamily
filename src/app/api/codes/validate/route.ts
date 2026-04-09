import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db/audit";
import { cookieSecure } from "@/lib/cookies";
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

export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";

  const rl = await rateLimit(`code:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code || code.length > 20) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");
  const supabase = await createSupabaseServerClient();

  const { data: accessCode, error } = await supabase
    .from("access_codes")
    .select("code, label, active")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error || !accessCode) {
    await logEvent({
      event_type: "FAILED_CODE_ATTEMPT",
      ip_address: ip,
      user_agent: userAgent ?? undefined,
      metadata: { attempted_code_prefix: code.slice(0, 4) + "***" },
    });
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  await logEvent({
    event_type: "DASHBOARD_ACCESS",
    ip_address: ip,
    user_agent: userAgent ?? undefined,
    metadata: { code_label: accessCode.label },
  });

  const res = NextResponse.json({ success: true });
  res.cookies.set("viewer_session", accessCode.code, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
