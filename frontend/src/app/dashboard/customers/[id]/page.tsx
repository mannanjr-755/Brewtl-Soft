import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { CustomerProfile } from "@/components/CustomerProfile";

export const metadata: Metadata = {
  title: "Customer Profile",
};

export default function CustomerProfilePage() {
  return (
    <DashboardShell active="customers">
      <CustomerProfile />
    </DashboardShell>
  );
}
