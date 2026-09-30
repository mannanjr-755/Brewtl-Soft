export const GST_RATE = 0.15;

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

export type BillingOptions = {
  /** Flat discount in Rs. Applied before GST. */
  discountAmount?: number;
  /** Percent discount 0–100. Applied before GST if discountAmount is not set. */
  discountPercent?: number;
};

export type BillingTotals = {
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotal: number;
};

/** Subtotal → optional discount (Rs or %) → fixed 15% GST → grand total. */
export function calcBillingTotals(
  subtotal: number,
  options?: BillingOptions
): BillingTotals {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(options?.discountPercent) || 0)
  );
  const fromPercent =
    discountPercent > 0 ? Math.round((safeSubtotal * discountPercent) / 100) : 0;
  const explicitAmount = Math.max(0, Number(options?.discountAmount) || 0);
  const discountAmount = Math.min(
    explicitAmount > 0 ? explicitAmount : fromPercent,
    safeSubtotal
  );
  const taxableAmount = Math.max(0, safeSubtotal - discountAmount);
  const gstAmount = Math.round(taxableAmount * GST_RATE);
  const grandTotal = taxableAmount + gstAmount;
  return {
    subtotal: safeSubtotal,
    discountAmount,
    discountPercent,
    taxableAmount,
    gstAmount,
    grandTotal,
  };
}

function orderSubtotal(order: ReceiptOrder): number {
  const fromItems = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  return fromItems > 0 ? fromItems : Math.max(0, Number(order.total) || 0);
}

/**
 * Receipt footer attribution — text only, centered on the slip.
 */

export type ReceiptPaperWidth = 58 | 80;

const PAPER_STORAGE_KEY = "Brewtl-receipt-paper-mm";

export function getReceiptPaperWidth(): ReceiptPaperWidth {
  if (typeof window === "undefined") return 58;
  try {
    const raw = localStorage.getItem(PAPER_STORAGE_KEY);
    if (raw === "80") return 80;
  } catch {
    /* ignore */
  }
  return 58;
}

export function setReceiptPaperWidth(width: ReceiptPaperWidth): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PAPER_STORAGE_KEY, String(width));
  } catch {
    /* ignore */
  }
}

/** Compact money for narrow thermal columns (no thin-space padding). */
function formatReceiptMoney(amount: number): string {
  return `Rs.${new Intl.NumberFormat("en-PK").format(Math.round(amount))}`;
}

/**
 * 58mm: ~48mm content (safe printable zone on narrow rolls).
 * 80mm: ~72mm content (safe printable zone on wide rolls).
 */
