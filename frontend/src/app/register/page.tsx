import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { RegisterForm } from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "Register restaurant",
};

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12 text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(198,161,91,0.22),transparent_55%)]" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="hero" />
          <span className="font-display mt-3 text-3xl text-[var(--gold-bright)]">Brewtl</span>
          <span className="mt-1 text-xs uppercase tracking-[0.25em] text-[var(--text-dim)]">
            Create your restaurant
          </span>
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)] sm:p-8">
          <h1 className="font-display text-2xl text-[var(--text)]">Get started</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create your restaurant and staff account. Then add tables and menu from the dashboard.
          </p>
          <div className="mt-6">
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}
