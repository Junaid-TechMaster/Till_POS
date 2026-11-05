import { formatGbp } from "@tillpro/shared";
import { useState } from "react";
import { useTillStore } from "../store/useTillStore";

export function StockEditor() {
  const products = useTillStore((state) => state.products);
  const adjust = useTillStore((state) => state.adjustStockQty);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("Delivery");
  const shown = products.filter(
    (product) => product.active && `${product.name} ${product.plu} ${product.barcode}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <input data-osk="true" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product" className="min-h-14 rounded border-2 border-[#b7c4c8] px-3 text-xl text-[var(--tp-ink)]" />
        <input data-osk="true" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="min-h-14 rounded border-2 border-[#b7c4c8] px-3 text-xl text-[var(--tp-ink)]" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded bg-white">
        {shown.map((product) => (
          <div key={product.id} className="stock-row">
            <div>
              <div className="font-extrabold text-[var(--tp-ink)]">{product.name}</div>
              <div className="text-sm text-[#5c6b70]">
                {formatGbp(product.pricePence)} · min {product.minStock}
                {product.stockQty <= product.minStock ? " · low" : ""}
              </div>
            </div>
            <div className="stock-qty">{product.stockQty}</div>
            <button type="button" className="tp-btn tone-clear" onClick={() => void adjust(product.id, -1, reason || "Adjustment")}>
              − 1
            </button>
            <button type="button" className="tp-btn tone-green" onClick={() => void adjust(product.id, 1, reason || "Adjustment")}>
              + 1
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StockScreen() {
  const setScreen = useTillStore((state) => state.setScreen);
  return (
    <div className="screen-page">
      <header className="page-head">
        <h1 className="text-2xl font-extrabold">Update stock</h1>
        <div className="flex gap-2">
          <button type="button" className="tp-btn tone-teal" onClick={() => setScreen("products")}>
            Products
          </button>
          <button type="button" className="tp-btn tone-clear" onClick={() => setScreen("sale")}>
            Close
          </button>
        </div>
      </header>
      <StockEditor />
    </div>
  );
}
