import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { CustomersManager } from "@/components/CustomersManager";

export const metadata: Metadata = {
  title: "Customers",
};

export default function CustomersPage() {
  return (
    <DashboardShell active="customers">
      <CustomersManager />
    </DashboardShell>
  );
}
