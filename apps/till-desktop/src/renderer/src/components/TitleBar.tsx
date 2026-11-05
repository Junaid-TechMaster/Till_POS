import { PRODUCT_NAME, APP_VERSION } from "@tillpro/shared";
import { useTillStore } from "../store/useTillStore";

export function TitleBar() {
  const kiosk = useTillStore((state) => state.kiosk);
  const licenceLabel = useTillStore((state) => state.licenceLabel);

  async function fullscreen() {
    if (!window.till) return;
    await window.till.toggleFullScreen();
  }

  async function toggleKiosk() {
    if (!window.till) return;
    const next = !useTillStore.getState().kiosk;
    await window.till.setKiosk(next);
    useTillStore.getState().setKiosk(next);
  }

  return (
    <header className="titlebar">
      <div className="brand">{PRODUCT_NAME}</div>
      <div className="chip" data-testid="licence-chip">
        {window.till ? "Till database" : "This session"}
        {licenceLabel ? ` · ${licenceLabel}` : ""} · v{APP_VERSION}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" className="win-btn" onClick={() => void fullscreen()} aria-label="Full screen">
          ▢
        </button>
        <button type="button" className="win-btn" onClick={() => void toggleKiosk()} aria-label="Kiosk mode">
          {kiosk ? "Exit kiosk" : "Kiosk"}
        </button>
        <button type="button" className="win-btn" onClick={() => void window.till?.minimize()} aria-label="Minimise">
          –
        </button>
        <button type="button" className="win-btn close" onClick={() => void window.till?.close()} aria-label="Close">
          ×
        </button>
      </div>
    </header>
  );
}
