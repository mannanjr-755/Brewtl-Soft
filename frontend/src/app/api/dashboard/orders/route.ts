import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/orders";
import { requireStaff } from "@/lib/session";
import { nextStatus, ORDER_STATUSES } from "@/lib/utils";

/**
 * Create a walking-customer order from existing menu item(s).
 * Supports single item `{ menuItemId, quantity }` or cart `{ items: [{ menuItemId, quantity }] }`.
 * Uses existing order/item pricing fields — does not alter table-based order flow.
 */
export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const walkingCustomer = body.walkingCustomer === true;

    if (!walkingCustomer) {
      return NextResponse.json(
        { error: "Only walking-customer order creation is supported here" },
        { status: 400 }
      );
    }

    type LineInput = { menuItemId: string; quantity: number };
    let lines: LineInput[] = [];

    if (Array.isArray(body.items) && body.items.length > 0) {
      lines = body.items
        .map((row: { menuItemId?: unknown; quantity?: unknown }) => ({
          menuItemId: typeof row.menuItemId === "string" ? row.menuItemId : "",
          quantity: Math.max(1, Math.floor(Number(row.quantity) || 1)),
        }))
        .filter((row: LineInput) => row.menuItemId);
    } else {
      const menuItemId = typeof body.menuItemId === "string" ? body.menuItemId : "";
      const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
      if (menuItemId) {
        lines = [{ menuItemId, quantity }];
      }
    }

    if (lines.length === 0) {
      return NextResponse.json({ error: "menuItemId required" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.user.restaurantId },
      select: { id: true, name: true, phone: true, address: true, slug: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: lines.map((l) => l.menuItemId) },
        restaurantId: restaurant.id,
        available: true,
      },
    });
    if (menuItems.length !== new Set(lines.map((l) => l.menuItemId)).size) {
      return NextResponse.json({ error: "Menu item not found or unavailable" }, { status: 404 });
    }

    const byId = new Map(menuItems.map((m) => [m.id, m]));
    const orderItems = lines.map((line) => {
      const menuItem = byId.get(line.menuItemId)!;
      const unitPrice = menuItem.price;
      const subtotal = line.quantity * unitPrice;
      return {
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        quantity: line.quantity,
        unitPrice,
        subtotal,
      };
    });
    const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0);

    const table = await prisma.table.findFirst({
      where: { restaurantId: restaurant.id },
      orderBy: { tableNumber: "asc" },
    });
    if (!table) {
      return NextResponse.json(
        { error: "Create at least one table before taking walking-customer orders" },
        { status: 400 }
      );
    }

    const orderNumber = await generateOrderNumber(restaurant.id, restaurant.slug);

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        orderNumber,
        customerName: "Walking Customer",
        orderType: "TAKE_AWAY",
        status: "NEW",
        total,
        items: {
          create: orderItems,
        },
      },
      include: { items: true, table: true },
    });

    return NextResponse.json(
      {
        order,
        restaurant: {
          name: restaurant.name,
          phone: restaurant.phone,
          address: restaurant.address,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create walking order error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

/** List orders for the logged-in staff member's restaurant only */
export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const since = searchParams.get("since");

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: session.user.restaurantId,
      ...(status && ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])
        ? { status }
        : {}),
      ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
    },
    include: {
      items: true,
      table: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders, serverTime: new Date().toISOString() });
}

/** Update order status / customer fields / add or remove items */
export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      orderId,
      status,
      advance,
      customerName,
      customerPhone,
      customerEmail,
      specialRequest,
      addItem,
      removeItemId,
      updateItemQty,
    } = body as {
      orderId?: string;
      status?: string;
      advance?: boolean;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      specialRequest?: string;
      addItem?: { menuItemId: string; quantity: number };
      removeItemId?: string;
      updateItemQty?: { orderItemId: string; quantity: number };
    };

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: session.user.restaurantId },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // --- Add a menu item to the order ---
    if (addItem) {
      const menuItem = await prisma.menuItem.findFirst({
        where: { id: addItem.menuItemId, restaurantId: session.user.restaurantId },
      });
      if (!menuItem) {
        return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
      }
      const qty = Math.max(1, Math.floor(addItem.quantity));
      const existing = order.items.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        await prisma.orderItem.update({
          where: { id: existing.id },
          data: { quantity: newQty, subtotal: newQty * existing.unitPrice },
        });
      } else {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: menuItem.id,
            itemName: menuItem.name,
            quantity: qty,
            unitPrice: menuItem.price,
            subtotal: qty * menuItem.price,
          },
        });
      }

      // Recalculate total
      const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { total },
        include: { items: true, table: true },
      });
      return NextResponse.json({ order: updatedOrder });
    }

    // --- Remove an item from the order ---
    if (removeItemId) {
      const item = order.items.find((i) => i.id === removeItemId);
      if (!item) {
        return NextResponse.json({ error: "Order item not found" }, { status: 404 });
      }
      await prisma.orderItem.delete({ where: { id: removeItemId } });

      const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { total },
        include: { items: true, table: true },
      });
      return NextResponse.json({ order: updatedOrder });
    }

    // --- Update item quantity ---
    if (updateItemQty) {
      const item = order.items.find((i) => i.id === updateItemQty.orderItemId);
      if (!item) {
        return NextResponse.json({ error: "Order item not found" }, { status: 404 });
      }
      const newQty = Math.max(1, Math.floor(updateItemQty.quantity));
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { quantity: newQty, subtotal: newQty * item.unitPrice },
      });

      const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { total },
        include: { items: true, table: true },
      });
      return NextResponse.json({ order: updatedOrder });
    }

    // --- Status / customer field edits ---
    const data: Record<string, unknown> = {};

    let newStatus = status;
    if (advance && !status) {
      const next = nextStatus(order.status);
      if (!next) {
        return NextResponse.json({ error: "Order already completed" }, { status: 400 });
      }
      newStatus = next;
    }

    if (newStatus) {
      if (!ORDER_STATUSES.includes(newStatus as (typeof ORDER_STATUSES)[number])) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = newStatus;
    }

    if (customerName !== undefined) data.customerName = customerName;
    if (customerPhone !== undefined) data.customerPhone = customerPhone || null;
    if (customerEmail !== undefined) data.customerEmail = customerEmail || null;
    if (specialRequest !== undefined) data.specialRequest = specialRequest || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data,
      include: { items: true, table: true },
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id,
      restaurantId: session.user.restaurantId,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await prisma.order.delete({ where: { id: order.id } });
  return NextResponse.json({ ok: true });
}
