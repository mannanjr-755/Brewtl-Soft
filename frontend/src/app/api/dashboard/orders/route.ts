import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrderWithRetry } from "@/lib/orders";
import { requireStaff } from "@/lib/session";
import { nextStatus, ORDER_STATUSES } from "@/lib/utils";
import {
  countsTowardsStock,
  releaseOrderInventory,
  syncOrderInventory,
  type InventoryLine,
} from "@/lib/inventory";

/**
 * Create a walking-customer order from existing menu item(s).
 * Supports single item `{ menuItemId, quantity }` or cart `{ items: [{ menuItemId, quantity }] }`.
 * Uses existing order/item pricing fields — does not alter table-based order flow.
 *
 * `saveToReports: true` (used by "Print Receipt") creates the order directly in
 * Reports and deducts stock automatically inside the same transaction, so the
 * printed receipt and the recorded sale can never disagree.
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
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        slug: true,
        logo: true,
      },
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

    // saveToReports: create as REPORTED so it appears in Reports only (not Kitchen).
    const saveToReports = body.saveToReports === true;
    const now = new Date();

    // Order + inventory movement commit together — a printed receipt always
    // matches the recorded sale and the stock levels.
    const { order, inventory } = await prisma.$transaction(async (tx) => {
      const created = await createOrderWithRetry(tx, {
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        build: (orderNumber) => ({
          data: {
            restaurantId: restaurant.id,
            tableId: table.id,
            orderNumber,
            customerName: "Walking Customer",
            orderType: "TAKE_AWAY",
            status: saveToReports ? "REPORTED" : "NEW",
            total,
            items: {
              create: orderItems,
            },
          },
        }),
      });

      const stockResult = saveToReports
        ? await syncOrderInventory(tx, {
            restaurantId: restaurant.id,
            previousItems: [],
            nextItems: created.items as InventoryLine[],
            wasCounted: false,
            isCounted: true,
          })
        : {
            changed: false,
            changes: [],
            outOfStock: [],
            lowStock: [],
          };

      return { order: created, inventory: stockResult };
    });

    return NextResponse.json(
      {
        order,
        savedToReports: saveToReports,
        inventory: {
          updated: inventory.changed,
          outOfStock: inventory.outOfStock,
          lowStock: inventory.lowStock,
        },
        restaurant: {
          name: restaurant.name,
          phone: restaurant.phone,
          address: restaurant.address,
          logo: restaurant.logo,
        },
        serverTime: now.toISOString(),
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

/**
 * Update order status / customer fields / add, remove or resize items.
 *
 * Every mutation also reconciles stock: an order consumes stock while it sits
 * in Reports, and editing a counted order applies the exact difference.
 */
export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantId = session.user.restaurantId;

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
      where: { id: orderId, restaurantId },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const previousLines: InventoryLine[] = order.items.map((i) => ({
      menuItemId: i.menuItemId,
      quantity: i.quantity,
    }));
    const wasCounted = countsTowardsStock(order.status);

    // --- Resolve the target status, if this is a status change ---
    let newStatus = status;
    if (advance && !status) {
      const next = nextStatus(order.status);
      if (!next) {
        return NextResponse.json({ error: "Order already completed" }, { status: 400 });
      }
      newStatus = next;
    }
    if (newStatus && !ORDER_STATUSES.includes(newStatus as (typeof ORDER_STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const hasItemMutation = Boolean(addItem || removeItemId || updateItemQty);

    // --- Validate item mutations before opening the transaction ---
    if (addItem) {
      const menuItem = await prisma.menuItem.findFirst({
        where: { id: addItem.menuItemId, restaurantId },
        select: { id: true },
      });
      if (!menuItem) {
        return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
      }
    }
    if (removeItemId && !order.items.some((i) => i.id === removeItemId)) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }
    if (updateItemQty && !order.items.some((i) => i.id === updateItemQty.orderItemId)) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }

    const orderUpdate: Prisma.OrderUpdateInput = {
      ...(newStatus ? { status: newStatus } : {}),
      ...(customerName !== undefined ? { customerName } : {}),
      ...(customerPhone !== undefined ? { customerPhone: customerPhone || null } : {}),
      ...(customerEmail !== undefined ? { customerEmail: customerEmail || null } : {}),
      ...(specialRequest !== undefined ? { specialRequest: specialRequest || null } : {}),
    };

    if (!hasItemMutation && Object.keys(orderUpdate).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // --- Add a menu item to the order ---
      if (addItem) {
        const menuItem = await tx.menuItem.findUniqueOrThrow({
          where: { id: addItem.menuItemId },
        });
        const qty = Math.max(1, Math.floor(addItem.quantity));
        const existing = order.items.find((i) => i.menuItemId === menuItem.id);
        if (existing) {
          const newQty = existing.quantity + qty;
          await tx.orderItem.update({
            where: { id: existing.id },
            data: { quantity: newQty, subtotal: newQty * existing.unitPrice },
          });
        } else {
          await tx.orderItem.create({
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
      }

      // --- Remove an item from the order ---
      if (removeItemId) {
        await tx.orderItem.delete({ where: { id: removeItemId } });
      }

      // --- Update item quantity ---
      if (updateItemQty) {
        const item = order.items.find((i) => i.id === updateItemQty.orderItemId)!;
        const newQty = Math.max(1, Math.floor(updateItemQty.quantity));
        await tx.orderItem.update({
          where: { id: item.id },
          data: { quantity: newQty, subtotal: newQty * item.unitPrice },
        });
      }

      // --- Recalculate the total from the stored line items ---
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { ...orderUpdate, total },
        include: { items: true, table: true },
      });

      // A status flip is what puts an order into (or out of) Reports, so the
      // stock footprint is always re-derived — never accumulated.
      const inventory = await syncOrderInventory(tx, {
        restaurantId,
        previousItems: previousLines,
        nextItems: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        wasCounted,
        isCounted: countsTowardsStock(updatedOrder.status),
      });

      return { order: updatedOrder, inventory };
    });

    return NextResponse.json({
      order: result.order,
      savedToReports: countsTowardsStock(result.order.status),
      inventory: {
        updated: result.inventory.changed,
        outOfStock: result.inventory.outOfStock,
        lowStock: result.inventory.lowStock,
      },
    });
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

  const restaurantId = session.user.restaurantId;

  const order = await prisma.order.findFirst({
    where: {
      id,
      restaurantId,
    },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Deleting a counted order must hand its stock back, otherwise inventory
  // would drift further away from reality with every correction.
  const inventory = await prisma.$transaction(async (tx) => {
    const result = countsTowardsStock(order.status)
      ? await releaseOrderInventory(tx, {
          restaurantId,
          items: order.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        })
      : { changed: false, changes: [], outOfStock: [], lowStock: [] };

    await tx.order.delete({ where: { id: order.id } });
    return result;
  });

  return NextResponse.json({
    ok: true,
    inventory: {
      updated: inventory.changed,
      outOfStock: inventory.outOfStock,
      lowStock: inventory.lowStock,
    },
  });
}
