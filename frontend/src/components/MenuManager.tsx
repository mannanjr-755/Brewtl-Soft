"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
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

const emptyItem = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  categoryId: "",
};

export function MenuManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [catToEdit, setCatToEdit] = useState<Category | null>(null);
  const [catEditName, setCatEditName] = useState("");
  const [catToDel, setCatToDel] = useState<Category | null>(null);
  const [catBusy, setCatBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/categories");
    const data = await res.json();
    const cats: Category[] = data.categories ?? [];
    setCategories(cats);
    setLoading(false);
    setItemForm((f) =>
      f.categoryId || !cats[0] ? f : { ...f, categoryId: cats[0].id }
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function renameCategory() {
    if (!catToEdit || !catEditName.trim()) return;
    setCatBusy(true);
    try {
      await fetch("/api/dashboard/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: catToEdit.id, name: catEditName.trim() }),
      });
      setMessage("Category renamed.");
      setTimeout(() => setMessage(null), 2200);
      load();
    } finally {
      setCatBusy(false);
      setCatToEdit(null);
    }
  }

  async function deleteCategory(id: string) {
    setCatBusy(true);
    try {
      await fetch(`/api/dashboard/categories?id=${id}`, { method: "DELETE" });
      setMessage("Category deleted.");
      setTimeout(() => setMessage(null), 2200);
      load();
    } finally {
      setCatBusy(false);
      setCatToDel(null);
    }
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      price: Number(itemForm.price),
      imageUrl: itemForm.imageUrl.trim() || null,
      categoryId: itemForm.categoryId,
      available: true,
    };

    if (editingItem) {
      await fetch("/api/dashboard/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingItem.id, ...payload }),
      });
      setEditingItem(null);
      setMessage("Item updated.");
    } else {
      await fetch("/api/dashboard/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage("Item created.");
    }

    setItemForm((f) => ({ ...emptyItem, categoryId: f.categoryId }));
    load();
  }

  async function toggleAvailable(item: MenuItem) {
    await fetch("/api/dashboard/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, available: !item.available }),
    });
    load();
  }

  async function deleteItem(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/dashboard/items?id=${id}`, { method: "DELETE" });
      setMessage("Item deleted.");
      setTimeout(() => setMessage(null), 2200);
      load();
    } finally {
      setDeleting(false);
      setItemToDelete(null);
    }
  }

  function startEdit(item: MenuItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      imageUrl: item.imageUrl ?? "",
      categoryId: item.categoryId,
    });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function onImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/dashboard/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Image upload failed.");
        return;
      }
      setItemForm((f) => ({ ...f, imageUrl: data.url }));
      setMessage("Image uploaded.");
    } catch {
      setMessage("Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#a8a29e]">Loading menu…</p>;
  }

  return (
    <div className="space-y-8">
      {/* Delete confirmation modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#141414] shadow-2xl shadow-black/50">
            {/* Red warning banner */}
            <div className="flex items-center gap-3 bg-red-500/10 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Delete Menu Item</p>
                <p className="text-xs text-[#9ca3af]">This action cannot be undone</p>
              </div>
            </div>
            {/* Item details */}
            <div className="px-5 py-4">
              <p className="text-sm text-[#d1d5db]">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">{itemToDelete.name}</span> from the menu?
              </p>
              <div className="mt-3 rounded-xl border border-[#2a2a2a] bg-[#0e0e0e] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af]">Price</span>
                  <span className="font-semibold text-[#f0c14b]">{formatMoney(itemToDelete.price)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[#9ca3af]">Status</span>
                  <span className={itemToDelete.available ? "text-[#22c55e]" : "text-[#ef4444]"}>
                    {itemToDelete.available ? "Available" : "Unavailable"}
                  </span>
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 border-t border-[#2a2a2a] px-5 py-4">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] py-2.5 text-sm font-medium text-[#d1d5db] transition hover:bg-[#222]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => deleteItem(itemToDelete.id)}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting…
                  </span>
                ) : (
                  "Delete Item"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category rename modal */}
      {catToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 shadow-2xl shadow-black/50">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4a017]">Rename Category</p>
            <h3 className="mt-3 text-lg font-semibold text-white">{catToEdit.name}</h3>
            <input
              autoFocus
              value={catEditName}
              onChange={(e) => setCatEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renameCategory(); } }}
              className="mt-4 w-full rounded-xl border border-[#2a2a2a] bg-[#0e0e0e] px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a017]"
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setCatToEdit(null)}
                className="flex-1 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] py-2.5 text-sm font-medium text-[#d1d5db] transition hover:bg-[#222]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={catBusy || !catEditName.trim()}
                onClick={renameCategory}
                className="flex-1 rounded-xl bg-[#d4a017] py-2.5 text-sm font-semibold text-black transition hover:bg-[#e8c547] disabled:opacity-50"
              >
                {catBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category delete modal */}
      {catToDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#141414] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 bg-red-500/10 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Delete Category</p>
                <p className="text-xs text-[#9ca3af]">This will also remove all items inside</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#d1d5db]">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">{catToDel.name}</span> and its{" "}
                <span className="font-medium text-white">{catToDel.items.length}</span> item{catToDel.items.length !== 1 ? "s" : ""}?
              </p>
            </div>
            <div className="flex gap-3 border-t border-[#2a2a2a] px-5 py-4">
              <button
                type="button"
                onClick={() => setCatToDel(null)}
                className="flex-1 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] py-2.5 text-sm font-medium text-[#d1d5db] transition hover:bg-[#222]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={catBusy}
                onClick={() => deleteCategory(catToDel.id)}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {catBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Menu</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage menu items. Changes appear on the customer menu automatically.
          Unavailable items are hidden from customers. Use Categories in the sidebar to organize groups.
        </p>
        {message && <p className="mt-2 text-sm text-[var(--gold-bright)]">{message}</p>}
      </div>

      {/* Item form */}
      <section ref={formRef} className="rounded-2xl border bg-white/[0.03] p-5 transition-colors duration-300" style={{ borderColor: editingItem ? "rgba(212,160,23,0.4)" : "rgba(255,255,255,0.1)" }}>
        {editingItem && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-[#d4a017]/30 bg-[#d4a017]/10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d4a017]/20 text-[10px] font-bold text-[#e8c547]">✎</span>
              <span className="text-sm text-[#e8c547]">
                Editing <span className="font-semibold text-white">{editingItem.name}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setEditingItem(null); setItemForm((f) => ({ ...emptyItem, categoryId: f.categoryId })); }}
              className="rounded-lg border border-[#d4a017]/30 px-2.5 py-1 text-xs font-medium text-[#e8c547] transition hover:bg-[#d4a017]/10"
            >
              Cancel edit
            </button>
          </div>
        )}
        <h2 className="font-medium text-white">
          {editingItem ? "Edit item" : "Add menu item"}
        </h2>
        <form onSubmit={saveItem} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            placeholder="Name"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={itemForm.price}
            onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
            placeholder="Price"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
          />
          <select
            required
            value={itemForm.categoryId}
            onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
            className="rounded-xl border border-white/10 bg-[#0c0f14] px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={itemForm.imageUrl}
            onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
            placeholder="Image URL (or upload below)"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
          />
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-[#d4a017]/40 bg-black/20 p-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
              {itemForm.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={itemForm.imageUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-7 w-7 text-[#666]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Dish image</p>
              <p className="mt-0.5 text-xs text-[#888]">JPG, PNG, WEBP, or GIF · max 2MB</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={onImageFileChange}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-[#d4a017]/50 bg-[#d4a017]/10 px-3 py-1.5 text-xs font-semibold text-[#e8c547] disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Choose image from file"}
                </button>
                {itemForm.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setItemForm((f) => ({ ...f, imageUrl: "" }))}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#aaa]"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
          </div>
          <textarea
            value={itemForm.description}
            onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            placeholder="Description"
            rows={2}
            className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
          />
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#000000] disabled:opacity-50"
            >
              {editingItem ? "Save changes" : "Create item"}
            </button>
            {editingItem && (
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setItemForm((f) => ({ ...emptyItem, categoryId: f.categoryId }));
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[#d6d3d1]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Items list — flat list (categories managed on Categories page) */}
      <section className="space-y-2">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          All menu items
        </h2>
        {categories.flatMap((cat) => cat.items).length === 0 && (
          <p className="text-sm text-[var(--text-dim)]">No items yet.</p>
        )}
        {categories.flatMap((cat) =>
          cat.items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-[var(--bg-card)] px-4 py-3 transition-all duration-200 ${
                editingItem?.id === item.id
                  ? "border-[var(--gold)]/50 bg-[var(--gold)]/[0.04] shadow-[0_0_15px_rgba(212,160,23,0.08)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImagePlus className="h-4 w-4 text-[var(--text-dim)]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text)]">
                    {item.name}{" "}
                    <span className="text-[var(--text-muted)]">· {formatMoney(item.price)}</span>
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {item.available ? "Available" : "Unavailable"}
                    {item.description ? ` · ${item.description}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggleAvailable(item)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1.5 hover:bg-[var(--bg-elevated)]"
                >
                  {item.available ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1.5 hover:bg-[var(--bg-elevated)]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setItemToDelete(item)}
                  className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
