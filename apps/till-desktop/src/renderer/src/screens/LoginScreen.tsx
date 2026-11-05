import { PRODUCT_NAME } from "@tillpro/shared";
import { useEffect, useState } from "react";
import { DEMO_ADMIN_USERNAME } from "../../../data/catalog";
import { useTillStore } from "../store/useTillStore";

export function LoginScreen() {
  const login = useTillStore((state) => state.login);
  const loginAdmin = useTillStore((state) => state.loginAdmin);
  const [mode, setMode] = useState<"admin" | "cashier">("admin");
  const [username, setUsername] = useState(DEMO_ADMIN_USERNAME);
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"id" | "pin">("id");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void window.till?.adminUsername?.().then((value) => {
      if (value) setUsername(value);
    });
  }, []);

  const buffer = stage === "id" ? staffId : pin;
  const setBuffer = stage === "id" ? setStaffId : setPin;

  useEffect(() => {
    if (mode !== "cashier") return;
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        setBuffer((value) => `${value}${event.key}`.slice(0, 6));
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setBuffer((value) => value.slice(0, -1));
      } else if (event.key === "Escape" || event.key === "Delete") {
        event.preventDefault();
        setBuffer("");
        setError("");
      } else if (event.key === "Enter") {
        event.preventDefault();
        void submitCashier();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function submitAdmin() {
    const ok = await loginAdmin(username, password);
    if (!ok) setError("Shop username or password not recognised");
  }

  async function submitCashier() {
    if (stage === "id") {
      if (!staffId) {
        setError("Enter a staff ID");
        return;
      }
      setStage("pin");
      setError("");
      return;
    }
    const ok = await login(staffId, pin);
    if (!ok) {
      setError("ID or PIN not recognised");
      setPin("");
      setStage("id");
      setStaffId("");
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "Enter"];

  return (
    <div className="login-screen" data-testid="login-screen">
      <div className="login-copy">
        <h1>{PRODUCT_NAME}</h1>
        <p className="text-xl">The shop account from the dashboard is the admin. The admin creates one cashier.</p>
        <div className="flex gap-2">
          <button type="button" className={`tp-btn ${mode === "admin" ? "tone-green" : "tone-teal"}`} onClick={() => { setMode("admin"); setError(""); }}>
            Admin
          </button>
          <button type="button" className={`tp-btn ${mode === "cashier" ? "tone-green" : "tone-teal"}`} onClick={() => { setMode("cashier"); setError(""); }}>
            Cashier
          </button>
        </div>
      </div>
      {mode === "admin" ? (
        <form
          className="login-pad"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAdmin();
          }}
        >
          <label className="field">
            Username
            <input data-osk="true" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            Password
            <input data-osk="true" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          {error ? <div className="flash flash-bad">{error}</div> : null}
          <button type="submit" className="tp-btn tone-green">Sign in</button>
        </form>
      ) : (
        <div className="login-pad">
          <div className="login-display" data-testid="login-display">
            <span>{stage === "id" ? "Staff ID" : "PIN"}</span>
            <span>{stage === "pin" ? "•".repeat(buffer.length) : buffer || "—"}</span>
          </div>
          {error ? <div className="flash flash-bad">{error}</div> : null}
          <div className="pin-grid">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                className={`tp-btn ${key === "Enter" ? "tone-green" : key === "Clear" ? "tone-clear" : "tone-blue"}`}
                onClick={() => {
                  if (key === "Clear") {
                    setBuffer("");
                    setError("");
                  } else if (key === "Enter") void submitCashier();
                  else setBuffer((value) => `${value}${key}`.slice(0, 6));
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
