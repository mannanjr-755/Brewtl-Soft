"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Minus, Plus, Printer, Search, ShoppingBag, Trash2 } from "lucide-react";
import { printOrderReceipt, type ReceiptRestaurant } from "@/lib/printReceipt";
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

function MenuItemImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--bg-soft)]">
      {showFallback ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[var(--text-dim)]">
          <ImagePlus className="h-7 w-7" />
          <span className="text-[10px] uppercase tracking-wide">No image</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/** Dedicated walking-customer POS — Save goes to Reports; Print prints receipt. */
export function WalkingCustomerManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<ReceiptRestaurant | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.restaurant) {
          setRestaurantInfo({
            name: data.restaurant.name,
            phone: data.restaurant.phone,
            address: data.restaurant.address,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function saveOrderToReports() {
    if (cart.length === 0 || checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const data = await createReportsOrder();
      setCart([]);
      toast.success(`Order ${data.order.orderNumber} saved to Reports.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create walking-customer order.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function printCartReceipt() {
    if (cart.length === 0 || checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      let restaurant = restaurantInfo;
      if (!restaurant) {
        const res = await fetch("/api/dashboard/profile", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.restaurant) {
            restaurant = {
              name: data.restaurant.name,
              phone: data.restaurant.phone,
              address: data.restaurant.address,
            };
            setRestaurantInfo(restaurant);
          }
        }
      }

      const items = cart.map((line) => ({
        itemName: line.item.name,
        quantity: line.quantity,
        unitPrice: line.item.price,
        subtotal: line.item.price * line.quantity,
      }));

      printOrderReceipt(
        {
          orderNumber: `WC-${Date.now().toString(36).toUpperCase()}`,
          customerName: "Walking Customer",
          orderType: "TAKE_AWAY",
          total: cartTotal,
          createdAt: new Date(),
          items,
          table: null,
        },
        restaurant ?? undefined
      );
      toast.success("Receipt sent to printer.");
    } catch {
      toast.error("Could not print walking-customer receipt.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading menu…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-[var(--text)] sm:text-3xl">Walking Customer</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Search the menu, add items to Current Order, then Save to Reports or Print Receipt.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Menu</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {filteredItems.length} available item{filteredItems.length === 1 ? "" : "s"}
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

          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
              <p className="text-sm text-[var(--text-dim)]">
                {search.trim() ? "No menu items match your search." : "No available menu items."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <article
                  key={`walk-${item.id}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow)] transition hover:border-[var(--gold)]/35"
                >
                  <MenuItemImage src={item.imageUrl} alt={item.name} />
                  <div className="flex flex-1 flex-col gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]">
                        {item.name}
                      </h3>
                      <p className="mt-1.5 text-sm font-semibold tabular-nums text-[var(--gold-bright)]">
                        {formatMoney(item.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </article>
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
              onClick={() => void saveOrderToReports()}
              className="w-full rounded-xl bg-[var(--gold)] py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {checkoutBusy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={cart.length === 0 || checkoutBusy}
              onClick={() => void printCartReceipt()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] py-3 text-sm font-bold uppercase tracking-wide text-[var(--text)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-bright)] disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {checkoutBusy ? "Printing…" : "Print Receipt"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
