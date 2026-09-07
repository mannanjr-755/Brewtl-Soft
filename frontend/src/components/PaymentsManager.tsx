"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatMoney } from "@/lib/utils";

const METHODS = ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_WALLET", "OTHER"] as const;
const STATUSES = ["PENDING", "PAID", "REFUNDED", "FAILED"] as const;

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  balance: number;
};

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string; customerName: string; total: number } | null;
};

const emptyForm = {
  orderId: "",
  amount: "",
  method: "CASH",
  status: "PAID",
  reference: "",
  note: "",
};

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-[#22c55e]/10 text-[#22c55e] ring-[#22c55e]/30",
  PENDING: "bg-[#f97316]/10 text-[#f97316] ring-[#f97316]/30",
  REFUNDED: "bg-[#a855f7]/10 text-[#a855f7] ring-[#a855f7]/30",
  FAILED: "bg-red-500/10 text-red-300 ring-red-500/30",
};

export function PaymentsManager() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/payments");
    const data = await res.json();
    setPayments(data.payments ?? []);
    setOrders(data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const collected = useMemo(
    () => payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const pending = useMemo(
    () => payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const outstanding = useMemo(
    () => orders.reduce((s, o) => s + o.balance, 0),
    [orders]
  );

  async function createPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: form.orderId || null,
        amount: Number(form.amount),
        method: form.method,
        status: form.status,
        reference: form.reference.trim() || null,
        note: form.note.trim() || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage("Payment recorded.");
      setForm(emptyForm);
      load();
    } else {
      setMessage(data.error || "Could not record payment.");
    }
  }

  async function changeStatus(payment: PaymentRow, status: string) {
    const res = await fetch("/api/dashboard/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: payment.id, status }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Payment updated." : data.error || "Update failed.");
    load();
  }

  async function removePayment(id: string) {
    if (!confirm("Delete this payment record?")) return;
    await fetch(`/api/dashboard/payments?id=${id}`, { method: "DELETE" });
    setMessage("Payment deleted.");
    load();
  }

  if (loading) {
    return <p className="text-sm text-[#a8a29e]">Loading payments…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Payments</h1>
        <p className="mt-1 text-sm text-[#a8a29e]">
          Record and track payments against orders, by method and status.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-[#a8a29e]">Collected</p>
          <p className="mt-1 text-2xl font-semibold text-[#22c55e]">{formatMoney(collected)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-[#a8a29e]">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-[#f97316]">{formatMoney(pending)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-[#a8a29e]">Outstanding on orders</p>
          <p className="mt-1 text-2xl font-semibold text-[#f0c14b]">{formatMoney(outstanding)}</p>
        </div>
      </div>

      {message && <p className="text-sm text-[#e8c547]">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Record payment */}
        <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-medium text-white">Record payment</h2>
          <form onSubmit={createPayment} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#d6d3d1]">Order</span>
              <select
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#0c0f14] px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
              >
                <option value="">No order (walk-in / other)</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} · {o.customerName} · {formatMoney(o.total)}
                    {o.balance > 0 ? ` (${formatMoney(o.balance)} due)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[#d6d3d1]">Amount</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-[#d6d3d1]">Method</span>
                <select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#0c0f14] px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[#d6d3d1]">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#0c0f14] px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0] + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Reference / transaction ID"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            />
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Note"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#000000] disabled:opacity-50"
            >
              {busy ? "Recording…" : "Record payment"}
            </button>
          </form>
        </section>

        {/* Payments list */}
        <section className="space-y-2">
          {payments.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[#78716c]">
              No payments recorded yet.
            </p>
          )}
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-white">
                  {p.order ? p.order.orderNumber : "Walk-in / other"}
                  {p.order && <span className="text-[#a8a29e]"> · {p.order.customerName}</span>}
                </p>
                <p className="text-xs text-[#78716c]">
                  {format(new Date(p.createdAt), "dd MMM yyyy, HH:mm")} · {p.method.replace("_", " ")}
                  {p.reference ? ` · ${p.reference}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-medium ring-1 ${STATUS_STYLE[p.status] ?? ""}`}>
                  {p.status[0] + p.status.slice(1).toLowerCase()}
                </span>
                <span className="font-semibold text-[#f0c14b]">{formatMoney(p.amount)}</span>
                <select
                  value={p.status}
                  onChange={(e) => changeStatus(p, e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0c0f14] px-2 py-1.5 text-xs outline-none focus:border-[#d4a017]"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s[0] + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removePayment(p.id)}
                  className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
