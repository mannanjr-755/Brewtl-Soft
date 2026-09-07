"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { formatMoney, STATUS_LABELS, type OrderStatus } from "@/lib/utils";

type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  totalOrders: number;
  completedOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLast: number | null;
  segment: string;
};

type OrderItem = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  tableNumber: number;
  createdAt: string;
  itemCount: number;
  items?: OrderItem[];
};

type FavItem = { name: string; quantity: number; revenue: number };

const SEGMENT_STYLES: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  NEW: { label: "New Customer", color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/15", desc: "Just started ordering" },
  REGULAR: { label: "Regular Customer", color: "text-[#22c55e]", bg: "bg-[#22c55e]/15", desc: "Multiple completed orders" },
  VIP: { label: "VIP Customer", color: "text-[#e8c547]", bg: "bg-[#d4a017]/15", desc: "High spending / frequent ordering" },
  INACTIVE: { label: "Inactive", color: "text-[#ef4444]", bg: "bg-[#ef4444]/15", desc: "No order in 60+ days" },
};

const STATUS_DOT: Record<string, string> = {
  NEW: "bg-[#ef4444]",
  ACCEPTED: "bg-[#f97316]",
  PREPARING: "bg-[#f97316]",
  READY: "bg-[#22c55e]",
  COMPLETED: "bg-[#3b82f6]",
};

