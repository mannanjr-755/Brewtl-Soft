import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { ReportsManager } from "@/components/ReportsManager";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <DashboardShell active="reports">
      <ReportsManager />
    </DashboardShell>
  );
}
