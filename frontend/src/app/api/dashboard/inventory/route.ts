import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { setManualStock } from "@/lib/inventory";

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.menuItem.findMany({
    where: { restaurantId: session.user.restaurantId },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json({ items });
}

const updateSchema = z.object({
  id: z.string().min(1),
  stockQty: z.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

const trackAllSchema = z.object({
  stockQty: z.number().int().min(0).max(100000),
  lowStockThreshold: z.number().int().min(0).max(100000).optional(),
});

/**
 * Update one item's stock level / low-stock threshold.
 *
 * Stock edits are the only manual input left in Inventory — everything else is
 * driven by orders. Crossing zero also flips the item's menu availability.
 */
export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantId = session.user.restaurantId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const existing = await prisma.menuItem.findFirst({
    where: { id: parsed.data.id, restaurantId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  try {
    const stock =
      parsed.data.stockQty !== undefined
        ? await setManualStock(prisma, {
            restaurantId,
            menuItemId: existing.id,
            stockQty: parsed.data.stockQty,
          })
        : null;

    const item = await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.lowStockThreshold !== undefined
          ? { lowStockThreshold: parsed.data.lowStockThreshold }
          : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      item: stock
        ? { ...item, stockQty: stock.stockQty, available: stock.available }
        : item,
    });
  } catch (error) {
    console.error("Inventory update error:", error);
    return NextResponse.json({ error: "Could not update stock" }, { status: 500 });
  }
}

/**
 * Start tracking every not-yet-tracked menu item at the same opening count, so
 * automatic stock control can take over for the whole menu in one action.
 */
export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantId = session.user.restaurantId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = trackAllSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const untracked = await prisma.menuItem.findMany({
    where: { restaurantId, stockQty: null },
    select: { id: true },
  });

  if (untracked.length === 0) {
    return NextResponse.json({ updated: 0, items: [] });
  }

  const items = await prisma.$transaction(
    untracked.map((row) =>
      prisma.menuItem.update({
        where: { id: row.id },
        data: {
          stockQty: parsed.data.stockQty,
          ...(parsed.data.lowStockThreshold !== undefined
            ? { lowStockThreshold: parsed.data.lowStockThreshold }
            : {}),
        },
        include: { category: { select: { id: true, name: true } } },
      })
    )
  );

  return NextResponse.json({ updated: items.length, items });
}
