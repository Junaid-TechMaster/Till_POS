import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";
import { localStamp } from "@tillpro/shared";
import type { CustomerRecord, ProductRecord, ShopSettings, StaffPublic, VatRate } from "@tillpro/shared";
import { DEFAULT_SETTINGS } from "../data/catalog";
import type { OpenSalePayload, StoredSale } from "../engine/types";
import { hashPin, verifyPin } from "./pin";

let db: Database.Database | null = null;
let activeShop = "";

export function getDb(): Database.Database {
  if (db) return db;
  return openDatabase(join(app.getPath("userData"), "tillpro.sqlite"), "");
}

export function openShop(clientCode: string, username: string): void {
  const key = clientCode.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "shop";
  if (db && activeShop === key) return;
  closeDb();
  const dir = join(app.getPath("userData"), "shops", key);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, "tillpro.sqlite");
  if (!existsSync(target)) adoptLegacy(target, username);
  openDatabase(target, key);
}

function closeDb(): void {
  if (!db) return;
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // The shop file is still closed so the next client can open its own database.
  }
  db.close();
  db = null;
  activeShop = "";
}

function openDatabase(file: string, shopKey: string): Database.Database {
  mkdirSync(dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  activeShop = shopKey;
  if (shopKey) setSetting(db, "client_code", shopKey);
  return db;
}

function adoptLegacy(target: string, username: string): void {
  const legacy = join(app.getPath("userData"), "tillpro.sqlite");
  if (!existsSync(legacy)) return;
  const legacyDb = new Database(legacy, { readonly: true, fileMustExist: true });
  let owner = "";
  try {
    const row = legacyDb.prepare("SELECT value FROM settings WHERE key = 'admin_username'").get() as { value: string } | undefined;
    owner = row?.value ?? "";
  } catch {
    owner = "";
  } finally {
    legacyDb.close();
  }
  if (!owner || owner.toLowerCase() !== username.trim().toLowerCase()) return;
  copyFileSync(legacy, target);
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      plu TEXT NOT NULL,
      category_id TEXT NOT NULL,
      price_pence INTEGER NOT NULL,
      cost_pence INTEGER NOT NULL,
      vat_rate INTEGER NOT NULL,
      stock_qty REAL NOT NULL,
      min_stock REAL NOT NULL,
      image TEXT,
      age_restricted INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      z_number INTEGER,
      opening_float_pence INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY,
      slip_no INTEGER NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      staff_id TEXT,
      staff_name TEXT,
      customer_name TEXT,
      kind TEXT NOT NULL,
      no_vat INTEGER NOT NULL DEFAULT 0,
      basket_discount_pct REAL NOT NULL DEFAULT 0,
      total_pence INTEGER NOT NULL,
      discount_pence INTEGER NOT NULL,
      vat_pence INTEGER NOT NULL,
      paid_pence INTEGER NOT NULL,
      change_pence INTEGER NOT NULL,
      payment_label TEXT,
      pay_out_pence INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      shift_id INTEGER,
      refund_of_slip INTEGER
    );
    CREATE TABLE IF NOT EXISTS sale_lines (
      id INTEGER PRIMARY KEY,
      sale_id INTEGER NOT NULL,
      product_id TEXT,
      description TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_price_pence INTEGER NOT NULL,
      discount_pct REAL NOT NULL DEFAULT 0,
      vat_rate INTEGER NOT NULL,
      amount_pence INTEGER NOT NULL,
      cost_pence INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tenders (
      id INTEGER PRIMARY KEY,
      sale_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount_pence INTEGER NOT NULL,
      auth_code TEXT
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL,
      product_id TEXT,
      qty_delta REAL NOT NULL,
      reason TEXT NOT NULL,
      staff_id TEXT,
      ref TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL,
      staff_id TEXT,
      action TEXT NOT NULL,
      detail TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drawer_events (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL,
      staff_id TEXT,
      reason TEXT NOT NULL,
      shift_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS z_reports (
      id INTEGER PRIMARY KEY,
      z_number INTEGER NOT NULL UNIQUE,
      shift_id INTEGER NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TEXT NOT NULL,
      staff_id TEXT,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cash_ups (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL,
      staff_id TEXT,
      expected_pence INTEGER NOT NULL,
      counted_pence INTEGER NOT NULL,
      variance_pence INTEGER NOT NULL,
      blind INTEGER NOT NULL DEFAULT 0,
      shift_id INTEGER,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS held_sales (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      label TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);
  const categoryColumns = database.prepare("PRAGMA table_info(categories)").all() as { name: string }[];
  if (!categoryColumns.some((column) => column.name === "image")) {
    database.exec("ALTER TABLE categories ADD COLUMN image TEXT");
  }
}

function seed(database: Database.Database): void {
  const seeded = database.prepare("SELECT value FROM settings WHERE key = 'seeded'").get() as { value: string } | undefined;
  if (seeded) {
    ensureShift(database);
    alignAccounts(database);
    return;
  }
  const secret = hashPin("change-me");
  const blankShop: ShopSettings = {
    ...DEFAULT_SETTINGS,
    shopName: "",
    addressLines: [],
    vatNumber: "",
    phone: "",
  };
  const tx = database.transaction(() => {
    database
      .prepare("INSERT INTO staff (id, name, role, pin_hash, pin_salt, active) VALUES ('1', 'Admin', 'admin', ?, ?, 1)")
      .run(secret.hash, secret.salt);
    setSetting(database, "shop", JSON.stringify(blankShop));
    setSetting(database, "next_slip", "1001");
    setSetting(database, "default_pins", "0");
    setSetting(database, "seeded", "1");
    setSetting(database, "open_sale", "");
    setSetting(database, "admin_username", "");
    setSetting(database, "account_model", "admin-cashier");
    database.prepare("INSERT INTO shifts (opened_at, opening_float_pence) VALUES (?, 0)").run(localStamp());
  });
  tx();
}

function alignAccounts(database: Database.Database): void {
  if (getSetting(database, "account_model") === "admin-cashier") return;
  database.prepare("UPDATE staff SET active = 0 WHERE id <> '1'").run();
  const secret = hashPin("DemoShop-12345");
  const admin = database.prepare("SELECT id FROM staff WHERE id = '1'").get();
  if (admin) {
    database.prepare("UPDATE staff SET name = ?, role = 'admin', pin_hash = ?, pin_salt = ?, active = 1 WHERE id = '1'").run("Admin", secret.hash, secret.salt);
  } else {
    database.prepare("INSERT INTO staff (id, name, role, pin_hash, pin_salt, active) VALUES ('1', 'Admin', 'admin', ?, ?, 1)").run(secret.hash, secret.salt);
  }
  setSetting(database, "admin_username", "demo-shop");
  setSetting(database, "account_model", "admin-cashier");
}

function setSetting(database: Database.Database, key: string, value: string): void {
  database.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

function getSetting(database: Database.Database, key: string): string {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

function ensureShift(database: Database.Database): number {
  const open = database.prepare("SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
  if (open) return open.id;
  const result = database.prepare("INSERT INTO shifts (opened_at, opening_float_pence) VALUES (?, 0)").run(localStamp());
  return Number(result.lastInsertRowid);
}

export function currentShiftId(): number {
  return ensureShift(getDb());
}

function mapProduct(row: Record<string, unknown>): ProductRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    barcode: String(row.barcode),
    plu: String(row.plu),
    categoryId: String(row.category_id),
    pricePence: Number(row.price_pence),
    costPence: Number(row.cost_pence),
    vatRate: Number(row.vat_rate) as VatRate,
    stockQty: Number(row.stock_qty),
    minStock: Number(row.min_stock),
    image: row.image ? String(row.image) : null,
    ageRestricted: Number(row.age_restricted) === 1,
    active: Number(row.active) === 1,
  };
}

export function listProducts(): ProductRecord[] {
  return (getDb().prepare("SELECT * FROM products ORDER BY plu").all() as Record<string, unknown>[]).map(mapProduct);
}

export function listCategories() {
  return getDb()
    .prepare("SELECT id, name, color, sort_order as sortOrder, image, active FROM categories ORDER BY sort_order")
    .all()
    .map((row) => {
      const item = row as { id: string; name: string; color: string; sortOrder: number; image: string | null; active: number };
      return { ...item, image: item.image || null, active: item.active === 1 };
    });
}

export function listCustomers(): CustomerRecord[] {
  return getDb().prepare("SELECT id, name, phone, email, notes FROM customers ORDER BY name").all() as CustomerRecord[];
}

export function readSettings(): ShopSettings & { defaultPins: boolean } {
  const raw = getSetting(getDb(), "shop");
  const shop = raw ? (JSON.parse(raw) as ShopSettings) : DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...shop, defaultPins: getSetting(getDb(), "default_pins") !== "0" };
}

export function saveSettings(settings: ShopSettings): void {
  const { ...shop } = settings;
  setSetting(getDb(), "shop", JSON.stringify(shop));
}

export function loginAdmin(username: string, password: string): StaffPublic | null {
  const expected = getSetting(getDb(), "admin_username").toLowerCase();
  if (!expected || username.trim().toLowerCase() !== expected) return null;
  const row = getDb().prepare("SELECT id, name, role, pin_hash, pin_salt, active FROM staff WHERE id = '1'").get() as
    | { id: string; name: string; role: StaffPublic["role"]; pin_hash: string; pin_salt: string; active: number }
    | undefined;
  if (!row || row.active !== 1 || row.role !== "admin" || !verifyPin(password, row.pin_hash, row.pin_salt)) return null;
  return { id: row.id, name: row.name, role: "admin", active: true };
}

export function setShopAdmin(username: string, password: string): void {
  const database = getDb();
  const secret = hashPin(password);
  const existing = database.prepare("SELECT id FROM staff WHERE id = '1'").get();
  if (existing) {
    database.prepare("UPDATE staff SET name = 'Admin', role = 'admin', pin_hash = ?, pin_salt = ?, active = 1 WHERE id = '1'").run(secret.hash, secret.salt);
  } else {
    database.prepare("INSERT INTO staff (id, name, role, pin_hash, pin_salt, active) VALUES ('1', 'Admin', 'admin', ?, ?, 1)").run(secret.hash, secret.salt);
  }
  setSetting(database, "admin_username", username.trim().toLowerCase());
  setSetting(database, "account_model", "admin-cashier");
}

export function adminUsername(): string {
  return getSetting(getDb(), "admin_username");
}

export function loginStaff(id: string, pin: string): StaffPublic | null {
  const row = getDb().prepare("SELECT id, name, role, pin_hash, pin_salt, active FROM staff WHERE id = ?").get(id.trim()) as
    | { id: string; name: string; role: StaffPublic["role"]; pin_hash: string; pin_salt: string; active: number }
    | undefined;
  if (!row || row.active !== 1 || row.role !== "cashier") return null;
  if (!verifyPin(pin, row.pin_hash, row.pin_salt)) return null;
  writeAudit(row.id, "login", row.name);
  return { id: row.id, name: row.name, role: row.role, active: true };
}

export function checkManagerPin(pin: string): StaffPublic | null {
  const rows = getDb().prepare("SELECT id, name, role, pin_hash, pin_salt, active FROM staff WHERE active = 1 AND role IN ('manager', 'admin')").all() as {
    id: string;
    name: string;
    role: StaffPublic["role"];
    pin_hash: string;
    pin_salt: string;
  }[];
  for (const row of rows) {
    if (verifyPin(pin, row.pin_hash, row.pin_salt)) return { id: row.id, name: row.name, role: row.role, active: true };
  }
  return null;
}

export function writeAudit(staffId: string, action: string, detail: string): void {
  getDb().prepare("INSERT INTO audit_log (created_at, staff_id, action, detail) VALUES (?, ?, ?, ?)").run(localStamp(), staffId, action, detail);
}

export function writeDrawer(staffId: string, reason: string): void {
  const database = getDb();
  const shiftId = ensureShift(database);
  database.prepare("INSERT INTO drawer_events (created_at, staff_id, reason, shift_id) VALUES (?, ?, ?, ?)").run(localStamp(), staffId, reason, shiftId);
  writeAudit(staffId, "no_sale", reason);
}

export function saveOpenSale(payload: OpenSalePayload | null): void {
  setSetting(getDb(), "open_sale", payload ? JSON.stringify(payload) : "");
}

export function readOpenSale(): OpenSalePayload | null {
  const raw = getSetting(getDb(), "open_sale");
  if (!raw) return null;
  return JSON.parse(raw) as OpenSalePayload;
}

export function nextSlipValue(): number {
  return Number(getSetting(getDb(), "next_slip") || "1001");
}

export function saveSale(sale: StoredSale): StoredSale {
  const database = getDb();
  const shiftId = ensureShift(database);
  const slip = sale.slipNo || nextSlipValue();
  const tx = database.transaction(() => {
    const result = database
      .prepare(
        `INSERT INTO sales (
          slip_no, created_at, staff_id, staff_name, customer_name, kind, no_vat, basket_discount_pct,
          total_pence, discount_pence, vat_pence, paid_pence, change_pence, payment_label, pay_out_pence,
          reason, shift_id, refund_of_slip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slip,
        sale.at,
        sale.staffId,
        sale.staffName,
        sale.customerName,
        sale.kind,
        sale.noVat ? 1 : 0,
        sale.basketDiscountPct,
        sale.totalPence,
        sale.discountPence,
        sale.vatPence,
        sale.paidPence,
        sale.changePence,
        sale.paymentLabel,
        sale.payOutPence,
        sale.reason ?? null,
        shiftId,
        sale.refundOfSlip ?? null,
      );
    const saleId = Number(result.lastInsertRowid);
    const insertLine = database.prepare(
      `INSERT INTO sale_lines (sale_id, product_id, description, qty, unit_price_pence, discount_pct, vat_rate, amount_pence, cost_pence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const stock = database.prepare("UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?");
    const movement = database.prepare(
      "INSERT INTO stock_movements (created_at, product_id, qty_delta, reason, staff_id, ref) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const line of sale.lines) {
      const appliedRate = sale.noVat ? 0 : line.vatRate;
      insertLine.run(saleId, line.productId, line.description, line.qty, line.unitPricePence, line.discountPct, appliedRate, line.amountPence, line.costPence);
      if (line.productId && sale.kind !== "payout") {
        const delta = sale.kind === "refund" ? line.qty : -line.qty;
        stock.run(delta, line.productId);
        movement.run(sale.at, line.productId, delta, sale.kind, sale.staffId, String(slip));
      }
    }
    const insertTender = database.prepare("INSERT INTO tenders (sale_id, type, amount_pence, auth_code) VALUES (?, ?, ?, ?)");
    for (const tender of sale.tenders) insertTender.run(saleId, tender.type, tender.amountPence, tender.authCode ?? null);
    setSetting(database, "next_slip", String(slip + 1));
    setSetting(database, "open_sale", "");
  });
  tx();
  return { ...sale, slipNo: slip };
}

export function listSales(from?: string, to?: string): StoredSale[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT * FROM sales
       WHERE (? = '' OR substr(created_at, 1, 10) >= ?)
         AND (? = '' OR substr(created_at, 1, 10) <= ?)
       ORDER BY slip_no DESC
       LIMIT 500`,
    )
    .all(from ?? "", from ?? "", to ?? "", to ?? "") as Record<string, unknown>[];
  return rows.map((row) => hydrateSale(database, row));
}

function hydrateSale(database: Database.Database, row: Record<string, unknown>): StoredSale {
  const id = Number(row.id);
  const lines = database.prepare("SELECT * FROM sale_lines WHERE sale_id = ?").all(id) as Record<string, unknown>[];
  const tenders = database.prepare("SELECT * FROM tenders WHERE sale_id = ?").all(id) as Record<string, unknown>[];
  return {
    slipNo: Number(row.slip_no),
    at: String(row.created_at),
    staffId: String(row.staff_id ?? ""),
    staffName: String(row.staff_name ?? ""),
    customerName: row.customer_name ? String(row.customer_name) : null,
    kind: row.kind as StoredSale["kind"],
    noVat: Number(row.no_vat) === 1,
    basketDiscountPct: Number(row.basket_discount_pct),
    totalPence: Number(row.total_pence),
    discountPence: Number(row.discount_pence),
    vatPence: Number(row.vat_pence),
    paidPence: Number(row.paid_pence),
    changePence: Number(row.change_pence),
    paymentLabel: String(row.payment_label ?? ""),
    payOutPence: Number(row.pay_out_pence),
    reason: row.reason ? String(row.reason) : undefined,
    refundOfSlip: row.refund_of_slip ? Number(row.refund_of_slip) : undefined,
    lines: lines.map((line) => ({
      id: `L${line.id}`,
      productId: line.product_id ? String(line.product_id) : null,
      description: String(line.description),
      qty: Number(line.qty),
      unitPricePence: Number(line.unit_price_pence),
      discountPct: Number(line.discount_pct),
      vatRate: Number(line.vat_rate),
      amountPence: Number(line.amount_pence),
      costPence: Number(line.cost_pence),
    })),
    tenders: tenders.map((tender) => ({
      type: String(tender.type),
      amountPence: Number(tender.amount_pence),
      authCode: tender.auth_code ? String(tender.auth_code) : undefined,
    })),
  };
}

export function saveProduct(product: ProductRecord): void {
  getDb()
    .prepare(
      `INSERT INTO products (id, name, barcode, plu, category_id, price_pence, cost_pence, vat_rate, stock_qty, min_stock, image, age_restricted, active)
       VALUES (@id, @name, @barcode, @plu, @categoryId, @pricePence, @costPence, @vatRate, @stockQty, @minStock, @image, @ageRestricted, @active)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, barcode = excluded.barcode, plu = excluded.plu, category_id = excluded.category_id,
         price_pence = excluded.price_pence, cost_pence = excluded.cost_pence, vat_rate = excluded.vat_rate,
         stock_qty = excluded.stock_qty, min_stock = excluded.min_stock, image = excluded.image,
         age_restricted = excluded.age_restricted, active = excluded.active`,
    )
    .run({ ...product, ageRestricted: product.ageRestricted ? 1 : 0, active: product.active ? 1 : 0 });
}

export function deleteProduct(id: string): void {
  getDb().prepare("UPDATE products SET active = 0 WHERE id = ?").run(id);
}

export function saveCategory(category: { id: string; name: string; color: string; sortOrder: number; image?: string | null }): void {
  getDb()
    .prepare(
      `INSERT INTO categories (id, name, color, sort_order, image, active) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, sort_order = excluded.sort_order, image = excluded.image`,
    )
    .run(category.id, category.name, category.color, category.sortOrder, category.image ?? null);
}

export function saveCustomer(customer: CustomerRecord): void {
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, email, notes) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, notes = excluded.notes`,
    )
    .run(customer.id, customer.name, customer.phone, customer.email, customer.notes);
}

export function adjustStock(productId: string, qtyDelta: number, reason: string, staffId: string): void {
  const database = getDb();
  database.prepare("UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?").run(qtyDelta, productId);
  database
    .prepare("INSERT INTO stock_movements (created_at, product_id, qty_delta, reason, staff_id, ref) VALUES (?, ?, ?, ?, ?, ?)")
    .run(localStamp(), productId, qtyDelta, reason, staffId, "adjust");
  writeAudit(staffId, "stock_adjust", `${productId} ${qtyDelta} ${reason}`);
}

export function listStaff(): StaffPublic[] {
  return (getDb().prepare("SELECT id, name, role, active FROM staff ORDER BY id").all() as { id: string; name: string; role: StaffPublic["role"]; active: number }[]).map(
    (row) => ({ ...row, active: row.active === 1 }),
  );
}

export function saveStaff(input: { id: string; name: string; role: StaffPublic["role"]; pin?: string; active: boolean }, actorId: string): void {
  const database = getDb();
  const actor = database.prepare("SELECT id, role, active FROM staff WHERE id = ?").get(actorId) as { id: string; role: string; active: number } | undefined;
  if (!actor || actor.active !== 1) throw new Error("Sign in required.");
  if (input.role === "manager") throw new Error("This till has an admin and one cashier.");
  if (actor.role !== "admin") {
    if (input.id !== actor.id || input.role !== "cashier") throw new Error("A cashier can only change their own PIN.");
    if (!input.pin) throw new Error("Enter a new PIN.");
    const pin = hashPin(input.pin);
    database.prepare("UPDATE staff SET pin_hash = ?, pin_salt = ? WHERE id = ?").run(pin.hash, pin.salt, actor.id);
    return;
  }
  if (input.role === "admin" && input.id !== "1") throw new Error("The admin account is the shop account from the dashboard.");
  if (input.id === "1" && input.role !== "admin") throw new Error("The admin account cannot be changed into a cashier.");
  if (input.role === "cashier") {
    const other = database.prepare("SELECT id FROM staff WHERE role = 'cashier' AND active = 1 AND id <> ?").get(input.id) as { id: string } | undefined;
    if (other) throw new Error("Only one cashier can be added.");
  }
  const existing = database.prepare("SELECT id FROM staff WHERE id = ?").get(input.id) as { id: string } | undefined;
  if (!existing) {
    if (!input.pin) throw new Error("Enter a PIN.");
    const pin = hashPin(input.pin);
    database.prepare("INSERT INTO staff (id, name, role, pin_hash, pin_salt, active) VALUES (?, ?, ?, ?, ?, ?)").run(input.id, input.name, input.role, pin.hash, pin.salt, input.active ? 1 : 0);
  } else if (input.pin) {
    const pin = hashPin(input.pin);
    database.prepare("UPDATE staff SET name = ?, role = ?, pin_hash = ?, pin_salt = ?, active = ? WHERE id = ?").run(input.name, input.role, pin.hash, pin.salt, input.active ? 1 : 0, input.id);
  } else {
    database.prepare("UPDATE staff SET name = ?, role = ?, active = ? WHERE id = ?").run(input.name, input.role, input.active ? 1 : 0, input.id);
  }
}

export function saveHeld(id: string, label: string, payload: unknown): void {
  getDb().prepare("INSERT OR REPLACE INTO held_sales (id, created_at, label, payload_json) VALUES (?, ?, ?, ?)").run(id, localStamp(), label, JSON.stringify(payload));
}

export function deleteHeld(id: string): void {
  getDb().prepare("DELETE FROM held_sales WHERE id = ?").run(id);
}

export function listHeld(): { id: string; at: string; label: string; payload: unknown }[] {
  return (getDb().prepare("SELECT * FROM held_sales ORDER BY created_at DESC").all() as { id: string; created_at: string; label: string; payload_json: string }[]).map((row) => ({
    id: row.id,
    at: row.created_at,
    label: row.label,
    payload: JSON.parse(row.payload_json) as unknown,
  }));
}

export function recordCashUp(input: { staffId: string; expectedPence: number; countedPence: number; blind: boolean; notes: string }): void {
  const database = getDb();
  const shiftId = ensureShift(database);
  database
    .prepare(
      "INSERT INTO cash_ups (created_at, staff_id, expected_pence, counted_pence, variance_pence, blind, shift_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(localStamp(), input.staffId, input.expectedPence, input.countedPence, input.countedPence - input.expectedPence, input.blind ? 1 : 0, shiftId, input.notes);
  writeAudit(input.staffId, "cash_up", `${input.countedPence - input.expectedPence}`);
}

export function expectedCashPence(shiftOnly: boolean): number {
  const database = getDb();
  const shiftId = ensureShift(database);
  const where = shiftOnly ? "AND s.shift_id = ?" : "";
  const params = shiftOnly ? [shiftId] : [];
  const cashIn = database
    .prepare(
      `SELECT COALESCE(SUM(t.amount_pence), 0) as v FROM tenders t JOIN sales s ON s.id = t.sale_id WHERE t.type = 'cash' AND s.kind = 'sale' ${where}`,
    )
    .get(...params) as { v: number };
  const change = database.prepare(`SELECT COALESCE(SUM(change_pence), 0) as v FROM sales s WHERE kind = 'sale' ${where}`).get(...params) as { v: number };
  const payouts = database.prepare(`SELECT COALESCE(SUM(pay_out_pence), 0) as v FROM sales s WHERE kind = 'payout' ${where}`).get(...params) as { v: number };
  const floatRow = database.prepare("SELECT opening_float_pence as v FROM shifts WHERE id = ?").get(shiftId) as { v: number };
  return Number(floatRow?.v ?? 0) + Number(cashIn.v) - Number(change.v) - Number(payouts.v);
}

export { getSetting, setSetting };
