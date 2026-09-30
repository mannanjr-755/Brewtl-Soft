import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { MenuManager } from "@/components/MenuManager";

export const metadata: Metadata = {
  title: "Menu",
};

export default function MenuPage() {
  return (
    <DashboardShell active="menu">
      <MenuManager />
    </DashboardShell>
  );
}
