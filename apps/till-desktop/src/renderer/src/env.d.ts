/// <reference types="vite/client" />

import type { CustomerRecord, ProductRecord, ShopSettings, StaffPublic } from "@tillpro/shared";
import type { OpenSalePayload, ReportResult, StoredSale } from "../../../engine/types";

interface TillBridge {
  isElectron: true;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  toggleFullScreen: () => Promise<boolean>;
  setKiosk: (on: boolean) => Promise<boolean>;
  bootstrap: () => Promise<{
    products: ProductRecord[];
    categories: { id: string; name: string; color: string; sortOrder: number; image: string | null; active: boolean }[];
    customers: CustomerRecord[];
    settings: ShopSettings;
    defaultPins: boolean;
    history: StoredSale[];
    held: { id: string; at: string; label: string; payload: unknown }[];
    openSale: OpenSalePayload | null;
    nextSlip: number;
    reports: { id: string; name: string; group: string; description: string; needsManager: boolean; blind: boolean; resets: boolean }[];
    demo: boolean;
  }>;
  login: (id: string, pin: string) => Promise<{ ok: boolean; staff?: StaffPublic }>;
  loginAdmin: (username: string, password: string) => Promise<{ ok: boolean; staff?: StaffPublic }>;
  adminUsername: () => Promise<string>;
  checkManager: (pin: string) => Promise<{ ok: boolean; staff?: StaffPublic }>;
  audit: (staffId: string, action: string, detail: string) => Promise<void>;
  recordDrawer: (staffId: string, reason: string) => Promise<void>;
  saveOpenSale: (payload: OpenSalePayload | null) => Promise<void>;
  completeSale: (sale: StoredSale) => Promise<{ sale: StoredSale; products: ProductRecord[]; nextSlip: number }>;
  saveProduct: (product: ProductRecord) => Promise<ProductRecord[]>;
  deleteProduct: (id: string) => Promise<ProductRecord[]>;
  saveCategory: (category: { id: string; name: string; color: string; sortOrder: number; image?: string | null }) => Promise<{ id: string; name: string; color: string; sortOrder: number; image: string | null; active: boolean }[]>;
  saveCustomer: (customer: CustomerRecord) => Promise<CustomerRecord[]>;
  saveSettings: (settings: ShopSettings) => Promise<ShopSettings>;
  adjustStock: (productId: string, qtyDelta: number, reason: string, staffId: string) => Promise<ProductRecord[]>;
  listStaff: () => Promise<StaffPublic[]>;
  saveStaff: (input: { id: string; name: string; role: StaffPublic["role"]; pin?: string; active: boolean }, actorId: string) => Promise<StaffPublic[]>;
  saveHeld: (id: string, label: string, payload: unknown) => Promise<void>;
  deleteHeld: (id: string) => Promise<void>;
  transactions: (from: string, to: string) => Promise<StoredSale[]>;
  runReport: (id: string, from: string, to: string) => Promise<ReportResult>;
  closeZ: (staffId: string, blind: boolean) => Promise<{ ok: true; report: ReportResult; zNumber: number } | { ok: false; error: string }>;
  dayEnd: (staffId: string) => Promise<{ ok: true; email: string; zNumber: number | null; warning?: string } | { ok: false; error: string }>;
  expectedCash: () => Promise<number>;
  cashUp: (input: { staffId: string; expectedPence: number; countedPence: number; blind: boolean; notes: string }) => Promise<boolean>;
  exportCsv: (title: string, csv: string) => Promise<boolean>;
  exportPdf: (title: string, html: string) => Promise<boolean>;
  printHtml: (html: string) => Promise<void>;
  licenceState: () => Promise<{
    activated: boolean;
    status: string;
    locked: boolean;
    label: string;
    banner: string | null;
    lockMessage: string | null;
  }>;
  licenceRefresh: () => Promise<{
    activated: boolean;
    status: string;
    locked: boolean;
    label: string;
    banner: string | null;
    lockMessage: string | null;
  }>;
  checkUpdate: () => Promise<{
    current: string;
    latest: string;
    url: string | null;
    notes: string;
    error: string | null;
  }>;
  openExternal: (url: string) => Promise<boolean>;
  activateLicence: (username: string, password: string) => Promise<{
    activated: boolean;
    status: string;
    locked: boolean;
    label: string;
    banner: string | null;
    lockMessage: string | null;
  }>;
}

declare global {
  interface Window {
    till?: TillBridge;
  }
}
