import type { Metadata } from "next";
import { CodesClient } from "@/components/admin/CodesClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Access Codes | Admin",
};

export default async function AdminCodesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: codes } = await supabase
    .from("access_codes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <CodesClient
      initialCodes={codes ?? []}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
    />
  );
}
