import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { CategoriesManager } from "@/components/CategoriesManager";

export const metadata: Metadata = {
  title: "Categories",
};

export default function CategoriesPage() {
  return (
    <DashboardShell active="categories">
      <CategoriesManager />
    </DashboardShell>
  );
}