function receiptStyle(paperMm: ReceiptPaperWidth): string {
  const contentMm = paperMm === 80 ? 72 : 48;
  const pageMm = paperMm;
  const padX = paperMm === 80 ? "2.5mm" : "1mm";
  const nameSize = paperMm === 80 ? "14px" : "12px";
  const subSize = paperMm === 80 ? "9px" : "8px";
  const itemSize = paperMm === 80 ? "10px" : "9px";
  const totalsGrand = paperMm === 80 ? "13px" : "12px";
  const logoMm = paperMm === 80 ? "14mm" : "11mm";
  const lxSize = paperMm === 80 ? "7.5px" : "6.5px";

  return `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      color: #000;
      font-size: 11px;
      line-height: 1.3;
      width: ${contentMm}mm;
      max-width: ${contentMm}mm;
      margin: 0 auto;
    }
    .receipt { width: ${contentMm}mm; max-width: ${contentMm}mm; padding: 1.5mm ${padX} 2mm; }
    .center { text-align: center; }
    .logo { display: block; width: ${logoMm}; height: ${logoMm}; margin: 0 auto 1mm; object-fit: contain; }
    .r-name { font-size: ${nameSize}; font-weight: 700; letter-spacing: 0.04em; margin: 0; text-align: center; overflow-wrap: anywhere; }
    .r-sub { font-size: ${subSize}; letter-spacing: 0; margin: 0.4mm 0 0; text-align: center; overflow-wrap: anywhere; }
    hr.dash { border: 0; border-top: 1px dashed #000; margin: 1.2mm 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .kv td { padding: 0.25mm 0; font-size: ${itemSize}; vertical-align: top; }
    .kv td.k { width: 34%; color: #333; padding-right: 1mm; }
    .kv td.v { width: 66%; text-align: right; font-weight: 600; overflow-wrap: anywhere; word-break: break-word; }
    .items { font-size: ${itemSize}; }
    .items th { font-size: 8px; text-transform: uppercase; letter-spacing: 0; padding: 0 0 0.6mm; border-bottom: 1px solid #000; text-align: left; }
    .items td { padding: 0.5mm 0; vertical-align: top; }
    .items .n { text-align: right; white-space: nowrap; padding-left: 1mm; font-variant-numeric: tabular-nums; }
    .items .item { width: 52%; padding-right: 1mm; overflow-wrap: anywhere; word-break: break-word; }
    .items .qty { width: 12%; }
    .items .amt { width: 36%; }
    .items .unit { display: block; font-size: 7.5px; font-weight: 500; color: #333; margin-top: 0.2mm; }
    .totals { font-size: ${itemSize}; }
    .totals td { padding: 0.35mm 0; }
    .totals td.l { width: 48%; overflow-wrap: anywhere; }
    .totals td.r { width: 52%; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .totals tr.grand td { font-size: ${totalsGrand}; padding-top: 0.8mm; border-top: 1px solid #000; }
    .note { font-size: 8.5px; margin-top: 1mm; word-break: break-word; }
    .note b { text-transform: uppercase; }
    .thanks { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; margin: 1.8mm 0 0; text-align: center; }
    .lx { margin-top: 3.5mm; text-align: center; }
    .lx-text { font-size: ${lxSize}; font-weight: 600; letter-spacing: 0.06em; margin: 0; text-align: center; overflow-wrap: anywhere; }
    .lx-text strong { font-weight: 800; }
    .feed { height: 0; }
    .kot-banner { font-size: ${paperMm === 80 ? "18px" : "15px"}; font-weight: 800; letter-spacing: 0.14em; margin: 1mm 0 0; }
    .kot-copy { font-size: 8px; letter-spacing: 0.1em; margin: 0.4mm 0 0; }
    .kot-line { display: flex; align-items: flex-start; gap: 1.5mm; padding: 0.8mm 0; border-bottom: 1px dashed #000; font-size: ${paperMm === 80 ? "13px" : "11px"}; font-weight: 700; }
    .kot-qty { min-width: 8mm; font-size: ${paperMm === 80 ? "16px" : "13px"}; font-weight: 800; line-height: 1.1; }
    .kot-name { flex: 1; overflow-wrap: anywhere; word-break: break-word; }

    @media screen {
      body { background: #eceff3; padding: 16px 0; width: ${contentMm}mm; }
      .receipt { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
    }
    @page { size: ${pageMm}mm auto; margin: 0; }
    @media print {
      html, body { width: ${contentMm}mm; max-width: ${contentMm}mm; margin: 0; padding: 0; background: #fff; }
      .receipt { width: ${contentMm}mm; max-width: ${contentMm}mm; padding: 1.5mm ${padX} 2mm; margin: 0; box-shadow: none; }
      .feed { display: block; height: 2mm; }
    }
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Build printable HTML from existing order totals (no recalculation). */
export function buildReceiptHtml(
  order: ReceiptOrder,
  restaurant?: ReceiptRestaurant,
  logoSrc?: string | null,
  billingOptions?: BillingOptions,
  paperMm: ReceiptPaperWidth = 58
): string {
  const billing = calcBillingTotals(orderSubtotal(order), billingOptions);
  const typeLabel =
    order.orderType === "TAKE_AWAY"
      ? "Take Away"
      : order.orderType === "DINE_IN"
        ? "Dine In"
        : order.orderType || "";

  const isWalking = order.customerName === "Walking Customer";
  const tableLabel =
    !isWalking && order.table ? `Table ${order.table.tableNumber}` : null;

  const logo = logoSrc
    ? `<img class="logo" src="${logoSrc}" alt="" />`
    : "";

  const rows = order.items
    .map(
      (i) => `<tr>
        <td class="item">${escapeHtml(i.itemName)}<span class="unit">@ ${formatReceiptMoney(i.unitPrice)}</span></td>
        <td class="n qty">${i.quantity}</td>
        <td class="n amt">${formatReceiptMoney(i.subtotal)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(order.orderNumber)}</title>
  <style>${receiptStyle(paperMm)}</style>
</head>
<body>
  <div class="receipt">
    ${logo}
    <p class="r-name">${escapeHtml(restaurant?.name || "Restaurant")}</p>
    ${
      restaurant?.address
        ? `<p class="r-sub">${escapeHtml(restaurant.address)}</p>`
        : ""
    }
    ${
      restaurant?.phone
        ? `<p class="r-sub">Tel: ${escapeHtml(restaurant.phone)}</p>`
        : ""
    }

    <hr class="dash" />

    <table class="kv">
      <tr><td class="k">Receipt</td><td class="v">${escapeHtml(order.orderNumber)}</td></tr>
      <tr><td class="k">Date</td><td class="v">${escapeHtml(formatDateTime(order.createdAt))}</td></tr>
      <tr><td class="k">Customer</td><td class="v">${escapeHtml(order.customerName)}</td></tr>
      ${typeLabel ? `<tr><td class="k">Type</td><td class="v">${escapeHtml(typeLabel)}</td></tr>` : ""}
      ${tableLabel ? `<tr><td class="k">Table</td><td class="v">${escapeHtml(tableLabel)}</td></tr>` : ""}
    </table>

    <hr class="dash" />

    <table class="items">
      <thead>
        <tr>
          <th class="item">Item</th>
          <th class="n qty">Qty</th>
          <th class="n amt">Amt</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <hr class="dash" />

    <table class="totals">
      <tr><td class="l">Subtotal</td><td class="r">${formatReceiptMoney(billing.subtotal)}</td></tr>
      ${
        billing.discountAmount > 0
          ? `<tr><td class="l">Discount${
              billing.discountPercent > 0 ? ` (${billing.discountPercent}%)` : ""
            }</td><td class="r">-${formatReceiptMoney(billing.discountAmount)}</td></tr>`
          : ""
      }
      <tr><td class="l">GST ${Math.round(GST_RATE * 100)}%</td><td class="r">${formatReceiptMoney(billing.gstAmount)}</td></tr>
      <tr class="grand"><td class="l">TOTAL</td><td class="r">${formatReceiptMoney(billing.grandTotal)}</td></tr>
    </table>

    ${
      order.specialRequest
        ? `<div class="note"><b>Note:</b> ${escapeHtml(order.specialRequest)}</div>`
        : ""
    }

    <p class="thanks">THANK YOU</p>

    <div class="lx">
      <p class="lx-text">POWERED BY <strong>LEXCORE</strong> SOLUTIONS</p>
    </div>

    <div class="feed"></div>
  </div>
</body>
</html>`;
}

/** Kitchen ticket: items and quantities only, no prices. */
export function buildKotHtml(
  order: ReceiptOrder,
  restaurant?: ReceiptRestaurant,
  paperMm: ReceiptPaperWidth = 58
): string {
  const typeLabel =
    order.orderType === "TAKE_AWAY"
      ? "Take Away"
      : order.orderType === "DINE_IN"
        ? "Dine In"
        : order.orderType || "";

  const isWalking = order.customerName === "Walking Customer";
  const tableLabel =
    !isWalking && order.table ? `Table ${order.table.tableNumber}` : null;

  const lines = order.items
    .map(
      (i) => `<div class="kot-line">
        <span class="kot-qty">${i.quantity}×</span>
        <span class="kot-name">${escapeHtml(i.itemName)}</span>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KOT ${escapeHtml(order.orderNumber)}</title>
  <style>${receiptStyle(paperMm)}</style>
</head>
<body>
  <div class="receipt">
    <p class="r-name">${escapeHtml(restaurant?.name || "Restaurant")}</p>
    <p class="kot-banner center">KOT</p>
    <p class="kot-copy center">KITCHEN ORDER TICKET</p>

    <hr class="dash" />

    <table class="kv">
      <tr><td class="k">KOT No</td><td class="v">${escapeHtml(order.orderNumber)}</td></tr>
      <tr><td class="k">Date</td><td class="v">${escapeHtml(formatDateTime(order.createdAt))}</td></tr>
      ${typeLabel ? `<tr><td class="k">Type</td><td class="v">${escapeHtml(typeLabel)}</td></tr>` : ""}
      ${tableLabel ? `<tr><td class="k">Table</td><td class="v">${escapeHtml(tableLabel)}</td></tr>` : ""}
      <tr><td class="k">Customer</td><td class="v">${escapeHtml(order.customerName)}</td></tr>
    </table>

    <hr class="dash" />

    ${lines}

    ${
      order.specialRequest
        ? `<div class="note"><b>Note:</b> ${escapeHtml(order.specialRequest)}</div>`
        : ""
    }

    <div class="feed"></div>
  </div>
</body>
</html>`;
}

/**
 * Inline the Brewtl logo as a data URI. A data URI guarantees the print window
 * never shows a missing-image box, and it loads synchronously enough that the
 * logo is always present on the printed receipt.
 */
let logoPromise: Promise<string | null> | null = null;

function loadLogoDataUri(): Promise<string | null> {
  if (logoPromise) return logoPromise;

  logoPromise = (async () => {
    if (typeof window === "undefined") return null;
    try {
      const res = await fetch("/logo.png", { cache: "force-cache" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  })();

  return logoPromise;
}

/** Wait until every image in the document has settled, so nothing prints blank. */
function waitForImages(doc: Document, timeoutMs = 3000): Promise<void> {
  const images = Array.from(doc.images);
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = 0;
    const done = () => {
      settled += 1;
      if (settled >= pending.length) resolve();
    };
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    setTimeout(resolve, timeoutMs);
  });
}

/**
 * Print one HTML document and resolve after the dialog closes, so the next
 * slip can open without the browser dropping it.
 */
function printHtmlDocument(html: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const win = frame.contentWindow;
    const doc = frame.contentDocument || win?.document;
    if (!doc || !win) {
      frame.remove();
      const popup = window.open("", "_blank", "noopener,noreferrer,width=400,height=600");
      if (!popup) {
        resolve();
        return;
      }
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      const finishPopup = () => {
        popup.close();
        resolve();
      };
      popup.addEventListener("afterprint", () => setTimeout(finishPopup, 250), { once: true });
      void waitForImages(popup.document).then(() => {
        popup.focus();
        popup.print();
      });
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setTimeout(() => frame.remove(), 200);
      resolve();
    };

    let started = false;
    const runPrint = async () => {
      if (started) return;
      started = true;
      try {
        await waitForImages(doc);
        win.addEventListener("afterprint", () => setTimeout(finish, 250), { once: true });
        win.focus();
        win.print();
        // If the dialog never reports afterprint, still release the caller.
        setTimeout(finish, 90000);
      } catch {
        finish();
      }
    };

    frame.onload = () => void runPrint();
    // iframe onload is unreliable for document.write; the timeout is the
    // guarantee that the dialog always opens.
    setTimeout(() => void runPrint(), 400);
  });
}

/** Print the kitchen ticket first, then the customer bill. No order mutations. */
export async function printOrderReceipt(
  order: ReceiptOrder,
  restaurant?: ReceiptRestaurant,
  billingOptions?: BillingOptions
): Promise<void> {
  if (typeof window === "undefined") return;

  const paperMm = getReceiptPaperWidth();
  const logo = await loadLogoDataUri();
  await printHtmlDocument(buildKotHtml(order, restaurant, paperMm));
  await printHtmlDocument(buildReceiptHtml(order, restaurant, logo, billingOptions, paperMm));
}
