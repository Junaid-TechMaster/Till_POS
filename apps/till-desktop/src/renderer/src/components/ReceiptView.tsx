import { formatDateTime, formatGbp, priceLine } from "@tillpro/shared";
import type { CompletedSale } from "../domain";
import { useTillStore } from "../store/useTillStore";

export function ReceiptView({ sale }: { sale: CompletedSale }) {
  const settings = useTillStore((state) => state.settings);
  const buckets = new Map<number, { net: number; vat: number; gross: number }>();
  for (const line of sale.lines) {
    const priced = priceLine(line, sale.basketDiscountPct, sale.noVat);
    const rate = priced.vatRateApplied;
    const current = buckets.get(rate) ?? { net: 0, vat: 0, gross: 0 };
    current.net += priced.netPence;
    current.vat += priced.vatPence;
    current.gross += priced.payablePence;
    buckets.set(rate, current);
  }

  return (
    <article className="receipt" data-testid="receipt">
      <h3>{settings.shopName}</h3>
      {settings.addressLines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p>Tel {settings.phone}</p>
      <p>VAT {settings.vatNumber}</p>
      <div className="rule" />
      <p>
        Slip {sale.slipNo} · POS {settings.posNumber}
      </p>
      <p>{formatDateTime(sale.at)}</p>
      <p>Staff {sale.staffName} (ID {sale.staffId})</p>
      {sale.customerName ? <p>Customer {sale.customerName}</p> : null}
      {sale.kind !== "sale" ? <p>{sale.kind === "refund" ? "REFUND" : "PAY OUT"}</p> : null}
      <div className="rule" />
      {sale.kind === "payout" ? (
        <p>
          {sale.reason} {formatGbp(sale.payOutPence)}
        </p>
      ) : (
        <table>
          <tbody>
            {sale.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.description}
                  <br />
                  {line.qty} × {formatGbp(line.unitPricePence)}
                  {line.discountPct ? `  disc ${line.discountPct}%` : ""}
                </td>
                <td className="right">{formatGbp(line.amountPence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="rule" />
      {[...buckets.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([rate, bucket]) => (
          <p key={rate}>
            VAT {rate}% net {formatGbp(bucket.net)} tax {formatGbp(bucket.vat)}
          </p>
        ))}
      {sale.noVat ? <p>No VAT applied</p> : null}
      <p>
        <strong>TOTAL {formatGbp(sale.kind === "payout" ? sale.payOutPence : sale.totalPence)}</strong>
      </p>
      {sale.kind === "sale" ? (
        <>
          <p>
            {sale.paymentLabel} {formatGbp(sale.paidPence)}
          </p>
          <p>CHANGE {formatGbp(sale.changePence)}</p>
        </>
      ) : null}
      {sale.reason && sale.kind === "refund" ? <p>Reason: {sale.reason}</p> : null}
      <div className="rule" />
      <p>{settings.receiptFooter}</p>
    </article>
  );
}
