"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatMoney } from "@/lib/utils";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  segment: string;
};

type SegmentCounts = {
  all: number;
  NEW: number;
  REGULAR: number;
  VIP: number;
  INACTIVE: number;
};

const emptyForm = { name: "", phone: "", email: "", notes: "" };

const SEGMENT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: "New", color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/15" },
  REGULAR: { label: "Regular", color: "text-[#22c55e]", bg: "bg-[#22c55e]/15" },
  VIP: { label: "VIP", color: "text-[#e8c547]", bg: "bg-[#d4a017]/15" },
  INACTIVE: { label: "Inactive", color: "text-[#ef4444]", bg: "bg-[#ef4444]/15" },
};

export function CustomersManager() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [segments, setSegments] = useState<SegmentCounts | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (segmentFilter) params.set("segment", segmentFilter);
    params.set("sort", sortBy);
    params.set("order", sortOrder);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/dashboard/customers?${params.toString()}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setSegments(data.segments ?? null);
    setTotalPages(data.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [search, segmentFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(timer);
  }, [search, segmentFilter, sortBy, sortOrder]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };
    const res = await fetch("/api/dashboard/customers", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });
    setBusy(false);
    if (res.ok) {
      setMessage(editing ? "Customer updated." : "Customer added.");
      setEditing(null);
      setForm(emptyForm);
      load();
    } else {
      const data = await res.json();
      setMessage(data.error || "Something went wrong.");
    }
  }

  async function syncFromOrders() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(
        `Synced from orders — created ${data.synced?.created ?? 0} customers, linked ${data.synced?.linked ?? 0} orders.`
      );
      load();
    } else {
      setMessage(data.error || "Sync failed.");
    }
  }

  async function deleteCustomer() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/customers?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("Customer deleted.");
        setTimeout(() => setMessage(null), 2200);
        load();
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function startEdit(c: CustomerRow) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      notes: c.notes ?? "",
    });
  }

  if (loading) {
    return <p className="text-sm text-[#a8a29e]">Loading customers…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#141414] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 bg-red-500/10 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Delete Customer</p>
                <p className="text-xs text-[#9ca3af]">This action cannot be undone</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#d1d5db]">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">{deleteTarget.name}</span>?
                Their order history will remain intact.
              </p>
            </div>
            <div className="flex gap-3 border-t border-[#2a2a2a] px-5 py-4">
              <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] py-2.5 text-sm font-medium text-[#d1d5db] transition hover:bg-[#222]">
                Cancel
              </button>
              <button type="button" disabled={deleting} onClick={deleteCustomer} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Customers</h1>
          <p className="mt-1 text-sm text-[#a8a29e]">
            Manage your customer relationships, track orders and spending.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={syncFromOrders}
            disabled={busy}
            className="rounded-xl border border-[#d4a017]/50 bg-[#d4a017]/10 px-4 py-2 text-sm font-semibold text-[#e8c547] disabled:opacity-50"
          >
            {busy ? "Working…" : "Sync from orders"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-2.5 text-sm text-[#22c55e]">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Add / edit form */}
        <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-medium text-white">{editing ? "Edit customer" : "Add customer"}</h2>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            />
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (preferences, allergies…)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#000000] disabled:opacity-50">
                {editing ? "Save changes" : "Add customer"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setForm(emptyForm); }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[#d6d3d1]"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Customer list */}
        <section className="space-y-3">
          {/* Search + sort */}
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, or email…"
              className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split("-");
                setSortBy(s);
                setSortOrder(o as "asc" | "desc");
              }}
              className="rounded-xl border border-white/10 bg-[#0c0f14] px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            >
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="totalSpent-desc">Highest spending</option>
              <option value="totalSpent-asc">Lowest spending</option>
              <option value="orderCount-desc">Most orders</option>
              <option value="orderCount-asc">Least orders</option>
            </select>
          </div>

          {/* Segment tabs */}
          {segments && (
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "", label: "All", count: segments.all },
                { key: "NEW", label: "New", count: segments.NEW },
                { key: "REGULAR", label: "Regular", count: segments.REGULAR },
                { key: "VIP", label: "VIP", count: segments.VIP },
                { key: "INACTIVE", label: "Inactive", count: segments.INACTIVE },
              ]).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSegmentFilter(s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    segmentFilter === s.key
                      ? s.key && SEGMENT_STYLES[s.key]
                        ? `${SEGMENT_STYLES[s.key].bg} ${SEGMENT_STYLES[s.key].color}`
                        : "bg-[#d4a017]/20 text-[#e8c547]"
                      : "border border-[#2a2a2a] text-[#9ca3af] hover:border-[#d4a017]/40 hover:text-[#e8c547]"
                  }`}
                >
                  {s.label} ({s.count})
                </button>
              ))}
            </div>
          )}

          {/* Customer rows */}
          {customers.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[#78716c]">
              No customers found. Add one manually or sync from orders.
            </p>
          )}
          <div className="space-y-2">
            {customers.map((c) => {
              const seg = SEGMENT_STYLES[c.segment] ?? SEGMENT_STYLES.NEW;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-[#d4a017]/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d4a017]/15 text-sm font-bold text-[#e8c547]">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/customers/${c.id}`} className="font-medium text-white hover:text-[#e8c547] transition">
                            {c.name}
                          </Link>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${seg.bg} ${seg.color}`}>
                            {seg.label}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[#78716c]">
                          {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#a8a29e]">
                      <div className="text-right">
                        <p className="font-semibold text-white">{c.orderCount}</p>
                        <p className="text-[#78716c]">orders</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#f0c14b]">{formatMoney(c.totalSpent)}</p>
                        <p className="text-[#78716c]">spent</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-white">
                          {c.lastOrderAt ? format(new Date(c.lastOrderAt), "dd MMM") : "—"}
                        </p>
                        <p className="text-[#78716c]">last order</p>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/customers/${c.id}`}
                          className="rounded-lg bg-[#d4a017]/10 px-2.5 py-1.5 text-[#e8c547] ring-1 ring-[#d4a017]/30 hover:bg-[#d4a017]/20"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10 hover:bg-white/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9ca3af] hover:bg-white/5 disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs text-[#9ca3af]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9ca3af] hover:bg-white/5 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
