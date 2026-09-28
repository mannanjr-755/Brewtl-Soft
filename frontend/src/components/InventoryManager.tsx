"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Minus, Plus, Sparkles, Zap } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { toast } from "@/components/ToastProvider";

type InventoryItem = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  stockQty: number | null;
  lowStockThreshold: number;
  category: { id: string; name: string };
};

type Draft = { qty: number | null; threshold: number };

const DEFAULT_OPENING_STOCK = 50;

export function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "auto">("all");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [openingStock, setOpeningStock] = useState(DEFAULT_OPENING_STOCK);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/inventory", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load inventory");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      toast.error("Could not load inventory. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    []
  );

  function draft(item: InventoryItem): Draft {
    return drafts[item.id] ?? { qty: item.stockQty, threshold: item.lowStockThreshold };
  }

  function patchDraft(item: InventoryItem, next: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [item.id]: { ...draft(item), ...next },
    }));
  }

  /** Persist a single item's stock + threshold. */
  const save = useCallback(
    async (item: InventoryItem, override?: Partial<Draft>) => {
      const d: Draft = { ...draft(item), ...override };
      setSavingId(item.id);
      try {
        const res = await fetch("/api/dashboard/inventory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            stockQty: d.qty,
            lowStockThreshold: d.threshold,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || "Save failed.");
        }
        const data = await res.json();
        setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed.");
        // Drop the draft so the row snaps back to the stored value.
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } finally {
        setSavingId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );

  /** Steppers commit instantly — no manual Save needed for the common case. */
  function step(item: InventoryItem, delta: number) {
    const d = draft(item);
    if (d.qty === null) return;
    void save(item, { qty: Math.max(0, d.qty + delta) });
  }

  /** Typed numbers persist on blur so half-typed values are never stored. */
  function commit(item: InventoryItem) {
    const d = draft(item);
    if (d.qty === item.stockQty && d.threshold === item.lowStockThreshold) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }
    void save(item);
  }

  /** Start / stop automatic tracking for one item. */
  function toggleTracking(item: InventoryItem) {
    const d = draft(item);
    if (d.qty === null) {
      void save(item, { qty: openingStock });
      toast.success(
        `${item.name} is now tracked automatically, starting at ${openingStock}.`
      );
    } else {
      void save(item, { qty: null });
      toast.info(`${item.name} is no longer tracked automatically.`);
    }
  }

  /** Turn on automatic tracking for every untracked menu item at once. */
  async function trackAllUntracked() {
    const untracked = items.filter((i) => i.stockQty === null);
    if (untracked.length === 0) {
      toast.info("Every menu item is already tracked automatically.");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/dashboard/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockQty: openingStock }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Could not start tracking.");
      }
      const data = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.stockQty === null ? (data.items as InventoryItem[]).find((u) => u.id === i.id) ?? i : i))
      );
      toast.success(
        `${data.updated ?? 0} item${data.updated === 1 ? "" : "s"} now tracked automatically.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start tracking.");
    } finally {
      setBulkBusy(false);
    }
  }

  const tracked = useMemo(() => items.filter((i) => i.stockQty !== null), [items]);
  const untrackedCount = items.length - tracked.length;
  const lowStock = useMemo(
    () => tracked.filter((i) => (i.stockQty ?? 0) <= i.lowStockThreshold),
    [tracked]
  );
  const outOfStock = useMemo(() => tracked.filter((i) => (i.stockQty ?? 0) === 0), [tracked]);
  const totalValue = useMemo(
    () => items.reduce((sum, i) => sum + (i.stockQty ?? 0) * i.price, 0),
    [items]
  );

  const visible = useMemo(() => {
    if (filter === "low") return lowStock;
    if (filter === "auto") return tracked;
    return items;
  }, [filter, items, lowStock, tracked]);

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const item of visible) {
      const list = map.get(item.category.name) ?? [];
      list.push(item);
      map.set(item.category.name, list);
    }
    return map;
  }, [visible]);

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading inventory…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Inventory</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Stock updates itself: every order saved to Reports deducts the items it sold,
          items run out at zero, and restocking brings them straight back.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-3">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
        <p className="text-sm text-[var(--text)]">
          <span className="font-semibold text-[var(--gold-bright)]">Automatic mode is on.</span>{" "}
          {tracked.length} of {items.length} item{items.length === 1 ? "" : "s"} tracked. The
          only manual step left is setting your opening stock — the rest is handled for you.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Auto-tracked</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {tracked.length}
            <span className="text-sm font-normal text-[var(--text-dim)]"> / {items.length}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Out of stock</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-400">
            {outOfStock.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Low stock</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">
            {lowStock.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="text-xs text-[var(--text-muted)]">Stock value</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--gold-bright)]">
            {formatMoney(totalValue)}
          </p>
        </div>
      </div>

      {untrackedCount > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text)]">
                {untrackedCount} item{untrackedCount === 1 ? "" : "s"} not tracked yet
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Give them an opening count and automatic control takes over.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              Opening
              <input
                type="number"
                min={0}
                value={openingStock}
                onChange={(e) =>
                  setOpeningStock(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
                className="input-theme w-20 rounded-lg px-2 py-1.5 text-center text-sm"
              />
            </label>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void trackAllUntracked()}
              className="rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {bulkBusy ? "Starting…" : "Track all"}
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: `All items (${items.length})` },
            { key: "auto", label: `Auto-tracked (${tracked.length})` },
            { key: "low", label: `Low / out of stock (${lowStock.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${
              filter === tab.key
                ? tab.key === "low"
                  ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/40"
                  : "bg-[var(--gold)]/20 text-[var(--gold-bright)] ring-1 ring-[var(--gold)]/40"
                : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-dim)]">
          {filter === "low"
            ? "Nothing is low on stock right now."
            : filter === "auto"
              ? "No items are tracked yet — set an opening count above."
              : "No menu items found."}
        </p>
      )}

      {[...grouped.entries()].map(([catName, list]) => (
        <section key={catName}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {catName}
          </h3>
          <div className="space-y-2">
            {list.map((item) => {
              const d = draft(item);
              const auto = item.stockQty !== null;
              const low = d.qty !== null && d.qty <= d.threshold;
              const out = d.qty === 0;
              const dirty =
                d.qty !== item.stockQty || d.threshold !== item.lowStockThreshold;

              return (
                <div
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-[var(--bg-elevated)] px-4 py-3 ${
                    out ? "border-red-500/40" : "border-[var(--border)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-[var(--text)]">
                      {item.name}
                      {auto && (
                        <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-bright)] ring-1 ring-[var(--gold)]/30">
                          Auto
                        </span>
                      )}
                      {out && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/30">
                          <AlertTriangle className="h-3 w-3" /> Out of stock
                        </span>
                      )}
                      {low && !out && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
                          <AlertTriangle className="h-3 w-3" /> Low stock
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-dim)]">
                      {formatMoney(item.price)} ·{" "}
                      {auto
                        ? item.available
                          ? "On the menu"
                          : "Hidden (sold out)"
                        : "Not tracked — stock changes are ignored"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!auto || savingId === item.id}
                        onClick={() => step(item, -1)}
                        aria-label={`Decrease stock for ${item.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)] transition hover:border-[var(--gold)]/40 disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        disabled={!auto}
                        value={d.qty ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          patchDraft(item, {
                            qty: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          })
                        }
                        onBlur={() => commit(item)}
                        className="input-theme w-20 rounded-lg px-2 py-1.5 text-center text-sm tabular-nums"
                      />
                      <button
                        type="button"
                        disabled={!auto || savingId === item.id}
                        onClick={() => step(item, 1)}
                        aria-label={`Increase stock for ${item.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)] transition hover:border-[var(--gold)]/40 disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      Low at
                      <input
                        type="number"
                        min={0}
                        value={d.threshold}
                        onChange={(e) =>
                          patchDraft(item, {
                            threshold: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          })
                        }
                        onBlur={() => commit(item)}
                        className="input-theme w-16 rounded-lg px-2 py-1.5 text-center text-sm tabular-nums"
                      />
                    </label>

                    {auto ? (
                      <button
                        type="button"
                        disabled={savingId === item.id}
                        onClick={() => toggleTracking(item)}
                        title="Stop automatic tracking for this item"
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--gold)]/40 disabled:opacity-50"
                      >
                        Stop tracking
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={savingId === item.id || bulkBusy}
                        onClick={() => toggleTracking(item)}
                        className="rounded-lg border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20 disabled:opacity-50"
                      >
                        Start tracking
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={savingId === item.id || !dirty}
                      onClick={() => void save(item)}
                      className="rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
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
