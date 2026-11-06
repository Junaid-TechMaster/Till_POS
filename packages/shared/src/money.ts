import type { VatRate } from "./constants.js";

export function formatGbp(pence: number): string {
  const negative = pence < 0;
  const abs = Math.abs(Math.round(pence));
  const pounds = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${negative ? "-" : ""}£${pounds.toLocaleString("en-GB")}.${rem.toString().padStart(2, "0")}`;
}

export function formatDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Local shop time, stored without a timezone suffix so the till day matches the clock. */
export function localStamp(input: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}T${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`;
}

export function formatDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Cash-buffer rule used by the till numpad.
 * One or two digits are whole pounds ("10" => £10.00).
 * Three or more digits are pence ("1050" => £10.50).
 */
export function parsePriceToPence(input: string): number | null {
  const text = input.trim().replace(/^£/, "");
  if (!text) return null;
  if (/^\d+$/.test(text)) return interpretTenderPence(text);
  const match = /^(\d+)\.(\d{1,2})$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2].padEnd(2, "0"));
}

export function interpretTenderPence(buffer: string): number | null {
  if (!/^\d+$/.test(buffer) || buffer.length > 7) return null;
  const n = Number(buffer);
  if (!Number.isSafeInteger(n)) return null;
  if (buffer.length <= 2) return n * 100;
  return n;
}

export interface PricedLineInput {
  qty: number;
  unitPricePence: number;
  discountPct: number;
  vatRate: VatRate | number;
}

export interface PricedLineResult {
  grossPence: number;
  promoDiscountPence: number;
  vatReliefPence: number;
  payablePence: number;
  netPence: number;
  vatPence: number;
  vatRateApplied: number;
}

function roundPence(value: number): number {
  return Math.round(value);
}

/** Inclusive-price retail maths. No VAT strips the VAT out of the price. */
export function priceLine(
  line: PricedLineInput,
  basketDiscountPct: number,
  noVat: boolean,
): PricedLineResult {
  const grossPence = roundPence(line.qty * line.unitPricePence);
  const lineDisc = roundPence(grossPence * (clampPct(line.discountPct) / 100));
  const afterLine = grossPence - lineDisc;
  const basketDisc = roundPence(afterLine * (clampPct(basketDiscountPct) / 100));
  const promoDiscountPence = lineDisc + basketDisc;
  const afterDiscount = grossPence - promoDiscountPence;
  const nominalRate = line.vatRate;
  const vatReliefPence =
    noVat && nominalRate > 0
      ? roundPence((afterDiscount * nominalRate) / (100 + nominalRate))
      : 0;
  const payablePence = afterDiscount - vatReliefPence;
  const vatRateApplied = noVat ? 0 : nominalRate;
  const vatPence =
    vatRateApplied > 0
      ? roundPence((payablePence * vatRateApplied) / (100 + vatRateApplied))
      : 0;
  return {
    grossPence,
    promoDiscountPence,
    vatReliefPence,
    payablePence,
    netPence: payablePence - vatPence,
    vatPence,
    vatRateApplied,
  };
}

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export interface VatBucket {
  rate: number;
  netPence: number;
  vatPence: number;
  grossPence: number;
}

export function addVatBucket(buckets: Map<number, VatBucket>, rate: number, net: number, vat: number, gross: number) {
  const current = buckets.get(rate) ?? { rate, netPence: 0, vatPence: 0, grossPence: 0 };
  current.netPence += net;
  current.vatPence += vat;
  current.grossPence += gross;
  buckets.set(rate, current);
}
