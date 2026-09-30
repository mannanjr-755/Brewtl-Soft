import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = base;
}

/**
 * Prisma surfaces every failure to open/borrow a Postgres connection as one of
 * these codes. Neon sits behind a PgBouncer pooler, so a request can lose its
 * backend connection mid-flight (cold pooled backend, idle reclaim, or a
 * transient TLS reset) even though the schema and credentials are fine.
 *
 * Retrying is safe here because Prisma only runs `retryable: true` operations
 * (reads, createMany, ...) inside this wrapper. The one exception would be a
 * non-idempotent write that failed *after* the server applied it, which cannot
 * be distinguished from one that never reached the server — but in that case
 * the client did receive a response, so it reports the server error rather than
 * a connection code and we do not retry.
 */
const TRANSIENT_CONNECTION_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1008", // operation timed out
  "P1017", // server has closed the connection
  "P2024", // timed out fetching a new connection from the pool
  "P2028", // transaction API error (pool closed mid-transaction)
]);

/**
 * Not every connection failure carries a `code`. When the engine cannot even
 * open a socket, Prisma throws `PrismaClientInitializationError`, which has an
 * undefined `errorCode` and — on some transports — an empty message. So the
 * error name and the rendered text are checked as well.
 */
const TRANSIENT_MESSAGE_PARTS = [
  "can't reach database server",
  "timed out fetching a new connection",
  "server has closed the connection",
  "the database server is now closed",
  "connection pool timeout",
  "error in postgres connection",
  "terminating connection",
  "econnreset",
  "econnrefused",
  "etimedout",
];

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const e = err as { code?: unknown; errorCode?: unknown; name?: unknown; message?: unknown };

  if (typeof e.code === "string" && TRANSIENT_CONNECTION_CODES.has(e.code)) return true;
  if (typeof e.errorCode === "string" && TRANSIENT_CONNECTION_CODES.has(e.errorCode)) return true;

  // Any initialization failure is a connection-layer failure.
  if (e.name === "PrismaClientInitializationError") return true;

  if (typeof e.message === "string") {
    const msg = e.message.toLowerCase();
    if (TRANSIENT_MESSAGE_PARTS.some((part) => msg.includes(part))) return true;
  }

  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isTransient(err)) throw err;
      // Exponential backoff with jitter, so parallel requests that all fail at
      // once do not retry in lockstep.
      const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(backoff + Math.random() * BASE_DELAY_MS);
    }
  }
}

/** Client-level methods that must keep their own identity, not be wrapped. */
const PASSTHROUGH = new Set(["$connect", "$disconnect", "$on", "$use", "$extends"]);

const modelCache = new WeakMap<object, object>();

/** Wraps a model delegate (`prisma.customer`) so each query is retried. */
function wrapModel(model: object): object {
  const cached = modelCache.get(model);
  if (cached) return cached;

  const proxy = new Proxy(model, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "symbol" || typeof value !== "function") return value;

      const fn = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => withRetry(() => Promise.resolve(fn.apply(target, args)));
    },
  });

  modelCache.set(model, proxy);
  return proxy;
}

/**
 * `prisma` — a PrismaClient that transparently retries transient Postgres
 * connection failures. Use it exactly as you would the raw PrismaClient.
 */
export const prisma: PrismaClient = new Proxy(base, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof prop === "symbol" || value === undefined) return value;

    if (PASSTHROUGH.has(prop)) {
      // $connect can fail the same way; retry it too.
      if (prop === "$connect") {
        return (...args: unknown[]) =>
          withRetry(() => Promise.resolve((value as (...a: unknown[]) => unknown).apply(target, args)));
      }
      return value;
    }

    if (typeof value !== "function") return wrapModel(value as object);

    const fn = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => withRetry(() => Promise.resolve(fn.apply(target, args)));
  },
});
