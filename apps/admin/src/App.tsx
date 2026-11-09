import { formatGbp, PRODUCT_NAME } from "@tillpro/shared";
import { useEffect, useState, type FormEvent } from "react";
import { api, getToken, setToken } from "./api";

type Page = "overview" | "clients" | "client" | "payments" | "settings";

interface Overview {
  total: number;
  active: number;
  trial: number;
  grace: number;
  suspended: number;
  mrrPence: number;
  dueSoon: number;
  devicesOnline: number;
}

interface ClientRow {
  id: string;
  clientCode: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  status: string;
  monthlyPricePence: number;
  username: string;
  createdAt: string;
  lastSeenAt: string | null;
  deviceCount: number;
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: string;
    currentPeriodEnd: string;
    graceEndsAt: string;
    maxDevices: number;
    lastPaidAt: string | null;
  } | null;
  devices: {
    id: string;
    name: string;
    lastSeenAt: string;
    lastIp: string;
    appVersion: string;
    status: string;
  }[];
}

interface ClientDetail {
  client: ClientRow;
  demoPassword: string | null;
  payments: { id: string; amountPence: number; method: string; reference: string; paidAt: string; periodEnd: string }[];
  audit: { id: string; action: string; detail: string; createdAt: string }[];
}

interface Settings {
  trialDays: number;
  graceDays: number;
  offlineHours: number;
  defaultPricePence: number;
  latestVersion: string;
  downloadUrl: string;
}

interface Secret {
  password: string;
  message: string;
}

function money(pence: number): string {
  return formatGbp(pence);
}

function when(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-GB", { hour12: false });
}

