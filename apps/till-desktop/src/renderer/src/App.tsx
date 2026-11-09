import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, DEMO_SHOP_PASSWORD, DEMO_SHOP_USERNAME } from "@tillpro/shared";
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
  const demoShop = useTillStore((state) => state.demoShop);
  const [gate, setGate] = useState<Gate | null>(window.till ? null : { activated: true, locked: false, label: "", banner: null, lockMessage: null });
  const [shopReady, setShopReady] = useState(!window.till);
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
    const next = await window.till.activateLicence(username.trim(), password);
    setGate(next);
    useTillStore.setState({ licenceLabel: next.label, licenceBanner: next.banner });
    if (next.activated && !next.locked) {
      await useTillStore.getState().hydrate();
      setShopReady(true);
    }
    setPassword("");
  }

  const pastShop = !window.till || shopReady;
  const locked = Boolean(window.till && shopReady && (!gate || !gate.activated || gate.locked));
  const paymentNotice = banner && !(demoShop && banner.includes("Pay the dues")) ? banner : null;

  return (
    <div className="app-frame">
      <TitleBar />
      {paymentNotice ? <div className="grace-banner">{paymentNotice}</div> : null}
      {pastShop && !locked && staff && demoShop ? (
        <div className="demo-contact">
          Demo shop. To buy a subscription call {CONTACT_PHONE}, email {CONTACT_EMAIL}, or write to {CONTACT_ADDRESS}.
        </div>
      ) : null}
      {window.till && !shopReady ? (
        <form className="lock-screen" onSubmit={(event) => void activate(event)}>
          <h1>Sign in</h1>
          <p>Enter the client email or username, and the password. This is asked every time the till opens.</p>
          <div className="demo-card">
            <strong>Demo account, valid for 1 day</strong>
            <span>Username {DEMO_SHOP_USERNAME}</span>
            <span>Password {DEMO_SHOP_PASSWORD}</span>
            <span>On the next screen choose Admin and use this username and password.</span>
          </div>
          <input data-osk="true" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Email or username" autoComplete="username" />
          <input data-osk="true" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" />
          {gate?.lockMessage ? <p className="lock-error">{gate.lockMessage}</p> : null}
          <button type="submit" className="key-btn enter">Sign in</button>
        </form>
      ) : null}
      {shopReady && gate?.activated && gate.locked ? (
        <section className="lock-screen">
          <h1>{gate.lockMessage}</h1>
          <button type="button" className="key-btn" onClick={() => void window.till?.licenceRefresh().then((next) => {
            setGate(next);
            useTillStore.setState({ licenceLabel: next.label, licenceBanner: next.banner });
          })}>Check again</button>
        </section>
      ) : null}
      {pastShop && !locked && !staff ? <LoginScreen /> : null}
      {pastShop && !locked && staff && screen === "sale" ? <SaleScreen /> : null}
      {pastShop && !locked && staff && screen === "transactions" ? <TransactionsScreen /> : null}
      {pastShop && !locked && staff && screen === "reports" ? <ReportsScreen /> : null}
      {pastShop && !locked && staff && screen === "products" ? <ProductsScreen /> : null}
      {pastShop && !locked && staff && screen === "settings" ? <SettingsScreen /> : null}
      {pastShop && !locked && staff && screen === "staff" ? <StaffScreen /> : null}
      {pastShop && !locked && staff && screen === "stock" ? <StockScreen /> : null}
      {pastShop && !locked && staff && screen === "cashup" ? <CashUpScreen /> : null}
      <OnScreenKeyboard />
    </div>
  );
}
