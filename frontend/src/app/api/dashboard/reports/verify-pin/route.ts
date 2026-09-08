import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/session";

/** Verify staff PIN before unlocking Reports. */
export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    if (!pin) {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }

    const expected = (process.env.REPORTS_PIN || "1234").trim();
    if (pin !== expected) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
