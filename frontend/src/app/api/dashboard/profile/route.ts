import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
  });

  return NextResponse.json({ restaurant });
}

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const restaurant = await prisma.restaurant.update({
    where: { id: session.user.restaurantId },
    data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.logo !== undefined ? { logo: body.logo || null } : {}),
      ...(body.coverImage !== undefined ? { coverImage: body.coverImage || null } : {}),
      ...(body.description !== undefined ? { description: body.description || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp || null } : {}),
      ...(body.address !== undefined ? { address: body.address || null } : {}),
      ...(body.googleMapsUrl !== undefined
        ? { googleMapsUrl: body.googleMapsUrl || null }
        : {}),
      ...(body.openingHours !== undefined
        ? {
            openingHours:
              typeof body.openingHours === "string"
                ? body.openingHours
                : JSON.stringify(body.openingHours),
          }
        : {}),
      ...(body.socialLinks !== undefined
        ? {
            socialLinks:
              typeof body.socialLinks === "string"
                ? body.socialLinks
                : JSON.stringify(body.socialLinks),
          }
        : {}),
    },
  });

  return NextResponse.json({ restaurant });
}
