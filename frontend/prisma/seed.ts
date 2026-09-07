import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Bella Cucina demo data...");

  // Clean existing data for a clean demo
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const bella = await prisma.restaurant.create({
    data: {
      name: "Bella Cucina",
      slug: "bella-cucina",
      logo: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200&h=200&fit=crop",
      coverImage:
        "https://images.unsplash.com/photo-1558030006-450675393462?w=1400&h=700&fit=crop",
      description: "Delicious food, great mood! Explore our chef's special dishes made just for you.",
      phone: "+92 300 1234567",
      whatsapp: "+923001234567",
      address: "12 Gourmet Avenue, City Center",
      googleMapsUrl: "https://maps.google.com",
      openingHours: JSON.stringify({
        mon: "11:00–23:00",
        tue: "11:00–23:00",
        wed: "11:00–23:00",
        thu: "11:00–23:00",
        fri: "11:00–00:00",
        sat: "11:00–00:00",
        sun: "12:00–22:00",
      }),
      socialLinks: JSON.stringify({
        instagram: "https://instagram.com",
        facebook: "https://facebook.com",
      }),
    },
  });

  await prisma.user.create({
    data: {
      email: "admin@bellacucina.com",
      passwordHash,
      name: "Admin",
      restaurantId: bella.id,
    },
  });

  // 12 tables (demo highlights table 12)
  for (let n = 1; n <= 12; n++) {
    await prisma.table.create({
      data: {
        restaurantId: bella.id,
        tableNumber: n,
        uniqueCode: `bella-cucina-t${n}-${Math.random().toString(36).slice(2, 8)}`,
        active: true,
      },
    });
  }

  const categories = [
    {
      name: "Starters",
      items: [
        {
          name: "Garlic Bread",
          description: "Toasted ciabatta with garlic butter and herbs",
          price: 450,
          imageUrl:
            "https://images.unsplash.com/photo-1573140401552-3fab57d69659?w=600&h=400&fit=crop",
        },
        {
          name: "Bruschetta",
          description: "Tomato, basil, and olive oil on grilled bread",
          price: 550,
          imageUrl:
            "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&h=400&fit=crop",
        },
      ],
    },
    {
      name: "Pizza",
      items: [
        {
          name: "Margherita Pizza",
          description: "Tomato sauce, mozzarella, fresh basil",
          price: 1150,
          imageUrl:
            "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop",
        },
        {
          name: "Chicken Pizza",
          description: "Grilled chicken, peppers, mozzarella",
          price: 1450,
          imageUrl:
            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop",
        },
      ],
    },
    {
      name: "Burgers",
      items: [
        {
          name: "Classic Burger",
          description: "Beef patty, lettuce, tomato, house sauce",
          price: 950,
          imageUrl:
            "https://images.unsplash.com/photo-1568901346375-23c9450cfc0b?w=600&h=400&fit=crop",
        },
        {
          name: "Cheese Burger",
          description: "Double cheese, pickles, special sauce",
          price: 1050,
          imageUrl:
            "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=600&h=400&fit=crop",
        },
      ],
    },
    {
      name: "Pasta",
      items: [
        {
          name: "Creamy Alfredo Pasta",
          description: "Fettuccine in rich parmesan cream sauce",
          price: 1250,
          imageUrl:
            "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&h=400&fit=crop",
        },
        {
          name: "Pasta Alfredo",
          description: "Classic alfredo with herbs",
          price: 1190,
          imageUrl:
            "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop",
        },
      ],
    },
    {
      name: "Main Course",
      items: [
        {
          name: "Grilled Steak",
          description: "Chef's special grilled steak with herbs",
          price: 2450,
          imageUrl:
            "https://images.unsplash.com/photo-1558030006-450675393462?w=600&h=400&fit=crop",
        },
        {
          name: "Chicken Parmigiana",
          description: "Breaded chicken, tomato, mozzarella",
          price: 1650,
          imageUrl:
            "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=600&h=400&fit=crop",
        },
      ],
    },
    {
      name: "Drinks",
      items: [
        {
          name: "Coke",
          description: "Chilled soft drink",
          price: 180,
          imageUrl:
            "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&h=400&fit=crop",
        },
        {
          name: "Fresh Lemonade",
          description: "House lemonade with mint",
          price: 250,
          imageUrl:
            "https://images.unsplash.com/photo-1523677011783-c91d1bbe2fdc?w=600&h=400&fit=crop",
        },
      ],
    },
    {
      name: "Desserts",
      items: [
        {
          name: "Chocolate Lava Cake",
          description: "Warm chocolate cake with molten center",
          price: 650,
          imageUrl:
            "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600&h=400&fit=crop",
        },
        {
          name: "Tiramisu",
          description: "Classic Italian dessert",
          price: 750,
          imageUrl:
            "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&h=400&fit=crop",
        },
      ],
    },
  ];

  let sort = 0;
  for (const cat of categories) {
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: bella.id,
        name: cat.name,
        sortOrder: sort++,
      },
    });
    for (const item of cat.items) {
      await prisma.menuItem.create({
        data: {
          restaurantId: bella.id,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          available: true,
        },
      });
    }
  }

  // Keep a second restaurant for isolation testing
  const pizza = await prisma.restaurant.create({
    data: {
      name: "Pizza Palace",
      slug: "pizza-palace",
      description: "Wood-fired pizzas",
      phone: "+92 300 7654321",
      logo: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&h=200&fit=crop",
      coverImage:
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&h=600&fit=crop",
    },
  });
  await prisma.user.create({
    data: {
      email: "staff@pizzapalace.com",
      passwordHash,
      name: "Pizza Admin",
      restaurantId: pizza.id,
    },
  });
  await prisma.table.create({
    data: {
      restaurantId: pizza.id,
      tableNumber: 1,
      uniqueCode: "pizza-palace-t1-demo",
      active: true,
    },
  });

  console.log("Done!");
  console.log("Customer menu: /r/bella-cucina/t/12");
  console.log("Admin login: admin@bellacucina.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
