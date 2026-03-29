import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Admin Login | Kpai Family Contributions" },
  manifest: "/manifest-admin.json",
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
