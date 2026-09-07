import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

/** List recent table service requests (Call Waiter / Request Bill) for CRM notifications */
export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const since = searchParams.get("since");

  const requests = await prisma.tableRequest.findMany({
    where: {
      restaurantId: session.user.restaurantId,
      ...(status === "PENDING" || status === "ACKNOWLEDGED" ? { status } : {}),
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    include: {
      table: { select: { tableNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      status: r.status,
      tableNumber: r.table.tableNumber,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    serverTime: new Date().toISOString(),
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACKNOWLEDGED"]),
});

/** Acknowledge a table service request */
export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const existing = await prisma.tableRequest.findFirst({
      where: {
        id: parsed.data.id,
        restaurantId: session.user.restaurantId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updated = await prisma.tableRequest.update({
      where: { id: existing.id },
      data: { status: parsed.data.status },
      include: { table: { select: { tableNumber: true } } },
    });

    return NextResponse.json({
      request: {
        id: updated.id,
        type: updated.type,
        message: updated.message,
        status: updated.status,
        tableNumber: updated.table.tableNumber,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update table request error:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
