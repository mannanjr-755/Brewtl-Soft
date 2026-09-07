"use client";

import { useEffect, useState } from "react";

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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then((r) => r.json())
      .then((data) => setForm(data.restaurant));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setForm(data.restaurant);
      setMessage("Profile saved.");
    } else {
      setMessage("Could not save profile.");
    }
  }

  if (!form) {
    return <p className="text-sm text-[#a8a29e]">Loading profile…</p>;
  }

  function field(
    key: keyof Profile,
    label: string,
    opts?: { multiline?: boolean; hint?: string }
  ) {
    const value = form![key] ?? "";
    return (
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-[#d6d3d1]">{label}</span>
        {opts?.multiline ? (
          <textarea
            rows={4}
            value={value}
            onChange={(e) => setForm({ ...form!, [key]: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-[#d4a017]"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setForm({ ...form!, [key]: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-[#d4a017]"
          />
        )}
        {opts?.hint && <span className="mt-1 block text-xs text-[#78716c]">{opts.hint}</span>}
      </label>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Restaurant profile</h1>
      <p className="mt-1 text-sm text-[#a8a29e]">
        This information appears on the customer menu page.
      </p>
      {message && <p className="mt-2 text-sm text-[#f0c14b]">{message}</p>}

      <form onSubmit={onSave} className="mt-6 max-w-2xl space-y-4">
        {field("name", "Restaurant name")}
        {field("description", "Description", { multiline: true })}
        {field("logo", "Logo image URL")}
        {field("coverImage", "Cover image URL")}
        {field("phone", "Phone")}
        {field("whatsapp", "WhatsApp number")}
        {field("address", "Address")}
        {field("googleMapsUrl", "Google Maps link")}
        {field("openingHours", "Opening hours (JSON)", {
          multiline: true,
          hint: 'Example: {"mon":"11:00–22:00","tue":"11:00–22:00"}',
        })}
        {field("socialLinks", "Social links (JSON)", {
          multiline: true,
          hint: 'Example: {"instagram":"https://...","facebook":"https://..."}',
        })}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#d4a017] px-5 py-2.5 text-sm font-semibold text-[#050505] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
