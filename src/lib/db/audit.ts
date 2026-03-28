import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logEvent(params: {
  event_type: string;
  actor_id?: string;
  actor_role?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("audit_logs").insert({
      event_type: params.event_type,
      actor_id: params.actor_id ?? null,
      actor_role: params.actor_role ?? null,
      ip_address: params.ip_address ?? null,
      user_agent: params.user_agent ?? null,
      metadata: params.metadata ?? null,
    });
    if (error) {
      console.error("audit log insert failed:", error);
    }
  } catch (e) {
    console.error("audit log failed:", e);
  }
}
