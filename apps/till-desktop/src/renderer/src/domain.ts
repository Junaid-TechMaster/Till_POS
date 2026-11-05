import type { CustomerRecord, ProductRecord, StaffPublic, VatRate } from "@tillpro/shared";
import { priceLine } from "@tillpro/shared";

export interface BasketLine {
  id: string;
  productId: string | null;
  description: string;
  qty: number;
  unitPricePence: number;
  discountPct: number;
  vatRate: VatRate;
  costPence: number;
  ageRestricted: boolean;
  amountPence: number;
}

export interface Tender {
  type: "cash" | "card";
  amountPence: number;
  authCode?: string;
}

export interface CompletedSale {
  slipNo: number;
  at: string;
  staffId: string;
  staffName: string;
  lines: BasketLine[];
  basketDiscountPct: number;
  noVat: boolean;
  totalPence: number;
  discountPence: number;
  vatPence: number;
  paidPence: number;
  changePence: number;
  paymentLabel: string;
  payOutPence: number;
  customerName: string | null;
  kind: "sale" | "refund" | "payout";
  reason?: string;
  tenders: Tender[];
  refundOfSlip?: number;
}

export interface HeldSale {
  id: string;
  at: string;
  lines: BasketLine[];
  basketDiscountPct: number;
  noVat: boolean;
  customer: CustomerRecord | null;
  label: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  staffId: string;
  action: string;
  detail: string;
}

export interface DrawerEvent {
  id: string;
  at: string;
  staffId: string;
  reason: string;
}

export type DialogState =
  | { name: "customer" }
  | { name: "priceCheck" }
  | { name: "hold" }
  | { name: "extras" }
  | { name: "manual" }
  | { name: "lineDiscount" }
  | { name: "basketDiscount" }
  | { name: "age"; productId: string; qty: number }
  | { name: "card" }
  | { name: "change" }
  | { name: "petty" }
  | { name: "refund" }
  | { name: "receipt"; slipNo?: number }
  | { name: "manager"; purpose: string; action: ManagerAction }
  | { name: "help" }
  | { name: "priceOverride" };

export type ManagerAction =
  | { type: "voidLine" }
  | { type: "voidBasket" }
  | { type: "priceOverride"; pricePence: number }
  | { type: "refund"; slipNo: number; reason: string };

export type TillScreen = "sale" | "transactions" | "reports" | "products" | "settings" | "staff" | "stock" | "cashup";

export interface FlashMessage {
  text: string;
  tone: "info" | "bad" | "good";
  token: number;
}

export function paymentLabel(tenders: Tender[]): string {
  const kinds = new Set(tenders.map((tender) => tender.type));
  if (kinds.size === 0) return "";
  if (kinds.size > 1) return "SPLIT";
  return kinds.has("card") ? "CARD" : "CASH";
}

export function reprice(lines: BasketLine[], basketDiscountPct: number, noVat: boolean): BasketLine[] {
  return lines.map((line) => {
    const priced = priceLine(line, basketDiscountPct, noVat);
    return { ...line, amountPence: priced.payablePence };
  });
}

export function totalsOf(lines: BasketLine[], basketDiscountPct: number, noVat: boolean) {
  return lines.reduce(
    (sum, line) => {
      const priced = priceLine(line, basketDiscountPct, noVat);
      sum.totalPence += priced.payablePence;
      sum.discountPence += priced.promoDiscountPence;
      sum.vatPence += priced.vatPence;
      return sum;
    },
    { totalPence: 0, discountPence: 0, vatPence: 0 },
  );
}

export function findProduct(products: ProductRecord[], query: string): ProductRecord | undefined {
  const needle = query.trim();
  return products.find(
    (product) => product.active && (product.barcode === needle || product.plu === needle),
  );
}

export function staffCanOverride(staff: StaffPublic | null): boolean {
  return Boolean(staff);
}
