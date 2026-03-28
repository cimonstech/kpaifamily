import { NextResponse } from "next/server";
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

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (id === session.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: target, error: fErr } = await supabase
    .from("admins")
    .select("id, email, role")
    .eq("id", id)
    .maybeSingle();

  if (fErr || !target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const t = target as { id: string; email: string; role: string };
  if (t.role === "super") {
    return NextResponse.json({ error: "Cannot delete a super admin" }, { status: 403 });
  }

  const { error: dErr } = await supabase.from("admins").delete().eq("id", id);
  if (dErr) {
    console.error("admin delete", dErr);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "ADMIN_ACCOUNT_DELETED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: { deletedEmail: t.email },
  });

  return NextResponse.json({ success: true });
}
