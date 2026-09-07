import type { Metadata } from "next";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { RegisterForm } from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "Register restaurant",
};

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,160,23,0.14),transparent_55%)]" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d4a017] text-[#d4a017]">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <span className="font-display mt-3 text-3xl text-[#e8c547]">Restaurant OS</span>
          <span className="mt-1 text-xs uppercase tracking-[0.25em] text-[#777]">
            Create your restaurant
          </span>
        </Link>

        <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6 sm:p-8">
          <h1 className="font-display text-2xl text-white">Get started</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
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
