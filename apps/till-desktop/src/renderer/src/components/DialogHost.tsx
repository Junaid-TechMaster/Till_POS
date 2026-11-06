import { formatDateTime, formatGbp, interpretTenderPence, parsePriceToPence, VAT_RATES, type VatRate } from "@tillpro/shared";
import { useEffect, useState } from "react";
import { openCatalogue } from "../catalogueNav";
import { useTillStore } from "../store/useTillStore";
import { Modal } from "./Modal";
import { ReceiptView } from "./ReceiptView";

export function DialogHost() {
  const dialog = useTillStore((state) => state.dialog);
  if (!dialog) return null;
  if (dialog.name === "customer") return <CustomerDialog />;
  if (dialog.name === "priceCheck") return <PriceCheckDialog />;
  if (dialog.name === "hold") return <HoldDialog />;
  if (dialog.name === "extras") return <ExtrasDialog />;
  if (dialog.name === "manual") return <ManualDialog />;
  if (dialog.name === "lineDiscount") return <DiscountDialog scope="line" />;
  if (dialog.name === "basketDiscount") return <DiscountDialog scope="basket" />;
  if (dialog.name === "age") return <AgeDialog />;
  if (dialog.name === "card") return <CardDialog />;
  if (dialog.name === "change") return <ChangeDialog />;
  if (dialog.name === "petty") return <PettyDialog />;
  if (dialog.name === "refund") return <RefundDialog />;
  if (dialog.name === "receipt") return <ReceiptDialog slipNo={dialog.slipNo} />;
  if (dialog.name === "manager") return <ManagerDialog />;
  if (dialog.name === "help") return <HelpDialog />;
  if (dialog.name === "priceOverride") return <PriceOverrideDialog />;
  if (dialog.name === "dayEnd") return <DayEndDialog />;
  return null;
}

function CustomerDialog() {
  const customers = useTillStore((state) => state.customers);
  const close = useTillStore((state) => state.closeDialog);
  const attach = useTillStore((state) => state.attachCustomer);
  const save = useTillStore((state) => state.saveCustomer);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <Modal title="Customer" onClose={close} testId="dialog-customer">
      <div className="choice-grid">
        <button type="button" className="tp-btn tone-ghost" onClick={() => attach(null)}>
          No customer
        </button>
        {customers.map((customer) => (
          <button key={customer.id} type="button" className="tp-btn tone-teal" onClick={() => attach(customer)}>
            {customer.name}
          </button>
        ))}
      </div>
      <label className="field">
        New customer
        <input data-osk="true" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
      </label>
      <label className="field">
        Phone
        <input data-osk="true" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" />
      </label>
      <button
        type="button"
        className="tp-btn tone-green"
        onClick={() =>
          save({
            id: `c${Date.now()}`,
            name: name.trim(),
            phone: phone.trim(),
            email: "",
            notes: "",
          })
        }
        disabled={!name.trim()}
      >
        Save and attach
      </button>
    </Modal>
  );
}

function PriceCheckDialog() {
  const close = useTillStore((state) => state.closeDialog);
  const found = useTillStore.getState().priceCheck();
  return (
    <Modal title="Price check" onClose={close} testId="dialog-price">
      {found ? (
        <>
          <p className="text-2xl font-extrabold">{found.name}</p>
          <p className="change-amount" style={{ fontSize: 64 }}>
            {formatGbp(found.pricePence)}
          </p>
          <p>VAT {found.vatRate}%. This does not add the item.</p>
        </>
      ) : (
        <p>Type a barcode or PLU on the numpad, then press Price Check again.</p>
      )}
    </Modal>
  );
}

