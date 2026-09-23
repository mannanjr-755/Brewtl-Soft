import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Staff login",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12 text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(198,161,91,0.22),transparent_55%)]" />

      <Link
        href={process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-lg border border-[var(--gold)]/40 px-3 py-2 text-xs font-semibold text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/10 sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to site
      </Link>

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="hero" showWordmark />
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)] sm:p-8">
          <h1 className="font-display text-2xl text-[var(--text)]">Staff sign in</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Access your live orders dashboard, menu, and tables.
          </p>

          <div className="mt-6">
            <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Loading…</p>}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-6 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-3 text-xs leading-relaxed text-[var(--text-muted)]">
            Demo: <span className="text-[var(--gold-bright)]">admin@brewtl.com</span> /{" "}
            <span className="text-[var(--gold-bright)]">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
