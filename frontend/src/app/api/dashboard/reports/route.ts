import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { ORDER_STATUSES, STATUS_LABELS, isReportedOrder } from "@/lib/utils";

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from") ?? dayKey(new Date());
  const toParam = searchParams.get("to") ?? dayKey(new Date());

  const from = startOfDay(fromParam);
  const to = new Date(startOfDay(toParam).getTime());
  to.setHours(23, 59, 59, 999);

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: session.user.restaurantId,
      createdAt: { gte: from, lte: to },
    },
    include: {
      items: { include: { menuItem: { include: { category: { select: { name: true } } } } } },
      table: { select: { tableNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const completed = orders.filter((o) => isReportedOrder(o.status));
  const revenue = completed.reduce((sum, o) => sum + o.total, 0);

  const ordersByStatus = ORDER_STATUSES.map((s) => {
    const list = orders.filter((o) => o.status === s);
    return {
      status: s,
      label: STATUS_LABELS[s],
      count: list.length,
      revenue: list.reduce((sum, o) => sum + o.total, 0),
    };
  });

  const daily: { date: string; orders: number; revenue: number }[] = [];
  const bucket = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const key = dayKey(new Date(o.createdAt));
    const b = bucket.get(key) ?? { orders: 0, revenue: 0 };
    b.orders += 1;
    if (isReportedOrder(o.status)) b.revenue += o.total;
    bucket.set(key, b);
  }
  const cursor = new Date(from.getTime());
  while (cursor.getTime() <= to.getTime()) {
    const key = dayKey(cursor);
    daily.push({ date: key, ...(bucket.get(key) ?? { orders: 0, revenue: 0 }) });
    cursor.setDate(cursor.getDate() + 1);
  }

  const itemMap = new Map<string, { quantity: number; revenue: number }>();
  const categoryMap = new Map<string, { quantity: number; revenue: number }>();
  for (const o of orders) {
    if (!isReportedOrder(o.status)) continue;
    for (const item of o.items) {
      const itemKey = item.itemName || "Unknown item";
      const it = itemMap.get(itemKey) ?? { quantity: 0, revenue: 0 };
      it.quantity += item.quantity;
      it.revenue += item.subtotal;
      itemMap.set(itemKey, it);

      const catName = item.menuItem?.category?.name ?? "Uncategorized";
      const ct = categoryMap.get(catName) ?? { quantity: 0, revenue: 0 };
      ct.quantity += item.quantity;
      ct.revenue += item.subtotal;
      categoryMap.set(catName, ct);
    }
  }

  const topItems = [...itemMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const categoryBreakdown = [...categoryMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const recentOrders = orders.slice(0, 50).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    tableNumber: o.table.tableNumber,
    status: o.status,
    total: o.total,
    createdAt: o.createdAt,
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
  }));

  return NextResponse.json({
    from: fromParam,
    to: toParam,
    summary: {
      totalOrders: orders.length,
      completedOrders: completed.length,
      revenue,
      averageOrderValue: completed.length ? revenue / completed.length : 0,
    },
    ordersByStatus,
    daily,
    topItems,
    categoryBreakdown,
    recentOrders,
  });
}
