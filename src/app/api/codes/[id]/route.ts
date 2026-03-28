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

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: { label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = body.label?.trim();
  if (label === undefined) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("access_codes")
    .update({ label })
    .eq("id", id);

  if (error) {
    console.error("access_codes patch", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const { data: deletedRow, error: fetchErr } = await supabase
    .from("access_codes")
    .select("id, code, label")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !deletedRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const del = deletedRow as { id: string; code: string; label: string | null };

  const { error: delErr } = await supabase.from("access_codes").delete().eq("id", id);
  if (delErr) {
    console.error("access_codes delete", delErr);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  const oldLabel = del.label?.trim() || "(no label)";
  const autoLabel = `Auto-generated (replaced ${oldLabel})`;

  let newCodeRow = null;
  let newCodeStr = "";

  for (let attempt = 0; attempt < 8; attempt++) {
    newCodeStr = generateAccessCode();
    const { data, error } = await supabase
      .from("access_codes")
      .insert({
        code: newCodeStr,
        label: autoLabel,
        active: true,
        created_by: session.id,
      })
      .select()
      .single();

    if (!error && data) {
      newCodeRow = data;
      break;
    }
  }

  if (!newCodeRow) {
    return NextResponse.json(
      { error: "Deleted but failed to create replacement code" },
      { status: 500 }
    );
  }

  const ip = getClientIp(request);
  await logEvent({
    event_type: "CODE_DELETED",
    actor_id: session.id,
    actor_role: session.role,
    ip_address: ip ?? undefined,
    user_agent: request.headers.get("user-agent") ?? undefined,
    metadata: {
      deletedCode: del.code,
      replacedWith: newCodeStr,
    },
  });

  return NextResponse.json({ success: true, newCode: newCodeRow });
}
