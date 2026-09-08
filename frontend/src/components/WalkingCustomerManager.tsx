"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { printOrderReceipt } from "@/lib/printReceipt";
import { formatMoney } from "@/lib/utils";

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

/** Dedicated walking-customer POS — reuses existing menu API + order create + receipt print. */
export function WalkingCustomerManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

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

  const availableItems = useMemo(
    () => categories.flatMap((cat) => cat.items.filter((i) => i.available)),
    [categories]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q)
    );
  }, [availableItems, search]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0),
    [cart]
  );

  function addToCart(item: MenuItem) {
    setMessage(null);
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
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

  async function printCartReceipt() {
    if (cart.length === 0 || checkoutBusy) return;
    setCheckoutBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walkingCustomer: true,
          items: cart.map((line) => ({
            menuItemId: line.item.id,
            quantity: line.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not create walking-customer order.");
        return;
      }
      printOrderReceipt(data.order, data.restaurant);
      setCart([]);
      setMessage(`Receipt printed for order ${data.order.orderNumber}.`);
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Could not create walking-customer order.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading menu…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--text)] sm:text-3xl">Walking Customer</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Search the menu, add items to the order, then print the receipt. Does not use table ordering.
        </p>
      </div>

      {message && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--gold-bright)]">
          {message}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search any food or menu item…"
              className="input-theme w-full rounded-xl py-2.5 pl-10 pr-3 text-sm"
            />
          </div>

          {filteredItems.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">
              {search.trim() ? "No menu items match your search." : "No available menu items."}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <div
                  key={`walk-${item.id}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImagePlus className="h-4 w-4 text-[var(--text-dim)]" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">{item.name}</p>
                    <p className="text-xs text-[var(--gold-bright)]">{formatMoney(item.price)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5 xl:sticky xl:top-4 xl:self-start">
          <h2 className="font-medium text-[var(--text)]">Current order</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {cart.length === 0 ? "Add items from the menu." : `${cart.length} line(s) in cart`}
          </p>

          {cart.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-dim)]">Cart is empty.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {cart.map((line) => (
                <li
                  key={line.item.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{line.item.name}</p>
                      <p className="text-xs text-[var(--gold-bright)]">
                        {formatMoney(line.item.price * line.quantity)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(line.item.id)}
                      className="rounded-lg p-1 text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-300"
                      aria-label={`Remove ${line.item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(line.item.id, -1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text)]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm tabular-nums text-[var(--text)]">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(line.item.id, 1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text)]"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-sm">
            <span className="text-[var(--text-muted)]">Total</span>
            <span className="font-semibold text-[var(--gold-bright)]">{formatMoney(cartTotal)}</span>
          </div>

          <button
            type="button"
            disabled={cart.length === 0 || checkoutBusy}
            onClick={() => void printCartReceipt()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold)] py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:brightness-110 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {checkoutBusy ? "Printing…" : "Print Receipt"}
          </button>
        </aside>
      </div>
    </div>
  );
}
