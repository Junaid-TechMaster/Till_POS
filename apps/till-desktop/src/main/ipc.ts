import { writeFileSync } from "node:fs";
import { BrowserWindow, dialog, ipcMain } from "electron";
import type { CustomerRecord, ProductRecord, ShopSettings, StaffPublic } from "@tillpro/shared";
import type { OpenSalePayload, StoredSale } from "../engine/types";
import {
  adjustStock,
  checkManagerPin,
  deleteHeld,
  deleteProduct,
  expectedCashPence,
  listCategories,
  listCustomers,
  listHeld,
  listProducts,
  listSales,
  listStaff,
  loginStaff,
  loginAdmin,
  adminUsername,
  readOpenSale,
  readSettings,
  recordCashUp,
  saveCategory,
  saveCustomer,
  saveHeld,
  saveOpenSale,
  saveProduct,
  saveSale,
  saveSettings,
  saveStaff,
  writeAudit,
  writeDrawer,
  nextSlipValue,
  getDb,
} from "./db";
import { assertSalesAllowed, sendDayEnd } from "./licence";
import { buildDayEnd, closeZ, listReportMeta, runReport } from "./reports";

export interface Bootstrap {
  products: ProductRecord[];
  categories: ReturnType<typeof listCategories>;
  customers: CustomerRecord[];
  settings: ShopSettings;
  defaultPins: boolean;
  history: StoredSale[];
  held: ReturnType<typeof listHeld>;
  openSale: OpenSalePayload | null;
  nextSlip: number;
  reports: ReturnType<typeof listReportMeta>;
}

export function registerDatabaseIpc(): void {
  ipcMain.handle("db:bootstrap", (): Bootstrap => {
    const settings = readSettings();
    return {
      products: listProducts(),
      categories: listCategories(),
      customers: listCustomers(),
      settings,
      defaultPins: settings.defaultPins,
      history: listSales(),
      held: listHeld(),
      openSale: readOpenSale(),
      nextSlip: nextSlipValue(),
      reports: listReportMeta(),
    };
  });

  ipcMain.handle("db:login", (_event, id: string, pin: string) => {
    assertSalesAllowed();
    const staff = loginStaff(id, pin);
    return staff ? { ok: true as const, staff } : { ok: false as const };
  });

  ipcMain.handle("db:loginAdmin", (_event, username: string, password: string) => {
    assertSalesAllowed();
    const staff = loginAdmin(username, password);
    return staff ? { ok: true as const, staff, username: adminUsername() } : { ok: false as const };
  });

  ipcMain.handle("db:adminUsername", () => adminUsername());

  ipcMain.handle("db:checkManager", (_event, pin: string) => {
    const staff = checkManagerPin(pin);
    return staff ? { ok: true as const, staff } : { ok: false as const };
  });

  ipcMain.handle("db:audit", (_event, staffId: string, action: string, detail: string) => {
    writeAudit(staffId, action, detail);
  });

  ipcMain.handle("db:drawer", (_event, staffId: string, reason: string) => {
    assertSalesAllowed();
    writeDrawer(staffId, reason);
  });

  ipcMain.handle("db:saveOpenSale", (_event, payload: OpenSalePayload | null) => {
    saveOpenSale(payload);
  });

  ipcMain.handle("db:completeSale", (_event, sale: StoredSale) => {
    assertSalesAllowed();
    const saved = saveSale(sale);
    return { sale: saved, products: listProducts(), nextSlip: nextSlipValue() };
  });

  ipcMain.handle("db:saveProduct", (_event, product: ProductRecord) => {
    assertSalesAllowed();
    saveProduct(product);
    return listProducts();
  });

  ipcMain.handle("db:deleteProduct", (_event, id: string) => {
    assertSalesAllowed();
    deleteProduct(id);
    return listProducts();
  });

  ipcMain.handle("db:saveCategory", (_event, category: { id: string; name: string; color: string; sortOrder: number; image?: string | null }) => {
    saveCategory(category);
    return listCategories();
  });

  ipcMain.handle("db:saveCustomer", (_event, customer: CustomerRecord) => {
    saveCustomer(customer);
    return listCustomers();
  });

  ipcMain.handle("db:saveSettings", (_event, settings: ShopSettings) => {
    saveSettings(settings);
    return readSettings();
  });

  ipcMain.handle("db:adjustStock", (_event, productId: string, qtyDelta: number, reason: string, staffId: string) => {
    assertSalesAllowed();
    adjustStock(productId, qtyDelta, reason, staffId);
    return listProducts();
  });

  ipcMain.handle("db:listStaff", () => listStaff());

  ipcMain.handle("db:saveStaff", (_event, input: { id: string; name: string; role: StaffPublic["role"]; pin?: string; active: boolean }, actorId: string) => {
    assertSalesAllowed();
    saveStaff(input, actorId);
    return listStaff();
  });

  ipcMain.handle("db:saveHeld", (_event, id: string, label: string, payload: unknown) => {
    saveHeld(id, label, payload);
  });

  ipcMain.handle("db:deleteHeld", (_event, id: string) => {
    deleteHeld(id);
  });

  ipcMain.handle("db:transactions", (_event, from: string, to: string) => listSales(from, to));

  ipcMain.handle("db:runReport", (_event, id: string, from: string, to: string) => runReport(id, { from, to }));

  ipcMain.handle("db:closeZ", (_event, staffId: string, blind: boolean) => {
    assertSalesAllowed();
    return closeZ(staffId, blind);
  });

  ipcMain.handle("db:dayEnd", async (_event, staffId: string) => {
    assertSalesAllowed();
    const built = buildDayEnd(staffId);
    if (!built.ok) return built;
    const sent = await sendDayEnd(built.report);
    if (!sent.ok) return sent;
    const closed = closeZ(staffId, false);
    if (!closed.ok) return { ok: true as const, email: sent.email, zNumber: null, warning: closed.error };
    return { ok: true as const, email: sent.email, zNumber: closed.zNumber };
  });

  ipcMain.handle("db:expectedCash", () => expectedCashPence(true));

  ipcMain.handle("db:cashUp", (_event, input: { staffId: string; expectedPence: number; countedPence: number; blind: boolean; notes: string }) => {
    assertSalesAllowed();
    recordCashUp(input);
    return true;
  });

  ipcMain.handle("export:csv", async (_event, title: string, csv: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `${title}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!result.filePath) return false;
    writeFileSync(result.filePath, csv, "utf8");
    return true;
  });

  ipcMain.handle("export:pdf", async (event, title: string, html: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `${title}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!result.filePath) return false;
    const parent = BrowserWindow.fromWebContents(event.sender);
    const printWindow = new BrowserWindow({ show: false, parent: parent ?? undefined });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await printWindow.webContents.printToPDF({ printBackground: true });
    writeFileSync(result.filePath, pdf);
    printWindow.destroy();
    return true;
  });

  ipcMain.handle("print:html", async (event, html: string) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const printWindow = new BrowserWindow({ show: false, parent: parent ?? undefined });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise<void>((resolve) => {
      printWindow.webContents.print({ silent: false }, () => resolve());
    });
    printWindow.destroy();
  });
}

export function databaseFile(): string {
  return getDb().name;
}
