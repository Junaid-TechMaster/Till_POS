import type { StaffPublic } from "@tillpro/shared";
import { useEffect, useState } from "react";
import { useTillStore } from "../store/useTillStore";

export function StaffScreen() {
  const setScreen = useTillStore((state) => state.setScreen);
  const actor = useTillStore((state) => state.staff);
  const accounts = useTillStore((state) => state.accounts);
  const saveTillStaff = useTillStore((state) => state.saveTillStaff);
  const [people, setPeople] = useState<StaffPublic[]>([]);
  const [cashierId, setCashierId] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [cashierPin, setCashierPin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [ownPin, setOwnPin] = useState("");
  const [error, setError] = useState("");

  const cashier = people.find((person) => person.role === "cashier" && person.active) ?? accounts.find((person) => person.role === "cashier" && person.active);

  useEffect(() => {
    if (window.till?.listStaff) {
      void window.till.listStaff().then(setPeople);
      return;
    }
    setPeople(accounts);
  }, [accounts]);

  useEffect(() => {
    if (!cashier) return;
    setCashierId(cashier.id);
    setCashierName(cashier.name);
  }, [cashier]);

  async function save(input: { id: string; name: string; role: "admin" | "cashier"; pin?: string }) {
    setError("");
    const message = await saveTillStaff({ ...input, active: true });
    if (message) {
      setError(message);
      return;
    }
    if (window.till?.listStaff) setPeople(await window.till.listStaff());
    setCashierPin("");
    setAdminPassword("");
    setOwnPin("");
  }

  return (
    <div className="screen-page">
      <header className="page-head">
        <h1 className="text-2xl font-extrabold">Staff</h1>
        <button type="button" className="tp-btn tone-clear" onClick={() => setScreen("sale")}>
          Close
        </button>
      </header>
      {error ? <div className="flash flash-bad">{error}</div> : null}
      {actor?.role === "cashier" ? (
        <form
          className="grid max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save({ id: actor.id, name: actor.name, role: "cashier", pin: ownPin });
          }}
        >
          <p className="text-white">You can change your own PIN. The admin account can only be changed by the admin.</p>
          <label className="field">
            New PIN
            <input value={ownPin} onChange={(event) => setOwnPin(event.target.value)} inputMode="numeric" required />
          </label>
          <button type="submit" className="tp-btn tone-green">Save my PIN</button>
        </form>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <form
            className="flex flex-col gap-2 rounded bg-white p-3 text-[var(--tp-ink)]"
            onSubmit={(event) => {
              event.preventDefault();
              void save({ id: "1", name: "Admin", role: "admin", pin: adminPassword });
            }}
          >
            <h2 className="text-xl font-extrabold">Admin</h2>
            <p>This is the shop account from the dashboard. The username stays the same. A new password replaces it on this till.</p>
            <label className="field">
              New password
              <input data-osk="true" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required />
            </label>
            <button type="submit" className="tp-btn tone-green">Save admin password</button>
          </form>
          <form
            className="flex flex-col gap-2 rounded bg-white p-3 text-[var(--tp-ink)]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!cashierPin.trim()) {
                setError("Enter a new PIN. The cashier does not need the old one.");
                return;
              }
              void save({ id: cashierId.trim(), name: cashierName.trim(), role: "cashier", pin: cashierPin.trim() });
            }}
          >
            <h2 className="text-xl font-extrabold">{cashier ? "Edit cashier" : "Add cashier"}</h2>
            <p>One cashier. If they forget the PIN, sign in as admin and enter a new one here. The old PIN is not required. Tell them the ID and the new PIN.</p>
            <label className="field">
              ID
              <input value={cashierId} onChange={(event) => setCashierId(event.target.value)} disabled={Boolean(cashier)} required />
            </label>
            <label className="field">
              Name
              <input data-osk="true" value={cashierName} onChange={(event) => setCashierName(event.target.value)} required />
            </label>
            <label className="field">
              {cashier ? "New PIN" : "PIN"}
              <input value={cashierPin} onChange={(event) => setCashierPin(event.target.value)} inputMode="numeric" placeholder="New PIN" required />
            </label>
            <button type="submit" className="tp-btn tone-green">{cashier ? "Save cashier" : "Add cashier"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
