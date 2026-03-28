import type { Metadata } from "next";
import { AdminResetForm } from "@/components/admin/admin-reset-form";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function AdminResetPasswordPage() {
  return <AdminResetForm />;
}
