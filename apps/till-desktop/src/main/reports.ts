import { formatGbp, localStamp } from "@tillpro/shared";
import type { StaffPublic } from "@tillpro/shared";
import type { ReportColumn, ReportMeta, ReportResult } from "../engine/types";
import { currentShiftId, getDb, writeAudit } from "./db";

type Range = { from: string; to: string };
type Runner = (range: Range, shiftOnly: boolean) => Record<string, string | number | null>[];

interface Definition extends ReportMeta {
  columns: ReportColumn[];
  run: Runner;
}

const money = (pence: number) => formatGbp(Number(pence) || 0);

function rangeClause(column: string, range: Range, shiftOnly: boolean): { sql: string; params: (string | number)[] } {
  if (shiftOnly) return { sql: `${column} IS NOT NULL AND shift_id = ?`, params: [currentShiftId()] };
  return {
    sql: `(? = '' OR substr(${column}, 1, 10) >= ?) AND (? = '' OR substr(${column}, 1, 10) <= ?)`,
    params: [range.from, range.from, range.to, range.to],
  };
}

function salesWhere(range: Range, shiftOnly: boolean, kind = "sale") {
  const dated = rangeClause("created_at", range, shiftOnly);
  return { sql: `kind = '${kind}' AND ${dated.sql}`, params: dated.params };
}

