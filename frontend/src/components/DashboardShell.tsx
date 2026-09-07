import { auth, signOut } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TableRequestsPanel } from "@/components/TableRequestsPanel";
import {
  DashboardMobileNav,
  DashboardSidebar,
  type NavKey,
} from "@/components/DashboardSidebar";

export type { NavKey };

export async function DashboardShell({
  children,
  active,
  newOrderCount = 0,
  preparingCount = 0,
}: {
  children: React.ReactNode;
  active: NavKey;
  newOrderCount?: number;
  preparingCount?: number;
}) {
  const session = await auth();
  const userName = session?.user.name || "Admin";
  const roleLabel = session?.user.role === "ADMIN" ? "Administrator" : "Staff";
  const restaurantName = session?.user.restaurantName || "Bella Cucina";
  void newOrderCount;
  void preparingCount;

  const navbarControls = (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 text-[11px] font-bold leading-none text-[var(--gold-bright)]">
          {userName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-[var(--text)]">{userName}</p>
          <p className="truncate text-[10px] text-[var(--text-dim)]">{roleLabel}</p>
        </div>
      </div>
      <ThemeToggle className="shrink-0" />
      <TableRequestsPanel className="shrink-0" />
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--text-muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold-bright)]"
        >
          Log out
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <DashboardSidebar active={active} restaurantName={restaurantName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-elevated)]/80">
          {navbarControls}
        </header>

        <DashboardMobileNav active={active} />

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
