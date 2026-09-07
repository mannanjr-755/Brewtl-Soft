"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
};

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/categories");
    const data = await res.json();
    const cats: { id: string; name: string; sortOrder: number; items?: unknown[] }[] =
      data.categories ?? [];
    setCategories(
      cats.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, itemCount: c.items?.length ?? 0 }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/dashboard/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      setMessage("Category created.");
      load();
    }
  }

  async function saveRename(id: string) {
    if (editingName.trim()) {
      await fetch("/api/dashboard/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editingName.trim() }),
      });
      setMessage("Category renamed.");
    }
    setEditingId(null);
    load();
  }

  async function removeCategory(id: string) {
    if (!confirm("Delete this category and its items?")) return;
    await fetch(`/api/dashboard/categories?id=${id}`, { method: "DELETE" });
    setMessage("Category deleted.");
    load();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const a = next[index];
    const b = next[target];
    await Promise.all([
      fetch("/api/dashboard/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, sortOrder: b.sortOrder }),
      }),
      fetch("/api/dashboard/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, sortOrder: a.sortOrder }),
      }),
    ]);
    load();
  }

  if (loading) {
    return <p className="text-sm text-[#a8a29e]">Loading categories…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Categories</h1>
        <p className="mt-1 text-sm text-[#a8a29e]">
          Organise your menu. The order here controls how categories appear on the customer menu.
        </p>
      </div>
      {message && <p className="text-sm text-[#e8c547]">{message}</p>}

      <form onSubmit={createCategory} className="flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
        />
        <button
          type="submit"
          className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#000000]"
        >
          Add category
        </button>
      </form>

      {categories.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[#78716c]">
          No categories yet. Create one above, then add items from the Menu section.
        </p>
      )}

      <div className="space-y-2">
        {categories.map((c, i) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-6 text-center text-xs text-[#555]">{i + 1}</span>
              {editingId === c.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename(c.id)}
                  className="rounded-lg border border-[#d4a017]/50 bg-white/5 px-2 py-1 text-sm outline-none"
                />
              ) : (
                <p className="font-medium text-white">{c.name}</p>
              )}
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-[#a8a29e]">
                {c.itemCount} {c.itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === categories.length - 1}
                  onClick={() => move(i, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              {editingId === c.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveRename(c.id)}
                    className="rounded-lg bg-[#d4a017] px-2.5 py-1.5 font-semibold text-black"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditingName(c.name);
                  }}
                  className="rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10 hover:bg-white/10"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => removeCategory(c.id)}
                className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-red-300 ring-1 ring-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
