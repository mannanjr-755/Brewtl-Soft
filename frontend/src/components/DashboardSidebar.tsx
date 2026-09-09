"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Table2,
  UtensilsCrossed,
  Tags,
  Users,
  BarChart3,
  Package,
  Footprints,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "orders"
  | "tables"
  | "menu"
  | "walking-customer"
  | "categories"
  | "customers"
  | "staff"
  | "reports"
  | "inventory"
  | "payments"
  | "profile"
  | "orders-link"
  | "kitchen";

const STORAGE_KEY = "crm-sidebar-collapsed";

const nav: { href: string; label: string; icon: LucideIcon; key: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "orders" },
  {
    href: "/dashboard/walking-customer",
    label: "Walking Customer",
    icon: Footprints,
    key: "walking-customer",
  },
  { href: "/dashboard/tables", label: "Tables", icon: Table2, key: "tables" },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, key: "menu" },
  { href: "/dashboard/categories", label: "Categories", icon: Tags, key: "categories" },
  { href: "/dashboard/customers", label: "Customers", icon: Users, key: "customers" },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, key: "reports" },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package, key: "inventory" },
];

function isNavActive(active: NavKey, key: string) {
  if (active === "orders" || active === "orders-link" || active === "kitchen") {
    return key === "orders";
  }
  return key === active;
}

export function DashboardSidebar({
  active,
  restaurantName,
}: {
  active: NavKey;
  restaurantName: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
      } catch {
        /* ignore */
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] lg:flex ${
        ready ? "transition-[width] duration-200 ease-out" : ""
      } ${collapsed ? "w-[72px]" : "w-[240px]"}`}
    >
      <div
        className={`flex items-center border-b border-[var(--border)] py-4 ${
          collapsed ? "flex-col gap-2 px-2" : "gap-3 px-3"
        }`}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[var(--gold)]/40 shadow-[var(--shadow)]">
          <Image
            src="/logo.png"
            alt="BON PANIER"
            width={40}
            height={40}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight text-[var(--gold-bright)]">
              {restaurantName}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)]">
              Bakery Cafe
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-bright)]"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav
        className={`flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-3 ${
          collapsed ? "px-1.5" : "px-2"
        }`}
      >
        {nav.map((item) => {
          const isActive = isNavActive(active, item.key);
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center rounded-lg text-sm transition ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                isActive
                  ? "bg-gradient-to-r from-[var(--gold)]/25 to-transparent text-[var(--gold-bright)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate leading-none">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function DashboardMobileNav({ active }: { active: NavKey }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 py-2 lg:hidden">
      {nav.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${
            isNavActive(active, item.key)
              ? "bg-[var(--gold)]/20 text-[var(--gold-bright)]"
              : "text-[var(--text-muted)]"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
