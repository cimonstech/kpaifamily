import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signAdminToken } from "@/lib/auth/session";
import { logEvent } from "@/lib/db/audit";
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
  const cookieStore = await cookies();
  const adminId = cookieStore.get("reset_required")?.value;

  if (!adminId) {
    return NextResponse.json(
      { error: "Session expired. Please log in again." },
      { status: 401 }
    );
  }

  let body: { newPassword?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { newPassword, confirmPassword } = body;
  if (!newPassword || !confirmPassword) {
    return NextResponse.json(
      { error: "Both password fields are required" },
      { status: 400 }
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Passwords do not match" },
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

  const supabase = await createSupabaseServerClient();

  const { data: admin, error: fetchErr } = await supabase
    .from("admins")
    .select("id, email, role, must_reset_password")
    .eq("id", adminId)
    .maybeSingle();

  if (fetchErr || !admin) {
    return NextResponse.json(
      { error: "Session expired. Please log in again." },
      { status: 401 }
    );
  }

  if (!admin.must_reset_password) {
    return NextResponse.json(
      { error: "Password reset not required. Please log in normally." },
      { status: 400 }
    );
  }

  const password_hash = await bcrypt.hash(newPassword, 12);

  const { error: updateErr } = await supabase
    .from("admins")
    .update({ password_hash, must_reset_password: false })
    .eq("id", adminId);

  if (updateErr) {
    console.error("first-time-reset update", updateErr);
    return NextResponse.json(
      { error: "Could not update password" },
      { status: 500 }
    );
  }

  const token = await signAdminToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });

  const ip = getClientIp(request);
  await logEvent({
    event_type: "PASSWORD_RESET_COMPLETED",
    actor_id: admin.id,
    actor_role: admin.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { type: "first_time_reset" },
  });

  const res = NextResponse.json({ success: true, role: admin.role });

  res.cookies.set("reset_required", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  res.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return res;
}
