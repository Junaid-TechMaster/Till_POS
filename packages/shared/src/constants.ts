/** Single source for the product name. Do not hard-code the brand elsewhere. */
export const PRODUCT_NAME = "TillPro";

export const APP_VERSION = "1.0.0";

export const CURRENCY = "GBP" as const;

export const VAT_RATES = [20, 5, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

export const STAFF_ROLES = ["cashier", "manager", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const LICENCE_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "GRACE",
  "SUSPENDED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type LicenceStatus = (typeof LICENCE_STATUSES)[number];

export const DEFAULT_TRIAL_DAYS = 2;
export const DEFAULT_GRACE_DAYS = 2;
export const DEFAULT_OFFLINE_ALLOWANCE_HOURS = 48;
export const LICENCE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
export const DEFAULT_MAX_DEVICES = 1;
export const DEFAULT_MONTHLY_PRICE_PENCE = 2900;
export const DEFAULT_VOID_THRESHOLD_PENCE = 500;
export const QUICK_CASH_DEFAULTS_PENCE = [500, 1000, 2000, 5000] as const;

export const LOCKED_LICENCE_STATUSES: readonly LicenceStatus[] = [
  "SUSPENDED",
  "EXPIRED",
  "CANCELLED",
];
