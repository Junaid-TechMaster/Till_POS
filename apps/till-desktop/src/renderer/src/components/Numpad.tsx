import { formatGbp } from "@tillpro/shared";
import { useTillStore } from "../store/useTillStore";

export function Numpad() {
  const pressDigit = useTillStore((state) => state.pressDigit);
  const pressDoubleZero = useTillStore((state) => state.pressDoubleZero);
  const backspace = useTillStore((state) => state.backspace);
  const clearBuffer = useTillStore((state) => state.clearBuffer);
  const enter = useTillStore((state) => state.enter);
  const cash = useTillStore((state) => state.cash);
  const openCard = useTillStore((state) => state.openCard);
  const quickCash = useTillStore((state) => state.quickCash);
  const toggleNoVat = useTillStore((state) => state.toggleNoVat);
  const noVat = useTillStore((state) => state.noVat);
  const quick = useTillStore((state) => state.settings.quickCashPence);

  const digits = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00", "back"];

  return (
    <div className="paypad">
      <button type="button" className={`novat ${noVat ? "on" : ""}`} data-testid="btn-novat" onClick={toggleNoVat}>
        {noVat ? "NO VAT ON" : "NO VAT"}
      </button>
      <div className="numpad" data-testid="numpad">
        <div className="quick-col">
          {quick.map((pence) => (
            <button
              key={pence}
              type="button"
              className="tp-btn tone-cash"
              data-testid={`quick-${pence}`}
              onClick={() => quickCash(pence)}
            >
              {formatGbp(pence).replace(".00", "")}
            </button>
          ))}
        </div>
        <div className="digits">
          {digits.map((key) =>
            key === "back" ? (
              <button key={key} type="button" className="tp-btn tone-blue" aria-label="Backspace" onClick={backspace}>
                ⌫
              </button>
            ) : key === "00" ? (
              <button key={key} type="button" className="tp-btn tone-blue" onClick={pressDoubleZero}>
                00
              </button>
            ) : (
              <button key={key} type="button" className="tp-btn tone-blue" onClick={() => pressDigit(key)}>
                {key}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="pay-row">
        <button type="button" className="tp-btn tone-red pay-word" data-testid="btn-card" onClick={openCard}>
          CARD
        </button>
        <div className="enter-stack">
          <button type="button" className="tp-btn tone-green enter-word" data-testid="btn-enter" onClick={enter}>
            Enter
          </button>
          <button type="button" className="tp-btn tone-clear enter-word" data-testid="btn-clear" onClick={clearBuffer}>
            Clear
          </button>
        </div>
        <button type="button" className="tp-btn tone-red pay-word" data-testid="btn-cash" onClick={cash}>
          CASH
        </button>
      </div>
    </div>
  );
}
