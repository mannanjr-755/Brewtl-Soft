"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ToastProvider";
import {
  getReceiptPaperWidth,
  setReceiptPaperWidth,
  type ReceiptPaperWidth,
} from "@/lib/printReceipt";

type Profile = {
  name: string;
  logo: string | null;
  coverImage: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  googleMapsUrl: string | null;
  openingHours: string | null;
  socialLinks: string | null;
};

export function ProfileManager() {
  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [paperMm, setPaperMm] = useState<ReceiptPaperWidth>(() => getReceiptPaperWidth());

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then((r) => r.json())
      .then((data) => setForm(data.restaurant));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setReceiptPaperWidth(paperMm);
    const res = await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setForm(data.restaurant);
      toast.success("Settings saved. New prints will use these details.");
    } else {
      toast.error("Could not save settings.");
    }
  }

  if (!form) {
    return <p className="text-sm text-[var(--text-muted)]">Loading settings…</p>;
  }

  function field(
    key: keyof Profile,
    label: string,
    opts?: { multiline?: boolean; hint?: string }
  ) {
    const value = form![key] ?? "";
    return (
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-[var(--text)]">{label}</span>
        {opts?.multiline ? (
          <textarea
            rows={3}
            value={value}
            onChange={(e) => setForm({ ...form!, [key]: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--gold)]"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setForm({ ...form!, [key]: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--gold)]"
          />
        )}
        {opts?.hint && (
          <span className="mt-1 block text-xs text-[var(--text-dim)]">{opts.hint}</span>
        )}
      </label>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--text)] sm:text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Edit business details used on receipts and the kitchen dashboard.
      </p>

      <form onSubmit={onSave} className="mt-6 max-w-2xl space-y-5">
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--gold-bright)]">Receipt & business</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Name, address, and phone print on KOT and bills.
            </p>
          </div>
          {field("name", "Business name")}
          {field("address", "Address")}
          {field("phone", "Phone")}
          {field("whatsapp", "WhatsApp number")}

          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--text)]">
              Thermal paper width
            </span>
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              Match your printer roll. Wrong size can clip the slip.
            </p>
            <div className="flex gap-2">
              {([58, 80] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPaperMm(w)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    paperMm === w
                      ? "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold-bright)]"
                      : "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-muted)] hover:border-[var(--gold)]/50"
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--gold-bright)]">Extra details</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Optional profile fields.</p>
          </div>
          {field("description", "Description", { multiline: true })}
          {field("logo", "Logo image URL")}
          {field("coverImage", "Cover image URL")}
          {field("googleMapsUrl", "Google Maps link")}
          {field("openingHours", "Opening hours (JSON)", {
            multiline: true,
            hint: 'Example: {"mon":"11:00–22:00","tue":"11:00–22:00"}',
          })}
          {field("socialLinks", "Social links (JSON)", {
            multiline: true,
            hint: 'Example: {"instagram":"https://...","facebook":"https://..."}',
          })}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-[#101820] transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
