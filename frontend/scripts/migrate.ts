import { PrismaClient } from "@prisma/client";

/**
 * One-time, non-destructive migration for new CRM fields.
 * - Promotes pre-existing user accounts to ADMIN (they were owners created before roles existed).
 * - Syncs Customer records from existing order contact details and links orders to customers.
 */
const prisma = new PrismaClient();

function normPhone(v: string | null | undefined) {
  if (!v) return null;
  return v.replace(/[\s+\-().]/g, "").toLowerCase();
}

async function main() {
  // 1. Promote pre-existing accounts to ADMIN
  const promoted = await prisma.user.updateMany({
    where: { role: "STAFF" },
    data: { role: "ADMIN" },
  });
  console.log(`Promoted ${promoted.count} existing users to ADMIN`);

  // 2. Sync customers from orders
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true },
  });

  let created = 0;
  let linked = 0;

  for (const { id: restaurantId } of restaurants) {
    const orders = await prisma.order.findMany({
      where: { restaurantId, customerId: null },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
      },
    });

    const existing = await prisma.customer.findMany({
      where: { restaurantId },
      select: { id: true, phone: true, email: true, name: true },
    });

    const match = (o: (typeof orders)[number]) =>
      existing.find((c) => {
        if (o.customerEmail && c.email && o.customerEmail.toLowerCase() === c.email.toLowerCase())
          return true;
        if (normPhone(o.customerPhone) && normPhone(c.phone) === normPhone(o.customerPhone))
          return true;
        return false;
      });

    for (const order of orders) {
      if (!order.customerName?.trim()) continue;
      let customer = match(order);
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            restaurantId,
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
  }

  console.log(`Created ${created} customers, linked ${linked} orders`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