function HoldDialog() {
  const held = useTillStore((state) => state.held);
  const recall = useTillStore((state) => state.recallSale);
  const holdSale = useTillStore((state) => state.holdSale);
  const lineCount = useTillStore((state) => state.lines.length);
  const close = useTillStore((state) => state.closeDialog);
  return (
    <Modal title="Hold / Recall" onClose={close}>
      <button type="button" className="tp-btn tone-green" onClick={holdSale} disabled={lineCount === 0}>
        Hold current sale
      </button>
      {held.length === 0 ? <p>No held sales.</p> : null}
      <div className="choice-grid">
        {held.map((sale) => (
          <button key={sale.id} type="button" className="tp-btn tone-teal" onClick={() => recall(sale.id)}>
            {formatDateTime(sale.at)} · {sale.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function ExtrasDialog() {
  const close = useTillStore((state) => state.closeDialog);
  const open = useTillStore((state) => state.openDialog);
  const setScreen = useTillStore((state) => state.setScreen);
  const requestVoidLine = useTillStore((state) => state.requestVoidLine);
  const requestVoidBasket = useTillStore((state) => state.requestVoidBasket);
  const requestPriceOverride = useTillStore((state) => state.requestPriceOverride);

  const items: { label: string; run: () => void }[] = [
    { label: "Manual item", run: () => open({ name: "manual" }) },
    { label: "Line discount", run: () => open({ name: "lineDiscount" }) },
    { label: "Basket discount", run: () => open({ name: "basketDiscount" }) },
    { label: "Void line", run: requestVoidLine },
    { label: "Void basket", run: requestVoidBasket },
    { label: "Price override", run: requestPriceOverride },
    { label: "Catalogue", run: () => openCatalogue("products") },
    { label: "Edit categories", run: () => openCatalogue("categories") },
    { label: "Stock", run: () => setScreen("stock") },
    { label: "Staff", run: () => setScreen("staff") },
    { label: "Settings", run: () => setScreen("settings") },
    { label: "Cash up", run: () => setScreen("cashup") },
    { label: "Day end", run: () => open({ name: "dayEnd" }) },
    { label: "Check for updates", run: () => setScreen("settings") },
    { label: "Keyboard help", run: () => open({ name: "help" }) },
  ];

  return (
    <Modal title="Extras" onClose={close} testId="dialog-extras">
      <div className="choice-grid">
        {items.map((item) => (
          <button key={item.label} type="button" className="tp-btn tone-teal" onClick={item.run}>
            {item.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function DayEndDialog() {
  const close = useTillStore((state) => state.closeDialog);
  const flash = useTillStore((state) => state.flash);
  const staff = useTillStore((state) => state.staff);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!window.till?.dayEnd || !staff) {
      setError("Sign in on the till to close the day.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await window.till.dayEnd(staff.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    flash(`Day end emailed to ${result.email}`, "good");
    close();
  }

  return (
    <Modal title="Day end" onClose={close} testId="dialog-day-end">
      <p>This emails every transaction since the shop opened to the client email, then closes the day.</p>
      {error ? <div className="flash flash-bad">{error}</div> : null}
      <button type="button" className="tp-btn tone-green" disabled={busy} onClick={() => void send()}>
        {busy ? "Sending…" : "Send day end"}
      </button>
    </Modal>
  );
}

function ManualDialog() {
  const close = useTillStore((state) => state.closeDialog);
  const addManual = useTillStore((state) => state.addManual);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [vat, setVat] = useState<VatRate>(20);
  const [error, setError] = useState("");

  function typePrice(key: string) {
    setError("");
    if (key === "clear") {
      setPrice("");
      return;
    }
    if (key === "back") {
      setPrice((value) => value.slice(0, -1));
      return;
    }
    setPrice((value) => {
      const next = `${value}${key}`;
      if (!/^\d*\.?\d{0,2}$/.test(next)) return value;
      return next.slice(0, 8);
    });
  }

  function add() {
    const pence = parsePriceToPence(price);
    if (!description.trim() || !pence) {
      setError("Enter the item name and a price, for example 2.50.");
      return;
    }
    addManual(description, pence, vat, qty);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

  return (
    <Modal title="Manual item" onClose={close}>
      <p>Type an item that is not in the catalogue. It is added to this basket.</p>
      <label className="field">
        Item name
        <input data-osk="true" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Item name" />
      </label>
      <div className="login-display">
        <span>Price</span>
        <span className={price ? undefined : "login-placeholder"}>{price ? `£${price}` : "0.00"}</span>
      </div>
      <div className="pin-grid">
        {keys.map((key) => (
          <button key={key} type="button" className={`tp-btn ${key === "back" ? "tone-clear" : "tone-blue"}`} onClick={() => typePrice(key)}>
            {key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
      <div className="choice-grid cols-3">
        <button type="button" className="tp-btn tone-teal" onClick={() => setQty((value) => Math.max(1, value - 1))}>−</button>
        <span className="tp-btn tone-green">Qty {qty}</span>
        <button type="button" className="tp-btn tone-teal" onClick={() => setQty((value) => Math.min(99, value + 1))}>+</button>
      </div>
      <div className="choice-grid cols-3">
        {VAT_RATES.map((rate) => (
          <button key={rate} type="button" className={`tp-btn ${vat === rate ? "tone-green" : "tone-ghost"}`} onClick={() => setVat(rate)}>
            VAT {rate}%
          </button>
        ))}
      </div>
      {error ? <div className="flash flash-bad">{error}</div> : null}
      <button type="button" className="tp-btn tone-green" onClick={add}>
        Add to basket
      </button>
    </Modal>
  );
}

function DiscountDialog({ scope }: { scope: "line" | "basket" }) {
  const close = useTillStore((state) => state.closeDialog);
  const applyLine = useTillStore((state) => state.applyLineDiscount);
  const applyBasket = useTillStore((state) => state.applyBasketDiscount);
  const [pct, setPct] = useState("10");
  const apply = () => {
    const value = Number(pct);
    if (!Number.isFinite(value)) return;
    if (scope === "line") applyLine(value);
    else applyBasket(value);
  };
  return (
    <Modal title={scope === "line" ? "Line discount %" : "Basket discount %"} onClose={close}>
      <label className="field">
        Percent
        <input inputMode="numeric" value={pct} onChange={(event) => setPct(event.target.value)} />
      </label>
      <div className="choice-grid cols-3">
        {[5, 10, 15, 20, 25, 50].map((value) => (
          <button key={value} type="button" className="tp-btn tone-teal" onClick={() => setPct(String(value))}>
            {value}%
          </button>
        ))}
      </div>
      <button type="button" className="tp-btn tone-green" onClick={apply}>
        Apply
      </button>
    </Modal>
  );
}

function AgeDialog() {
  const confirmAge = useTillStore((state) => state.confirmAge);
  return (
    <Modal title="Age check" onClose={() => confirmAge(false)} testId="dialog-age">
      <p className="text-xl font-bold">This item is age-restricted. Confirm the customer is 18 or over.</p>
      <div className="choice-grid">
        <button type="button" className="tp-btn tone-green" onClick={() => confirmAge(true)}>
          Customer is 18+
        </button>
        <button type="button" className="tp-btn tone-clear" onClick={() => confirmAge(false)}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function CardDialog() {
  const due = useTillStore((state) => state.totalPence - state.paidPence);
  const resolve = useTillStore((state) => state.resolveCard);
  return (
    <Modal title="Card payment" onClose={() => resolve(false)} testId="dialog-card">
      <p>Mock terminal. A real terminal can replace this provider later.</p>
      <p className="change-amount" style={{ fontSize: 64 }}>
        {formatGbp(due)}
      </p>
      <div className="choice-grid">
        <button type="button" className="tp-btn tone-green" data-testid="card-approve" onClick={() => resolve(true)}>
          Approve
        </button>
        <button type="button" className="tp-btn tone-clear" onClick={() => resolve(false)}>
          Decline
        </button>
      </div>
    </Modal>
  );
}

function ChangeDialog() {
  const change = useTillStore((state) => state.changePence);
  const fresh = useTillStore((state) => state.newSale);
  return (
    <Modal title="Change" onClose={fresh} testId="dialog-change">
      <div className="change-amount">{formatGbp(change)}</div>
      <button type="button" className="tp-btn tone-green" onClick={fresh}>
        New sale
      </button>
    </Modal>
  );
}

function PettyDialog() {
  const close = useTillStore((state) => state.closeDialog);
  const record = useTillStore((state) => state.recordPetty);
  const buffer = useTillStore((state) => state.buffer);
  const preset = interpretTenderPence(buffer);
  const [amount, setAmount] = useState(preset ? (preset / 100).toFixed(2) : "");
  const [reason, setReason] = useState("");
  return (
    <Modal title="Petty cash / pay out" onClose={close}>
      <label className="field">
        Amount (£)
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label className="field">
        Reason
        <input data-osk="true" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Window cleaner" />
      </label>
      <button
        type="button"
        className="tp-btn tone-green"
        onClick={() => record(Math.round(Number(amount) * 100), reason)}
      >
        Record pay out
      </button>
    </Modal>
  );
}

function RefundDialog() {
  const history = useTillStore((state) => state.history);
  const close = useTillStore((state) => state.closeDialog);
  const refundSale = useTillStore((state) => state.refundSale);
  const sales = history.filter((sale) => sale.kind === "sale");
  const [slip, setSlip] = useState(sales[0]?.slipNo ?? 0);
  const [reason, setReason] = useState("");
  return (
    <Modal title="Refund" onClose={close} wide>
      <p>Record the reason. The refund is stored with the original slip.</p>
      <div className="choice-grid">
        {sales.map((sale) => (
          <button
            key={sale.slipNo}
            type="button"
            className={`tp-btn ${slip === sale.slipNo ? "tone-green" : "tone-teal"}`}
            onClick={() => setSlip(sale.slipNo)}
          >
            Slip {sale.slipNo} · {formatGbp(sale.totalPence)}
          </button>
        ))}
      </div>
      {sales.length === 0 ? <p>No completed sales in this session yet.</p> : null}
      <label className="field">
        Reason
        <input data-osk="true" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button
        type="button"
        className="tp-btn tone-red"
        disabled={!slip || !reason.trim()}
        onClick={() => refundSale(slip, reason.trim())}
      >
        Refund
      </button>
    </Modal>
  );
}

function ReceiptDialog({ slipNo }: { slipNo?: number }) {
  const history = useTillStore((state) => state.history);
  const close = useTillStore((state) => state.closeDialog);
  const sale = slipNo ? history.find((item) => item.slipNo === slipNo) : history.find((item) => item.kind === "sale");
  return (
    <Modal title="Receipt" onClose={close} testId="dialog-receipt">
      {sale ? <ReceiptView sale={sale} /> : <p>No receipt to print yet.</p>}
      {sale ? (
        <button type="button" className="tp-btn tone-teal" onClick={() => window.print()}>
          Print
        </button>
      ) : null}
    </Modal>
  );
}

function ManagerDialog() {
  const dialog = useTillStore((state) => state.dialog);
  const approve = useTillStore((state) => state.approveManager);
  const close = useTillStore((state) => state.closeDialog);
  const [pin, setPin] = useState("");
  const purpose = dialog?.name === "manager" ? dialog.purpose : "Manager";
  const press = (digit: string) => setPin((value) => `${value}${digit}`.slice(0, 6));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        setPin((value) => `${value}${event.key}`.slice(0, 6));
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setPin((value) => value.slice(0, -1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        setPin((value) => {
          approve(value);
          return value;
        });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [approve]);

  return (
    <Modal title="Manager PIN" onClose={close} testId="dialog-manager">
      <p>{purpose}</p>
      <div className="login-display">
        <span>PIN</span>
        <span>{pin ? "•".repeat(pin.length) : ""}</span>
      </div>
      <div className="pin-grid">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "OK"].map((key) => (
          <button
            key={key}
            type="button"
            className={`tp-btn ${key === "OK" ? "tone-green" : key === "Clear" ? "tone-clear" : "tone-blue"}`}
            onClick={() => {
              if (key === "Clear") setPin("");
              else if (key === "OK") approve(pin);
              else press(key);
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function HelpDialog() {
  const close = useTillStore((state) => state.closeDialog);
  return (
    <Modal title="Keyboard" onClose={close}>
      <ul className="help-list">
        <li>Number keys and the numpad type into the entry row.</li>
        <li>Enter looks up a barcode or PLU. Clear, Esc, or Delete removes the basket items.</li>
        <li>Backspace deletes the last digit. Type a quantity, then tap a product.</li>
        <li>F1 Cash, F2 Card, F3 Customer, F4 Price Check, F5 Reports, F6 Print Last.</li>
        <li>Up and Down move through the basket.</li>
        <li>One or two digits are pounds. Three or more digits are pence. 1050 is £10.50.</li>
      </ul>
    </Modal>
  );
}

function PriceOverrideDialog() {
  const close = useTillStore((state) => state.closeDialog);
  const apply = useTillStore((state) => state.applyPriceOverride);
  const current = useTillStore((state) => state.lines.find((line) => line.id === state.selectedLineId));
  const [price, setPrice] = useState(current ? (current.unitPricePence / 100).toFixed(2) : "");
  return (
    <Modal title="Price override" onClose={close}>
      <p>This changes the price of the selected line.</p>
      <label className="field">
        New price (£)
        <input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
      </label>
      <button type="button" className="tp-btn tone-green" onClick={() => apply(Math.round(Number(price) * 100))}>
        Apply
      </button>
    </Modal>
  );
}
