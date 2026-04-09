import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { cookieSecure } from "@/lib/cookies";
import { logEvent } from "@/lib/db/audit";

export async function POST(request: Request) {
  const session = await getAdminSession(request);

  if (session) {
    await logEvent({
      event_type: "ADMIN_LOGOUT",
      actor_id: session.id,
      actor_role: session.role,
    });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_token", "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
