"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Printer } from "lucide-react";
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

/** Dedicated walking-customer POS — reuses existing menu API + order create + receipt print. */
export function WalkingCustomerManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [walkingBusyId, setWalkingBusyId] = useState<string | null>(null);

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

  async function handleWalkingCustomerOrder(item: MenuItem) {
    if (!item.available || walkingBusyId) return;
    setWalkingBusyId(item.id);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walkingCustomer: true,
          menuItemId: item.id,
          quantity: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not create walking-customer order.");
        return;
      }
      printOrderReceipt(data.order, data.restaurant);
      setMessage(`Receipt printed for ${item.name}.`);
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("Could not create walking-customer order.");
    } finally {
      setWalkingBusyId(null);
    }
  }

  const availableItems = categories.flatMap((cat) => cat.items.filter((i) => i.available));

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading menu…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--text)] sm:text-3xl">Walking Customer</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Tap an item to create a take-away order and print the receipt. Does not use table ordering.
        </p>
      </div>

      {message && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--gold-bright)]">
          {message}
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
        {availableItems.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No available menu items.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableItems.map((item) => (
              <button
                key={`walk-${item.id}`}
                type="button"
                disabled={walkingBusyId === item.id}
                onClick={() => handleWalkingCustomerOrder(item)}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3 text-left transition hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 disabled:opacity-60"
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
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  <Printer className="h-3 w-3" />
                  {walkingBusyId === item.id ? "…" : "Print"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
