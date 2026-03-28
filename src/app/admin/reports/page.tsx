import type { Metadata } from "next";
import { ReportsClient } from "@/components/admin/ReportsClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reports | Admin",
};

export default async function AdminReportsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .order("month", { ascending: false });

  return <ReportsClient initialReports={reports ?? []} />;
}
