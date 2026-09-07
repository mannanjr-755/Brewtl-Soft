import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { TablesManager } from "@/components/TablesManager";

export const metadata: Metadata = {
  title: "Tables",
};

export default function TablesPage() {
  return (
    <DashboardShell active="tables">
      <TablesManager />
    </DashboardShell>
  );
}
