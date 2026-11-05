import { useState } from "react";
import { useTillStore } from "../store/useTillStore";

export function SettingsScreen() {
  const current = useTillStore((state) => state.settings);
  const save = useTillStore((state) => state.saveSettingsRecord);
  const setScreen = useTillStore((state) => state.setScreen);
  const [shopName, setShopName] = useState(current.shopName);
  const [address, setAddress] = useState(current.addressLines.join("\n"));
  const [vatNumber, setVatNumber] = useState(current.vatNumber);
  const [phone, setPhone] = useState(current.phone);
  const [posNumber, setPosNumber] = useState(String(current.posNumber));
  const [footer, setFooter] = useState(current.receiptFooter);
  const [quick, setQuick] = useState(current.quickCashPence.map((pence) => String(pence / 100)).join(", "));
  const [threshold, setThreshold] = useState(String(current.voidPinThresholdPence / 100));

  return (
    <div className="screen-page">
      <header className="page-head">
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <button type="button" className="tp-btn tone-clear" onClick={() => setScreen("sale")}>
          Close
        </button>
      </header>
      <form
        className="grid max-w-3xl grid-cols-2 gap-3 overflow-auto"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            ...current,
            shopName,
            addressLines: address.split("\n").map((line) => line.trim()).filter(Boolean),
            vatNumber,
            phone,
            posNumber: Number(posNumber) || 1,
            receiptFooter: footer,
            quickCashPence: quick.split(",").map((part) => Math.round(Number(part.trim()) * 100)).filter((value) => value > 0).slice(0, 4),
            voidPinThresholdPence: Math.round(Number(threshold) * 100),
          });
          setScreen("sale");
        }}
      >
        <label className="field">
          Shop name
          <input data-osk="true" value={shopName} onChange={(event) => setShopName(event.target.value)} />
        </label>
        <label className="field">
          Phone
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="field">
          Address
          <textarea data-osk="true" value={address} onChange={(event) => setAddress(event.target.value)} className="min-h-28 rounded border-2 border-[#b7c4c8] p-2 text-xl" />
        </label>
        <label className="field">
          VAT number
          <input value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} />
        </label>
        <label className="field">
          POS number
          <input value={posNumber} onChange={(event) => setPosNumber(event.target.value)} />
        </label>
        <label className="field">
          Void PIN threshold £
          <input value={threshold} onChange={(event) => setThreshold(event.target.value)} />
        </label>
        <label className="field">
          Quick cash buttons £
          <input value={quick} onChange={(event) => setQuick(event.target.value)} />
        </label>
        <label className="field">
          Receipt footer
          <input data-osk="true" value={footer} onChange={(event) => setFooter(event.target.value)} />
        </label>
        <button type="submit" className="tp-btn tone-green">
          Save settings
        </button>
      </form>
    </div>
  );
}
