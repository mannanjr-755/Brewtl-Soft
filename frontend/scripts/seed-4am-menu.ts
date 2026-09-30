/**
 * Wipe old menu categories/items and seed the official Brewtl Cafe menu
 * into the connected DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MENU: { name: string; items: string[] }[] = [
  {
    name: "Chicken",
    items: [
      "Chicken Peshawari Karahi",
      "Chicken Shinwari Karahi",
      "Chicken Brown Karahi",
      "Chicken Balochi Karahi",
      "Chicken White Karahi",
    ],
  },
  {
    name: "Handi",
    items: ["Chicken Mughlai Handi", "Chicken Paneer Reshmi"],
  },
  {
    name: "Tandoor",
    items: ["Farmaishi Chapati", "Paratha"],
  },
  {
    name: "Chicken Biryani",
    items: [
      "Chicken Biryani (Single)",
      "Chicken Biryani (Double)",
      "Tikka Biryani (Single)",
      "Tikka Biryani (Double)",
      "Sada Biryani",
    ],
  },
  {
    name: "Chicken Kabab",
    items: ["Chicken Turkish Kabab", "Chicken Gola Kabab", "Chicken Reshmi Kabab"],
  },
  {
    name: "Chicken B.B.Q",
    items: [
      "Chicken Tikka (Leg)",
      "Chicken Tikka (Chest)",
      "Behari Tikka (Leg)",
      "Behari Tikka (Chest)",
      "Malai Tikka (Leg)",
      "Malai Tikka (Chest)",
      "Special Boti",
      "Chicken Boti",
      "Chicken Behari Boti",
      "Chicken Malai Boti",
      "Chicken Afghani Boti",
    ],
  },
  {
    name: "Chicken Rolls",
    items: [
      "Chicken Chatni Roll",
      "Chicken Bihari Roll",
      "Chicken Malai Roll",
      "Chicken Kabab Roll",
    ],
  },
  {
    name: "Beef Biryani",
    items: [
      "Beef Biryani (Single)",
      "Beef Biryani (Double)",
      "Beef White Biryani (Single)",
      "Beef White Biryani (Double)",
    ],
  },
  {
    name: "Beef Kabab",
    items: ["Beef Seekh Kabab", "Beef Behari Kabab", "Beef Gola Kabab"],
  },
  {
    name: "Beef B.B.Q",
    items: ["Beef Boti", "Beef Behari Boti", "Beef Afghani Boti"],
  },
  {
    name: "Beef Roll",
    items: ["Beef Chatni Roll", "Beef Bihari Roll", "Beef Kabab Roll"],
  },
  {
    name: "Beef Fry Kabab",
    items: ["Beef Fry Kabab"],
  },
  {
    name: "Beverages & Sides",
    items: ["Can", "Small Water", "Large Water", "Raita", "Salad"],
  },
];

async function main() {
  console.log("Connecting and syncing Brewtl Cafe menu...");

  let restaurant = await prisma.restaurant.findUnique({ where: { slug: "brewtl" } });
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: "Brewtl",
        slug: "brewtl",
        description: "Coffee & more — ice tea, hot coffees, mojitos, chillers, frappe, ice coffees.",
        phone: "+92 300 1234567",
        whatsapp: "+923001234567",
        address: "Brewtl Cafe",
        openingHours: JSON.stringify({
          mon: "11:00–23:00",
          tue: "11:00–23:00",
          wed: "11:00–23:00",
          thu: "11:00–23:00",
          fri: "11:00–00:00",
          sat: "11:00–00:00",
          sun: "12:00–22:00",
        }),
      },
    });
    console.log("Created restaurant:", restaurant.slug);
  } else {
    restaurant = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { name: "Brewtl" },
    });
    console.log("Using restaurant:", restaurant.slug);
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { email: "admin@brewtl.com" },
    update: {
      passwordHash,
      active: true,
      role: "ADMIN",
      name: "Admin",
      restaurantId: restaurant.id,
    },
    create: {
      email: "admin@brewtl.com",
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      restaurantId: restaurant.id,
    },
  });

  const tableCount = await prisma.table.count({ where: { restaurantId: restaurant.id } });
  if (tableCount === 0) {
    for (let n = 1; n <= 12; n++) {
      await prisma.table.create({
        data: {
          restaurantId: restaurant.id,
          tableNumber: n,
          uniqueCode: `brewtl-t${n}-${Math.random().toString(36).slice(2, 8)}`,
          active: true,
        },
      });
    }
    console.log("Created 12 tables");
  }

  // Detach order lines from menu items, then wipe categories/items.
  await prisma.orderItem.updateMany({ data: { menuItemId: null } });
  await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.menuCategory.deleteMany({ where: { restaurantId: restaurant.id } });
  console.log("Deleted old menu for restaurant");

  let itemCount = 0;
  for (let i = 0; i < MENU.length; i++) {
    const cat = MENU[i];
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: cat.name,
        sortOrder: i,
      },
    });
    const created = await prisma.menuItem.createMany({
        data: cat.items.map((name) => ({
        restaurantId: restaurant.id,
        categoryId: category.id,
          name,
          price: 0,
        available: true,
      })),
    });
    itemCount += created.count;
  }

  console.log(`Seeded ${MENU.length} categories, ${itemCount} items`);
  console.log("Admin login: admin@brewtl.com / password123");
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[retry ${i}/${attempts}] ${label}:`, (err as Error)?.message ?? err);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

withRetry("seed-brewtl-menu", main)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
