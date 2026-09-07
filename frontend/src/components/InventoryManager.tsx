"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type InventoryItem = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  stockQty: number | null;
  lowStockThreshold: number;
  category: { id: string; name: string };
};

export function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { qty: number | null; threshold: number }>>(
    {}
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low">("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/inventory");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function draft(item: InventoryItem) {
    return (
      drafts[item.id] ?? { qty: item.stockQty, threshold: item.lowStockThreshold }
    );
  }

  async function save(item: InventoryItem) {
    const d = draft(item);
    setSavingId(item.id);
    setMessage(null);
    const res = await fetch("/api/dashboard/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, stockQty: d.qty, lowStockThreshold: d.threshold }),
    });
    setSavingId(null);
    if (res.ok) {
      setMessage(`Saved ${item.name}.`);
      const data = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      const data = await res.json();
      setMessage(data.error || "Save failed.");
    }
  }

  const tracked = items.filter((i) => i.stockQty !== null);
  const lowStock = tracked.filter((i) => (i.stockQty ?? 0) <= i.lowStockThreshold);
  const totalValue = items.reduce(
    (sum, i) => sum + (i.stockQty ?? 0) * i.price,
    0
  );

  const visible =
    filter === "all" ? items : items.filter((i) => i.stockQty !== null && (i.stockQty ?? 0) <= i.lowStockThreshold);

  const grouped = new Map<string, InventoryItem[]>();
  for (const item of visible) {
    const list = grouped.get(item.category.name) ?? [];
    list.push(item);
    grouped.set(item.category.name, list);
  }

  if (loading) {
    return <p className="text-sm text-[#a8a29e]">Loading inventory…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Inventory</h1>
        <p className="mt-1 text-sm text-[#a8a29e]">
          Track stock for menu items. Items without a stock count are not tracked.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-[#a8a29e]">Tracked items</p>
          <p className="mt-1 text-2xl font-semibold text-white">{tracked.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-[#a8a29e]">Low / out of stock</p>
          <p className="mt-1 text-2xl font-semibold text-red-300">{lowStock.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-[#a8a29e]">Stock value</p>
          <p className="mt-1 text-2xl font-semibold text-[#f0c14b]">{formatMoney(totalValue)}</p>
        </div>
      </div>

      {message && <p className="text-sm text-[#e8c547]">{message}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs ${
            filter === "all"
              ? "bg-[#d4a017]/20 text-[#e8c547] ring-1 ring-[#d4a017]/40"
              : "border border-white/10 text-[#a8a29e]"
          }`}
        >
          All items
        </button>
        <button
          type="button"
          onClick={() => setFilter("low")}
          className={`rounded-lg px-3 py-1.5 text-xs ${
            filter === "low"
              ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/40"
              : "border border-white/10 text-[#a8a29e]"
          }`}
        >
          Low stock only ({lowStock.length})
        </button>
      </div>

      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[#78716c]">
          {filter === "low" ? "Nothing is low on stock right now." : "No menu items found."}
        </p>
      )}

      {[...grouped.entries()].map(([catName, list]) => (
        <section key={catName}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#a8a29e]">
            {catName}
          </h3>
          <div className="space-y-2">
            {list.map((item) => {
              const d = draft(item);
              const low = d.qty !== null && d.qty <= d.threshold;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-white">
                      {item.name}
                      {low && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/30">
                          <AlertTriangle className="h-3 w-3" /> Low stock
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#78716c]">
                      {formatMoney(item.price)} · {item.available ? "Available" : "Hidden"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={d.qty === null}
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft(item), qty: Math.max(0, (d.qty ?? 0) - 1) },
                          }))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        disabled={d.qty === null}
                        value={d.qty ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...draft(item),
                              qty: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                            },
                          }))
                        }
                        className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm outline-none focus:border-[#d4a017] disabled:opacity-40"
                      />
                      <button
                        type="button"
                        disabled={d.qty === null}
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft(item), qty: (d.qty ?? 0) + 1 },
                          }))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#a8a29e]">
                      <span>Low at</span>
                      <input
                        type="number"
                        min={0}
                        value={d.threshold}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...draft(item),
                              threshold: Math.max(0, Number(e.target.value)),
                            },
                          }))
                        }
                        className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm outline-none focus:border-[#d4a017]"
                      />
                    </div>

                    {d.qty === null ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft(item), qty: 0 },
                          }))
                        }
                        className="rounded-lg border border-[#d4a017]/50 bg-[#d4a017]/10 px-2.5 py-1.5 text-xs font-semibold text-[#e8c547]"
                      >
                        Start tracking
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft(item), qty: null } }))}
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs ring-1 ring-white/10 hover:bg-white/10"
                        title="Stop tracking this item"
                      >
                        Stop
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => save(item)}
                      className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#000000] disabled:opacity-50"
                    >
                      {savingId === item.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
