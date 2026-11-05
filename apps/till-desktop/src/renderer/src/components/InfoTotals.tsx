import { APP_VERSION, PRODUCT_NAME, formatDateTime, formatGbp } from "@tillpro/shared";
import { useEffect, useState } from "react";
import { useTillStore } from "../store/useTillStore";

export function InfoPanel() {
  const staff = useTillStore((state) => state.staff);
  const settings = useTillStore((state) => state.settings);
  const customer = useTillStore((state) => state.customer);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="info" aria-label="Till information">
      <div className="flex items-start justify-between gap-2">
        <span className="pill">OPEN</span>
        <span className="info-meta">POS {settings.posNumber}</span>
      </div>
      <div>
        <div className="info-name">{staff?.name ?? "Signed out"}</div>
        <div className="info-meta">
          <span>ID {staff?.id ?? "—"}</span>
          <span className="capitalize">{staff?.role}</span>
        </div>
      </div>
      <div className="info-meta">
        <span>
          {PRODUCT_NAME} {APP_VERSION}
        </span>
        <span>{customer ? customer.name : "No customer"}</span>
      </div>
      <div className="info-clock" data-testid="clock">
        {formatDateTime(now)}
      </div>
    </section>
  );
}

export function TotalsPanel() {
  const total = useTillStore((state) => state.totalPence);
  const disc = useTillStore((state) => state.discountPence);
  const paid = useTillStore((state) => state.paidPence);
  const change = useTillStore((state) => state.changePence);
  const basketPct = useTillStore((state) => state.basketDiscountPct);

  return (
    <section className="totals" aria-label="Totals">
      <div className="tot-row tot-total">
        <span>TOTAL</span>
        <span data-testid="total-value">{formatGbp(total)}</span>
      </div>
      <div className="tot-row tot-disc">
        <span>DISC{basketPct ? ` ${basketPct}%` : ""}</span>
        <span data-testid="disc-value">{formatGbp(disc)}</span>
      </div>
      <div className="tot-row tot-paid">
        <span>PAID</span>
        <span data-testid="paid-value">{formatGbp(paid)}</span>
      </div>
      <div className="tot-row tot-change">
        <span>CHANGE</span>
        <span data-testid="change-value">{formatGbp(change)}</span>
      </div>
    </section>
  );
}
