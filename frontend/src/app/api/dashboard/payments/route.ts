import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_WALLET", "OTHER"] as const;
const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED", "FAILED"] as const;

const createSchema = z.object({
  orderId: z.string().min(1).nullable().optional(),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS).default("CASH"),
  status: z.enum(PAYMENT_STATUSES).default("PAID"),
  reference: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [payments, orders] = await Promise.all([
    prisma.payment.findMany({
      where: { restaurantId: session.user.restaurantId },
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true, total: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.order.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const paidPerOrder = await prisma.payment.groupBy({
    by: ["orderId"],
    where: { restaurantId: session.user.restaurantId, status: { in: ["PAID"] } },
    _sum: { amount: true },
  });
  const paidMap = new Map(paidPerOrder.map((p) => [p.orderId, p._sum.amount ?? 0]));

  const ordersWithBalance = orders.map((o) => ({
    ...o,
    paid: paidMap.get(o.id) ?? 0,
    balance: Math.max(0, o.total - (paidMap.get(o.id) ?? 0)),
  }));

  return NextResponse.json({ payments, orders: ordersWithBalance });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, restaurantId: session.user.restaurantId },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
  }

  const payment = await prisma.payment.create({
    data: {
      restaurantId: session.user.restaurantId,
      orderId: parsed.data.orderId || null,
      amount: parsed.data.amount,
      method: parsed.data.method,
      status: parsed.data.status,
      reference: parsed.data.reference || null,
      note: parsed.data.note || null,
    },
    include: {
      order: { select: { id: true, orderNumber: true, customerName: true, total: true } },
    },
  });

  return NextResponse.json({ payment }, { status: 201 });
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

  const existing = await prisma.payment.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      ...(rest.method !== undefined ? { method: String(rest.method) } : {}),
      ...(rest.status !== undefined ? { status: String(rest.status).toUpperCase() } : {}),
      ...(rest.reference !== undefined
        ? { reference: rest.reference ? String(rest.reference) : null }
        : {}),
      ...(rest.note !== undefined ? { note: rest.note ? String(rest.note) : null } : {}),
      ...(rest.amount !== undefined ? { amount: Number(rest.amount) } : {}),
      ...(rest.orderId !== undefined
        ? { orderId: rest.orderId ? String(rest.orderId) : null }
        : {}),
    },
    include: {
      order: { select: { id: true, orderNumber: true, customerName: true, total: true } },
    },
  });

  return NextResponse.json({ payment });
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

  const existing = await prisma.payment.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.payment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
