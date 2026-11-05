export interface StoredLine {
  id?: string;
  productId: string | null;
  description: string;
  qty: number;
  unitPricePence: number;
  discountPct: number;
  vatRate: number;
  amountPence: number;
  costPence: number;
}

export interface StoredTender {
  type: "cash" | "card" | string;
  amountPence: number;
  authCode?: string;
}

export interface StoredSale {
  slipNo: number;
  at: string;
  staffId: string;
  staffName: string;
  lines: StoredLine[];
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
  tenders: StoredTender[];
  refundOfSlip?: number;
}

export interface ReportColumn {
  key: string;
  header: string;
  format?: "text" | "money" | "number";
  align?: "left" | "right";
}

export interface ReportResult {
  id: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
}

export interface ReportMeta {
  id: string;
  name: string;
  group: "Till" | "Retail";
  description: string;
  needsManager: boolean;
  blind: boolean;
  resets: boolean;
}

export interface OpenSalePayload {
  lines: unknown[];
  basketDiscountPct: number;
  noVat: boolean;
  customer: unknown;
  tenders: unknown[];
  paidPence: number;
  buffer: string;
  selectedLineId: string | null;
}
