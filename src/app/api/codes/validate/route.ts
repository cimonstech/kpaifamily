import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db/audit";
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

function signViewerCookie(code: string): string {
  const secret = process.env.JWT_SECRET ?? "fallback";
  const sig = createHmac("sha256", secret).update(code).digest("hex").slice(0, 16);
  return `${code}.${sig}`;
}

export function verifyViewerCookie(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const code = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const secret = process.env.JWT_SECRET ?? "fallback";
  const expected = createHmac("sha256", secret).update(code).digest("hex").slice(0, 16);
  if (sig !== expected) return null;
  return code;
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

  const signed = signViewerCookie(accessCode.code);
  const res = NextResponse.json({ success: true });
  res.cookies.set("viewer_session", signed, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
