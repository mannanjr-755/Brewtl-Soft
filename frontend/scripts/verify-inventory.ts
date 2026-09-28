/**
 * Self-check for the automatic inventory engine and the receipt builder.
 *
 * Run with:  npx tsx scripts/verify-inventory.ts
 *
 * Everything here is exercised against an in-memory fake Prisma handle, so it
 * needs no database and no test framework.
 */
import assert from "node:assert/strict";
import { buildReceiptHtml } from "@/lib/printReceipt";
import {
  countsTowardsStock,
  releaseOrderInventory,
  setManualStock,
  syncOrderInventory,
  type InventoryLine,
} from "@/lib/inventory";
import { generateOrderNumber } from "@/lib/orders";

type FakeItem = {
  id: string;
  name: string;
  stockQty: number | null;
  lowStockThreshold: number;
  available: boolean;
};

let failures = 0;
let passes = 0;

function check(label: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passes += 1;
      console.log(`  ok  ${label}`);
    })
    .catch((error: unknown) => {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAIL ${label}\n       ${message}`);
    });
}

/** Minimal in-memory stand-in for the two delegates the engine touches. */
function makeDb(seed: FakeItem[]) {
  const items = seed.map((i) => ({ ...i }));
  const byId = (id: string) => {
    const found = items.find((i) => i.id === id);
    if (!found) throw new Error(`no such item ${id}`);
    return found;
  };
  return {
    items,
    menuItem: {
      async findMany({ where }: { where: { id: { in: string[] } } }) {
        return where.id.in
          .map((id) => items.find((i) => i.id === id))
          .filter((i): i is FakeItem => Boolean(i))
          .map((i) => ({ ...i }));
      },
      async findFirst({ where }: { where: { id: string } }) {
        const found = items.find((i) => i.id === where.id);
        return found ? { ...found } : null;
      },
      async findFirstOrNull() {
        return null;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<FakeItem> }) {
        const target = byId(where.id);
        Object.assign(target, data);
        return { ...target };
      },
    },
  };
}

const line = (menuItemId: string | null, quantity: number): InventoryLine => ({
  menuItemId,
  quantity,
});

async function main() {
  console.log("\nautomatic inventory\n");

  await check("an order in Reports deducts every tracked line", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 10, lowStockThreshold: 2, available: true },
      { id: "b", name: "Muffin", stockQty: 4, lowStockThreshold: 1, available: true },
    ]);
    const res = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [],
      nextItems: [line("a", 3), line("b", 1)],
      wasCounted: false,
      isCounted: true,
    });
    assert.equal(res.changed, true);
    assert.equal(db.items[0].stockQty, 7);
    assert.equal(db.items[1].stockQty, 3);
  });

  await check("untracked items are never touched", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: null, lowStockThreshold: 2, available: true },
    ]);
    const res = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [],
      nextItems: [line("a", 5)],
      wasCounted: false,
      isCounted: true,
    });
    assert.equal(res.changed, false);
    assert.equal(db.items[0].stockQty, null);
  });

  await check("re-saving to Reports does not deduct twice", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 10, lowStockThreshold: 2, available: true },
    ]);
    const items = [line("a", 3)];
    const first = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [],
      nextItems: items,
      wasCounted: false,
      isCounted: true,
    });
    assert.equal(db.items[0].stockQty, 7);
    // Same order, same items, already counted -> no further movement.
    const second = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: items,
      nextItems: items,
      wasCounted: true,
      isCounted: true,
    });
    assert.equal(first.changed, true);
    assert.equal(second.changed, false);
    assert.equal(db.items[0].stockQty, 7);
  });

  await check("editing a counted order applies only the difference", async () => {
    // Stock 10 is the level *after* the original 3-unit sale; growing the line
    // to 5 must take 2 more, not another 5.
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 10, lowStockThreshold: 2, available: true },
    ]);
    const res = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [line("a", 3)],
      nextItems: [line("a", 5)],
      wasCounted: true,
      isCounted: true,
    });
    assert.equal(res.changed, true);
    assert.equal(db.items[0].stockQty, 8);
  });

  await check("removing a line from a counted order restores it", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 7, lowStockThreshold: 2, available: true },
    ]);
    await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [line("a", 3)],
      nextItems: [line("a", 3), line("b", 2)],
      wasCounted: true,
      isCounted: true,
    });
    // "b" is untracked, so only "a" moved (nothing to move for a).
    assert.equal(db.items[0].stockQty, 7);
  });

  await check("stock never goes below zero", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 2, lowStockThreshold: 1, available: true },
    ]);
    await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [],
      nextItems: [line("a", 9)],
      wasCounted: false,
      isCounted: true,
    });
    assert.equal(db.items[0].stockQty, 0);
  });

  await check("hitting zero hides the item from the menu", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 1, lowStockThreshold: 1, available: true },
    ]);
    const res = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [],
      nextItems: [line("a", 1)],
      wasCounted: false,
      isCounted: true,
    });
    assert.equal(db.items[0].stockQty, 0);
    assert.equal(db.items[0].available, false);
    assert.deepEqual(res.outOfStock, ["Latte"]);
  });

  await check("restocking brings a sold-out item back", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 0, lowStockThreshold: 1, available: false },
    ]);
    const res = await setManualStock(db as never, {
      restaurantId: "r1",
      menuItemId: "a",
      stockQty: 12,
    });
    assert.equal(res.stockQty, 12);
    assert.equal(res.available, true);
  });

  await check("an item hidden by hand stays hidden while it has stock", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 30, lowStockThreshold: 2, available: false },
    ]);
    const res = await setManualStock(db as never, {
      restaurantId: "r1",
      menuItemId: "a",
      stockQty: 40,
    });
    assert.equal(res.available, false);
  });

  await check("low stock is reported but stays on the menu", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 5, lowStockThreshold: 5, available: true },
    ]);
    const res = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [],
      nextItems: [line("a", 1)],
      wasCounted: false,
      isCounted: true,
    });
    assert.equal(db.items[0].stockQty, 4);
    assert.equal(db.items[0].available, true);
    assert.deepEqual(res.lowStock, ["Latte"]);
    assert.deepEqual(res.outOfStock, []);
  });

  await check("only orders in Reports consume stock", () => {
    assert.equal(countsTowardsStock("REPORTED"), true);
    assert.equal(countsTowardsStock("COMPLETED"), false);
    assert.equal(countsTowardsStock("NEW"), false);
    assert.equal(countsTowardsStock("READY"), false);
    assert.equal(countsTowardsStock(null), false);
  });

  await check("deleting a counted order returns its stock", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 5, lowStockThreshold: 2, available: true },
    ]);
    const res = await releaseOrderInventory(db as never, {
      restaurantId: "r1",
      items: [line("a", 2), line("a", 1)],
    });
    assert.equal(db.items[0].stockQty, 8);
    assert.equal(res.changed, true);
  });

  await check("deleting an order never seen in Reports changes nothing", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 5, lowStockThreshold: 2, available: true },
    ]);
    const res = await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [line("a", 2)],
      nextItems: [],
      wasCounted: false,
      isCounted: false,
    });
    assert.equal(res.changed, false);
    assert.equal(db.items[0].stockQty, 5);
  });

  await check("duplicate menu lines are summed", async () => {
    const db = makeDb([
      { id: "a", name: "Latte", stockQty: 10, lowStockThreshold: 2, available: true },
    ]);
    await syncOrderInventory(db as never, {
      restaurantId: "r1",
      previousItems: [],
      nextItems: [line("a", 2), line("a", 3)],
      wasCounted: false,
      isCounted: true,
    });
    assert.equal(db.items[0].stockQty, 5);
  });

  console.log("\norder numbers\n");

  await check("next number continues from the highest suffix", async () => {
    const db = {
      order: {
        async findFirst() {
          return { orderNumber: "BRE-0009" };
        },
      },
    };
    assert.equal(await generateOrderNumber("r1", "brewtl", db as never), "BRE-0010");
  });

  await check("a gap left by a deleted order is not reused", async () => {
    const db = {
      order: {
        async findFirst() {
          return { orderNumber: "BRE-0015" };
        },
      },
    };
    // count+1 would have produced BRE-0002 and collided.
    assert.equal(await generateOrderNumber("r1", "brewtl", db as never), "BRE-0016");
  });

  await check("prefix comes from the slug, with a safe fallback", async () => {
    const empty = { order: { async findFirst() { return null; } } };
    assert.equal(await generateOrderNumber("r1", "brewtl", empty as never), "BRE-0001");
    assert.equal(await generateOrderNumber("r1", "", empty as never), "ORD-0001");
  });

  console.log("\nreceipt\n");

  await check("receipt carries the brand, the totals and the footer", () => {
    const html = buildReceiptHtml(
      {
        orderNumber: "BRE-0007",
        customerName: "Walking Customer",
        orderType: "TAKE_AWAY",
        total: 900,
        createdAt: new Date("2026-03-04T10:30:00Z"),
        specialRequest: "Extra hot",
        items: [
          { itemName: "Latte", quantity: 2, unitPrice: 250, subtotal: 500 },
          { itemName: "Muffin <special> & \"cheese\"", quantity: 1, unitPrice: 400, subtotal: 400 },
        ],
        table: { tableNumber: 1 },
      },
      { name: "BREWTL", address: "12 Test Road", phone: "+92 300 1234567" }
    );

    assert.ok(html.startsWith("<!DOCTYPE html>"), "is a full document");
    assert.match(html, /src="\/logo\.png"/, "uses the BREWTL logo");
    assert.match(html, /Thank You!/, "shows the thank-you line");
    assert.match(html, /Powered by <b>Lexcore Solutions<\/b>/, "credits Lexcore Solutions");
    assert.match(html, /BRE-0007/, "shows the order number");
    assert.match(html, /BREWTL/, "shows the restaurant name");
    assert.match(html, /Take Away/, "shows the order type");
    assert.match(html, /Extra hot/, "shows the note");
    assert.ok(!html.includes("Table"), "hides the table for a walking customer");
    assert.ok(
      html.includes("Muffin &lt;special&gt; &amp; &quot;cheese&quot;"),
      "escapes user-controlled text"
    );
    assert.ok(!html.includes("<special>"), "never emits raw markup from an item name");
  });

  await check("a table order shows its table number", () => {
    const html = buildReceiptHtml(
      {
        orderNumber: "BRE-0008",
        customerName: "Ali",
        orderType: "DINE_IN",
        total: 500,
        createdAt: new Date("2026-03-04T10:30:00Z"),
        items: [{ itemName: "Latte", quantity: 1, unitPrice: 500, subtotal: 500 }],
        table: { tableNumber: 7 },
      },
      { name: "BREWTL" }
    );
    assert.match(html, /Table/);
    assert.match(html, />7</);
  });

  console.log(
    `\n${failures === 0 ? "PASS" : "FAIL"} — ${passes} passed, ${failures} failed\n`
  );
  if (failures > 0) process.exit(1);
}

void main();
