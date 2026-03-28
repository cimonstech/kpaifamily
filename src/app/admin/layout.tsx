import { AdminShell } from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/admin/Toast";
import { verifyAdminToken } from "@/lib/auth/session";
import { cookies } from "next/headers";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  const session = token ? await verifyAdminToken(token) : null;

  return (
    <AdminShell session={session}>
      <ToastProvider>{children}</ToastProvider>
    </AdminShell>
  );
}
