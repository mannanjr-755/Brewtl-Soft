import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  price: z.number().positive(),
  imageUrl: z.string().optional().nullable(),
  categoryId: z.string().min(1),
  available: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const category = await prisma.menuCategory.findFirst({
    where: { id: parsed.data.categoryId, restaurantId: session.user.restaurantId },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const imageUrl = parsed.data.imageUrl?.trim() || null;

  const item = await prisma.menuItem.create({
    data: {
      restaurantId: session.user.restaurantId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price: parsed.data.price,
      imageUrl,
      available: parsed.data.available ?? true,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...rest } = body as { id?: string } & Record<string, unknown>;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.menuItem.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (rest.categoryId) {
    const category = await prisma.menuCategory.findFirst({
      where: {
        id: String(rest.categoryId),
        restaurantId: session.user.restaurantId,
      },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
  }

  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(rest.name !== undefined ? { name: String(rest.name).trim() } : {}),
      ...(rest.description !== undefined
        ? { description: rest.description ? String(rest.description) : null }
        : {}),
      ...(rest.price !== undefined ? { price: Number(rest.price) } : {}),
      ...(rest.imageUrl !== undefined
        ? { imageUrl: rest.imageUrl ? String(rest.imageUrl).trim() : null }
        : {}),
      ...(rest.categoryId !== undefined ? { categoryId: String(rest.categoryId) } : {}),
      ...(rest.available !== undefined ? { available: Boolean(rest.available) } : {}),
    },
  });

  return NextResponse.json({ item });
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

  const existing = await prisma.menuItem.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
