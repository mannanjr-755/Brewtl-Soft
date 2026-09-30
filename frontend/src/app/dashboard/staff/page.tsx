import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { StaffManager } from "@/components/StaffManager";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Staff",
};

export default async function StaffPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <DashboardShell active="staff">
      <StaffManager isAdmin={isAdmin} />
    </DashboardShell>
  );
}
