import type { Metadata } from "next";
import { AuditClient } from "@/components/admin/AuditClient";
import { verifyAdminToken } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Audit Log | Admin",
};
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminAuditPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session || session.role !== "super") {
    redirect("/admin");
  }

  const supabase = await createSupabaseServerClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [{ data: logs }, { data: admins }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("*")
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("admins").select("id, email"),
  ]);

  const adminEmails: Record<string, string> = {};
  for (const a of admins ?? []) {
    const row = a as { id: string; email: string };
    adminEmails[row.id] = row.email;
  }

  return (
    <AuditClient initialLogs={logs ?? []} adminEmails={adminEmails} />
  );
}
