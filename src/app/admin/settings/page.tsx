import type { Metadata } from "next";
import { SettingsClient } from "@/components/admin/SettingsClient";
import { verifyAdminToken } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings | Admin",
};
import { DEFAULT_MONTHLY_RATE } from "@/lib/constants";
import { pickCurrentGlobalRateFromRows } from "@/lib/db/rates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function todayLocalIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export default async function AdminSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session || session.role !== "super") {
    redirect("/admin");
  }

  const supabase = await createSupabaseServerClient();
  const today = todayLocalIso();

  const [{ data: currentRows }, { data: globalHistory }, { data: admins }] =
    await Promise.all([
      supabase
        .from("global_rate_history")
        .select("rate, effective_from, created_at"),
      supabase
        .from("global_rate_history")
        .select("*")
        .order("effective_from", { ascending: false }),
      supabase
        .from("admins")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: true }),
    ]);

  const cur = pickCurrentGlobalRateFromRows(currentRows, today);
  const currentRate = cur?.rate ?? DEFAULT_MONTHLY_RATE;
  const effectiveSince = cur?.effective_from ?? today;

  return (
    <SettingsClient
      currentAdminId={session.id}
      currentRate={Number.isNaN(currentRate) ? DEFAULT_MONTHLY_RATE : currentRate}
      effectiveSince={effectiveSince}
      globalHistory={globalHistory ?? []}
      admins={admins ?? []}
    />
  );
}