function day(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB");
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function badge(status: string): string {
  if (status === "ACTIVE") return "bg-emerald-700";
  if (status === "TRIAL") return "bg-sky-700";
  if (status === "GRACE") return "bg-amber-600";
  return "bg-red-700";
}

export function App() {
  const [token, setSession] = useState(getToken());
  const [page, setPage] = useState<Page>("overview");
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function openClient(id: string) {
    setClientId(id);
    setPage("client");
  }

  if (!token) {
    return (
      <Login
        onSuccess={(next) => {
          setToken(next);
          setSession(next);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <strong className="text-xl">{PRODUCT_NAME}</strong>
        <nav className="flex gap-2">
          {(
            [
              ["overview", "Overview"],
              ["clients", "Clients"],
              ["payments", "Payments"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`min-h-11 rounded px-3 ${page === id ? "bg-teal-700" : "bg-white/10"}`}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="ml-auto min-h-11 rounded bg-white/10 px-3"
          onClick={() => {
            setToken("");
            setSession("");
          }}
        >
          Log out
        </button>
      </header>
      {error ? <p className="bg-red-800 px-5 py-3">{error}</p> : null}
      <main className="p-5">
        {page === "overview" ? <OverviewPage onError={setError} /> : null}
        {page === "clients" ? <ClientsPage onOpen={openClient} onError={setError} /> : null}
        {page === "client" && clientId ? <ClientPage id={clientId} onError={setError} /> : null}
        {page === "payments" ? <PaymentsPage onError={setError} /> : null}
        {page === "settings" ? <SettingsPage onError={setError} /> : null}
      </main>
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onSuccess(result.token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto mt-24 grid w-full max-w-md gap-3 rounded-xl bg-[#182024] p-6">
      <h1 className="text-3xl">{PRODUCT_NAME}</h1>
      <p>Dashboard sign-in. There is no public registration.</p>
      <input className="min-h-12 rounded bg-white px-3 text-black" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
      <input className="min-h-12 rounded bg-white px-3 text-black" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required />
      {error ? <p className="text-red-300">{error}</p> : null}
      <button type="submit" className="min-h-12 rounded bg-teal-700">Sign in</button>
    </form>
  );
}

function OverviewPage({ onError }: { onError: (message: string) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    api<Overview>("/admin/overview").then(setData).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not load the overview."));
  }, [onError]);
  if (!data) return <p>Loading overview…</p>;
  const cards = [
    ["Clients", String(data.total)],
    ["Active", String(data.active)],
    ["Trial", String(data.trial)],
    ["Grace", String(data.grace)],
    ["Suspended", String(data.suspended)],
    ["Monthly recurring", money(data.mrrPence)],
    ["Due in 7 days", String(data.dueSoon)],
    ["Devices online", String(data.devicesOnline)],
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value]) => (
        <article key={label} className="rounded-xl bg-[#182024] p-4">
          <p className="text-white/70">{label}</p>
          <p className="text-3xl">{value}</p>
        </article>
      ))}
    </section>
  );
}

function ClientsPage({ onOpen, onError }: { onOpen: (id: string) => void; onError: (message: string) => void }) {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  function load() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    api<ClientRow[]>(`/admin/clients?${params.toString()}`)
      .then(setRows)
      .catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not load clients."));
  }

  useEffect(() => {
    load();
    api<Settings>("/admin/settings").then(setSettings).catch(() => undefined);
    // The search box applies when the user presses Search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <input className="min-h-12 rounded bg-white px-3 text-black" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
        <select className="min-h-12 rounded bg-white px-3 text-black" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {["TRIAL", "ACTIVE", "GRACE", "SUSPENDED", "EXPIRED", "CANCELLED"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button type="button" className="min-h-12 rounded bg-white/10 px-4" onClick={load}>Search</button>
        <button type="button" className="min-h-12 rounded bg-teal-700 px-4" onClick={() => setCreating(true)}>Create client</button>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-white/70">
            {["Client ID", "Business", "Status", "Next due", "Last seen", "Devices"].map((heading) => (
              <th key={heading} className="border-b border-white/10 py-2">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="cursor-pointer hover:bg-white/5" onClick={() => onOpen(row.id)}>
              <td className="py-3">{row.clientCode}</td>
              <td>{row.businessName}</td>
              <td><span className={`rounded px-2 py-1 text-sm ${badge(row.status)}`}>{row.status}</span></td>
              <td>{day(row.subscription?.currentPeriodEnd ?? null)}</td>
              <td>{when(row.lastSeenAt)}</td>
              <td>{row.deviceCount}/{row.subscription?.maxDevices ?? 1}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {creating && settings ? (
        <CreateClient
          settings={settings}
          onClose={() => setCreating(false)}
          onCreated={(next) => {
            setSecret(next);
            setCreating(false);
            load();
          }}
          onError={onError}
        />
      ) : null}
      {secret ? <SecretDialog secret={secret} onClose={() => setSecret(null)} /> : null}
    </section>
  );
}

function CreateClient({
  settings,
  onClose,
  onCreated,
  onError,
}: {
  settings: Settings;
  onClose: () => void;
  onCreated: (secret: Secret) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    monthlyPricePence: settings.defaultPricePence,
    trialDays: settings.trialDays,
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{ password: string; message: string }>("/admin/clients", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated(result);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not create the client.");
    }
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label className="grid gap-1">
      {label}
      <input
        className="min-h-12 rounded bg-white px-3 text-black"
        type={type}
        value={form[key]}
        onChange={(event) =>
          setForm({
            ...form,
            [key]: type === "number" ? Number(event.target.value) : event.target.value,
          })
        }
        required={key !== "notes"}
      />
    </label>
  );

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-xl bg-[#182024] p-4 md:grid-cols-2">
      <h2 className="md:col-span-2 text-2xl">New client</h2>
      {field("businessName", "Business name")}
      {field("contactName", "Contact name")}
      {field("email", "Email", "email")}
      {field("phone", "Phone")}
      {field("address", "Address")}
      {field("notes", "Notes")}
      {field("monthlyPricePence", "Monthly price (pence)", "number")}
      {field("trialDays", "Trial days", "number")}
      <div className="flex gap-2">
        <button type="submit" className="min-h-12 rounded bg-teal-700 px-4">Save</button>
        <button type="button" className="min-h-12 rounded bg-white/10 px-4" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function SecretDialog({ secret, onClose }: { secret: Secret; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  return (
    <div className="fixed inset-0 grid place-items-center bg-black/70 p-4">
      <div className="grid w-full max-w-xl gap-3 rounded-xl bg-[#182024] p-5">
        <h2 className="text-2xl">Login details — shown once</h2>
        <p className="text-3xl tracking-wide">{secret.password}</p>
        <pre className="whitespace-pre-wrap rounded bg-black/40 p-3">{secret.message}</pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-12 rounded bg-teal-700 px-4" onClick={() => void copyText(secret.password).then(() => setCopied("Password copied"))}>Copy password</button>
          <button type="button" className="min-h-12 rounded bg-teal-700 px-4" onClick={() => void copyText(secret.message).then(() => setCopied("Message copied"))}>Copy login details for client</button>
          <button type="button" className="min-h-12 rounded bg-white/10 px-4" onClick={onClose}>Close</button>
        </div>
        {copied ? <p>{copied}</p> : null}
      </div>
    </div>
  );
}

function ClientPage({ id, onError }: { id: string; onError: (message: string) => void }) {
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [maxDevices, setMaxDevices] = useState(1);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [trialEnd, setTrialEnd] = useState("");

  function load() {
    api<ClientDetail>(`/admin/clients/${id}`)
      .then((next) => {
        setDetail(next);
        setMaxDevices(next.client.subscription?.maxDevices ?? 1);
        setAmount(next.client.monthlyPricePence);
      })
      .catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not load the client."));
  }

  useEffect(load, [id]);

  async function action(path: string, body?: unknown) {
    try {
      const result = await api<Secret | { ok: boolean }>(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : "{}",
      });
      if ("password" in result) setSecret(result);
      load();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "The action failed.");
    }
  }

  if (!detail) return <p>Loading client…</p>;
  const client = detail.client;
  const upcoming = `Hello ${client.contactName},\n\nYour ${PRODUCT_NAME} subscription for ${client.businessName} (${client.clientCode}) is due on ${day(client.subscription?.currentPeriodEnd ?? null)}. The amount is ${money(client.monthlyPricePence)}.\n\nPlease send payment so the till stays open.`;
  const overdue = `Hello ${client.contactName},\n\nPayment for ${PRODUCT_NAME} (${client.clientCode}) is overdue. The till will lock when the grace period ends (${day(client.subscription?.graceEndsAt ?? null)}). Please pay ${money(client.monthlyPricePence)} to keep the till running.`;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-3xl">{client.businessName}</h2>
        <span className={`rounded px-2 py-1 ${badge(client.status)}`}>{client.status}</span>
        <span>{client.clientCode}</span>
      </div>
      <form
        className="grid gap-3 rounded-xl bg-[#182024] p-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void api(`/admin/clients/${client.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              businessName: client.businessName,
              contactName: client.contactName,
              email: client.email,
              phone: client.phone,
              address: client.address,
              notes: client.notes,
              monthlyPricePence: client.monthlyPricePence,
            }),
          }).then(load).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not save."));
        }}
      >
        {(
          [
            ["businessName", "Business"],
            ["contactName", "Contact"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["address", "Address"],
            ["notes", "Notes"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-1">
            {label}
            <input className="min-h-12 rounded bg-white px-3 text-black" value={client[key]} onChange={(event) => setDetail({ ...detail, client: { ...client, [key]: event.target.value } })} />
          </label>
        ))}
        <label className="grid gap-1">
          Monthly price (pence)
          <input className="min-h-12 rounded bg-white px-3 text-black" type="number" value={client.monthlyPricePence} onChange={(event) => setDetail({ ...detail, client: { ...client, monthlyPricePence: Number(event.target.value) } })} />
        </label>
        <button type="submit" className="min-h-12 rounded bg-teal-700 px-4">Save details</button>
      </form>
      {detail.demoPassword ? (
        <div className="rounded-xl bg-[#182024] p-4">
          <h3 className="text-xl">Demo till sign-in</h3>
          <p>Username {client.username}</p>
          <p className="text-2xl tracking-wide">{detail.demoPassword}</p>
          <p>This is the password printed on the till sign-in screen. Reset password puts this same password back.</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-12 rounded bg-red-700 px-4" onClick={() => void action(`/admin/clients/${client.id}/suspend`)}>Suspend</button>
        <button type="button" className="min-h-12 rounded bg-emerald-700 px-4" onClick={() => void action(`/admin/clients/${client.id}/reactivate`)}>Reactivate</button>
        <button type="button" className="min-h-12 rounded bg-white/10 px-4" onClick={() => void action(`/admin/clients/${client.id}/cancel`)}>Cancel</button>
        <button type="button" className="min-h-12 rounded bg-white/10 px-4" onClick={() => void action(`/admin/clients/${client.id}/password`)}>Reset password</button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">Trial ends<input className="min-h-12 rounded bg-white px-3 text-black" type="datetime-local" value={trialEnd} onChange={(event) => setTrialEnd(event.target.value)} /></label>
        <button type="button" className="min-h-12 rounded bg-sky-700 px-4" onClick={() => void action(`/admin/clients/${client.id}/extend-trial`, { trialEndsAt: new Date(trialEnd).toISOString() })}>Extend trial</button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void action(`/admin/clients/${client.id}/pay`, {
            amountPence: amount,
            method,
            reference,
            periodEnd: periodEnd ? new Date(periodEnd).toISOString() : undefined,
          });
        }}
      >
        <label className="grid gap-1">Amount (pence)<input className="min-h-12 w-36 rounded bg-white px-3 text-black" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <label className="grid gap-1">Method
          <select className="min-h-12 rounded bg-white px-3 text-black" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="grid gap-1">Reference<input className="min-h-12 rounded bg-white px-3 text-black" value={reference} onChange={(event) => setReference(event.target.value)} /></label>
        <label className="grid gap-1">Period end (optional)<input className="min-h-12 rounded bg-white px-3 text-black" type="datetime-local" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        <button type="submit" className="min-h-12 rounded bg-teal-700 px-4">Mark as paid</button>
      </form>
      <h3 className="text-xl">Payments</h3>
      <ul>{detail.payments.map((payment) => <li key={payment.id}>{when(payment.paidAt)} · {money(payment.amountPence)} · {payment.method} · {payment.reference}</li>)}</ul>
      <h3 className="text-xl">Devices</h3>
      <div className="flex items-end gap-2">
        <label className="grid gap-1">Max devices<input className="min-h-12 w-24 rounded bg-white px-3 text-black" type="number" value={maxDevices} onChange={(event) => setMaxDevices(Number(event.target.value))} /></label>
        <button type="button" className="min-h-12 rounded bg-white/10 px-4" onClick={() => void action(`/admin/clients/${client.id}/devices/max`, { maxDevices })}>Save limit</button>
      </div>
      <ul className="grid gap-2">
        {client.devices.map((device) => (
          <li key={device.id} className="flex flex-wrap items-center gap-2 rounded bg-[#182024] p-3">
            <span>{device.name}</span>
            <span>{device.status}</span>
            <span>{device.appVersion}</span>
            <span>{when(device.lastSeenAt)}</span>
            <span>{device.lastIp}</span>
            <button type="button" className="min-h-11 rounded bg-red-700 px-3" onClick={() => void action(`/admin/clients/${client.id}/devices/${device.id}/block`)}>Block</button>
            <button type="button" className="min-h-11 rounded bg-white/10 px-3" onClick={() => void api(`/admin/clients/${client.id}/devices/${device.id}`, { method: "DELETE" }).then(load)}>Remove</button>
          </li>
        ))}
      </ul>
      <h3 className="text-xl">Reminders</h3>
      <Reminder label="Upcoming payment" text={upcoming} />
      <Reminder label="Overdue payment" text={overdue} />
      <p>Username {client.username}. Last activity {when(client.lastSeenAt)}. App version {client.devices[0]?.appVersion ?? "—"}.</p>
      <h3 className="text-xl">Audit</h3>
      <ul>{detail.audit.map((entry) => <li key={entry.id}>{when(entry.createdAt)} · {entry.action} · {entry.detail}</li>)}</ul>
      {secret ? <SecretDialog secret={secret} onClose={() => setSecret(null)} /> : null}
    </section>
  );
}

function Reminder({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <strong>{label}</strong>
        <button type="button" className="min-h-11 rounded bg-white/10 px-3" onClick={() => void copyText(text)}>Copy</button>
      </div>
      <pre className="whitespace-pre-wrap rounded bg-[#182024] p-3">{text}</pre>
    </div>
  );
}

function PaymentsPage({ onError }: { onError: (message: string) => void }) {
  const [data, setData] = useState<{ payments: { id: string; clientCode: string; businessName: string; amount: string; method: string; reference: string; paidAt: string; periodEnd: string }[]; overdue: ClientRow[] } | null>(null);
  useEffect(() => {
    api<NonNullable<typeof data>>("/admin/payments").then(setData).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not load payments."));
  }, [onError]);
  if (!data) return <p>Loading payments…</p>;
  function exportCsv() {
    const lines = ["Client ID,Business,Amount,Method,Reference,Paid,Period end", ...data!.payments.map((payment) => [payment.clientCode, payment.businessName, payment.amount, payment.method, payment.reference, payment.paidAt, payment.periodEnd].join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tillpro-payments.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="grid gap-4">
      <button type="button" className="min-h-12 w-fit rounded bg-teal-700 px-4" onClick={exportCsv}>Export CSV</button>
      <h2 className="text-2xl">Overdue</h2>
      <ul>{data.overdue.map((client) => <li key={client.id}>{client.clientCode} · {client.businessName} · {client.status} · due {day(client.subscription?.currentPeriodEnd ?? null)}</li>)}</ul>
      <h2 className="text-2xl">All payments</h2>
      <ul>{data.payments.map((payment) => <li key={payment.id}>{payment.clientCode} · {payment.businessName} · {payment.amount} · {payment.method} · {when(payment.paidAt)}</li>)}</ul>
    </section>
  );
}

function SettingsPage({ onError }: { onError: (message: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Support");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    api<Settings>("/admin/settings").then(setSettings).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not load settings."));
  }, [onError]);
  if (!settings) return <p>Loading settings…</p>;
  return (
    <section className="grid max-w-xl gap-4">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void api<Settings>("/admin/settings", { method: "PUT", body: JSON.stringify(settings) })
            .then((next) => {
              setSettings(next);
              setSaved("Settings saved");
            })
            .catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not save settings."));
        }}
      >
        <label className="grid gap-1">Default trial days<input className="min-h-12 rounded bg-white px-3 text-black" type="number" value={settings.trialDays} onChange={(event) => setSettings({ ...settings, trialDays: Number(event.target.value) })} /></label>
        <label className="grid gap-1">Grace days<input className="min-h-12 rounded bg-white px-3 text-black" type="number" value={settings.graceDays} onChange={(event) => setSettings({ ...settings, graceDays: Number(event.target.value) })} /></label>
        <label className="grid gap-1">Offline allowance (hours)<input className="min-h-12 rounded bg-white px-3 text-black" type="number" value={settings.offlineHours} onChange={(event) => setSettings({ ...settings, offlineHours: Number(event.target.value) })} /></label>
        <label className="grid gap-1">Default monthly price (pence)<input className="min-h-12 rounded bg-white px-3 text-black" type="number" value={settings.defaultPricePence} onChange={(event) => setSettings({ ...settings, defaultPricePence: Number(event.target.value) })} /></label>
        <label className="grid gap-1">Latest app version<input className="min-h-12 rounded bg-white px-3 text-black" value={settings.latestVersion} onChange={(event) => setSettings({ ...settings, latestVersion: event.target.value })} /></label>
        <label className="grid gap-1">Download URL<input className="min-h-12 rounded bg-white px-3 text-black" value={settings.downloadUrl} onChange={(event) => setSettings({ ...settings, downloadUrl: event.target.value })} /></label>
        <button type="submit" className="min-h-12 rounded bg-teal-700">Save settings</button>
        {saved ? <p>{saved}</p> : null}
      </form>
      <form
        className="grid gap-3 rounded-xl bg-[#182024] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void api("/admin/users", { method: "POST", body: JSON.stringify({ email, password, role }) })
            .then(() => setSaved("Dashboard user created"))
            .catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not create the user."));
        }}
      >
        <h2 className="text-xl">Dashboard user</h2>
        <input className="min-h-12 rounded bg-white px-3 text-black" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
        <input className="min-h-12 rounded bg-white px-3 text-black" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (12+ characters)" required />
        <select className="min-h-12 rounded bg-white px-3 text-black" value={role} onChange={(event) => setRole(event.target.value)}>
          <option>Support</option>
          <option>SuperAdmin</option>
        </select>
        <button type="submit" className="min-h-12 rounded bg-white/10">Add user</button>
      </form>
    </section>
  );
}
