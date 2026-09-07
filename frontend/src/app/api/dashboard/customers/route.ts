import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

function normPhone(v: string | null | undefined) {
  if (!v) return null;
  return v.replace(/[\s+\-().]/g, "").toLowerCase();
}

function computeSegment(orderCount: number, totalSpent: number, lastOrderAt: Date | null): string {
  if (orderCount === 0 || !lastOrderAt) return "NEW";
  const daysSinceLast = Math.floor((Date.now() - lastOrderAt.getTime()) / 86400000);
  if (daysSinceLast > 60) return "INACTIVE";
  if (orderCount >= 10 || totalSpent >= 50000) return "VIP";
  if (orderCount >= 3) return "REGULAR";
  return "NEW";
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").toLowerCase();
  const segment = searchParams.get("segment") ?? "";
  const sort = searchParams.get("sort") ?? "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const skip = (page - 1) * limit;

  const where = {
    restaurantId: session.user.restaurantId,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { orders: true } },
        orders: {
          select: { total: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy:
        sort === "name"
          ? { name: order }
          : sort === "totalSpent"
            ? { createdAt: order }
            : sort === "orderCount"
              ? { createdAt: order }
              : { createdAt: order },
      skip,
      take: limit,
    }),
  ]);

  const rows = customers.map((c) => {
    const completedOrders = c.orders.filter((o) => o.status === "COMPLETED");
    const totalSpent = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = c._count.orders;
    const lastOrderAt = c.orders.length > 0 ? c.orders[0].createdAt : null;
    const firstOrderAt = c.orders.length > 0 ? c.orders[c.orders.length - 1].createdAt : null;
    const avgOrderValue = completedOrders.length > 0 ? totalSpent / completedOrders.length : 0;
    const seg = computeSegment(orderCount, totalSpent, lastOrderAt);

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      createdAt: c.createdAt,
      orderCount,
      totalSpent,
      avgOrderValue,
      lastOrderAt,
      firstOrderAt,
      segment: seg,
    };
  });

  const filtered = segment ? rows.filter((r) => r.segment === segment) : rows;

  const sortFn =
    sort === "name"
      ? (a: (typeof filtered)[number], b: (typeof filtered)[number]) => a.name.localeCompare(b.name)
      : sort === "totalSpent"
        ? (a: (typeof filtered)[number], b: (typeof filtered)[number]) => a.totalSpent - b.totalSpent
        : sort === "orderCount"
          ? (a: (typeof filtered)[number], b: (typeof filtered)[number]) => a.orderCount - b.orderCount
          : (a: (typeof filtered)[number], b: (typeof filtered)[number]) =>
              +new Date(a.createdAt) - +new Date(b.createdAt);

  filtered.sort(sortFn);
  if (order === "desc") filtered.reverse();

  const segmentCounts = {
    all: rows.length,
    NEW: rows.filter((r) => r.segment === "NEW").length,
    REGULAR: rows.filter((r) => r.segment === "REGULAR").length,
    VIP: rows.filter((r) => r.segment === "VIP").length,
    INACTIVE: rows.filter((r) => r.segment === "INACTIVE").length,
  };

  const totalRevenue = rows.reduce((s, r) => s + r.totalSpent, 0);
  const avgSpending = rows.length > 0 ? totalRevenue / rows.length : 0;
  const returning = rows.filter((r) => r.orderCount > 1).length;

  return NextResponse.json({
    customers: filtered,
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit),
    },
    segments: segmentCounts,
    analytics: {
      totalCustomers: rows.length,
      returningCustomers: returning,
      newCustomers: rows.filter((r) => r.segment === "NEW").length,
      activeCustomers: rows.filter((r) => r.segment !== "INACTIVE").length,
      inactiveCustomers: rows.filter((r) => r.segment === "INACTIVE").length,
      totalRevenue,
      avgSpending,
      avgOrdersPerCustomer: rows.length > 0 ? rows.reduce((s, r) => s + r.orderCount, 0) / rows.length : 0,
    },
  });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "sync") {
    const orders = await prisma.order.findMany({
      where: { restaurantId: session.user.restaurantId, customerId: null },
      select: { id: true, customerName: true, customerPhone: true, customerEmail: true },
    });

    const existing = await prisma.customer.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { id: true, phone: true, email: true },
    });

    const match = (o: (typeof orders)[number]) =>
      existing.find((c) => {
        if (o.customerEmail && c.email && o.customerEmail.toLowerCase() === c.email.toLowerCase())
          return true;
        if (normPhone(o.customerPhone) && normPhone(c.phone) === normPhone(o.customerPhone))
          return true;
        return false;
      });

    let created = 0;
    let linked = 0;
    for (const order of orders) {
      if (!order.customerName?.trim()) continue;
      let customer = match(order);
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            restaurantId: session.user.restaurantId,
            name: order.customerName.trim(),
            phone: order.customerPhone || null,
            email: order.customerEmail || null,
          },
        });
        existing.push(customer);
        created++;
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { customerId: customer.id },
      });
      linked++;
    }
    return NextResponse.json({ synced: { created, linked } });
  }

  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: {
      restaurantId: session.user.restaurantId,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    },
  });

  return NextResponse.json({ customer }, { status: 201 });
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

  const existing = await prisma.customer.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(rest.name !== undefined ? { name: String(rest.name).trim() } : {}),
      ...(rest.phone !== undefined ? { phone: rest.phone ? String(rest.phone).trim() : null } : {}),
      ...(rest.email !== undefined
        ? { email: rest.email ? String(rest.email).trim().toLowerCase() : null }
        : {}),
      ...(rest.notes !== undefined ? { notes: rest.notes ? String(rest.notes) : null } : {}),
    },
  });

  return NextResponse.json({ customer });
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

  const existing = await prisma.customer.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