export function CustomerProfile() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<{ customer: CustomerDetail; stats: Stats; favoriteItems: FavItem[]; recentActivity: OrderRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, OrderItem[]>>({});

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/dashboard/customers/${id}`);
      if (!res.ok) {
        router.push("/dashboard/customers");
        return;
      }
      const d = await res.json();
      setData(d);
      setNotesValue(d.customer.notes ?? "");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNotes() {
    if (!id) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/dashboard/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue.trim() || null }),
      });
      if (res.ok) {
        setData((prev) =>
          prev ? { ...prev, customer: { ...prev.customer, notes: notesValue.trim() || null } } : prev
        );
        setEditingNotes(false);
        setNotice("Notes saved.");
        setTimeout(() => setNotice(null), 2200);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function toggleOrderItems(orderId: string) {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!expandedItems[orderId]) {
      const res = await fetch(`/api/dashboard/orders?status=`);
      if (res.ok) {
        const d = await res.json();
        const order = (d.orders ?? []).find((o: { id: string }) => o.id === orderId);
        if (order?.items) {
          setExpandedItems((prev) => ({ ...prev, [orderId]: order.items }));
        }
      }
    }
  }

  if (loading) {
    return <p className="text-sm text-[#a8a29e]">Loading customer profile…</p>;
  }

  if (!data) return null;

  const { customer, stats, favoriteItems, recentActivity } = data;
  const seg = SEGMENT_STYLES[stats.segment] ?? SEGMENT_STYLES.NEW;

  return (
    <div className="space-y-6">
      {notice && (
        <div className="fixed right-5 top-5 z-50 rounded-xl border border-[#22c55e]/50 bg-[#11251a] px-4 py-3 text-sm text-[#d1fae5] shadow-2xl shadow-[#22c55e]/10">
          {notice}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#78716c]">
        <Link href="/dashboard/customers" className="hover:text-[#e8c547] transition">Customers</Link>
        <span>/</span>
        <span className="text-[#9ca3af]">{customer.name}</span>
      </div>

      {/* Customer header */}
      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#d4a017]/15 text-2xl font-bold text-[#e8c547]">
          {customer.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{customer.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${seg.bg} ${seg.color}`}>
              {seg.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[#78716c]">{seg.desc}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#9ca3af]">
            {customer.phone && <span>📱 {customer.phone}</span>}
            {customer.email && <span>✉️ {customer.email}</span>}
            <span>🗓 Member since {format(new Date(customer.createdAt), "dd MMM yyyy")}</span>
          </div>
        </div>
        <Link
          href="/dashboard/customers"
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[#9ca3af] hover:bg-white/5 hover:text-white transition"
        >
          ← Back to list
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Orders", value: String(stats.totalOrders), icon: "📋", tone: "text-[#e8c547] bg-[#d4a017]/15" },
          { label: "Total Spent", value: formatMoney(stats.totalSpent), icon: "💰", tone: "text-[#22c55e] bg-[#22c55e]/15" },
          { label: "Avg Order Value", value: formatMoney(stats.avgOrderValue), icon: "📊", tone: "text-[#3b82f6] bg-[#3b82f6]/15" },
          { label: "First Order", value: stats.firstOrderAt ? format(new Date(stats.firstOrderAt), "dd MMM yy") : "—", icon: "🎂", tone: "text-[#a855f7] bg-[#a855f7]/15" },
          { label: "Last Order", value: stats.lastOrderAt ? format(new Date(stats.lastOrderAt), "dd MMM yy") : "—", icon: "🕐", tone: "text-[#f97316] bg-[#f97316]/15" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#9ca3af]">{card.label}</p>
                <p className="mt-1 text-xl font-semibold text-white">{card.value}</p>
              </div>
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${card.tone}`}>
                {card.icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* Order history */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-medium text-white">Order History</h2>
          <p className="mt-0.5 text-xs text-[#78716c]">{stats.totalOrders} total orders · {stats.completedOrders} completed</p>
          {recentActivity.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-[#78716c]">
              No orders yet.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {recentActivity.map((o) => (
                <div key={o.id}>
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0e0e0e] px-4 py-3 transition hover:border-[#d4a017]/30 cursor-pointer"
                    onClick={() => toggleOrderItems(o.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[o.status] ?? "bg-[#666]"}`} />
                      <div>
                        <p className="text-sm font-medium text-white">{o.orderNumber}</p>
                        <p className="text-[11px] text-[#78716c]">
                          Table {o.tableNumber} · {format(new Date(o.createdAt), "dd MMM, HH:mm")} · {o.itemCount} item{o.itemCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        o.status === "COMPLETED" ? "bg-[#3b82f6]/15 text-[#3b82f6]" :
                        o.status === "READY" ? "bg-[#22c55e]/15 text-[#22c55e]" :
                        o.status === "PREPARING" ? "bg-[#f97316]/15 text-[#f97316]" :
                        "bg-[#ef4444]/15 text-[#ef4444]"
                      }`}>
                        {STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                      </span>
                      <span className="text-sm font-semibold text-[#f0c14b]">{formatMoney(o.total)}</span>
                    </div>
                  </div>
                  {expandedOrder === o.id && expandedItems[o.id] && (
                    <div className="ml-5 mt-1 rounded-lg border border-white/5 bg-[#0a0a0a] p-3">
                      {expandedItems[o.id].map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-1 text-xs">
                          <span className="text-[#d1d5db]">
                            <span className="text-[#9ca3af]">{item.quantity}×</span> {item.itemName}
                          </span>
                          <span className="text-[#f0c14b]">{formatMoney(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right sidebar */}
        <aside className="space-y-4">
          {/* Favorite items */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="font-medium text-white">Frequently Ordered</h3>
            {favoriteItems.length === 0 ? (
              <p className="mt-3 text-xs text-[#78716c]">No items ordered yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {favoriteItems.map((item, idx) => (
                  <li key={item.name} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d4a017]/15 text-[10px] font-bold text-[#f0c14b]">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[#d1d5db]">{item.name}</span>
                    <span className="text-xs text-[#9ca3af]">{item.quantity}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Staff Notes</h3>
              {!editingNotes && (
                <button
                  type="button"
                  onClick={() => { setEditingNotes(true); setNotesValue(customer.notes ?? ""); }}
                  className="text-xs text-[#d4a017] hover:text-[#e8c547] transition"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-[#78716c]">Internal only — not visible to customers</p>
            {editingNotes ? (
              <div className="mt-3">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={4}
                  placeholder="e.g. Prefers less spicy food, usually orders family meal…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#d4a017] resize-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={saveNotes}
                    className="rounded-lg bg-[#d4a017] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    {savingNotes ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNotes(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9ca3af] hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#d1d5db]">
                {customer.notes || <span className="text-[#78716c] italic">No notes yet. Click Edit to add internal notes about this customer.</span>}
              </p>
            )}
          </div>

          {/* Contact info */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="font-medium text-white">Contact Info</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af]">Phone</span>
                <span className="text-white">{customer.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af]">Email</span>
                <span className="text-white">{customer.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af]">Customer ID</span>
                <span className="font-mono text-[10px] text-[#78716c]">{customer.id}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
