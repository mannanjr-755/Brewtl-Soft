import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { OrdersBoard } from "@/components/OrdersBoard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  let newOrderCount = 0;
  let preparingCount = 0;
  if (session?.user.restaurantId) {
    newOrderCount = await prisma.order.count({
      where: { restaurantId: session.user.restaurantId, status: "NEW" },
    });
    preparingCount = await prisma.order.count({
      where: { restaurantId: session.user.restaurantId, status: "PREPARING" },
    });
  }

  return (
    <DashboardShell
      active="orders"
      newOrderCount={newOrderCount}
      preparingCount={preparingCount}
    >
      <OrdersBoard />
    </DashboardShell>
  );
}
