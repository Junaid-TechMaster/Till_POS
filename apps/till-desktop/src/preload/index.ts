import { contextBridge, ipcRenderer } from "electron";
import type { CustomerRecord, ProductRecord, ShopSettings, StaffPublic } from "@tillpro/shared";
import type { OpenSalePayload, ReportResult, StoredSale } from "../engine/types";
import type { Bootstrap } from "../main/ipc";

const till = {
  isElectron: true as const,
  minimize: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
  close: () => ipcRenderer.invoke("window:close") as Promise<void>,
  toggleFullScreen: () => ipcRenderer.invoke("window:fullscreen") as Promise<boolean>,
  setKiosk: (on: boolean) => ipcRenderer.invoke("window:kiosk", on) as Promise<boolean>,
  bootstrap: () => ipcRenderer.invoke("db:bootstrap") as Promise<Bootstrap>,
  login: (id: string, pin: string) => ipcRenderer.invoke("db:login", id, pin) as Promise<{ ok: boolean; staff?: StaffPublic }>,
  loginAdmin: (username: string, password: string) =>
    ipcRenderer.invoke("db:loginAdmin", username, password) as Promise<{ ok: boolean; staff?: StaffPublic }>,
  adminUsername: () => ipcRenderer.invoke("db:adminUsername") as Promise<string>,
  checkManager: (pin: string) => ipcRenderer.invoke("db:checkManager", pin) as Promise<{ ok: boolean; staff?: StaffPublic }>,
  audit: (staffId: string, action: string, detail: string) => ipcRenderer.invoke("db:audit", staffId, action, detail) as Promise<void>,
  recordDrawer: (staffId: string, reason: string) => ipcRenderer.invoke("db:drawer", staffId, reason) as Promise<void>,
  saveOpenSale: (payload: OpenSalePayload | null) => ipcRenderer.invoke("db:saveOpenSale", payload) as Promise<void>,
  completeSale: (sale: StoredSale) =>
    ipcRenderer.invoke("db:completeSale", sale) as Promise<{ sale: StoredSale; products: ProductRecord[]; nextSlip: number }>,
  saveProduct: (product: ProductRecord) => ipcRenderer.invoke("db:saveProduct", product) as Promise<ProductRecord[]>,
  deleteProduct: (id: string) => ipcRenderer.invoke("db:deleteProduct", id) as Promise<ProductRecord[]>,
  saveCategory: (category: { id: string; name: string; color: string; sortOrder: number; image?: string | null }) =>
    ipcRenderer.invoke("db:saveCategory", category) as Promise<{ id: string; name: string; color: string; sortOrder: number; image: string | null; active: boolean }[]>,
  saveCustomer: (customer: CustomerRecord) => ipcRenderer.invoke("db:saveCustomer", customer) as Promise<CustomerRecord[]>,
  saveSettings: (settings: ShopSettings) => ipcRenderer.invoke("db:saveSettings", settings) as Promise<ShopSettings>,
  adjustStock: (productId: string, qtyDelta: number, reason: string, staffId: string) =>
    ipcRenderer.invoke("db:adjustStock", productId, qtyDelta, reason, staffId) as Promise<ProductRecord[]>,
  listStaff: () => ipcRenderer.invoke("db:listStaff") as Promise<StaffPublic[]>,
  saveStaff: (input: { id: string; name: string; role: StaffPublic["role"]; pin?: string; active: boolean }, actorId: string) =>
    ipcRenderer.invoke("db:saveStaff", input, actorId) as Promise<StaffPublic[]>,
  saveHeld: (id: string, label: string, payload: unknown) => ipcRenderer.invoke("db:saveHeld", id, label, payload) as Promise<void>,
  deleteHeld: (id: string) => ipcRenderer.invoke("db:deleteHeld", id) as Promise<void>,
  transactions: (from: string, to: string) => ipcRenderer.invoke("db:transactions", from, to) as Promise<StoredSale[]>,
  runReport: (id: string, from: string, to: string) => ipcRenderer.invoke("db:runReport", id, from, to) as Promise<ReportResult>,
  closeZ: (staffId: string, blind: boolean) =>
    ipcRenderer.invoke("db:closeZ", staffId, blind) as Promise<{ ok: true; report: ReportResult; zNumber: number } | { ok: false; error: string }>,
  dayEnd: (staffId: string) =>
    ipcRenderer.invoke("db:dayEnd", staffId) as Promise<{ ok: true; email: string; zNumber: number | null; warning?: string } | { ok: false; error: string }>,
  expectedCash: () => ipcRenderer.invoke("db:expectedCash") as Promise<number>,
  cashUp: (input: { staffId: string; expectedPence: number; countedPence: number; blind: boolean; notes: string }) =>
    ipcRenderer.invoke("db:cashUp", input) as Promise<boolean>,
  exportCsv: (title: string, csv: string) => ipcRenderer.invoke("export:csv", title, csv) as Promise<boolean>,
  exportPdf: (title: string, html: string) => ipcRenderer.invoke("export:pdf", title, html) as Promise<boolean>,
  printHtml: (html: string) => ipcRenderer.invoke("print:html", html) as Promise<void>,
  licenceState: () =>
    ipcRenderer.invoke("licence:state") as Promise<{
      activated: boolean;
      status: string;
      locked: boolean;
      label: string;
      banner: string | null;
      lockMessage: string | null;
    }>,
  licenceRefresh: () =>
    ipcRenderer.invoke("licence:refresh") as Promise<{
      activated: boolean;
      status: string;
      locked: boolean;
      label: string;
      banner: string | null;
      lockMessage: string | null;
    }>,
  activateLicence: (username: string, password: string) =>
    ipcRenderer.invoke("licence:activate", username, password) as Promise<{
      activated: boolean;
      status: string;
      locked: boolean;
      label: string;
      banner: string | null;
      lockMessage: string | null;
    }>,
};

contextBridge.exposeInMainWorld("till", till);

export type TillApi = typeof till;
