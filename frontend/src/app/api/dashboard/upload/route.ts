import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/session";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function uploadDirs() {
  // Customer menu is served by restaurantorder — store images where that app can serve them.
  const customerPublic =
    process.env.CUSTOMER_PUBLIC_DIR?.trim() ||
    path.resolve(process.cwd(), "..", "..", "restaurantorder", "public");

  return [
    path.join(customerPublic, "uploads", "menu"),
    // Also keep a local copy so CRM dashboard previews work on :3001.
    path.join(process.cwd(), "public", "uploads", "menu"),
  ];
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WEBP, or GIF image" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 2MB" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const dirs = uploadDirs();

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);
  }

  const url = `/uploads/menu/${filename}`;
  return NextResponse.json({ url });
}
