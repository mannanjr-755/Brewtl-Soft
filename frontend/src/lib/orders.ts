import { prisma } from "@/lib/prisma";

/** Generate next order number for a restaurant, e.g. BH-0001 */
export async function generateOrderNumber(restaurantId: string, slug: string): Promise<string> {
  const prefix = slug
    .split("-")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3) || "ORD";

  const count = await prisma.order.count({ where: { restaurantId } });
  const next = count + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
