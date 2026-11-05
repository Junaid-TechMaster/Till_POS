import { describe, expect, it } from "vitest";
import { formatGbp, interpretTenderPence, priceLine } from "./money.js";

describe("formatGbp", () => {
  it("formats pence as pounds", () => {
    expect(formatGbp(0)).toBe("£0.00");
    expect(formatGbp(35)).toBe("£0.35");
    expect(formatGbp(1215)).toBe("£12.15");
    expect(formatGbp(-50)).toBe("-£0.50");
  });
});

describe("interpretTenderPence", () => {
  it("treats one or two digits as pounds and longer entries as pence", () => {
    expect(interpretTenderPence("10")).toBe(1000);
    expect(interpretTenderPence("5")).toBe(500);
    expect(interpretTenderPence("1050")).toBe(1050);
    expect(interpretTenderPence("100")).toBe(100);
    expect(interpretTenderPence("")).toBeNull();
    expect(interpretTenderPence("12a")).toBeNull();
  });
});

describe("priceLine", () => {
  it("extracts 20% VAT from an inclusive price", () => {
    const priced = priceLine({ qty: 1, unitPricePence: 120, discountPct: 0, vatRate: 20 }, 0, false);
    expect(priced.payablePence).toBe(120);
    expect(priced.vatPence).toBe(20);
    expect(priced.netPence).toBe(100);
  });

  it("strips VAT when No VAT is on", () => {
    const priced = priceLine({ qty: 1, unitPricePence: 110, discountPct: 0, vatRate: 20 }, 0, true);
    expect(priced.payablePence).toBe(92);
    expect(priced.vatPence).toBe(0);
    expect(priced.vatRateApplied).toBe(0);
  });

  it("applies a line discount before VAT", () => {
    const priced = priceLine({ qty: 2, unitPricePence: 100, discountPct: 10, vatRate: 0 }, 0, false);
    expect(priced.grossPence).toBe(200);
    expect(priced.promoDiscountPence).toBe(20);
    expect(priced.payablePence).toBe(180);
  });
});
