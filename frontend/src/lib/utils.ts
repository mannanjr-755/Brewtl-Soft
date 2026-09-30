export const ORDER_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "REPORTED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  REPORTED: "Reported",
};

/** Orders that count toward report revenue (saved out of kitchen Completed). */
export function isReportedOrder(status: string): boolean {
  return status === "COMPLETED" || status === "REPORTED";
}

/** Next allowed status in the kitchen flow, or null if already completed/reported */
export function nextStatus(current: string): OrderStatus | null {
  if (current === "COMPLETED" || current === "REPORTED") return null;
  const index = ORDER_STATUSES.indexOf(current as OrderStatus);
  if (index < 0 || index >= ORDER_STATUSES.length - 1) return null;
  const next = ORDER_STATUSES[index + 1];
  // Kitchen advance never jumps into REPORTED — that is the Save action.
  if (next === "REPORTED") return null;
  return next;
}

export function formatMoney(amount: number): string {
  return `Rs. ${new Intl.NumberFormat("en-PK").format(Math.round(amount))}`;
}

export function parseJsonObject(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return {};
}
