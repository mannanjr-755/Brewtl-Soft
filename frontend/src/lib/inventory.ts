import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Automatic inventory engine.
 *
 * There is no separate stock table: `MenuItem.stockQty` IS the stock level and
 * `stockQty === null` means "not tracked" (automation ignores that item).
 *
 * Stock is moved automatically from the order lifecycle:
 *   - an order is *counted* once it lands in Reports (status REPORTED)
 *   - moving into REPORTED deducts, moving back out restores
 *   - editing a counted order re-syncs the exact difference
 *   - deleting a counted order restores
 *
 * Because every call site knows the previous and the next order state, the
 * applied delta is always exact — no ledger table and no double deduction.
 */

type Db = Prisma.TransactionClient | PrismaClient;

export type InventoryLine = {
  menuItemId: string | null;
  quantity: number;
};

export type StockChange = {
  menuItemId: string;
  name: string;
  /** Signed change applied to stock (negative = sold). */
  delta: number;
  /** Resulting stock level, or null when the item is not tracked. */
  stockAfter: number | null;
  /** True when this change pushed the item out of stock. */
  soldOut: boolean;
  /** True when the item is at or below its low-stock threshold. */
  low: boolean;
};

export type InventorySyncResult = {
  /** True when at least one tracked item changed. */
  changed: boolean;
  changes: StockChange[];
  outOfStock: string[];
  lowStock: string[];
};

const EMPTY_RESULT: InventorySyncResult = {
  changed: false,
  changes: [],
  outOfStock: [],
  lowStock: [],
};

/** Orders that count as a finished sale and therefore consume stock. */
export function countsTowardsStock(status: string | null | undefined): boolean {
  return status === "REPORTED";
}

function sumByItem(items: InventoryLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.menuItemId || item.quantity <= 0) continue;
    map.set(item.menuItemId, (map.get(item.menuItemId) ?? 0) + item.quantity);
  }
  return map;
}

/**
 * Apply signed stock movements and keep menu availability in sync.
 *
 * `deltas` holds the change in *stock level* (negative = sold). Availability is
 * automated only on a 0 <-> non-zero transition, so an item that staff hid
 * manually while it still has stock stays hidden.
 */
async function applyDeltas(
  db: Db,
  restaurantId: string,
  deltas: Map<string, number>
): Promise<InventorySyncResult> {
  const wanted = [...deltas.entries()].filter(([, delta]) => delta !== 0);
  if (wanted.length === 0) return EMPTY_RESULT;

  const items = await db.menuItem.findMany({
    where: { restaurantId, id: { in: wanted.map(([id]) => id) } },
    select: {
      id: true,
      name: true,
      stockQty: true,
      lowStockThreshold: true,
      available: true,
    },
  });
  if (items.length === 0) return EMPTY_RESULT;

  const changes: StockChange[] = [];
  const outOfStock: string[] = [];
  const lowStock: string[] = [];

  for (const item of items) {
    // Untracked items are never touched by automation.
    if (item.stockQty === null) continue;

    const delta = deltas.get(item.id) ?? 0;
    if (delta === 0) continue;

    const previous = item.stockQty;
    const stockAfter = Math.max(0, previous + delta);

    // Auto show/hide only when crossing the zero line.
    let available = item.available;
    if (stockAfter === 0 && previous > 0) {
      available = false;
    } else if (previous === 0 && stockAfter > 0) {
      available = true;
    }

    await db.menuItem.update({
      where: { id: item.id },
      data: { stockQty: stockAfter, ...(available !== item.available ? { available } : {}) },
    });

    const low = stockAfter <= item.lowStockThreshold;
    if (stockAfter === 0) outOfStock.push(item.name);
    else if (low) lowStock.push(item.name);

    changes.push({
      menuItemId: item.id,
      name: item.name,
      delta,
      stockAfter,
      soldOut: stockAfter === 0,
      low,
    });
  }

  return { changed: changes.length > 0, changes, outOfStock, lowStock };
}

/**
 * Reconcile an order's stock footprint.
 *
 * `wasCounted` / `isCounted` are the order's counted state before and after
 * the change; the difference is applied to tracked items only.
 */
export async function syncOrderInventory(
  db: Db,
  args: {
    restaurantId: string;
    previousItems: InventoryLine[];
    nextItems: InventoryLine[];
    wasCounted: boolean;
    isCounted: boolean;
  }
): Promise<InventorySyncResult> {
  const previous = args.wasCounted ? sumByItem(args.previousItems) : new Map<string, number>();
  const next = args.isCounted ? sumByItem(args.nextItems) : new Map<string, number>();

  const ids = new Set<string>([...previous.keys(), ...next.keys()]);
  const deltas = new Map<string, number>();
  for (const id of ids) {
    // Stock must fall by whatever the order consumed, so the movement is the
    // consumed-now minus consumed-before.
    deltas.set(id, (previous.get(id) ?? 0) - (next.get(id) ?? 0));
  }

  return applyDeltas(db, args.restaurantId, deltas);
}

/** Return every unit of a counted order back to stock (order deleted). */
export async function releaseOrderInventory(
  db: Db,
  args: { restaurantId: string; items: InventoryLine[] }
): Promise<InventorySyncResult> {
  return syncOrderInventory(db, {
    restaurantId: args.restaurantId,
    previousItems: args.items,
    nextItems: [],
    wasCounted: true,
    isCounted: false,
  });
}

/**
 * Apply a manual stock level and mirror it into menu availability.
 * Used by the Inventory screen (restocking, tracking, thresholds).
 */
export async function setManualStock(
  db: Db,
  args: {
    restaurantId: string;
    menuItemId: string;
    stockQty: number | null;
  }
): Promise<{ stockQty: number | null; available: boolean }> {
  const item = await db.menuItem.findFirst({
    where: { id: args.menuItemId, restaurantId: args.restaurantId },
    select: { id: true, stockQty: true, available: true },
  });
  if (!item) throw new Error("ITEM_NOT_FOUND");

  if (args.stockQty === null) {
    // Stopping tracking must not change availability.
    await db.menuItem.update({ where: { id: item.id }, data: { stockQty: null } });
    return { stockQty: null, available: item.available };
  }

  const next = Math.max(0, Math.floor(args.stockQty));
  let available = item.available;
  if (next === 0 && (item.stockQty ?? 0) > 0) available = false;
  else if ((item.stockQty ?? 0) === 0 && next > 0) available = true;

  const updated = await db.menuItem.update({
    where: { id: item.id },
    data: { stockQty: next, ...(available !== item.available ? { available } : {}) },
    select: { stockQty: true, available: true },
  });
  return { stockQty: updated.stockQty, available: updated.available };
}

/** Human-readable one-liner for the UI to confirm what automation did. */
export function describeStockSync(result: InventorySyncResult): string | null {
  if (!result.changed) return null;
  const parts = result.changes.map(
    (c) => `${c.name} ${c.delta > 0 ? `+${c.delta}` : c.delta}`
  );
  return parts.join(", ");
}
