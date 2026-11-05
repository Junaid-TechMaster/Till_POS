import { formatGbp } from "@tillpro/shared";
import { useEffect, useState } from "react";
import { useTillStore } from "../store/useTillStore";

export function CashUpScreen() {
  const setScreen = useTillStore((state) => state.setScreen);
  const staff = useTillStore((state) => state.staff);
  const [expected, setExpected] = useState<number | null>(null);
  const [counted, setCounted] = useState("");
  const [blind, setBlind] = useState(true);
  const [notes, setNotes] = useState("");
  const [variance, setVariance] = useState<number | null>(null);

  useEffect(() => {
    void window.till?.expectedCash?.().then(setExpected);
  }, []);

  const countedPence = Math.round(Number(counted) * 100);

  return (
    <div className="screen-page">
      <header className="page-head">
        <h1 className="text-2xl font-extrabold">Cash up</h1>
        <button type="button" className="tp-btn tone-clear" onClick={() => setScreen("sale")}>
          Close
        </button>
      </header>
      <p className="max-w-2xl text-lg text-white">
        Count the drawer first. A blind cash-up hides the expected total until the count is saved.
      </p>
      <form
        className="grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (expected === null || !Number.isFinite(countedPence)) return;
          const diff = countedPence - expected;
          setVariance(diff);
          setBlind(false);
          void window.till?.cashUp?.({
            staffId: staff?.id ?? "",
            expectedPence: expected,
            countedPence,
            blind: true,
            notes,
          });
        }}
      >
        <label className="field">
          Counted cash £
          <input inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} />
        </label>
        <label className="field">
          Notes
          <input data-osk="true" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button type="submit" className="tp-btn tone-green" disabled={expected === null}>
          Save count
        </button>
      </form>
      {!blind && expected !== null ? (
        <div className="rounded bg-[var(--tp-teal-dark)] p-4 text-2xl font-extrabold">
          <div>Expected {formatGbp(expected)}</div>
          <div>Counted {formatGbp(countedPence)}</div>
          <div>Variance {variance === null ? "—" : formatGbp(variance)}</div>
        </div>
      ) : (
        <p className="text-white">Expected cash stays hidden until you save the count.</p>
      )}
    </div>
  );
}
