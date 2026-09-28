import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

/** Any Prisma client handle — the root client or an interactive transaction. */
type Db = Prisma.TransactionClient | PrismaClient;

const ORDER_INCLUDE = { items: true, table: true } as const;

function orderPrefix(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  // Multi-word slugs read better as initials (pizza-palace -> PP).
  if (parts.length > 1) {
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("").slice(0, 3) || "ORD";
  }
  // A single word gives a one-letter prefix, so keep the first three letters
  // instead (brewtl -> BRE, not B).
  return (parts[0] ?? "").slice(0, 3).toUpperCase() || "ORD";
}

/**
 * Generate the next order number for a restaurant, e.g. BRE-0007.
 *
 * Uses the highest existing suffix rather than `count + 1` so deleting orders
 * can never hand out a number that is already taken (which would break the
 * `@@unique([restaurantId, orderNumber])` constraint).
 */
export async function generateOrderNumber(
  restaurantId: string,
  slug: string,
  db: Db = prisma
): Promise<string> {
  const prefix = orderPrefix(slug);

  const last = await db.order.findFirst({
    where: { restaurantId, orderNumber: { startsWith: `${prefix}-` } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  const lastSeq = last ? parseInt(last.orderNumber.slice(prefix.length + 1), 10) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

function isOrderNumberConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes("orderNumber")
  );
}

export type CreatedOrder = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/**
 * Create an order with a guaranteed-unique order number.
 *
 * Two cashiers can finish a sale in the same instant, so the unique index is
 * the real guard: a losing writer simply takes the next number and retries.
 * Runs on the supplied handle so it can take part in a caller's transaction.
 */
export async function createOrderWithRetry(
  db: Db,
  args: {
    restaurantId: string;
    slug: string;
    build: (orderNumber: string) => Prisma.OrderCreateArgs;
  }
): Promise<CreatedOrder> {
  const MAX_ATTEMPTS = 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const orderNumber = await generateOrderNumber(args.restaurantId, args.slug, db);
    try {
      return await db.order.create({
        ...args.build(orderNumber),
        include: ORDER_INCLUDE,
      });
    } catch (error) {
      if (!isOrderNumberConflict(error)) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not allocate a unique order number");
}
