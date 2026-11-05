import { useEffect, useState, type FormEvent } from "react";
import { OnScreenKeyboard } from "./components/OnScreenKeyboard";
import { TitleBar } from "./components/TitleBar";
import { CashUpScreen } from "./screens/CashUpScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ProductsScreen } from "./screens/ProductsScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SaleScreen } from "./screens/SaleScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { StockScreen } from "./screens/StockScreen";
import { TransactionsScreen } from "./screens/TransactionsScreen";
import { useTillStore } from "./store/useTillStore";

interface Gate {
  activated: boolean;
  locked: boolean;
  label: string;
  banner: string | null;
  lockMessage: string | null;
}

export function App() {
  const staff = useTillStore((state) => state.staff);
  const screen = useTillStore((state) => state.screen);
  const banner = useTillStore((state) => state.licenceBanner);
  const [gate, setGate] = useState<Gate | null>(window.till ? null : { activated: true, locked: false, label: "", banner: null, lockMessage: null });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!window.till) return;
    let stop = false;
    async function tick(force = false) {
      const next = force ? await window.till!.licenceRefresh() : await window.till!.licenceState();
      if (stop) return;
      setGate(next);
      useTillStore.setState({ licenceLabel: next.label, licenceBanner: next.banner });
    }
    void tick(true);
    const timer = window.setInterval(() => void tick(false), 60_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    void useTillStore.getState().hydrate();
    return useTillStore.subscribe((state, previous) => {
      if (!window.till?.saveOpenSale || !state.staff) return;
      if (state.saleComplete) {
        void window.till.saveOpenSale(null);
        return;
      }
      if (
        state.lines === previous.lines &&
        state.noVat === previous.noVat &&
        state.paidPence === previous.paidPence &&
        state.buffer === previous.buffer &&
        state.customer === previous.customer &&
        state.basketDiscountPct === previous.basketDiscountPct
      ) {
        return;
      }
      void window.till.saveOpenSale({
        lines: state.lines,
        basketDiscountPct: state.basketDiscountPct,
        noVat: state.noVat,
        customer: state.customer,
        tenders: state.tenders,
        paidPence: state.paidPence,
        buffer: state.buffer,
        selectedLineId: state.selectedLineId,
      });
    });
  }, []);

  async function activate(event: FormEvent) {
    event.preventDefault();
    if (!window.till) return;
    const next = await window.till.activateLicence(username, password);
    setGate(next);
    useTillStore.setState({ licenceLabel: next.label, licenceBanner: next.banner });
    setPassword("");
  }

  const locked = Boolean(window.till && (!gate || !gate.activated || gate.locked));

  return (
    <div className="app-frame">
      <TitleBar />
      {banner ? <div className="grace-banner">{banner}</div> : null}
      {window.till && !gate ? <section className="lock-screen"><h1>Checking subscription…</h1></section> : null}
      {gate && !gate.activated ? (
        <form className="lock-screen" onSubmit={(event) => void activate(event)}>
          <h1>Activate this till</h1>
          <p>Enter the shop username and password from your provider. There is no public sign-up.</p>
          <input data-osk="true" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" />
          <input data-osk="true" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" />
          {gate.lockMessage ? <p className="lock-error">{gate.lockMessage}</p> : null}
          <button type="submit" className="key-btn enter">Sign in</button>
        </form>
      ) : null}
      {gate?.activated && gate.locked ? (
        <section className="lock-screen">
          <h1>{gate.lockMessage}</h1>
          <button type="button" className="key-btn" onClick={() => void window.till?.licenceRefresh().then((next) => {
            setGate(next);
            useTillStore.setState({ licenceLabel: next.label, licenceBanner: next.banner });
          })}>Check again</button>
        </section>
      ) : null}
      {!locked && !staff ? <LoginScreen /> : null}
      {!locked && staff && screen === "sale" ? <SaleScreen /> : null}
      {!locked && staff && screen === "transactions" ? <TransactionsScreen /> : null}
      {!locked && staff && screen === "reports" ? <ReportsScreen /> : null}
      {!locked && staff && screen === "products" ? <ProductsScreen /> : null}
      {!locked && staff && screen === "settings" ? <SettingsScreen /> : null}
      {!locked && staff && screen === "staff" ? <StaffScreen /> : null}
      {!locked && staff && screen === "stock" ? <StockScreen /> : null}
      {!locked && staff && screen === "cashup" ? <CashUpScreen /> : null}
      <OnScreenKeyboard />
    </div>
  );
}
