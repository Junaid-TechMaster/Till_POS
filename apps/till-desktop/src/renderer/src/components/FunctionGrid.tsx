import { useTillStore } from "../store/useTillStore";
import { openDrawer } from "../store/useTillStore";

export function FunctionGrid() {
  const openDialog = useTillStore((state) => state.openDialog);
  const logOff = useTillStore((state) => state.logOff);
  const setScreen = useTillStore((state) => state.setScreen);

  const buttons: { id: string; label: string; run: () => void }[] = [
    { id: "logoff", label: "Log Off", run: logOff },
    { id: "transactions", label: "Transactions", run: () => setScreen("transactions") },
    { id: "petty", label: "Petty Cash", run: () => openDialog({ name: "petty" }) },
    { id: "customer", label: "Customer", run: () => openDialog({ name: "customer" }) },
    { id: "refund", label: "Refund", run: () => openDialog({ name: "refund" }) },
    { id: "nosale", label: "No Sale", run: () => openDrawer("No sale") },
    { id: "pricecheck", label: "Price Check", run: () => openDialog({ name: "priceCheck" }) },
    { id: "hold", label: "Hold/Recall", run: () => openDialog({ name: "hold" }) },
    { id: "reports", label: "Reports", run: () => setScreen("reports") },
    { id: "print", label: "Print Last", run: () => openDialog({ name: "receipt" }) },
    { id: "sales", label: "Sales", run: () => setScreen("transactions") },
    { id: "extras", label: "Extras", run: () => openDialog({ name: "extras" }) },
  ];

  return (
    <div className="fn-grid" aria-label="Functions">
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          className="tp-btn tone-teal fn-btn"
          data-testid={`fn-${button.id}`}
          onClick={button.run}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