function summaryRows(range: Range, shiftOnly: boolean, blind: boolean) {
  const database = getDb();
  const where = salesWhere(range, shiftOnly);
  const totals = database
    .prepare(
      `SELECT COUNT(*) as sales, COALESCE(SUM(total_pence),0) as gross, COALESCE(SUM(discount_pence),0) as disc, COALESCE(SUM(vat_pence),0) as vat, COALESCE(SUM(change_pence),0) as change
       FROM sales WHERE ${where.sql}`,
    )
    .get(...where.params) as { sales: number; gross: number; disc: number; vat: number; change: number };
  const cash = database
    .prepare(
      `SELECT COALESCE(SUM(t.amount_pence),0) as v FROM tenders t JOIN sales s ON s.id = t.sale_id WHERE t.type = 'cash' AND s.${where.sql}`,
    )
    .get(...where.params) as { v: number };
  const card = database
    .prepare(
      `SELECT COALESCE(SUM(t.amount_pence),0) as v FROM tenders t JOIN sales s ON s.id = t.sale_id WHERE t.type = 'card' AND s.${where.sql}`,
    )
    .get(...where.params) as { v: number };
  const payoutWhere = salesWhere(range, shiftOnly, "payout");
  const payouts = database.prepare(`SELECT COALESCE(SUM(pay_out_pence),0) as v FROM sales WHERE ${payoutWhere.sql}`).get(...payoutWhere.params) as { v: number };
  const refunds = database
    .prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total_pence),0) as v FROM sales WHERE ${salesWhere(range, shiftOnly, "refund").sql}`)
    .get(...salesWhere(range, shiftOnly, "refund").params) as { c: number; v: number };
  const expected = Number(cash.v) - Number(totals.change) - Number(payouts.v);
  const rows: Record<string, string | number | null>[] = [
    { label: "Sales", value: String(totals.sales) },
    { label: "Gross", value: money(totals.gross) },
    { label: "Discounts", value: money(totals.disc) },
    { label: "VAT", value: money(totals.vat) },
    { label: "Card takings", value: money(card.v) },
    { label: "Refunds", value: `${refunds.c} · ${money(refunds.v)}` },
    { label: "Pay outs", value: money(payouts.v) },
  ];
  if (!blind) {
    rows.splice(5, 0, { label: "Cash takings", value: money(cash.v) });
    rows.push({ label: "Expected cash in drawer", value: money(expected) });
  }
  return rows;
}

const labelColumns: ReportColumn[] = [
  { key: "label", header: "Item" },
  { key: "value", header: "Value", align: "right" },
];

function productRows(range: Range, order: "top" | "slow" | "all" | "profit") {
  const database = getDb();
  const where = salesWhere(range, false);
  const rows = database
    .prepare(
      `SELECT p.name as name, p.category_id as category, COALESCE(SUM(l.qty),0) as qty,
              COALESCE(SUM(l.amount_pence),0) as amount, COALESCE(SUM(l.cost_pence * l.qty),0) as cost, p.stock_qty as stock
       FROM products p
       LEFT JOIN sale_lines l ON l.product_id = p.id
       LEFT JOIN sales s ON s.id = l.sale_id AND ${where.sql}
       WHERE p.active = 1
       GROUP BY p.id
       ORDER BY ${order === "slow" ? "qty ASC, p.name" : order === "profit" ? "(amount - cost) DESC" : "amount DESC"}`,
    )
    .all(...where.params) as { name: string; category: string; qty: number; amount: number; cost: number; stock: number }[];
  const sliced = order === "all" || order === "profit" ? rows : rows.slice(0, 20);
  return sliced.map((row) => {
    const profit = Number(row.amount) - Number(row.cost);
    const margin = Number(row.amount) > 0 ? `${Math.round((profit / Number(row.amount)) * 100)}%` : "—";
    return {
      name: row.name,
      category: row.category,
      qty: Number(row.qty),
      amount: money(row.amount),
      cost: money(row.cost),
      profit: money(profit),
      margin,
      stock: Number(row.stock),
    };
  });
}

const definitions: Definition[] = [
  { id: "x-report", name: "X Report", group: "Till", description: "Current shift totals. Does not reset the till.", needsManager: false, blind: false, resets: false, columns: labelColumns, run: (range) => summaryRows(range, true, false) },
  { id: "s-report", name: "S Report", group: "Till", description: "Sales summary for the selected dates.", needsManager: false, blind: false, resets: false, columns: labelColumns, run: (range) => summaryRows(range, false, false) },
  { id: "blind-s", name: "Blind S", group: "Till", description: "Period summary with expected cash hidden, for a cash-up count.", needsManager: false, blind: true, resets: false, columns: labelColumns, run: (range) => summaryRows(range, false, true) },
  { id: "blind-z", name: "Blind Z", group: "Till", description: "Shift change with expected cash hidden. Clears this shift's transactions.", needsManager: true, blind: true, resets: true, columns: labelColumns, run: (range) => summaryRows(range, true, true) },
  { id: "z-report", name: "Z Report", group: "Till", description: "Shift change. Saves the Z report, clears this shift's transactions, and opens the next shift.", needsManager: true, blind: false, resets: true, columns: labelColumns, run: (range) => summaryRows(range, true, false) },
  {
    id: "sales-by-product",
    name: "Sales by product",
    group: "Retail",
    description: "Quantity and takings for each product.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Product" },
      { key: "qty", header: "Qty", align: "right", format: "number" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => productRows(range, "all").map(({ name, qty, amount }) => ({ name, qty, amount })),
  },
  {
    id: "sales-by-category",
    name: "Sales by category",
    group: "Retail",
    description: "Takings grouped by department.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Category" },
      { key: "qty", header: "Qty", align: "right" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false);
      const rows = getDb()
        .prepare(
          `SELECT c.name as name, COALESCE(SUM(l.qty),0) as qty, COALESCE(SUM(l.amount_pence),0) as amount
           FROM sale_lines l
           JOIN sales s ON s.id = l.sale_id
           LEFT JOIN products p ON p.id = l.product_id
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE ${where.sql}
           GROUP BY COALESCE(c.name, 'Manual')
           ORDER BY amount DESC`,
        )
        .all(...where.params) as { name: string | null; qty: number; amount: number }[];
      return rows.map((row) => ({ name: row.name ?? "Manual", qty: Number(row.qty), amount: money(row.amount) }));
    },
  },
  {
    id: "sales-by-staff",
    name: "Sales by staff",
    group: "Retail",
    description: "Takings for each cashier.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Staff" },
      { key: "sales", header: "Sales", align: "right" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false);
      const rows = getDb()
        .prepare(`SELECT staff_name as name, staff_id as id, COUNT(*) as sales, COALESCE(SUM(total_pence),0) as amount FROM sales WHERE ${where.sql} GROUP BY staff_id ORDER BY amount DESC`)
        .all(...where.params) as { name: string; id: string; sales: number; amount: number }[];
      return rows.map((row) => ({ name: `${row.name} (${row.id})`, sales: Number(row.sales), amount: money(row.amount) }));
    },
  },
  {
    id: "sales-by-payment",
    name: "Sales by payment type",
    group: "Retail",
    description: "Cash, card and split takings.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Payment" },
      { key: "sales", header: "Sales", align: "right" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false);
      const rows = getDb()
        .prepare(`SELECT payment_label as name, COUNT(*) as sales, COALESCE(SUM(total_pence),0) as amount FROM sales WHERE ${where.sql} GROUP BY payment_label`)
        .all(...where.params) as { name: string; sales: number; amount: number }[];
      return rows.map((row) => ({ name: row.name || "—", sales: Number(row.sales), amount: money(row.amount) }));
    },
  },
  {
    id: "sales-by-hour",
    name: "Sales by hour",
    group: "Retail",
    description: "Takings for each hour of the day.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "hour", header: "Hour" },
      { key: "sales", header: "Sales", align: "right" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false);
      const rows = getDb()
        .prepare(`SELECT substr(created_at, 12, 2) as hour, COUNT(*) as sales, COALESCE(SUM(total_pence),0) as amount FROM sales WHERE ${where.sql} GROUP BY hour ORDER BY hour`)
        .all(...where.params) as { hour: string; sales: number; amount: number }[];
      return rows.map((row) => ({ hour: `${row.hour}:00`, sales: Number(row.sales), amount: money(row.amount) }));
    },
  },
  {
    id: "vat",
    name: "VAT report",
    group: "Retail",
    description: "Net, VAT and gross for 20%, 5% and 0%.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "rate", header: "Rate" },
      { key: "net", header: "Net", align: "right" },
      { key: "vat", header: "VAT", align: "right" },
      { key: "gross", header: "Gross", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false);
      const rows = getDb()
        .prepare(
          `SELECT l.vat_rate as rate,
                  COALESCE(SUM(l.amount_pence - ROUND(l.amount_pence * l.vat_rate / (100.0 + l.vat_rate))),0) as net,
                  COALESCE(SUM(ROUND(l.amount_pence * l.vat_rate / (100.0 + l.vat_rate))),0) as vat,
                  COALESCE(SUM(l.amount_pence),0) as gross
           FROM sale_lines l JOIN sales s ON s.id = l.sale_id
           WHERE ${where.sql}
           GROUP BY l.vat_rate
           ORDER BY l.vat_rate DESC`,
        )
        .all(...where.params) as { rate: number; net: number; vat: number; gross: number }[];
      return rows.map((row) => ({ rate: `${row.rate}%`, net: money(row.net), vat: money(row.vat), gross: money(row.gross) }));
    },
  },
  {
    id: "refunds-voids",
    name: "Refunds and voids",
    group: "Retail",
    description: "Refund slips and void audit entries.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "when", header: "When" },
      { key: "type", header: "Type" },
      { key: "detail", header: "Detail" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => {
      const refundWhere = salesWhere(range, false, "refund");
      const refunds = getDb()
        .prepare(`SELECT created_at, slip_no, reason, total_pence, staff_id FROM sales WHERE ${refundWhere.sql}`)
        .all(...refundWhere.params) as { created_at: string; slip_no: number; reason: string; total_pence: number; staff_id: string }[];
      const dated = rangeClause("created_at", range, false);
      const voids = getDb()
        .prepare(`SELECT created_at, action, detail, staff_id FROM audit_log WHERE action LIKE 'void%' AND ${dated.sql}`)
        .all(...dated.params) as { created_at: string; action: string; detail: string; staff_id: string }[];
      return [
        ...refunds.map((row) => ({ when: row.created_at, type: "Refund", detail: `Slip ${row.slip_no} · ${row.reason ?? ""} · ${row.staff_id}`, amount: money(row.total_pence) })),
        ...voids.map((row) => ({ when: row.created_at, type: row.action, detail: `${row.detail} · ${row.staff_id}`, amount: "" })),
      ];
    },
  },
  {
    id: "discounts",
    name: "Discounts",
    group: "Retail",
    description: "Sales that included a line or basket discount.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "slip", header: "Slip" },
      { key: "when", header: "When" },
      { key: "discount", header: "Discount", align: "right" },
      { key: "total", header: "Total", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false);
      const rows = getDb()
        .prepare(`SELECT slip_no, created_at, discount_pence, total_pence FROM sales WHERE discount_pence > 0 AND ${where.sql} ORDER BY slip_no DESC`)
        .all(...where.params) as { slip_no: number; created_at: string; discount_pence: number; total_pence: number }[];
      return rows.map((row) => ({ slip: row.slip_no, when: row.created_at, discount: money(row.discount_pence), total: money(row.total_pence) }));
    },
  },
  {
    id: "petty-cash",
    name: "Petty cash",
    group: "Retail",
    description: "Pay outs from the drawer.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "when", header: "When" },
      { key: "staff", header: "Staff" },
      { key: "reason", header: "Reason" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false, "payout");
      const rows = getDb()
        .prepare(`SELECT created_at, staff_name, reason, pay_out_pence FROM sales WHERE ${where.sql} ORDER BY created_at DESC`)
        .all(...where.params) as { created_at: string; staff_name: string; reason: string; pay_out_pence: number }[];
      return rows.map((row) => ({ when: row.created_at, staff: row.staff_name, reason: row.reason, amount: money(row.pay_out_pence) }));
    },
  },
  {
    id: "no-sale",
    name: "No sale log",
    group: "Retail",
    description: "Times the cash drawer was opened without a sale.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "when", header: "When" },
      { key: "staff", header: "Staff" },
      { key: "reason", header: "Reason" },
    ],
    run: (range) => {
      const dated = rangeClause("created_at", range, false);
      const rows = getDb()
        .prepare(`SELECT created_at, staff_id, reason FROM drawer_events WHERE ${dated.sql} ORDER BY created_at DESC`)
        .all(...dated.params) as { created_at: string; staff_id: string; reason: string }[];
      return rows.map((row) => ({ when: row.created_at, staff: row.staff_id, reason: row.reason }));
    },
  },
  {
    id: "cash-up",
    name: "Cash-up history",
    group: "Retail",
    description: "Counted cash against the expected drawer, and the variance.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "when", header: "When" },
      { key: "expected", header: "Expected", align: "right" },
      { key: "counted", header: "Counted", align: "right" },
      { key: "variance", header: "Variance", align: "right" },
    ],
    run: (range) => {
      const dated = rangeClause("created_at", range, false);
      const rows = getDb()
        .prepare(`SELECT created_at, expected_pence, counted_pence, variance_pence, blind FROM cash_ups WHERE ${dated.sql} ORDER BY created_at DESC`)
        .all(...dated.params) as { created_at: string; expected_pence: number; counted_pence: number; variance_pence: number; blind: number }[];
      return rows.map((row) => ({
        when: row.created_at,
        expected: row.blind ? "Hidden" : money(row.expected_pence),
        counted: money(row.counted_pence),
        variance: row.blind ? "Hidden" : money(row.variance_pence),
      }));
    },
  },
  {
    id: "stock-level",
    name: "Stock levels",
    group: "Retail",
    description: "Current quantity for every product.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Product" },
      { key: "stock", header: "Stock", align: "right" },
      { key: "min", header: "Minimum", align: "right" },
    ],
    run: () =>
      (getDb().prepare("SELECT name, stock_qty as stock, min_stock as min FROM products WHERE active = 1 ORDER BY name").all() as { name: string; stock: number; min: number }[]).map((row) => ({
        name: row.name,
        stock: Number(row.stock),
        min: Number(row.min),
      })),
  },
  {
    id: "low-stock",
    name: "Low stock",
    group: "Retail",
    description: "Products at or below their minimum.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Product" },
      { key: "stock", header: "Stock", align: "right" },
      { key: "min", header: "Minimum", align: "right" },
    ],
    run: () =>
      (getDb().prepare("SELECT name, stock_qty as stock, min_stock as min FROM products WHERE active = 1 AND stock_qty <= min_stock ORDER BY stock_qty").all() as { name: string; stock: number; min: number }[]).map(
        (row) => ({ name: row.name, stock: Number(row.stock), min: Number(row.min) }),
      ),
  },
  {
    id: "stock-movement",
    name: "Stock movement",
    group: "Retail",
    description: "Sales, refunds and manual adjustments.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "when", header: "When" },
      { key: "product", header: "Product" },
      { key: "delta", header: "Change", align: "right" },
      { key: "reason", header: "Reason" },
    ],
    run: (range) => {
      const dated = rangeClause("m.created_at", range, false);
      const rows = getDb()
        .prepare(
          `SELECT m.created_at, COALESCE(p.name, m.product_id) as product, m.qty_delta as delta, m.reason
           FROM stock_movements m LEFT JOIN products p ON p.id = m.product_id
           WHERE ${dated.sql} ORDER BY m.created_at DESC LIMIT 500`,
        )
        .all(...dated.params) as { created_at: string; product: string; delta: number; reason: string }[];
      return rows.map((row) => ({ when: row.created_at, product: row.product, delta: Number(row.delta), reason: row.reason }));
    },
  },
  {
    id: "top-sellers",
    name: "Top sellers",
    group: "Retail",
    description: "Best selling products in the period.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Product" },
      { key: "qty", header: "Qty", align: "right" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => productRows(range, "top").map(({ name, qty, amount }) => ({ name, qty, amount })),
  },
  {
    id: "slow-sellers",
    name: "Slow sellers",
    group: "Retail",
    description: "Products with the fewest sales in the period.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Product" },
      { key: "qty", header: "Qty", align: "right" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => productRows(range, "slow").map(({ name, qty, amount }) => ({ name, qty, amount })),
  },
  {
    id: "profit",
    name: "Profit and margin",
    group: "Retail",
    description: "Takings against cost price.",
    needsManager: true,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Product" },
      { key: "amount", header: "Takings", align: "right" },
      { key: "cost", header: "Cost", align: "right" },
      { key: "profit", header: "Profit", align: "right" },
      { key: "margin", header: "Margin", align: "right" },
    ],
    run: (range) => productRows(range, "profit").map(({ name, amount, cost, profit, margin }) => ({ name, amount, cost, profit, margin })),
  },
  {
    id: "customer-sales",
    name: "Customer sales",
    group: "Retail",
    description: "Takings for named customers.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "name", header: "Customer" },
      { key: "sales", header: "Sales", align: "right" },
      { key: "amount", header: "Amount", align: "right" },
    ],
    run: (range) => {
      const where = salesWhere(range, false);
      const rows = getDb()
        .prepare(`SELECT customer_name as name, COUNT(*) as sales, COALESCE(SUM(total_pence),0) as amount FROM sales WHERE customer_name IS NOT NULL AND customer_name != '' AND ${where.sql} GROUP BY customer_name ORDER BY amount DESC`)
        .all(...where.params) as { name: string; sales: number; amount: number }[];
      return rows.map((row) => ({ name: row.name, sales: Number(row.sales), amount: money(row.amount) }));
    },
  },
  {
    id: "transaction-list",
    name: "Transaction list",
    group: "Retail",
    description: "Every slip in the period.",
    needsManager: false,
    blind: false,
    resets: false,
    columns: [
      { key: "slip", header: "Slip" },
      { key: "when", header: "When" },
      { key: "staff", header: "Staff" },
      { key: "kind", header: "Kind" },
      { key: "amount", header: "Amount", align: "right" },
      { key: "payment", header: "Payment" },
    ],
    run: (range) => {
      const dated = rangeClause("created_at", range, false);
      const rows = getDb()
        .prepare(`SELECT slip_no, created_at, staff_id, kind, total_pence, pay_out_pence, payment_label FROM sales WHERE ${dated.sql} ORDER BY slip_no DESC`)
        .all(...dated.params) as { slip_no: number; created_at: string; staff_id: string; kind: string; total_pence: number; pay_out_pence: number; payment_label: string }[];
      return rows.map((row) => ({
        slip: row.slip_no,
        when: row.created_at,
        staff: row.staff_id,
        kind: row.kind,
        amount: money(row.kind === "payout" ? row.pay_out_pence : row.total_pence),
        payment: row.payment_label,
      }));
    },
  },
  {
    id: "audit-log",
    name: "Audit log",
    group: "Retail",
    description: "Voids, refunds, no-sales, price overrides and sign-ins.",
    needsManager: true,
    blind: false,
    resets: false,
    columns: [
      { key: "when", header: "When" },
      { key: "staff", header: "Staff" },
      { key: "action", header: "Action" },
      { key: "detail", header: "Detail" },
    ],
    run: (range) => {
      const dated = rangeClause("created_at", range, false);
      const rows = getDb()
        .prepare(`SELECT created_at, staff_id, action, detail FROM audit_log WHERE ${dated.sql} ORDER BY id DESC LIMIT 500`)
        .all(...dated.params) as { created_at: string; staff_id: string; action: string; detail: string }[];
      return rows.map((row) => ({ when: row.created_at, staff: row.staff_id, action: row.action, detail: row.detail }));
    },
  },
];

const byId = new Map(definitions.map((definition) => [definition.id, definition]));

export function listReportMeta(): ReportMeta[] {
  return definitions.map(({ id, name, group, description, needsManager, blind, resets }) => ({ id, name, group, description, needsManager, blind, resets }));
}

export function runReport(id: string, range: Range): ReportResult {
  const definition = byId.get(id);
  if (!definition) throw new Error("Unknown report");
  return {
    id: definition.id,
    title: definition.name,
    description: definition.description,
    columns: definition.columns,
    rows: definition.run(range, false),
  };
}

export interface DayEndReport {
  shopName: string;
  openedAt: string;
  closedAt: string;
  closedBy: string;
  takings: string;
  saleCount: number;
  refundCount: number;
  slips: {
    slip: number;
    when: string;
    staff: string;
    kind: string;
    amount: string;
    payment: string;
    lines: { description: string; qty: number; amount: string }[];
  }[];
}

export function buildDayEnd(staffId: string): { ok: true; report: DayEndReport } | { ok: false; error: string } {
  const database = getDb();
  const staff = database.prepare("SELECT id, name, active FROM staff WHERE id = ?").get(staffId) as { id: string; name: string; active: number } | undefined;
  if (!staff || staff.active !== 1) return { ok: false, error: "Sign in required." };
  const shift = database.prepare("SELECT id, opened_at, z_number FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1").get() as
    | { id: number; opened_at: string; z_number: number | null }
    | undefined;
  if (!shift) return { ok: false, error: "No open shift" };
  if (shift.z_number) return { ok: false, error: "This day is already closed." };
  const sales = database
    .prepare("SELECT id, slip_no, created_at, staff_name, kind, total_pence, pay_out_pence, payment_label FROM sales WHERE shift_id = ? ORDER BY slip_no")
    .all(shift.id) as {
    id: number;
    slip_no: number;
    created_at: string;
    staff_name: string;
    kind: string;
    total_pence: number;
    pay_out_pence: number;
    payment_label: string;
  }[];
  const lineQuery = database.prepare("SELECT description, qty, amount_pence FROM sale_lines WHERE sale_id = ? ORDER BY id");
  let takings = 0;
  let saleCount = 0;
  let refundCount = 0;
  for (const sale of sales) {
    if (sale.kind === "sale") {
      takings += sale.total_pence;
      saleCount += 1;
    } else if (sale.kind === "refund") {
      takings -= sale.total_pence;
      refundCount += 1;
    }
  }
  const slips = sales.slice(0, 500).map((sale) => {
    const amount = sale.kind === "payout" ? sale.pay_out_pence : sale.total_pence;
    const lines = (lineQuery.all(sale.id) as { description: string; qty: number; amount_pence: number }[]).map((line) => ({
      description: line.description,
      qty: Number(line.qty),
      amount: money(line.amount_pence),
    }));
    return {
      slip: sale.slip_no,
      when: sale.created_at,
      staff: sale.staff_name || "",
      kind: sale.kind,
      amount: money(amount),
      payment: sale.payment_label || "",
      lines,
    };
  });
  const shop = database.prepare("SELECT value FROM settings WHERE key = 'shop'").get() as { value: string } | undefined;
  let shopName = "";
  try {
    shopName = String((JSON.parse(shop?.value || "{}") as { shopName?: string }).shopName || "");
  } catch {
    shopName = "";
  }
  return {
    ok: true,
    report: {
      shopName,
      openedAt: shift.opened_at,
      closedAt: localStamp(),
      closedBy: staff.name,
      takings: money(takings),
      saleCount,
      refundCount,
      slips,
    },
  };
}

export function closeZ(staffId: string, blind: boolean): { ok: true; report: ReportResult; zNumber: number } | { ok: false; error: string } {
  const manager = getDb().prepare("SELECT id, name, role, active FROM staff WHERE id = ?").get(staffId) as { id: string; name: string; role: string; active: number } | undefined;
  if (!manager || manager.active !== 1) return { ok: false, error: "Sign in required." };
  const database = getDb();
  const shift = database.prepare("SELECT id, opened_at, z_number FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1").get() as
    | { id: number; opened_at: string; z_number: number | null }
    | undefined;
  if (!shift) return { ok: false, error: "No open shift" };
  if (shift.z_number) return { ok: false, error: "This shift already has a Z report" };
  const sales = database.prepare("SELECT COUNT(*) as c FROM sales WHERE shift_id = ?").get(shift.id) as { c: number };
  const today = localStamp().slice(0, 10);
  const last = database.prepare("SELECT period_end FROM z_reports ORDER BY z_number DESC LIMIT 1").get() as { period_end: string } | undefined;
  if (Number(sales.c) === 0 && last && last.period_end.slice(0, 10) === today) {
    return { ok: false, error: "A Z report has already been taken for this period" };
  }
  const definition = byId.get(blind ? "blind-z" : "z-report");
  if (!definition) return { ok: false, error: "Report missing" };
  const rows = definition.run({ from: "", to: "" }, true);
  const next = (database.prepare("SELECT COALESCE(MAX(z_number), 0) as n FROM z_reports").get() as { n: number }).n + 1;
  const now = localStamp();
  const report: ReportResult = {
    id: definition.id,
    title: `${definition.name} ${next}`,
    description: definition.description,
    columns: definition.columns,
    rows: [{ label: "Z number", value: String(next) }, { label: "From", value: shift.opened_at }, { label: "To", value: now }, ...rows],
  };
  const tx = database.transaction(() => {
    database.prepare("INSERT INTO z_reports (z_number, shift_id, period_start, period_end, created_at, staff_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      next,
      shift.id,
      shift.opened_at,
      now,
      now,
      manager.id,
      JSON.stringify(report),
    );
    database.prepare("UPDATE shifts SET closed_at = ?, z_number = ? WHERE id = ?").run(now, next, shift.id);
    database.prepare("DELETE FROM sale_lines WHERE sale_id IN (SELECT id FROM sales WHERE shift_id = ?)").run(shift.id);
    database.prepare("DELETE FROM tenders WHERE sale_id IN (SELECT id FROM sales WHERE shift_id = ?)").run(shift.id);
    database.prepare("DELETE FROM sales WHERE shift_id = ?").run(shift.id);
    database.prepare("INSERT INTO shifts (opened_at, opening_float_pence) VALUES (?, 0)").run(now);
  });
  tx();
  writeAudit(manager.id, blind ? "blind_z" : "z_report", `Z ${next}`);
  return { ok: true, report, zNumber: next };
}

export function isManager(staff: StaffPublic | null): boolean {
  return staff?.role === "manager" || staff?.role === "admin";
}
