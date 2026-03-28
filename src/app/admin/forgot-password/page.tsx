import type { Metadata } from "next";
import { AdminForgotForm } from "@/components/admin/admin-forgot-form";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return <AdminForgotForm />;
}
