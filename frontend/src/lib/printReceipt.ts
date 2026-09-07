import { formatMoney } from "@/lib/utils";

export type ReceiptItem = {
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type ReceiptOrder = {
  orderNumber: string;
  customerName: string;
  orderType?: string;
  total: number;
  createdAt: string | Date;
  specialRequest?: string | null;
  table?: { tableNumber: number } | null;
  items: ReceiptItem[];
};

export type ReceiptRestaurant = {
  name: string;
  phone?: string | null;
  address?: string | null;
};

/** Build printable HTML from existing order totals (no recalculation). */
export function buildReceiptHtml(order: ReceiptOrder, restaurant?: ReceiptRestaurant): string {
  const created =
    typeof order.createdAt === "string"
      ? new Date(order.createdAt)
      : order.createdAt;
  const itemsSubtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
  const typeLabel =
    order.orderType === "TAKE_AWAY"
      ? "Take Away"
      : order.orderType === "DINE_IN"
        ? "Dine In"
        : order.orderType || "";

  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.itemName)}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${formatMoney(i.unitPrice)}</td>
        <td class="num">${formatMoney(i.subtotal)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(order.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 0; padding: 16px; color: #111; }
    .receipt { max-width: 320px; margin: 0 auto; }
    h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
    .meta { font-size: 11px; text-align: center; color: #444; margin-bottom: 12px; line-height: 1.4; }
    .line { border-top: 1px dashed #999; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { padding: 4px 0; vertical-align: top; }
    th { text-align: left; border-bottom: 1px solid #ccc; font-weight: 600; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .totals { font-size: 12px; margin-top: 8px; }
    .totals .row { display: flex; justify-content: space-between; margin: 3px 0; }
    .totals .grand { font-weight: 700; font-size: 14px; margin-top: 6px; }
    .note { font-size: 11px; margin-top: 10px; }
    @media print {
      body { padding: 0; }
      @page { margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <h1>${escapeHtml(restaurant?.name || "Restaurant")}</h1>
    <div class="meta">
      ${restaurant?.address ? `${escapeHtml(restaurant.address)}<br/>` : ""}
      ${restaurant?.phone ? `Tel: ${escapeHtml(restaurant.phone)}<br/>` : ""}
      Receipt / Order: <strong>${escapeHtml(order.orderNumber)}</strong><br/>
      ${created.toLocaleString()}<br/>
      ${escapeHtml(order.customerName)}
      ${typeLabel ? ` · ${escapeHtml(typeLabel)}` : ""}
      ${order.table ? ` · Table ${order.table.tableNumber}` : ""}
    </div>
    <div class="line"></div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Price</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="line"></div>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatMoney(itemsSubtotal)}</span></div>
      <div class="row grand"><span>Total</span><span>${formatMoney(order.total)}</span></div>
    </div>
    ${
      order.specialRequest
        ? `<div class="note">Note: ${escapeHtml(order.specialRequest)}</div>`
        : ""
    }
    <div class="line"></div>
    <div class="meta">Thank you</div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open browser print dialog for an existing order. No order mutations. */
export function printOrderReceipt(
  order: ReceiptOrder,
  restaurant?: ReceiptRestaurant
): void {
  if (typeof window === "undefined") return;

  const html = buildReceiptHtml(order, restaurant);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    const win = window.open("", "_blank", "noopener,noreferrer,width=400,height=600");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      setTimeout(() => frame.remove(), 800);
    }
  };

  frame.onload = runPrint;
  setTimeout(runPrint, 300);
}
