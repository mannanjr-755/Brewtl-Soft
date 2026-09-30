"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Minus, Plus, Printer, Search, ShoppingBag, Trash2 } from "lucide-react";
import { printOrderReceipt, type BillingOptions, type ReceiptRestaurant } from "@/lib/printReceipt";
import { PrintBillingDialog } from "@/components/PrintBillingDialog";
import { formatMoney } from "@/lib/utils";
import { toast } from "@/components/ToastProvider";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  categoryId: string;
};

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

type CartLine = {
  item: MenuItem;
  quantity: number;
};

/** Dedicated walking-customer POS — printing also saves the order to Reports. */
export function WalkingCustomerManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const filteredByCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        items: cat.items
          .filter((item) => item.available)
          .filter(
            (item) =>
              !q ||
              item.name.toLowerCase().includes(q) ||
              (item.description ?? "").toLowerCase().includes(q)
          ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, search]);

  const filteredCount = useMemo(
    () => filteredByCategory.reduce((sum, cat) => sum + cat.items.length, 0),
    [filteredByCategory]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0),
    [cart]
  );

  const draftPrintOrder = useMemo(
    () => ({
      orderNumber: "WALK-IN",
      customerName: "Walking Customer",
      orderType: "TAKE_AWAY",
      total: cartTotal,
      createdAt: new Date(),
      items: cart.map((line) => ({
        itemName: line.item.name,
        quantity: line.quantity,
        unitPrice: line.item.price,
        subtotal: line.item.price * line.quantity,
      })),
    }),
    [cart, cartTotal]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart]
  );

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    toast.success(`${item.name} added to order`);
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.item.id === itemId
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((line) => line.item.id !== itemId));
  }

  /** Create walking order as REPORTED (Reports only — not Kitchen). */
  async function createReportsOrder() {
    const res = await fetch("/api/dashboard/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walkingCustomer: true,
        saveToReports: true,
        items: cart.map((line) => ({
          menuItemId: line.item.id,
          quantity: line.quantity,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not create walking-customer order.");
    }
    return data as {
      order: {
        orderNumber: string;
        customerName: string;
        orderType?: string;
        total: number;
        createdAt: string;
        status: string;
        items: { itemName: string; quantity: number; unitPrice: number; subtotal: number }[];
        table?: { tableNumber: number } | null;
      };
      restaurant: ReceiptRestaurant;
    };
  }

  async function printCartReceipt(options: BillingOptions) {
    if (cart.length === 0 || checkoutBusy) return;
    setCheckoutBusy(true);
    let savedOrderNumber: string | null = null;
    try {
      const data = await createReportsOrder();
      savedOrderNumber = data.order.orderNumber;
      setCart([]);
      setBillingOpen(false);
      await printOrderReceipt(data.order, data.restaurant, options);
      toast.success(`Order ${savedOrderNumber} saved to Reports. KOT, then bill, sent to printer.`);
    } catch (error) {
      toast.error(
        savedOrderNumber
          ? `Order ${savedOrderNumber} was saved to Reports, but printing failed.`
          : error instanceof Error
            ? error.message
            : "Could not create walking-customer order."
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading menu…</p>;
  }

  return (
    <div className="space-y-5">
      <PrintBillingDialog
        open={billingOpen}
        order={draftPrintOrder}
        busy={checkoutBusy}
        onCancel={() => {
          if (!checkoutBusy) setBillingOpen(false);
        }}
        onConfirm={(options) => void printCartReceipt(options)}
      />
      <div>
        <h1 className="font-display text-2xl text-[var(--text)] sm:text-3xl">Walking Customer</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Search the menu, add items to Current Order, then print. Confirm GST and discount, then kitchen KOT prints first and the bill after.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Menu</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {filteredCount} available item{filteredCount === 1 ? "" : "s"}
                {filteredByCategory.length > 0
                  ? ` · ${filteredByCategory.length} categor${filteredByCategory.length === 1 ? "y" : "ies"}`
                  : ""}
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search any food or menu item…"
                className="input-theme w-full rounded-xl py-2.5 pl-10 pr-3 text-sm"
              />
            </div>
          </div>

          {filteredByCategory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
              <p className="text-sm text-[var(--text-dim)]">
                {search.trim() ? "No menu items match your search." : "No available menu items."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredByCategory.map((cat) => (
                <section key={cat.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-3 border-b border-[var(--border)] pb-2">
                    <h3 className="font-display text-lg text-[var(--gold-bright)]">{cat.name}</h3>
                    <span className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">
                      {cat.items.length} item{cat.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {cat.items.map((item) => (
                      <article
                        key={`walk-${item.id}`}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 transition hover:border-[var(--gold)]/35"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-[var(--text)]">
                            {item.name}
                          </h4>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--gold-bright)]">
                            {formatMoney(item.price)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <aside className="flex h-fit flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] xl:sticky xl:top-4">
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold-bright)]">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-[var(--text)]">Current Order</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {cart.length === 0
                  ? "Add items from the menu."
                  : `${cartCount} item${cartCount === 1 ? "" : "s"} · ${cart.length} line${cart.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <div className="max-h-[min(52vh,420px)] overflow-y-auto px-4 py-4 sm:px-5">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-10 text-center">
                <p className="text-sm text-[var(--text-dim)]">Cart is empty.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {cart.map((line) => (
                  <li
                    key={line.item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]">
                        {line.item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={line.item.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImagePlus className="h-4 w-4 text-[var(--text-dim)]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--text)]">
                            {line.item.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(line.item.id)}
                            className="rounded-lg p-1 text-[var(--text-dim)] transition hover:bg-red-500/10 hover:text-red-300"
                            aria-label={`Remove ${line.item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--gold-bright)]">
                          {formatMoney(line.item.price * line.quantity)}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQty(line.item.id, -1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)] transition hover:border-[var(--gold)]/40"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums text-[var(--text)]">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(line.item.id, 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)] transition hover:border-[var(--gold)]/40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-auto space-y-3 border-t border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Total</span>
              <span className="text-base font-semibold tabular-nums text-[var(--gold-bright)]">
                {formatMoney(cartTotal)}
              </span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0 || checkoutBusy}
              onClick={() => setBillingOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] py-3 text-sm font-bold uppercase tracking-wide text-[var(--text)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-bright)] disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {checkoutBusy ? "Saving & printing…" : "Print KOT & Bill"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
