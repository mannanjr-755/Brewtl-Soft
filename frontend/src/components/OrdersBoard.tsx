"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Pencil, Printer, Search } from "lucide-react";
import { printOrderReceipt, type ReceiptRestaurant } from "@/lib/printReceipt";
import { formatMoney, nextStatus, ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/utils";

type OrderItem = {
  id: string;
  menuItemId: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  specialRequest: string | null;
  status: string;
  orderType: string;
  total: number;
  createdAt: string;
  table: { tableNumber: number };
  items: OrderItem[];
};

type TableRow = { id: string; tableNumber: number; active: boolean };

const COLUMNS: { key: OrderStatus[]; title: string; color: string; btn: string; btnClass: string }[] = [
  {
    key: ["NEW", "ACCEPTED"],
    title: "New Orders",
    color: "text-[#ef4444]",
    btn: "Accept Order",
    btnClass: "bg-[#ef4444] hover:bg-[#f87171] text-white",
  },
  {
    key: ["PREPARING"],
    title: "Preparing",
    color: "text-[#f97316]",
    btn: "Mark as Ready",
    btnClass: "bg-[#f97316] hover:bg-[#fb923c] text-white",
  },
  {
    key: ["READY"],
    title: "Ready",
    color: "text-[#22c55e]",
    btn: "Mark as Served",
    btnClass: "bg-[#22c55e] hover:bg-[#4ade80] text-black",
  },
    {
      key: ["COMPLETED"],
      title: "Completed",
      color: "text-[#3b82f6]",
      btn: "Save",
      btnClass: "bg-[#3b82f6] hover:bg-[#60a5fa] text-white",
    },
  ];

export function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lastFetch, setLastFetch] = useState("");
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [menuCategories, setMenuCategories] = useState<{ id: string; name: string; items: { id: string; name: string; price: number; available: boolean }[] }[]>([]);
  const [editCategory, setEditCategory] = useState("");
  const [editQty, setEditQty] = useState<Record<string, number>>({});
  const [editBusy, setEditBusy] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [orderTypeFilter, setOrderTypeFilter] = useState<"ALL" | "DINE_IN" | "TAKE_AWAY">("ALL");
  const [searchOpen, setSearchOpen] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<ReceiptRestaurant | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [ordersRes, tablesRes, catRes] = await Promise.all([
        fetch("/api/dashboard/orders", { cache: "no-store" }),
        fetch("/api/dashboard/tables", { cache: "no-store" }),
        fetch("/api/dashboard/categories", { cache: "no-store" }),
      ]);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders ?? []);
        setLastFetch(data.serverTime ?? new Date().toISOString());
      }
      if (tablesRes.ok) {
        const data = await tablesRes.json();
        setTables(data.tables ?? []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setMenuCategories(data.categories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 4000);
    return () => clearInterval(id);
  }, [fetchAll]);

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

  useEffect(() => {
    if (!search.trim()) return;
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [search]);

  function handlePrintReceipt(order: Order) {
    printOrderReceipt(order, restaurantInfo ?? undefined);
  }

  const todayOrders = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return orders.filter((o) => new Date(o.createdAt) >= start);
  }, [orders]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of ORDER_STATUSES) map[s] = 0;
    for (const o of todayOrders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [todayOrders]);

  const revenue = useMemo(
    () => todayOrders.reduce((sum, o) => sum + o.total, 0),
    [todayOrders]
  );

  const filtered = useMemo(() => {
    let list = orders;
    if (orderTypeFilter !== "ALL") {
      list = list.filter((o) => o.orderType === orderTypeFilter);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerPhone ?? "").toLowerCase().includes(q) ||
        (o.customerEmail ?? "").toLowerCase().includes(q) ||
        (o.specialRequest ?? "").toLowerCase().includes(q) ||
        String(o.table.tableNumber).includes(q) ||
        o.status.toLowerCase().includes(q) ||
        (STATUS_LABELS[o.status as OrderStatus] ?? "").toLowerCase().includes(q) ||
        o.items.some((item) => item.itemName.toLowerCase().includes(q))
    );
  }, [orders, search, orderTypeFilter]);

  const searchQ = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchQ) return null;
    const matchedOrders = filtered.slice(0, 5);
    const matchedTables = tables.filter((t) => String(t.tableNumber).includes(searchQ)).slice(0, 5);
    const allMenuItems = menuCategories.flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name })));
    const matchedMenu = allMenuItems.filter((i) => i.name.toLowerCase().includes(searchQ)).slice(0, 5);
    return { orders: matchedOrders, tables: matchedTables, menu: matchedMenu, totalMatches: matchedOrders.length + matchedTables.length + matchedMenu.length };
  }, [filtered, tables, menuCategories, searchQ]);

  const topItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of todayOrders) {
      for (const item of o.items) {
        map.set(item.itemName, (map.get(item.itemName) ?? 0) + item.quantity);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [todayOrders]);

  const recentActivity = useMemo(() => {
    return [...orders]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6)
      .map((o) => ({
        id: o.id,
        text:
          o.status === "NEW"
            ? `New order ${o.orderNumber} received`
            : o.status === "READY"
              ? `Order ${o.orderNumber} is ready to serve`
              : `Order ${o.orderNumber} → ${STATUS_LABELS[o.status as OrderStatus] ?? o.status}`,
        time: format(new Date(o.createdAt), "HH:mm"),
        tone:
          o.status === "NEW"
            ? "bg-[#ef4444]"
            : o.status === "READY"
              ? "bg-[#22c55e]"
              : o.status === "PREPARING"
                ? "bg-[#f97316]"
                : "bg-[#3b82f6]",
      }));
  }, [orders]);

  async function advanceStatus(orderId: string, status: string) {
    if (status === "COMPLETED" || status === "REPORTED") return;
    setUpdatingId(orderId);
    try {
      // From NEW: Accept -> ACCEPTED, then next click PREPARING feels slow.
      // Match image: Accept Order from NEW goes to PREPARING in one action if NEW,
      // or advance one step for others.
      let body: Record<string, unknown> = { orderId, advance: true };
      if (status === "NEW") {
        body = { orderId, status: "PREPARING" };
      } else if (status === "ACCEPTED") {
        body = { orderId, status: "PREPARING" };
      } else if (status === "READY") {
        body = { orderId, status: "COMPLETED" };
      }

      const res = await fetch("/api/dashboard/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  /** Move a completed order into Reports (REPORTED) and remove it from Kitchen Completed. */
  async function saveOrderToReports(order: Order) {
    if (order.status !== "COMPLETED") return;
    setUpdatingId(order.id);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, status: "REPORTED" }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? (data.order as Order) : o))
        );
        setDeleteNotice(`Order ${order.orderNumber} saved to Reports.`);
        setTimeout(() => setDeleteNotice(null), 2200);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteOrder() {
    if (!orderToDelete) return;

    const orderId = orderToDelete.id;
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/dashboard/orders?id=${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
        setDeleteNotice(`Order ${orderToDelete.orderNumber} deleted.`);
        setTimeout(() => setDeleteNotice(null), 2200);
      }
    } finally {
      setDeletingId(null);
      setOrderToDelete(null);
    }
  }

  async function openEditOrder(order: Order) {
    setOrderToEdit(order);
    setEditCategory("");
    setEditQty({});
    setEditBusy(false);
    setEditNotice(null);
    if (menuCategories.length === 0) {
      try {
        const res = await fetch("/api/dashboard/categories", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const cats = (data.categories ?? []) as typeof menuCategories;
          setMenuCategories(cats);
          if (cats.length > 0) setEditCategory(cats[0].id);
        }
      } catch {}
    } else if (menuCategories.length > 0 && !editCategory) {
      setEditCategory(menuCategories[0].id);
    }
  }

  async function addMenuItem(menuItemId: string) {
    if (!orderToEdit) return;
    setEditBusy(true);
    try {
      const qty = Math.max(1, editQty[menuItemId] ?? 1);
      const res = await fetch("/api/dashboard/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderToEdit.id, addItem: { menuItemId, quantity: qty } }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderToEdit.id ? data.order : o)));
        setOrderToEdit(data.order);
        setEditQty((prev) => ({ ...prev, [menuItemId]: 1 }));
        setEditNotice("Item added");
        setTimeout(() => setEditNotice(null), 1500);
      }
    } finally {
      setEditBusy(false);
    }
  }

  async function removeOrderItem(orderItemId: string) {
    if (!orderToEdit) return;
    setEditBusy(true);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderToEdit.id, removeItemId: orderItemId }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderToEdit.id ? data.order : o)));
        setOrderToEdit(data.order);
        setEditNotice("Item removed");
        setTimeout(() => setEditNotice(null), 1500);
      }
    } finally {
      setEditBusy(false);
    }
  }

  async function updateOrderItemQty(orderItemId: string, quantity: number) {
    if (!orderToEdit) return;
    if (quantity < 1) return removeOrderItem(orderItemId);
    setEditBusy(true);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderToEdit.id, updateItemQty: { orderItemId, quantity } }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderToEdit.id ? data.order : o)));
        setOrderToEdit(data.order);
      }
    } finally {
      setEditBusy(false);
    }
  }

  const kpi = [
    {
      label: "Total Orders",
      value: String(todayOrders.length),
      icon: "📋",
      tone: "text-[#e8c547] bg-[#d4a017]/15",
      trend: "↑ 25% from yesterday",
    },
    {
      label: "Preparing",
      value: String(counts.PREPARING ?? 0),
      icon: "🍲",
      tone: "text-[#22c55e] bg-[#22c55e]/15",
      sub: "In Kitchen",
    },
    {
      label: "Ready",
      value: String(counts.READY ?? 0),
      icon: "🔔",
      tone: "text-[#3b82f6] bg-[#3b82f6]/15",
      sub: "To Be Served",
    },
    {
      label: "Completed",
      value: String(counts.COMPLETED ?? 0),
      icon: "✅",
      tone: "text-[#a855f7] bg-[#a855f7]/15",
      trend: "↑ 18% from yesterday",
    },
    {
      label: "Total Revenue",
      value: formatMoney(revenue),
      icon: "💰",
      tone: "text-[#e8c547] bg-[#d4a017]/15",
      trend: "↑ 22% from yesterday",
    },
  ];

  const newBucket = (counts.NEW ?? 0) + (counts.ACCEPTED ?? 0);
  const preparingCount = counts.PREPARING ?? 0;
  const readyCount = counts.READY ?? 0;
  const completedCount = counts.COMPLETED ?? 0;
  const donutTotal = newBucket + preparingCount + readyCount + completedCount || 1;

  const occupiedEstimate = Math.min(
    tables.length,
    new Set(
      orders
        .filter((o) => !["COMPLETED"].includes(o.status))
        .map((o) => o.table.tableNumber)
    ).size
  );
  const available = Math.max(0, tables.length - occupiedEstimate);

  return (
    <div className="space-y-6">
      {deleteNotice && (
        <div className="fixed right-5 top-5 z-50 rounded-xl border border-[#22c55e]/50 bg-[#11251a] px-4 py-3 text-sm text-[#d1fae5] shadow-2xl shadow-[#22c55e]/10">
          {deleteNotice}
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 shadow-2xl shadow-black/50">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ef4444]">Delete order</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{orderToDelete.orderNumber}</h3>
            <p className="mt-2 text-sm text-[#cbd5e1]">
              Are you sure you want to remove this order for <span className="font-medium text-white">{orderToDelete.customerName}</span>?
            </p>
            <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#0e0e0e] p-3 text-sm text-[#d1d5db]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#9ca3af]">Table</span>
                <span>{orderToDelete.table.tableNumber}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[#9ca3af]">Total</span>
                <span className="font-semibold text-[#f0c14b]">{formatMoney(orderToDelete.total)}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="flex-1 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] py-2.5 text-sm font-medium text-[#d1d5db] transition hover:bg-[#222]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteOrder}
                disabled={deletingId === orderToDelete.id}
                className="flex-1 rounded-lg bg-[#ef4444] py-2.5 text-sm font-semibold text-white transition hover:bg-[#f87171] disabled:opacity-50"
              >
                {deletingId === orderToDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderToEdit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-[#2a2a2a] bg-[#141414] shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4a017]">Edit Order</p>
                <h3 className="text-lg font-semibold text-white">
                  {orderToEdit.orderNumber}
                  <span className="ml-2 text-sm font-normal text-[#9ca3af]">Table {orderToEdit.table.tableNumber}</span>
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {editNotice && (
                  <span className="rounded-full bg-[#22c55e]/15 px-3 py-1 text-xs font-medium text-[#22c55e]">{editNotice}</span>
                )}
                <button
                  type="button"
                  onClick={() => setOrderToEdit(null)}
                  className="rounded-lg border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#9ca3af] transition hover:bg-[#1a1a1a] hover:text-white"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Left: Current items */}
              <div className="flex flex-1 flex-col overflow-hidden border-r border-[#2a2a2a] p-4 md:w-1/2">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Current Items</h4>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {orderToEdit.items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#2a2a2a] px-3 py-6 text-center text-xs text-[#4b5563]">
                      No items in this order
                    </p>
                  )}
                  {orderToEdit.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-[#1f1f1f] bg-[#0e0e0e] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{item.itemName}</p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {formatMoney(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={editBusy}
                          onClick={() => updateOrderItemQty(item.id, item.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a] text-xs text-[#9ca3af] transition hover:border-[#d4a017] hover:text-[#e8c547] disabled:opacity-50"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xs tabular-nums text-white">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={editBusy}
                          onClick={() => updateOrderItemQty(item.id, item.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a] text-xs text-[#9ca3af] transition hover:border-[#d4a017] hover:text-[#e8c547] disabled:opacity-50"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={editBusy}
                          onClick={() => removeOrderItem(item.id)}
                          className="ml-1 flex h-6 w-6 items-center justify-center rounded-md border border-red-500/30 text-xs text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
                        >
                          ×
                        </button>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-[#f0c14b]">
                        {formatMoney(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#2a2a2a] pt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Order Total</span>
                  <span className="text-lg font-bold text-[#f0c14b]">{formatMoney(orderToEdit.total)}</span>
                </div>
              </div>

              {/* Right: Menu to add */}
              <div className="flex flex-1 flex-col overflow-hidden p-4 md:w-1/2">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Add from Menu</h4>
                {/* Category tabs */}
                <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto pb-1">
                  {menuCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEditCategory(cat.id)}
                      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        editCategory === cat.id
                          ? "bg-[#d4a017] text-black"
                          : "border border-[#2a2a2a] text-[#9ca3af] hover:border-[#d4a017]/50 hover:text-[#e8c547]"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                {/* Menu items */}
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {menuCategories
                    .find((c) => c.id === editCategory)
                    ?.items.filter((i) => i.available)
                    .map((item) => {
                      const inOrder = orderToEdit.items.find((oi) => oi.menuItemId === item.id);
                      const qty = editQty[item.id] ?? 1;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                            inOrder
                              ? "border-[#22c55e]/40 bg-[#22c55e]/5"
                              : "border-[#1f1f1f] bg-[#0e0e0e]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white">{item.name}</p>
                            <p className="text-[11px] text-[#9ca3af]">{formatMoney(item.price)}</p>
                          </div>
                          {inOrder && (
                            <span className="rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-bold text-[#22c55e]">
                              ×{inOrder.quantity} in order
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={editBusy}
                              onClick={() => setEditQty((prev) => ({ ...prev, [item.id]: Math.max(1, (prev[item.id] ?? 1) - 1) }))}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a] text-xs text-[#9ca3af] transition hover:border-[#d4a017] hover:text-[#e8c547] disabled:opacity-50"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-xs tabular-nums text-white">{qty}</span>
                            <button
                              type="button"
                              disabled={editBusy}
                              onClick={() => setEditQty((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 1) + 1 }))}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a] text-xs text-[#9ca3af] transition hover:border-[#d4a017] hover:text-[#e8c547] disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={editBusy}
                            onClick={() => addMenuItem(item.id)}
                            className="rounded-lg bg-[#d4a017] px-3 py-1.5 text-[11px] font-bold text-black transition hover:bg-[#e8c547] disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      );
                    })}
                  {menuCategories.find((c) => c.id === editCategory)?.items.filter((i) => i.available).length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#2a2a2a] px-3 py-6 text-center text-xs text-[#4b5563]">
                      No items in this category
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--text)] sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Live kitchen board
            {lastFetch ? ` · synced ${format(new Date(lastFetch), "HH:mm:ss")}` : ""}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3 sm:max-w-xl">
          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(""); }}
            className="rounded-full border border-[#2a2a2a] p-2.5 text-[#9ca3af] sm:hidden"
          >
            <Search className="h-5 w-5" />
          </button>
          {/* Search input — always visible on sm+, toggleable on mobile */}
          <div ref={searchRef} className={`relative flex-1 sm:block ${searchOpen ? "block" : "hidden"}`}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
            <input
              autoFocus={searchOpen}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search orders, tables, menu..."
              className="w-full rounded-full border border-[#2a2a2a] bg-[#141414] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#d4a017]"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-[#9ca3af] hover:text-white"
              >
                Clear
              </button>
            )}
            {/* Search results dropdown */}
            {searchResults && searchResults.totalMatches > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 shadow-2xl shadow-black/60">
                {/* Orders */}
                {searchResults.orders.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#e8c547]">
                      Orders ({searchResults.orders.length})
                    </p>
                    {searchResults.orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-white/5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{o.orderNumber}</p>
                          <p className="truncate text-[11px] text-[#9ca3af]">
                            {o.customerName} · Table {o.table.tableNumber}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#9ca3af]">
                          {STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Tables */}
                {searchResults.tables.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#3b82f6]">
                      Tables ({searchResults.tables.length})
                    </p>
                    {searchResults.tables.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-white/5">
                        <p className="text-sm text-white">Table {t.tableNumber}</p>
                        <span className={`text-[11px] font-medium ${t.active ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                          {t.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Menu items */}
                {searchResults.menu.length > 0 && (
                  <div>
                    <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#22c55e]">
                      Menu ({searchResults.menu.length})
                    </p>
                    {searchResults.menu.map((i) => (
                      <div key={i.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-white/5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{i.name}</p>
                          <p className="truncate text-[11px] text-[#9ca3af]">{i.categoryName}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-[#f0c14b]">{formatMoney(i.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* No matches for specific sections hidden */}
              </div>
            )}
            {/* No results */}
            {searchResults && searchResults.totalMatches === 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 text-center shadow-2xl shadow-black/60">
                <p className="text-sm text-[#6b7280]">No results found for &ldquo;{search}&rdquo;</p>
              </div>
            )}
          </div>
          <div className="hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)] md:block">
            {format(new Date(), "dd MMM, yyyy EEEE")}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpi.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{card.value}</p>
                {card.trend && <p className="mt-1 text-xs text-[#22c55e]">{card.trend}</p>}
                {"sub" in card && card.sub && (
                  <p className="mt-1 text-xs text-[#888]">{card.sub}</p>
                )}
              </div>
              <span className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${card.tone}`}>
                {card.icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Kitchen board — horizontal order cards per status */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl text-[var(--text)]">Kitchen Orders</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                POS-ready board — edit items, advance status, and keep service in sync
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              {([
                { key: "ALL" as const, label: "All Orders" },
                { key: "DINE_IN" as const, label: "Dine In" },
                { key: "TAKE_AWAY" as const, label: "Take Away" },
              ]).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setOrderTypeFilter(f.key)}
                  className={`rounded-full px-3 py-1 transition ${
                    orderTypeFilter === f.key
                      ? "bg-[var(--gold)]/20 text-[var(--gold-bright)]"
                      : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]/40 hover:text-[var(--gold-bright)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="py-10 text-center text-sm text-[var(--text-dim)]">Loading orders…</p>}

          {/* Horizontal status columns: New → Preparing → Ready → Completed */}
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory lg:gap-4">
            {COLUMNS.map((col) => {
              const colOrders = filtered.filter((o) =>
                col.key.includes(o.status as OrderStatus)
              );
              return (
                <div
                  key={col.title}
                  className="w-[min(100%,300px)] shrink-0 snap-start rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-3 sm:w-[320px] lg:min-w-0 lg:flex-1"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className={`truncate text-xs font-bold uppercase tracking-wider ${col.color}`}>
                      {col.title}
                    </h3>
                    <span className="shrink-0 rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="max-h-[min(70vh,640px)] space-y-3 overflow-y-auto pr-0.5">
                    {colOrders.length === 0 && (
                      <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-dim)]">
                        No orders
                      </p>
                    )}
                    {colOrders.map((order) => {
                      const nxt = nextStatus(order.status);
                      const isNew = order.status === "NEW";
                      const initials = order.customerName
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase() ?? "")
                        .join("");
                      return (
                        <article
                          key={order.id}
                          className={`min-w-0 overflow-hidden rounded-xl border bg-[var(--bg-card)] p-3 shadow-[var(--shadow)] ${
                            isNew
                              ? "border-[var(--danger)]/50 shadow-[0_0_20px_rgba(239,68,68,0.12)]"
                              : "border-[var(--border)]"
                          }`}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text)]">{order.orderNumber}</p>
                              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                Table {order.table.tableNumber} · {order.orderType === "TAKE_AWAY" ? "Take Away" : "Dine In"}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-md bg-[var(--bg-soft)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
                              {format(new Date(order.createdAt), "HH:mm")}
                            </span>
                          </div>

                          <div className="mt-3 flex min-w-0 items-start gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 text-[10px] font-bold text-[var(--gold-bright)]">
                              {initials || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-[var(--text)]" title={order.customerName}>
                                {order.customerName}
                              </p>
                              {order.customerEmail && (
                                <p
                                  className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]"
                                  title={order.customerEmail}
                                >
                                  {order.customerEmail}
                                </p>
                              )}
                              {order.customerPhone && (
                                <p className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]">
                                  {order.customerPhone}
                                </p>
                              )}
                            </div>
                          </div>

                          <ul className="mt-3 max-h-28 space-y-1.5 overflow-y-auto border-t border-[var(--border)] pt-2.5 text-xs text-[var(--text)]">
                            {order.items.map((item) => (
                              <li key={item.id} className="flex min-w-0 gap-2">
                                <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                                  {item.quantity}×
                                </span>
                                <span className="min-w-0 break-words">{item.itemName}</span>
                              </li>
                            ))}
                          </ul>
                          {order.specialRequest && (
                            <p className="mt-2 break-words rounded-lg bg-[var(--gold)]/10 px-2 py-1.5 text-[11px] leading-snug text-[var(--gold-bright)]">
                              {order.specialRequest}
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 text-xs">
                            <span className="font-semibold tabular-nums text-[var(--gold-bright)]">
                              {formatMoney(order.total)}
                            </span>
                            <span className="rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                              POS
                            </span>
                          </div>
                          {(nxt || order.status === "READY" || order.status === "NEW" || order.status === "ACCEPTED") &&
                            order.status !== "COMPLETED" &&
                            order.status !== "REPORTED" && (
                              <button
                                type="button"
                                disabled={updatingId === order.id || deletingId === order.id}
                                onClick={() => advanceStatus(order.id, order.status)}
                                className={`mt-3 w-full rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50 ${col.btnClass}`}
                              >
                                {updatingId === order.id ? "…" : col.btn}
                              </button>
                            )}
                          {order.status === "COMPLETED" && (
                            <button
                              type="button"
                              disabled={updatingId === order.id || deletingId === order.id}
                              onClick={() => saveOrderToReports(order)}
                              className="mt-3 w-full rounded-lg bg-[#3b82f6] py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-[#60a5fa] disabled:opacity-50"
                            >
                              {updatingId === order.id ? "Saving…" : "Save"}
                            </button>
                          )}
                          {(order.status === "NEW" ||
                            order.status === "ACCEPTED" ||
                            order.status === "PREPARING" ||
                            order.status === "READY") && (
                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(order)}
                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-bright)]"
                            >
                              <Printer className="h-3 w-3" />
                              Print Receipt
                            </button>
                          )}
                          {order.status !== "COMPLETED" && order.status !== "REPORTED" && (
                            <>
                              <button
                                type="button"
                                disabled={deletingId === order.id || updatingId === order.id}
                                onClick={() => openEditOrder(order)}
                                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--gold)]/50 bg-[var(--gold)]/10 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20 disabled:opacity-50"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit Order (POS)
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === order.id || updatingId === order.id}
                                onClick={() => setOrderToDelete(order)}
                                className="mt-2 w-full rounded-lg border border-red-500/50 bg-red-500/10 py-2 text-[10px] font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                              >
                                {deletingId === order.id ? "Deleting…" : "Delete Order"}
                              </button>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      {/* Overview widgets moved to bottom */}
      <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h3 className="font-medium text-[var(--text)]">Today&apos;s Overview</h3>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="relative h-28 w-28 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(
                    #ef4444 0 ${(newBucket / donutTotal) * 100}%,
                    #f97316 ${(newBucket / donutTotal) * 100}% ${((newBucket + preparingCount) / donutTotal) * 100}%,
                    #22c55e ${((newBucket + preparingCount) / donutTotal) * 100}% ${((newBucket + preparingCount + readyCount) / donutTotal) * 100}%,
                    #3b82f6 ${((newBucket + preparingCount + readyCount) / donutTotal) * 100}% 100%
                  )`,
                }}
              >
                <div className="absolute inset-3 flex items-center justify-center rounded-full bg-[var(--bg-card)] text-center">
                  <div>
                    <p className="text-lg font-bold">{todayOrders.length}</p>
                    <p className="text-[9px] text-[var(--text-dim)]">Orders</p>
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ef4444]" /> New {newBucket}</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#f97316]" /> Preparing {preparingCount}</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Ready {readyCount}</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#3b82f6]" /> Completed {completedCount}</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h3 className="font-medium text-[var(--text)]">Revenue Overview</h3>
            <p className="mt-1 text-xs text-[var(--success)]">+22% from yesterday</p>
            <div className="mt-4 flex h-24 items-end gap-1">
              {[40, 55, 35, 70, 60, 85, 50, 95, 75, 65, 80, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-[var(--gold)]/30 to-[var(--gold-bright)]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <p className="mt-2 text-right text-sm font-semibold text-[var(--gold-bright)]">{formatMoney(revenue)}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h3 className="font-medium text-[var(--text)]">Top Selling Items</h3>
            <ul className="mt-3 space-y-3">
              {topItems.length === 0 && (
                <li className="text-xs text-[var(--text-dim)]">No sales yet today.</li>
              )}
              {topItems.map(([name, qty], idx) => (
                <li key={name} className="flex items-center gap-3 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold)]/15 text-xs font-bold text-[var(--gold-bright)]">
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate text-[var(--text)]">{name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{qty} sold</span>
                </li>
              ))}
            </ul>
          </div>
      </div>

      {/* Bottom panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h3 className="font-medium text-[var(--text)]">Table Status</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Available", value: available, color: "text-[#22c55e] border-[#22c55e]/30" },
              { label: "Occupied", value: occupiedEstimate, color: "text-[#f97316] border-[#f97316]/30" },
              { label: "Reserved", value: 0, color: "text-[#ef4444] border-[#ef4444]/30" },
              { label: "Total", value: tables.length, color: "text-[#3b82f6] border-[#3b82f6]/30" },
            ].map((t) => (
              <div key={t.label} className={`rounded-xl border bg-[var(--bg-elevated)] p-3 ${t.color}`}>
                <p className="text-2xl font-bold">{t.value}</p>
                <p className="text-xs text-[var(--text-muted)]">{t.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h3 className="font-medium text-[var(--text)]">Recent Activity</h3>
          <ul className="mt-3 space-y-3">
            {recentActivity.length === 0 && (
              <li className="text-xs text-[var(--text-dim)]">No recent activity.</li>
            )}
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-xs">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.tone}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--text)]">{a.text}</p>
                  <p className="text-[var(--text-dim)]">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h3 className="font-medium text-[var(--text)]">Staff on Duty</h3>
          <ul className="mt-3 space-y-3">
            {[
              { name: "Ali Khan", role: "Head Chef", initial: "A" },
              { name: "Sara Ahmed", role: "Kitchen Staff", initial: "S" },
              { name: "Imran Raza", role: "Waiter", initial: "I" },
              { name: "Usman Javed", role: "Cashier", initial: "U" },
            ].map((s) => (
              <li key={s.name} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold)]/20 text-sm font-bold text-[var(--gold-bright)]">
                  {s.initial}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[var(--text)]">{s.name}</p>
                  <p className="text-xs text-[var(--text-dim)]">{s.role}</p>
                </div>
                <span className="text-[10px] font-semibold text-[var(--success)]">● Online</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
