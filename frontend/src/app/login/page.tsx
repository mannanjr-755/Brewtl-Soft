import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Staff login",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,160,23,0.14),transparent_55%)]" />

      <Link
        href={process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-lg border border-[#d4a017]/40 px-3 py-2 text-xs font-semibold text-[#e8c547] transition hover:bg-[#d4a017]/10 sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to site
      </Link>

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d4a017] text-[#d4a017]">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <span className="font-display mt-3 text-3xl text-[#e8c547]">Bella Cucina</span>
          <span className="mt-1 text-xs uppercase tracking-[0.25em] text-[#777]">
            Staff login · Restaurant
          </span>
        </Link>

        <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6 sm:p-8">
          <h1 className="font-display text-2xl text-white">Staff sign in</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            Access your live orders dashboard, menu, and tables.
          </p>

          <div className="mt-6">
            <Suspense fallback={<p className="text-sm text-[#9ca3af]">Loading…</p>}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-6 rounded-xl border border-[#d4a017]/20 bg-[#d4a017]/5 p-3 text-xs leading-relaxed text-[#9ca3af]">
            Demo: <span className="text-[#e8c547]">admin@bellacucina.com</span> /{" "}
            <span className="text-[#e8c547]">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
