import { useEffect } from "react";
import { useTillStore } from "../store/useTillStore";

export function useSaleHotkeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      const state = useTillStore.getState();

      if (state.dialog?.name === "change" && (event.key === "Enter" || event.key === "Escape" || event.key === "Delete")) {
        event.preventDefault();
        state.newSale();
        return;
      }

      if (state.dialog || typing) {
        if (event.key === "Escape" && state.dialog?.name === "age") state.confirmAge(false);
        else if (event.key === "Escape") state.closeDialog();
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        state.pressDigit(event.key);
        return;
      }

      const key = event.key;
      if (key === "Enter") {
        event.preventDefault();
        state.enter();
      } else if (key === "Escape" || key === "Delete") {
        event.preventDefault();
        state.clearBuffer();
      } else if (key === "Backspace") {
        event.preventDefault();
        state.backspace();
      } else if (key === "F1") {
        event.preventDefault();
        state.cash();
      } else if (key === "F2") {
        event.preventDefault();
        state.openCard();
      } else if (key === "F3") {
        event.preventDefault();
        state.openDialog({ name: "customer" });
      } else if (key === "F4") {
        event.preventDefault();
        state.openDialog({ name: "priceCheck" });
      } else if (key === "F5") {
        event.preventDefault();
        state.setScreen("reports");
      } else if (key === "F6") {
        event.preventDefault();
        state.openDialog({ name: "receipt" });
      } else if (key === "ArrowUp") {
        event.preventDefault();
        state.moveSelection(-1);
      } else if (key === "ArrowDown") {
        event.preventDefault();
        state.moveSelection(1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
