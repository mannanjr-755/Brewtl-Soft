import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tables = await prisma.table.findMany({
    where: { restaurantId: session.user.restaurantId },
    orderBy: { tableNumber: "asc" },
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    select: { slug: true },
  });

  return NextResponse.json({ tables, slug: restaurant?.slug });
}

const createSchema = z.object({
  tableNumber: z.number().int().positive(),
});

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid table number" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const exists = await prisma.table.findUnique({
    where: {
      restaurantId_tableNumber: {
        restaurantId: restaurant.id,
        tableNumber: parsed.data.tableNumber,
      },
    },
  });

  if (exists) {
    return NextResponse.json({ error: "Table number already exists" }, { status: 409 });
  }

  const table = await prisma.table.create({
    data: {
      restaurantId: restaurant.id,
      tableNumber: parsed.data.tableNumber,
      uniqueCode: `${restaurant.slug}-t${parsed.data.tableNumber}-${Math.random().toString(36).slice(2, 8)}`,
      active: true,
    },
  });

  return NextResponse.json(
    {
      table,
      url: `/r/${restaurant.slug}/t/${table.tableNumber}`,
      absoluteUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")}/r/${restaurant.slug}/t/${table.tableNumber}`,
    },
    { status: 201 }
  );
}
