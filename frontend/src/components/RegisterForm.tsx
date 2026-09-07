"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function RegisterForm() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewSlug = useMemo(
    () => (slugTouched ? slug : slugify(restaurantName)),
    [slug, slugTouched, restaurantName]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const finalSlug = previewSlug;
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantName: restaurantName.trim(),
          slug: finalSlug,
          adminName: adminName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3 text-sm text-white outline-none placeholder:text-[#6b7280] focus:border-[#d4a017] focus:ring-1 focus:ring-[#d4a017]/40";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block text-[#9ca3af]">Restaurant name</span>
        <input
          required
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          className={inputClass}
          placeholder="Your restaurant name"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-[#9ca3af]">URL slug</span>
        <input
          required
          value={previewSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          className={inputClass}
          placeholder="my-restaurant"
        />
        <span className="mt-1 block text-xs text-[#666]">
          Customer menu: /r/{previewSlug || "your-slug"}/t/1
        </span>
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-[#9ca3af]">Your name</span>
        <input
          required
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          className={inputClass}
          placeholder="Admin name"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-[#9ca3af]">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@restaurant.com"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-[#9ca3af]">Password</span>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="At least 6 characters"
        />
      </label>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[#d4a017] py-3.5 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create restaurant"}
      </button>

      <p className="text-center text-sm text-[#9ca3af]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#e8c547] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
