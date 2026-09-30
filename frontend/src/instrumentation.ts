/**
 * Next.js instrumentation hook — runs once when the server boots.
 *
 * On serverless the first request after a cold start would otherwise pay for
 * opening a Postgres connection to Neon (TLS handshake through the PgBouncer
 * pooler). Connecting during boot keeps that latency off the user-facing path
 * and validates DATABASE_URL before any traffic arrives.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.$connect();
    console.log("[db] connected");
  } catch (err) {
    // Never block boot: the retrying client in lib/prisma.ts will keep trying
    // per query, and surfacing this would take the whole app down.
    console.error("[db] initial connect failed:", (err as Error)?.message ?? err);
  }
}
