import {
  APP_VERSION,
  DEFAULT_GRACE_DAYS,
  DEFAULT_MONTHLY_PRICE_PENCE,
  DEFAULT_OFFLINE_ALLOWANCE_HOURS,
  DEFAULT_TRIAL_DAYS,
} from "@tillpro/shared";
import { prisma } from "./prisma.js";

export interface ShopLicenceSettings {
  trialDays: number;
  graceDays: number;
  offlineHours: number;
  defaultPricePence: number;
  latestVersion: string;
  downloadUrl: string;
}

const DEFAULTS: Record<keyof ShopLicenceSettings, string> = {
  trialDays: String(DEFAULT_TRIAL_DAYS),
  graceDays: String(DEFAULT_GRACE_DAYS),
  offlineHours: String(DEFAULT_OFFLINE_ALLOWANCE_HOURS),
  defaultPricePence: String(DEFAULT_MONTHLY_PRICE_PENCE),
  latestVersion: APP_VERSION,
  downloadUrl: "",
};

export async function readSettings(): Promise<ShopLicenceSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    trialDays: Number(map.get("trialDays") ?? DEFAULTS.trialDays),
    graceDays: Number(map.get("graceDays") ?? DEFAULTS.graceDays),
    offlineHours: Number(map.get("offlineHours") ?? DEFAULTS.offlineHours),
    defaultPricePence: Number(map.get("defaultPricePence") ?? DEFAULTS.defaultPricePence),
    latestVersion: map.get("latestVersion") ?? DEFAULTS.latestVersion,
    downloadUrl: map.get("downloadUrl") ?? "",
  };
}

export async function writeSettings(next: ShopLicenceSettings): Promise<void> {
  const entries = Object.entries(next) as [keyof ShopLicenceSettings, string | number][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    ),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() < day) next.setUTCDate(0);
  return next;
}
