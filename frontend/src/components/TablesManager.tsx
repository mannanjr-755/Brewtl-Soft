"use client";

import { useCallback, useEffect, useState } from "react";

type TableRow = {
  id: string;
  tableNumber: number;
  uniqueCode: string;
  active: boolean;
};

export function TablesManager() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [slug, setSlug] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/tables");
    const data = await res.json();
    setTables(data.tables ?? []);
    setSlug(data.slug ?? "");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
      // NFC/QR must open the Digital Menu app directly (not the CRM host).
      const menuBase = (
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      ).replace(/\/$/, "");
      setOrigin(menuBase);
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/dashboard/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber: Number(tableNumber) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not create table.");
      return;
    }
    setMessage(`Table ${data.table.tableNumber} created. URL: ${data.url}`);
    setTableNumber("");
    load();
  }

  function tableUrl(n: number) {
    return `${origin}/r/${slug}/t/${n}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Tables</h1>
      <p className="mt-1 text-sm text-[#a8a29e]">
        Each table has a URL for NFC cards and QR codes. The card only stores this URL — not the
        menu.
      </p>

      <form onSubmit={createTable} className="mt-6 flex flex-wrap gap-2">
        <input
          type="number"
          min={1}
          required
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="Table number"
          className="w-40 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
        />
        <button
          type="submit"
          className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#000000]"
        >
          Create table
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-[#e8c547]">{message}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[#a8a29e]">
            <tr>
              <th className="px-4 py-3 font-medium">Table</th>
              <th className="px-4 py-3 font-medium">Customer URL (NFC / QR)</th>
              <th className="px-4 py-3 font-medium">Code</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.id} className="border-b border-white/5">
                <td className="px-4 py-3 font-medium text-white">{t.tableNumber}</td>
                <td className="px-4 py-3">
                  <a
                    href={tableUrl(t.tableNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#e8c547] underline-offset-2 hover:underline"
                  >
                    {origin
                      ? `${origin}/r/${slug}/t/${t.tableNumber}`
                      : `/r/${slug}/t/${t.tableNumber}`}
                  </a>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#a8a29e]">{t.uniqueCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
