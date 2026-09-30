import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { PaymentsManager } from "@/components/PaymentsManager";

export const metadata: Metadata = {
  title: "Payments",
};

export default function PaymentsPage() {
  return (
    <DashboardShell active="payments">
      <PaymentsManager />
    </DashboardShell>
  );
}
