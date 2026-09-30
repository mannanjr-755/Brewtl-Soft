import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireAdmin } from "@/lib/session";

const ROLES = ["ADMIN", "STAFF"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(100),
  role: z.enum(ROLES).optional(),
});

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { restaurantId: session.user.restaurantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ staff: users, currentUserId: session.user.id });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      restaurantId: session.user.restaurantId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role ?? "STAFF",
      active: true,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json({ staff: user }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body as { id?: string };
  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const role = body.role !== undefined ? String(body.role).toUpperCase() : undefined;
  const active = body.active !== undefined ? Boolean(body.active) : undefined;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (role && !ROLES.includes(role as (typeof ROLES)[number])) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Prevent the current admin from locking themselves out
  if (id === session.user.id) {
    if (role && role !== "ADMIN") {
      return NextResponse.json({ error: "You cannot remove your own admin role" }, { status: 400 });
    }
    if (active === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(active !== undefined ? { active } : {}),
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json({ staff: user });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
