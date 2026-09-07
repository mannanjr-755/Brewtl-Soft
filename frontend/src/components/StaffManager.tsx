"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

const emptyForm = { name: "", email: "", password: "", role: "STAFF" };

export function StaffManager({ isAdmin }: { isAdmin: boolean }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/staff");
    const data = await res.json();
    setStaff(data.staff ?? []);
    setCurrentUserId(data.currentUserId ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(`Staff member added.`);
      setForm(emptyForm);
      load();
    } else {
      setMessage(data.error || "Could not add staff member.");
    }
  }

  async function updateRole(id: string, role: string) {
    if (!isAdmin) return;
    const res = await fetch("/api/dashboard/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Role updated." : data.error || "Update failed.");
    load();
  }

  async function toggleActive(s: StaffRow) {
    if (!isAdmin) return;
    const res = await fetch("/api/dashboard/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Account status updated." : data.error || "Update failed.");
    load();
  }

  async function removeStaff(id: string) {
    if (!isAdmin) return;
    if (!confirm("Remove this staff member permanently?")) return;
    const res = await fetch(`/api/dashboard/staff?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    setMessage(res.ok ? "Staff member removed." : data.error || "Could not remove.");
    load();
  }

  if (loading) {
    return <p className="text-sm text-[#a8a29e]">Loading staff…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Staff</h1>
        <p className="mt-1 text-sm text-[#a8a29e]">
          Team members who can sign in to the dashboard.{" "}
          {isAdmin ? (
            "Admins can add, promote, and remove staff."
          ) : (
            <span className="text-[#e8c547]">Only admins can manage staff.</span>
          )}
        </p>
      </div>
      {message && <p className="text-sm text-[#e8c547]">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {isAdmin && (
          <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-medium text-white">Add staff member</h2>
            <form onSubmit={createStaff} className="mt-4 space-y-3">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
              />
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Temporary password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#0c0f14] px-3 py-2 text-sm outline-none focus:border-[#d4a017]"
              >
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#000000] disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add staff member"}
              </button>
            </form>
          </section>
        )}

        <section className="space-y-2">
          {staff.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[#78716c]">
              No staff members yet.
            </p>
          )}
          {staff.map((s) => {
            const isSelf = s.id === currentUserId;
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d4a017]/15 text-sm font-bold text-[#e8c547]">
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white">
                      {s.name}
                      {isSelf && <span className="ml-2 text-xs text-[#78716c]">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-[#78716c]">{s.email}</p>
                    <p className="text-[11px] text-[#555]">
                      Joined {format(new Date(s.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ring-1 ${
                      s.role === "ADMIN"
                        ? "bg-[#d4a017]/15 text-[#e8c547] ring-[#d4a017]/40"
                        : "bg-white/5 text-[#a8a29e] ring-white/10"
                    }`}
                  >
                    {s.role === "ADMIN" && <ShieldCheck className="h-3.5 w-3.5" />}
                    {s.role === "ADMIN" ? "Admin" : "Staff"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ring-1 ${
                      s.active
                        ? "bg-[#22c55e]/10 text-[#22c55e] ring-[#22c55e]/30"
                        : "bg-red-500/10 text-red-300 ring-red-500/30"
                    }`}
                  >
                    {s.active ? "Active" : "Inactive"}
                  </span>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateRole(s.id, s.role === "ADMIN" ? "STAFF" : "ADMIN")}
                        disabled={isSelf}
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
                        title={isSelf ? "You cannot change your own role" : "Toggle role"}
                      >
                        {s.role === "ADMIN" ? "Make Staff" : "Make Admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(s)}
                        disabled={isSelf}
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
                        title={isSelf ? "You cannot deactivate yourself" : "Toggle status"}
                      >
                        {s.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStaff(s.id)}
                        disabled={isSelf}
                        className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
