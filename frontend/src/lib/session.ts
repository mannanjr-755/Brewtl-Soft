import { auth } from "@/lib/auth";

/** Returns the logged-in staff session, or null if not authenticated */
export async function requireStaff() {
  const session = await auth();
  if (!session?.user?.restaurantId) return null;
  return session;
}

/** Returns the logged-in admin session, or null if not authenticated or not an admin */
export async function requireAdmin() {
  const session = await requireStaff();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}
