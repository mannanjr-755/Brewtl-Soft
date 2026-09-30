import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { WalkingCustomerManager } from "@/components/WalkingCustomerManager";

export const metadata: Metadata = {
  title: "Walking Customer",
};

export default function WalkingCustomerPage() {
  return (
    <DashboardShell active="walking-customer">
      <WalkingCustomerManager />
    </DashboardShell>
  );
}
