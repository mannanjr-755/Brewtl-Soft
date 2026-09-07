import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  restaurantName: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  adminName: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { restaurantName, slug, adminName, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existingSlug = await prisma.restaurant.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json({ error: "This restaurant URL slug is already taken" }, { status: 409 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const restaurant = await prisma.restaurant.create({
      data: {
        name: restaurantName,
        slug,
        users: {
          create: {
            email: normalizedEmail,
            name: adminName,
            passwordHash,
            role: "ADMIN",
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
