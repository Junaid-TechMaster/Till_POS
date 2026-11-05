import { formatDateTime, formatGbp } from "@tillpro/shared";
import { useMemo, useState } from "react";
import { useTillStore } from "../store/useTillStore";
import { ReceiptView } from "../components/ReceiptView";

export function TransactionsScreen() {
  const history = useTillStore((state) => state.history);
  const setScreen = useTillStore((state) => state.setScreen);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<number | null>(history[0]?.slipNo ?? null);

  const rows = useMemo(() => {
    return history.filter((sale) => {
      const day = sale.at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [history, from, to]);

  const sale = rows.find((item) => item.slipNo === selected) ?? null;

  return (
    <div className="screen-page" data-testid="transactions-screen">
      <header className="page-head">
        <h1 className="text-2xl font-extrabold">Transactions</h1>
        <div className="flex gap-2">
          <label className="field">
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button type="button" className="tp-btn tone-teal" onClick={() => window.print()} disabled={!sale}>
            Print
          </button>
          <button type="button" className="tp-btn tone-clear" onClick={() => setScreen("sale")}>
            Close
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <div className="min-h-0 overflow-auto rounded bg-white">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slip No</th>
                <th>Date/Time</th>
                <th>Staff ID</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Pay Out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.slipNo} className={item.slipNo === selected ? "selected" : ""}>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <button type="button" className="linkish" onClick={() => setSelected(item.slipNo)}>
                      <span className="grid grid-cols-6 gap-2 px-2">
                        <span>{item.slipNo}</span>
                        <span>{formatDateTime(item.at)}</span>
                        <span>{item.staffId}</span>
                        <span>{formatGbp(item.kind === "payout" ? 0 : item.totalPence)}</span>
                        <span>{item.paymentLabel}</span>
                        <span>{item.payOutPence ? formatGbp(item.payOutPence) : ""}</span>
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No transactions in this range.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="min-h-0 overflow-auto rounded bg-white p-2 text-[var(--tp-ink)]">
          {sale && sale.lines.length > 0 ? (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Slip No</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Disc %</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{sale.slipNo}</td>
                      <td>{line.description}</td>
                      <td>{line.qty}</td>
                      <td>{formatGbp(line.unitPricePence)}</td>
                      <td>{line.discountPct || ""}</td>
                      <td>{formatGbp(line.amountPence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ReceiptView sale={sale} />
            </>
          ) : sale ? (
            <ReceiptView sale={sale} />
          ) : (
            <p className="p-4">Select a slip.</p>
          )}
        </div>
      </div>
    </div>
  );
}
