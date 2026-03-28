import type { Metadata } from "next";
import { CodeEntryForm } from "@/components/public/code-entry-form";

export const metadata: Metadata = {
  title: "Family Access | Kpai Family Contributions",
  description: "Enter your access code to view the family dashboard",
};

export default function Page() {
  return <CodeEntryForm />;
}
