import { formatGbp, interpretTenderPence } from "@tillpro/shared";
import { useTillStore } from "../store/useTillStore";

export function BasketPanel() {
  const buffer = useTillStore((state) => state.buffer);
  const lines = useTillStore((state) => state.lines);
  const selectedLineId = useTillStore((state) => state.selectedLineId);
  const message = useTillStore((state) => state.message);
  const selectLine = useTillStore((state) => state.selectLine);
  const removeLine = useTillStore((state) => state.requestVoidLine);
  const changeQty = useTillStore((state) => state.changeSelectedQty);
  const openPriceChange = useTillStore((state) => state.openPriceChange);
  const selected = lines.find((line) => line.id === selectedLineId);
  const tender = buffer ? interpretTenderPence(buffer) : null;
  const priceHint = tender !== null && tender > 0 ? `Price ${formatGbp(tender)}` : null;

  return (
    <section className="basket" data-testid="basket" aria-label="Basket">
      <div className="entry">
        <div className="entry-label">Item / barcode</div>
        <div className="entry-value" data-testid="buffer">
          {buffer || "—"}
        </div>
        <div className="entry-hint">
          {priceHint}
        </div>
      </div>
      {message ? <div className={`flash flash-${message.tone}`}>{message.text}</div> : null}
      <div className="basket-scroll">
        {lines.length === 0 ? (
          <div className="empty-basket">Type a price, then tap a category and a product. Or scan a barcode.</div>
        ) : (
          <table className="lines">
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Disc %</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.id}
                  className={line.id === selectedLineId ? "selected" : ""}
                  onClick={() => selectLine(line.id)}
                >
                  <td>
                    <span className="line-name">
                      {line.id === selectedLineId ? (
                        <button
                          type="button"
                          className="line-cancel"
                          aria-label={`Remove ${line.description}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeLine();
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                      {line.description}
                    </span>
                  </td>
                  <td className="num">{line.qty}</td>
                  <td className="num">{formatGbp(line.unitPricePence)}</td>
                  <td className="num">{line.discountPct ? line.discountPct : ""}</td>
                  <td className="num">{formatGbp(line.amountPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected ? (
        <div className="line-actions" data-testid="line-actions">
          <button type="button" className="tp-btn tone-clear" onClick={() => changeQty(-1)}>
            − Qty
          </button>
          <div className="line-qty">{selected.qty}</div>
          <button type="button" className="tp-btn tone-green" onClick={() => changeQty(1)}>
            + Qty
          </button>
          <button type="button" className="tp-btn tone-teal" onClick={openPriceChange}>
            Change price
          </button>
        </div>
      ) : null}
    </section>
  );
}
