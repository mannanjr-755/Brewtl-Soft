import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_WALLET", "OTHER"] as const;
const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED", "FAILED"] as const;

const rowSchema = z.object({
  amount: z.number().positive().optional(),
  method: z.string().optional(),
  status: z.string().optional(),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
});

const bodySchema = z.object({
  rows: z.array(z.record(z.string(), z.any())).min(1).max(500),
});

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeKey(k), v);
  }
  for (const alias of aliases) {
    if (map.has(alias)) return map.get(alias);
  }
  return undefined;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toString(value: unknown) {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function normalizeMethod(value?: string) {
  const v = (value ?? "CASH").toUpperCase().replace(/\s+/g, "_");
  return (PAYMENT_METHODS as readonly string[]).includes(v) ? (v as (typeof PAYMENT_METHODS)[number]) : "OTHER";
}

function normalizeStatus(value?: string) {
  const v = (value ?? "PAID").toUpperCase();
  return (PAYMENT_STATUSES as readonly string[]).includes(v) ? (v as (typeof PAYMENT_STATUSES)[number]) : "PAID";
}

/**
 * Import Excel/CSV-parsed rows into existing Payments (and optional Customers).
 * Expected columns (flexible headers): amount, method, status, reference, note,
 * customerName/name, customerPhone/phone, customerEmail/email.
 */
export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid import payload. Provide a non-empty rows array (max 500)." },
      { status: 400 }
    );
  }

  const restaurantId = session.user.restaurantId;
  let paymentsCreated = 0;
  let customersCreated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const preview: { amount?: number; customerName?: string; method?: string; status?: string }[] = [];

  for (let i = 0; i < parsedBody.data.rows.length; i++) {
    const raw = parsedBody.data.rows[i];
    const mapped = {
      amount: toNumber(pick(raw, ["amount", "total", "revenue", "price", "payment"])),
      method: toString(pick(raw, ["method", "paymentmethod", "paymethod"])),
      status: toString(pick(raw, ["status", "paymentstatus"])),
      reference: toString(pick(raw, ["reference", "ref", "ordernumber", "order"])),
      note: toString(pick(raw, ["note", "notes", "description", "remark"])),
      customerName: toString(pick(raw, ["customername", "name", "customer"])),
      customerPhone: toString(pick(raw, ["customerphone", "phone", "mobile"])),
      customerEmail: toString(pick(raw, ["customeremail", "email"])),
    };

    const parsed = rowSchema.safeParse(mapped);
    if (!parsed.success) {
      skipped += 1;
      errors.push(`Row ${i + 1}: invalid data`);
      continue;
    }

    const row = parsed.data;
    if (!row.amount && !row.customerName) {
      skipped += 1;
      errors.push(`Row ${i + 1}: missing amount and customer name`);
      continue;
    }

    try {
      if (row.customerName) {
        const existing = await prisma.customer.findFirst({
          where: {
            restaurantId,
            OR: [
              row.customerEmail ? { email: row.customerEmail } : undefined,
              row.customerPhone ? { phone: row.customerPhone } : undefined,
              { name: row.customerName },
            ].filter(Boolean) as { email?: string; phone?: string; name?: string }[],
          },
        });
        if (!existing) {
          await prisma.customer.create({
            data: {
              restaurantId,
              name: row.customerName,
              phone: row.customerPhone || null,
              email: row.customerEmail || null,
            },
          });
          customersCreated += 1;
        }
      }

      if (row.amount) {
        await prisma.payment.create({
          data: {
            restaurantId,
            amount: row.amount,
            method: normalizeMethod(row.method),
            status: normalizeStatus(row.status),
            reference: row.reference || null,
            note: row.note || (row.customerName ? `Imported for ${row.customerName}` : "Imported from Excel"),
          },
        });
        paymentsCreated += 1;
        preview.push({
          amount: row.amount,
          customerName: row.customerName || undefined,
          method: normalizeMethod(row.method),
          status: normalizeStatus(row.status),
        });
      }
    } catch (e) {
      skipped += 1;
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (paymentsCreated === 0 && customersCreated === 0) {
    return NextResponse.json(
      {
        error:
          "No valid rows imported. Use columns like amount, method, status, reference, note, customerName, customerPhone, customerEmail.",
        errors: errors.slice(0, 10),
        skipped,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    paymentsCreated,
    customersCreated,
    skipped,
    errors: errors.slice(0, 10),
    preview: preview.slice(0, 20),
  });
}
