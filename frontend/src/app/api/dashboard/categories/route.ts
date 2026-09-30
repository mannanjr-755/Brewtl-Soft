import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: session.user.restaurantId },
    include: { items: { orderBy: { name: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ categories });
}

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().optional(),
});

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const maxSort = await prisma.menuCategory.aggregate({
    where: { restaurantId: session.user.restaurantId },
    _max: { sortOrder: true },
  });

  const category = await prisma.menuCategory.create({
    data: {
      restaurantId: session.user.restaurantId,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, sortOrder } = body as {
    id?: string;
    name?: string;
    sortOrder?: number;
  };

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.menuCategory.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const category = await prisma.menuCategory.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
    },
  });

  return NextResponse.json({ category });
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

  const existing = await prisma.menuCategory.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.menuCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
