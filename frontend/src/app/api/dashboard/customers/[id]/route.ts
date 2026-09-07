import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
    include: {
      orders: {
        include: {
          items: true,
          table: { select: { tableNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const completedOrders = customer.orders.filter((o) => o.status === "COMPLETED");
  const totalSpent = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = completedOrders.length > 0 ? totalSpent / completedOrders.length : 0;
  const lastOrderAt = customer.orders.length > 0 ? customer.orders[0].createdAt : null;
  const firstOrderAt = customer.orders.length > 0 ? customer.orders[customer.orders.length - 1].createdAt : null;

  const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of completedOrders) {
    for (const item of order.items) {
      const existing = itemMap.get(item.itemName);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal;
      } else {
        itemMap.set(item.itemName, { name: item.itemName, quantity: item.quantity, revenue: item.subtotal });
      }
    }
  }
  const favoriteItems = [...itemMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  const catMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of completedOrders) {
    for (const item of order.items) {
      const catName = "Order";
      const existing = catMap.get(catName);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal;
      } else {
        catMap.set(catName, { name: catName, quantity: item.quantity, revenue: item.subtotal });
      }
    }
  }

  const daysSinceLast = lastOrderAt
    ? Math.floor((Date.now() - lastOrderAt.getTime()) / 86400000)
    : null;
  let segment = "NEW";
  if (customer.orders.length === 0 || !lastOrderAt) segment = "NEW";
  else if (daysSinceLast !== null && daysSinceLast > 60) segment = "INACTIVE";
  else if (completedOrders.length >= 10 || totalSpent >= 50000) segment = "VIP";
  else if (completedOrders.length >= 3) segment = "REGULAR";

  const recentActivity = customer.orders.slice(0, 10).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: o.total,
    tableNumber: o.table.tableNumber,
    createdAt: o.createdAt,
    itemCount: o.items.length,
  }));

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    stats: {
      totalOrders: customer.orders.length,
      completedOrders: completedOrders.length,
      totalSpent,
      avgOrderValue,
      firstOrderAt,
      lastOrderAt,
      daysSinceLast,
      segment,
    },
    favoriteItems,
    recentActivity,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.customer.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone).trim() : null } : {}),
      ...(body.email !== undefined
        ? { email: body.email ? String(body.email).trim().toLowerCase() : null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
    },
  });

  return NextResponse.json({ customer });
}
