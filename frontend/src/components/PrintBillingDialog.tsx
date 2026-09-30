"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/utils";
import {
  GST_RATE,
  calcBillingTotals,
  type BillingOptions,
  type ReceiptOrder,
} from "@/lib/printReceipt";

type Props = {
  order: ReceiptOrder;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (options: BillingOptions) => void;
};

type DiscountMode = "amount" | "percent";

const QUICK_AMOUNTS = [50, 100, 200, 500] as const;
const QUICK_PERCENTS = [5, 10, 15, 20] as const;

export function PrintBillingDialog({ order, open, busy = false, onCancel, onConfirm }: Props) {
  const [wantDiscount, setWantDiscount] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discountInput, setDiscountInput] = useState("");

  const subtotal = useMemo(
    () => order.items.reduce((sum, item) => sum + item.subtotal, 0) || order.total,
    [order]
  );

  const parsedValue = useMemo(() => {
    if (!wantDiscount) return 0;
    const parsed = Number(discountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
  }, [wantDiscount, discountInput]);

  const billing = useMemo(() => {
    if (!wantDiscount || parsedValue <= 0) {
      return calcBillingTotals(subtotal);
    }
    if (discountMode === "percent") {
      return calcBillingTotals(subtotal, {
        discountPercent: Math.min(100, parsedValue),
      });
    }
    return calcBillingTotals(subtotal, {
      discountAmount: Math.min(parsedValue, subtotal),
    });
  }, [subtotal, wantDiscount, parsedValue, discountMode]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setWantDiscount(false);
      setDiscountMode("amount");
      setDiscountInput("");
    }, 0);
    return () => clearTimeout(timer);
  }, [open, order.orderNumber]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl shadow-black/50">
        <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(198,161,91,0.14),transparent)] px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
                Bill preview
              </p>
              <h3 className="mt-1 font-display text-2xl text-[var(--text)]">{order.orderNumber}</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                GST {Math.round(GST_RATE * 100)}% included · confirm before print
              </p>
            </div>
            <div className="rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Payable</p>
              <p className="text-lg font-bold tabular-nums text-[var(--gold-bright)]">
                {formatMoney(billing.grandTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2 text-sm text-[var(--text)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--text-muted)]">Items</span>
              <span className="font-semibold tabular-nums">{formatMoney(billing.subtotal)}</span>
            </div>
            {billing.discountAmount > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">
                  Discount
                  {billing.discountPercent > 0 ? ` (${billing.discountPercent}%)` : ""}
                </span>
                <span className="font-semibold tabular-nums text-[#22c55e]">
                  −{formatMoney(billing.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--text-muted)]">GST {Math.round(GST_RATE * 100)}%</span>
              <span className="font-semibold tabular-nums">{formatMoney(billing.gstAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--border)] pt-2">
              <span className="font-medium">Customer pays</span>
              <span className="text-base font-bold tabular-nums text-[var(--gold-bright)]">
                {formatMoney(billing.grandTotal)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Apply discount?</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Amount (Rs.) or percent — before GST
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={wantDiscount}
                disabled={busy}
                onClick={() => {
                  const next = !wantDiscount;
                  setWantDiscount(next);
                  if (!next) setDiscountInput("");
                }}
                className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
                  wantDiscount ? "bg-[var(--gold)]" : "bg-[var(--border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    wantDiscount ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {wantDiscount && (
              <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDiscountMode("amount");
                      setDiscountInput("");
                    }}
                    className={`rounded-lg py-2 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50 ${
                      discountMode === "amount"
                        ? "bg-[var(--gold)] text-[#101820]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Amount
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDiscountMode("percent");
                      setDiscountInput("");
                    }}
                    className={`rounded-lg py-2 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50 ${
                      discountMode === "percent"
                        ? "bg-[var(--gold)] text-[#101820]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    Percent
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {discountMode === "amount"
                    ? QUICK_AMOUNTS.filter((amount) => amount < subtotal).map((amount) => {
                        const selected = Number(discountInput) === amount;
                        return (
                          <button
                            key={amount}
                            type="button"
                            disabled={busy}
                            onClick={() => setDiscountInput(String(amount))}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition disabled:opacity-50 ${
                              selected
                                ? "bg-[var(--gold)] text-[#101820]"
                                : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]/50 hover:text-[var(--gold-bright)]"
                            }`}
                          >
                            −{formatMoney(amount)}
                          </button>
                        );
                      })
                    : QUICK_PERCENTS.map((percent) => {
                        const selected = Number(discountInput) === percent;
                        return (
                          <button
                            key={percent}
                            type="button"
                            disabled={busy}
                            onClick={() => setDiscountInput(String(percent))}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition disabled:opacity-50 ${
                              selected
                                ? "bg-[var(--gold)] text-[#101820]"
                                : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]/50 hover:text-[var(--gold-bright)]"
                            }`}
                          >
                            −{percent}%
                          </button>
                        );
                      })}
                </div>

                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs text-[var(--text-muted)]">
                    {discountMode === "amount" ? "Custom amount" : "Custom percent"}
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 focus-within:border-[var(--gold)]">
                    {discountMode === "amount" ? (
                      <span className="text-sm font-semibold text-[var(--text-dim)]">Rs.</span>
                    ) : null}
                    <input
                      type="number"
                      min={0}
                      max={discountMode === "percent" ? 100 : subtotal}
                      step="1"
                      value={discountInput}
                      disabled={busy}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
                    />
                    {discountMode === "percent" ? (
                      <span className="text-sm font-semibold text-[var(--text-dim)]">%</span>
                    ) : null}
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-[var(--border)] bg-[var(--bg-soft)]/60 px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--bg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm(
                discountMode === "percent" && billing.discountPercent > 0
                  ? { discountPercent: billing.discountPercent }
                  : { discountAmount: billing.discountAmount }
              )
            }
            className="flex-[1.35] rounded-xl bg-[var(--gold)] py-2.5 text-sm font-semibold text-[#101820] transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Printing…" : "Print KOT & Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}
