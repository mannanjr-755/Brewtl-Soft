import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

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

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const existing = await prisma.menuItem.findFirst({
    where: { id: parsed.data.id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const item = await prisma.menuItem.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.stockQty !== undefined ? { stockQty: parsed.data.stockQty } : {}),
      ...(parsed.data.lowStockThreshold !== undefined
        ? { lowStockThreshold: parsed.data.lowStockThreshold }
        : {}),
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ item });
}
