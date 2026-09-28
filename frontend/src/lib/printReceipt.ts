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
  orderType?: string | null;
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

/** The BREWTL brand mark is the single source of truth for every receipt. */
const BRAND_LOGO = "/logo.png";

const GOLD = "#b8860b";
const GOLD_SOFT = "#d4af37";
const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const HAIRLINE = "#d9d9d9";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeDate(value: string | Date): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function two(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTime(value: string | Date) {
  const d = safeDate(value);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}  ${two(d.getHours())}:${two(
    d.getMinutes()
  )}`;
}

function orderTypeLabel(orderType: string | null | undefined) {
  if (orderType === "TAKE_AWAY") return "Take Away";
  if (orderType === "DINE_IN") return "Dine In";
  return orderType || "";
}

function isWalkingCustomer(customerName: string) {
  return customerName.trim().toLowerCase() === "walking customer";
}

/**
 * Build a self-contained printable receipt document.
 *
 * The markup is deliberately dependency-free: it is written straight into a
 * same-origin iframe, so the only external asset is the restaurant logo, and
 * the layout is sized for 80mm thermal paper while still printing cleanly on
 * A4/Letter.
 */
export function buildReceiptHtml(
  order: ReceiptOrder,
  restaurant?: ReceiptRestaurant
): string {
  const restaurantName = restaurant?.name?.trim() || "Restaurant";
  const typeLabel = orderTypeLabel(order.orderType);
  const itemsSubtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const showTable = Boolean(order.table) && !isWalkingCustomer(order.customerName);
  const logoSrc = BRAND_LOGO;

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td class="name">
            <span class="qty">${item.quantity}&times;</span>${escapeHtml(item.itemName)}
          </td>
          <td class="num rate">${formatMoney(item.unitPrice)}</td>
          <td class="num amt">${formatMoney(item.subtotal)}</td>
        </tr>`
    )
    .join("");

  const metaRows = [
    `<div class="kv"><span>Order No.</span><b>${escapeHtml(order.orderNumber)}</b></div>`,
    `<div class="kv"><span>Date</span><b>${escapeHtml(formatDateTime(order.createdAt))}</b></div>`,
    `<div class="kv"><span>Served To</span><b>${escapeHtml(order.customerName || "Guest")}</b></div>`,
    typeLabel ? `<div class="kv"><span>Order Type</span><b>${escapeHtml(typeLabel)}</b></div>` : "",
    showTable
      ? `<div class="kv"><span>Table</span><b>${escapeHtml(String(order.table!.tableNumber))}</b></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipt ${escapeHtml(order.orderNumber)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif;
    color: ${INK};
    font-size: 11px;
    line-height: 1.45;
  }
  .sheet {
    width: 76mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 6mm 4mm 8mm;
  }

  /* ---------- Brand header ---------- */
  .brand { text-align: center; }
  .logo-wrap { height: 22mm; display: flex; align-items: center; justify-content: center; }
  .logo { max-height: 20mm; max-width: 44mm; width: auto; height: auto; }
  .wordmark {
    display: none;
    font-size: 21px;
    font-weight: 800;
    letter-spacing: 4px;
    color: ${GOLD};
  }
  .brand-name {
    margin: 2mm 0 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: ${INK};
  }
  .brand-sub {
    margin: 0.6mm 0 0;
    font-size: 9px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: ${MUTED};
  }
  .brand-contact {
    margin: 1.4mm 0 0;
    font-size: 9.5px;
    color: ${MUTED};
    line-height: 1.5;
  }
  .rule-gold {
    height: 3px;
    margin: 3mm 0 0;
    border-top: 1.5px solid ${GOLD};
    border-bottom: 1px solid ${GOLD_SOFT};
  }
  .rule-thin { border-top: 1px solid ${HAIRLINE}; margin: 2.5mm 0; }
  .rule-dash { border-top: 1px dashed ${HAIRLINE}; margin: 2.5mm 0; }

  .doc-title {
    text-align: center;
    margin: 2.5mm 0 0;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: ${GOLD};
  }

  /* ---------- Meta ---------- */
  .meta { margin-top: 2mm; }
  .kv {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 3mm;
    font-size: 10px;
    padding: 0.5mm 0;
  }
  .kv span { color: ${MUTED}; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.6px; }
  .kv b { font-weight: 600; text-align: right; }

  /* ---------- Items ---------- */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: ${MUTED};
    text-align: left;
    padding: 1.2mm 0;
    border-bottom: 1px solid ${HAIRLINE};
  }
  tbody td {
    padding: 1.6mm 0;
    border-bottom: 1px dotted ${HAIRLINE};
    vertical-align: top;
  }
  tbody tr:last-child td { border-bottom: 0; }
  td.name { padding-right: 2mm; }
  td.name .qty {
    display: inline-block;
    min-width: 6mm;
    font-weight: 700;
    color: ${GOLD};
  }
  .num { text-align: right; white-space: nowrap; }
  td.rate { width: 17mm; color: ${MUTED}; font-size: 9.5px; }
  td.amt { width: 20mm; font-weight: 600; }

  .count-line {
    margin-top: 1mm;
    font-size: 9px;
    color: ${MUTED};
    text-align: right;
  }

  /* ---------- Totals ---------- */
  .totals { margin-top: 2mm; }
  .total-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 3mm;
    font-size: 10.5px;
    padding: 0.8mm 0;
  }
  .total-row .label { color: ${MUTED}; }
  .total-row .value { font-weight: 600; }
  .grand {
    margin-top: 1.5mm;
    padding: 2.2mm 3mm;
    background: #fbf7ec;
    border: 1px solid ${GOLD_SOFT};
    border-radius: 2px;
  }
  .grand .label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: ${INK};
  }
  .grand .value {
    font-size: 15px;
    font-weight: 800;
    color: ${GOLD};
    letter-spacing: 0.4px;
  }

  .note {
    margin-top: 2mm;
    padding: 1.8mm 2.4mm;
    font-size: 9.5px;
    color: ${INK};
    background: #f6f6f6;
    border-left: 2px solid ${GOLD_SOFT};
    border-radius: 2px;
  }
  .note b {
    display: block;
    font-size: 8.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${MUTED};
    margin-bottom: 0.6mm;
  }

  /* ---------- Footer ---------- */
  .thanks {
    text-align: center;
    margin-top: 4mm;
  }
  .thanks-main {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 19px;
    font-weight: 700;
    color: ${GOLD};
    letter-spacing: 0.5px;
    margin: 0;
  }
  .thanks-sub {
    margin: 1mm 0 0;
    font-size: 9px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: ${MUTED};
  }
  .footer {
    text-align: center;
    margin-top: 4mm;
  }
  .footer-brand {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: ${MUTED};
  }
  .footer-brand b { color: ${GOLD}; font-weight: 700; }

  @media print {
    body { padding: 0; background: #fff; }
    .sheet { width: auto; max-width: none; margin: 0; padding: 4mm 3mm 6mm; }
    @page { margin: 4mm; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="brand">
      <div class="logo-wrap">
        <img
          class="logo"
          src="${escapeHtml(logoSrc)}"
          alt=""
          onerror="this.style.display='none';this.parentNode.querySelector('.wordmark').style.display='block';"
        />
        <div class="wordmark">${escapeHtml(restaurantName)}</div>
      </div>
      <h1 class="brand-name">${escapeHtml(restaurantName)}</h1>
      ${
        restaurant?.address
          ? `<p class="brand-contact">${escapeHtml(restaurant.address)}</p>`
          : ""
      }
      ${
        restaurant?.phone
          ? `<p class="brand-contact">Tel: ${escapeHtml(restaurant.phone)}</p>`
          : ""
      }
    </header>

    <div class="rule-gold"></div>
    <p class="doc-title">Sales Receipt</p>

    <section class="meta">${metaRows}</section>

    <div class="rule-dash"></div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <p class="count-line">${itemCount} item${itemCount === 1 ? "" : "s"}</p>

    <div class="rule-dash"></div>

    <section class="totals">
      <div class="total-row">
        <span class="label">Subtotal</span>
        <span class="value">${formatMoney(itemsSubtotal)}</span>
      </div>
      <div class="grand total-row">
        <span class="label">Total</span>
        <span class="value">${formatMoney(order.total)}</span>
      </div>
    </section>

    ${
      order.specialRequest
        ? `<div class="note"><b>Note</b>${escapeHtml(order.specialRequest)}</div>`
        : ""
    }

    <div class="rule-thin"></div>

    <section class="thanks">
      <p class="thanks-main">Thank You!</p>
      <p class="thanks-sub">Please visit again</p>
    </section>

    <div class="rule-dash"></div>

    <footer class="footer">
      <p class="footer-brand">Powered by <b>Lexcore Solutions</b></p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Print a receipt using a hidden same-origin iframe.
 *
 * Resolves once the print dialog has been handed off to the browser. Waits for
 * the logo to decode first so it is never missing from the printed output.
 */
export function printOrderReceipt(
  order: ReceiptOrder,
  restaurant?: ReceiptRestaurant
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  let html: string;
  try {
    html = buildReceiptHtml(order, restaurant);
  } catch {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", "receipt");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "80mm";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";
    frame.style.pointerEvents = "none";
    document.body.appendChild(frame);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => {
        try {
          frame.remove();
        } catch {
          /* ignore */
        }
      }, 1000);
      resolve();
    };

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) {
      frame.remove();
      const win = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const runPrint = () => {
      if (settled) return;
      settled = true;
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        /* printing is best-effort */
      }
      finish();
    };

    // Give the logo a chance to decode, but never block printing on it.
    const images = Array.from(doc.images ?? []);
    const ready = images.length
      ? Promise.race([
          Promise.all(
            images.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((res) => {
                    img.addEventListener("load", () => res(), { once: true });
                    img.addEventListener("error", () => res(), { once: true });
                  })
            )
          ),
          new Promise<void>((res) => window.setTimeout(res, 1200)),
        ])
      : Promise.resolve();

    void ready.then(() => {
      window.setTimeout(runPrint, 60);
    });
  });
}
