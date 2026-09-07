import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { InventoryManager } from "@/components/InventoryManager";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function InventoryPage() {
  return (
    <DashboardShell active="inventory">
      <InventoryManager />
    </DashboardShell>
  );
}
