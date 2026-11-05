import type { LicenceStatus, StaffRole, VatRate } from "./constants.js";

export interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  active: boolean;
}

export interface ProductRecord {
  id: string;
  name: string;
  barcode: string;
  plu: string;
  categoryId: string;
  pricePence: number;
  costPence: number;
  vatRate: VatRate;
  stockQty: number;
  minStock: number;
  image: string | null;
  ageRestricted: boolean;
  active: boolean;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface StaffPublic {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
}

export interface ShopSettings {
  shopName: string;
  addressLines: string[];
  vatNumber: string;
  phone: string;
  posNumber: number;
  receiptFooter: string;
  quickCashPence: number[];
  voidPinThresholdPence: number;
}

export interface LicenceSnapshot {
  status: LicenceStatus;
  label: string;
  banner: string | null;
  locked: boolean;
  serverTime: string | null;
  checkedAt: string | null;
}
