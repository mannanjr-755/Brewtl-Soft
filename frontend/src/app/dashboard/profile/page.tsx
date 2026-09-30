import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { ProfileManager } from "@/components/ProfileManager";

export const metadata: Metadata = {
  title: "Settings",
};

export default function ProfilePage() {
  return (
    <DashboardShell active="profile">
      <ProfileManager />
    </DashboardShell>
  );
}
