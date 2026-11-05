import { BasketPanel } from "../components/BasketPanel";
import { CategoryGrid } from "../components/CategoryGrid";
import { DialogHost } from "../components/DialogHost";
import { FunctionGrid } from "../components/FunctionGrid";
import { InfoPanel, TotalsPanel } from "../components/InfoTotals";
import { Numpad } from "../components/Numpad";
import { useSaleHotkeys } from "../hooks/useSaleHotkeys";

export function SaleScreen() {
  useSaleHotkeys();
  return (
    <div className="sale-root" data-testid="sale-screen">
      <div className="col">
        <BasketPanel />
        <div className="mid">
          <InfoPanel />
          <TotalsPanel />
        </div>
        <FunctionGrid />
      </div>
      <div className="col">
        <CategoryGrid />
        <Numpad />
      </div>
      <DialogHost />
    </div>
  );
}
