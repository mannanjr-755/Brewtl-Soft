"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { formatMoney, STATUS_LABELS, ORDER_STATUSES, type OrderStatus } from "@/lib/utils";

type ReportData = {
  from: string;
  to: string;
  summary: {
    totalOrders: number;
    completedOrders: number;
    revenue: number;
    averageOrderValue: number;
  };
  ordersByStatus: { status: string; label: string; count: number; revenue: number }[];
  daily: { date: string; orders: number; revenue: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  categoryBreakdown: { name: string; quantity: number; revenue: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    tableNumber: number;
    status: string;
    total: number;
    createdAt: string;
    itemCount: number;
  }[];
};

const STATUS_COLOR: Record<string, string> = {
  NEW: "#ef4444",
  ACCEPTED: "#f97316",
  PREPARING: "#eab308",
  READY: "#22c55e",
  COMPLETED: "#3b82f6",
  REPORTED: "#6366f1",
};

function toInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function ReportsManager() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toInput(d);
  });
  const [to, setTo] = useState(() => toInput(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/dashboard/reports?from=${from}&to=${to}`, { cache: "no-store" });
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const presets = [
    {
      label: "Today",
      set: () => {
        const d = new Date();
        setFrom(toInput(d));
        setTo(toInput(d));
      },
    },
    {
      label: "7 days",
      set: () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        setFrom(toInput(d));
        setTo(toInput(new Date()));
      },
    },
    {
      label: "30 days",
      set: () => {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        setFrom(toInput(d));
        setTo(toInput(new Date()));
      },
    },
  ];

  const maxDailyRevenue = useMemo(
    () => Math.max(1, ...(data?.daily.map((d) => d.revenue) ?? [1])),
    [data]
  );

  const statusTotal = useMemo(
    () => (data?.ordersByStatus ?? []).reduce((s, x) => s + x.count, 0),
    [data]
  );

  async function onImportFile(file: File) {
    setImportError(null);
    setImportMessage(null);

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls") && !lower.endsWith(".csv")) {
      setImportError("Please select an Excel file (.xlsx, .xls) or CSV (.csv).");
      return;
    }
    if (file.size === 0) {
      setImportError("The selected file is empty.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError("File must be under 5MB.");
      return;
    }

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportError("Workbook has no sheets.");
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!rows.length) {
        setImportError("No data rows found in the Excel file.");
        return;
      }

      const res = await fetch("/api/dashboard/reports/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setImportError(payload.error || "Import failed.");
        return;
      }

      setImportMessage(
        `Imported ${payload.paymentsCreated} payment(s) and ${payload.customersCreated} customer(s). Skipped ${payload.skipped}.`
      );
      await load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not read Excel file.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Reports</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Sales, orders, and menu performance for the selected period.
          </p>
          {importMessage && <p className="mt-2 text-sm text-[var(--success)]">{importMessage}</p>}
          {importError && <p className="mt-2 text-sm text-[var(--danger)]">{importError}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
            }}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-3 py-2 text-sm font-semibold text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {importing ? "Importing…" : "Import Excel File"}
          </button>
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-1 text-xs">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={p.set}
                className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text)]"
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className="input-theme rounded-xl px-3 py-2 text-sm"
          />
          <span className="text-xs text-[var(--text-dim)]">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className="input-theme rounded-xl px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--text-muted)]">Loading reports…</p>}

      {!loading && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Revenue", value: formatMoney(data.summary.revenue), tone: "text-[var(--gold-bright)]" },
              { label: "Orders", value: String(data.summary.totalOrders), tone: "text-[var(--text)]" },
              { label: "Completed", value: String(data.summary.completedOrders), tone: "text-[var(--success)]" },
              {
                label: "Avg order value",
                value: formatMoney(data.summary.averageOrderValue),
                tone: "text-[var(--info)]",
              },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-xs text-[var(--text-muted)]">{k.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            {/* Daily revenue */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="font-medium text-white">Revenue by day</h2>
              <div className="mt-4 flex h-40 items-end gap-1">
                {data.daily.map((d) => (
                  <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-[#d4a017]/30 to-[#f0c14b]"
                      style={{ height: `${Math.max(2, (d.revenue / maxDailyRevenue) * 100)}%` }}
                      title={`${d.date}: ${formatMoney(d.revenue)}`}
                    />
                    <span className="hidden text-[9px] text-[#555] sm:block">
                      {format(new Date(d.date + "T00:00:00"), "d")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-sm font-semibold text-[#f0c14b]">
                {formatMoney(data.summary.revenue)}
              </p>
            </section>

            {/* Status breakdown */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="font-medium text-white">Orders by status</h2>
              <ul className="mt-4 space-y-3">
                {ORDER_STATUSES.map((s) => {
                  const row = data.ordersByStatus.find((r) => r.status === s);
                  const count = row?.count ?? 0;
                  const pct = statusTotal ? (count / statusTotal) * 100 : 0;
                  return (
                    <li key={s}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-[#d6d3d1]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: STATUS_COLOR[s] }}
                          />
                          {STATUS_LABELS[s as OrderStatus]}
                        </span>
                        <span className="text-[#a8a29e]">
                          {count} · {formatMoney(row?.revenue ?? 0)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: STATUS_COLOR[s] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Top items */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="font-medium text-white">Top selling items</h2>
              {data.topItems.length === 0 ? (
                <p className="mt-3 text-sm text-[#78716c]">No completed sales in this period.</p>
              ) : (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs text-[#a8a29e]">
                    <tr>
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium">Sold</th>
                      <th className="pb-2 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topItems.map((t, i) => (
                      <tr key={t.name} className="border-b border-white/5">
                        <td className="py-2.5 text-white">
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d4a017]/15 text-[10px] font-bold text-[#f0c14b]">
                            {i + 1}
                          </span>
                          {t.name}
                        </td>
                        <td className="py-2.5 text-[#a8a29e]">{t.quantity}</td>
                        <td className="py-2.5 text-right font-medium text-[#f0c14b]">
                          {formatMoney(t.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Category breakdown */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="font-medium text-white">Revenue by category</h2>
              {data.categoryBreakdown.length === 0 ? (
                <p className="mt-3 text-sm text-[#78716c]">No completed sales in this period.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.categoryBreakdown.map((c) => {
                    const pct =
                      data.summary.revenue > 0
                        ? (c.revenue / data.summary.revenue) * 100
                        : 0;
                    return (
                      <li key={c.name}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-[#d6d3d1]">{c.name}</span>
                          <span className="text-[#a8a29e]">
                            {c.quantity} sold · {formatMoney(c.revenue)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#d4a017] to-[#f0c14b]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Recent orders */}
          <section className="overflow-x-auto rounded-2xl border border-white/10">
            <h2 className="border-b border-white/10 bg-white/[0.03] px-5 py-3 font-medium text-white">
              Orders in period
            </h2>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs text-[#a8a29e]">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Table</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#78716c]">
                      No orders in this period.
                    </td>
                  </tr>
                )}
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-white/5">
                    <td className="px-4 py-3 font-medium text-white">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-[#d6d3d1]">{o.customerName}</td>
                    <td className="px-4 py-3 text-[#a8a29e]">{o.tableNumber}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: STATUS_COLOR[o.status] ?? "#666" }}
                        />
                        {STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#a8a29e]">{o.itemCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#f0c14b]">
                      {formatMoney(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
