import { useEffect, useState } from "react";
import type { ReportResult } from "../../../engine/types";
import { useTillStore } from "../store/useTillStore";

const FALLBACK = [
  { id: "x-report", name: "X Report", group: "Till", description: "Current shift totals.", needsManager: false, resets: false },
  { id: "z-report", name: "Z Report", group: "Till", description: "End of day. Closes the shift.", needsManager: true, resets: true },
  { id: "s-report", name: "S Report", group: "Till", description: "Sales summary for a period.", needsManager: false, resets: false },
  { id: "blind-s", name: "Blind S", group: "Till", description: "Summary without expected cash.", needsManager: false, resets: false },
  { id: "blind-z", name: "Blind Z", group: "Till", description: "End of day without expected cash.", needsManager: true, resets: true },
  { id: "sales-by-product", name: "Sales by product", group: "Retail", description: "Quantity and takings.", needsManager: false, resets: false },
  { id: "sales-by-category", name: "Sales by category", group: "Retail", description: "Department takings.", needsManager: false, resets: false },
  { id: "sales-by-staff", name: "Sales by staff", group: "Retail", description: "Cashier takings.", needsManager: false, resets: false },
  { id: "sales-by-payment", name: "Sales by payment", group: "Retail", description: "Cash, card and split.", needsManager: false, resets: false },
  { id: "sales-by-hour", name: "Sales by hour", group: "Retail", description: "Takings by hour.", needsManager: false, resets: false },
  { id: "vat", name: "VAT report", group: "Retail", description: "Net, VAT and gross by rate.", needsManager: false, resets: false },
  { id: "refunds-voids", name: "Refunds and voids", group: "Retail", description: "Refunds and voided lines.", needsManager: false, resets: false },
  { id: "discounts", name: "Discounts", group: "Retail", description: "Discounted sales.", needsManager: false, resets: false },
  { id: "petty-cash", name: "Petty cash", group: "Retail", description: "Pay outs.", needsManager: false, resets: false },
  { id: "no-sale", name: "No sale log", group: "Retail", description: "Drawer openings.", needsManager: false, resets: false },
  { id: "cash-up", name: "Cash-up history", group: "Retail", description: "Counted cash and variance.", needsManager: false, resets: false },
  { id: "stock-level", name: "Stock levels", group: "Retail", description: "Current stock.", needsManager: false, resets: false },
  { id: "low-stock", name: "Low stock", group: "Retail", description: "At or below minimum.", needsManager: false, resets: false },
  { id: "stock-movement", name: "Stock movement", group: "Retail", description: "Stock changes.", needsManager: false, resets: false },
  { id: "top-sellers", name: "Top sellers", group: "Retail", description: "Best sellers.", needsManager: false, resets: false },
  { id: "slow-sellers", name: "Slow sellers", group: "Retail", description: "Fewest sales.", needsManager: false, resets: false },
  { id: "profit", name: "Profit and margin", group: "Retail", description: "Uses cost price.", needsManager: true, resets: false },
  { id: "customer-sales", name: "Customer sales", group: "Retail", description: "Named customers.", needsManager: false, resets: false },
  { id: "transaction-list", name: "Transaction list", group: "Retail", description: "Every slip.", needsManager: false, resets: false },
  { id: "audit-log", name: "Audit log", group: "Retail", description: "Voids, refunds, overrides and sign-ins.", needsManager: true, resets: false },
];

export function ReportsScreen() {
  const setScreen = useTillStore((state) => state.setScreen);
  const [reports, setReports] = useState(FALLBACK);
  const [selected, setSelected] = useState(FALLBACK[0]!.id);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const staff = useTillStore((state) => state.staff);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void window.till?.bootstrap?.().then((data) => {
      if (data.reports.length > 0) setReports(data.reports);
    });
  }, []);

  const current = reports.find((report) => report.id === selected) ?? reports[0]!;

  async function preview() {
    setMessage("");
    if (!window.till?.runReport) {
      setMessage("Open the TillPro window to run reports from the till database.");
      return;
    }
    if (current.resets) {
      setMessage("Z reports close the shift. Press Run Z.");
      return;
    }
    setResult(await window.till.runReport(current.id, from, to));
  }

  async function runZ() {
    if (!window.till?.closeZ) return;
    if (!staff) return;
    const closed = await window.till.closeZ(staff.id, current.id === "blind-z");
    if (!closed.ok) {
      setMessage(closed.error);
      return;
    }
    setResult(closed.report);
    setMessage(`Z ${closed.zNumber} saved. This shift is closed.`);
  }

  function csv() {
    if (!result) return "";
    const header = result.columns.map((column) => column.header).join(",");
    const body = result.rows
      .map((row) => result.columns.map((column) => `"${String(row[column.key] ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    return `${header}\n${body}`;
  }

  function html() {
    if (!result) return "";
    const head = result.columns.map((column) => `<th>${column.header}</th>`).join("");
    const body = result.rows
      .map((row) => `<tr>${result.columns.map((column) => `<td>${row[column.key] ?? ""}</td>`).join("")}</tr>`)
      .join("");
    return `<h1>${result.title}</h1><p>${result.description}</p><table border="1" cellspacing="0" cellpadding="6"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  return (
    <div className="screen-page" data-testid="reports-screen">
      <header className="page-head">
        <h1 className="text-2xl font-extrabold">Reports</h1>
        <button type="button" className="tp-btn tone-clear" onClick={() => setScreen("sale")}>
          Close
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] gap-2">
        <div className="min-h-0 overflow-auto rounded bg-white p-2">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              className={`mb-1 w-full text-left ${report.id === current.id ? "tp-btn tone-green" : "tp-btn tone-ghost"}`}
              onClick={() => {
                setSelected(report.id);
                setResult(null);
                setMessage("");
              }}
            >
              {report.name}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <p className="text-white">{current.description}</p>
          <div className="flex flex-wrap gap-2">
            <label className="field">
              From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="field">
              To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
            <button type="button" className="tp-btn tone-teal" onClick={() => void preview()}>
              Preview
            </button>
            <button
              type="button"
              className="tp-btn tone-teal"
              disabled={!result}
              onClick={() => void (window.till?.exportCsv ? window.till.exportCsv(current.name, csv()) : download(csv(), `${current.id}.csv`))}
            >
              CSV
            </button>
            <button
              type="button"
              className="tp-btn tone-teal"
              disabled={!result}
              onClick={() => void (window.till?.exportPdf ? window.till.exportPdf(current.name, html()) : window.print())}
            >
              PDF
            </button>
            <button type="button" className="tp-btn tone-green" disabled={!result} onClick={() => void (window.till?.printHtml ? window.till.printHtml(html()) : window.print())}>
              Print
            </button>
          </div>
          {current.resets ? (
            <div className="flex flex-wrap items-end gap-2">
              <button type="button" className="tp-btn tone-red" onClick={() => void runZ()}>
                Run {current.name}
              </button>
            </div>
          ) : null}
          {message ? <div className="flash flash-info">{message}</div> : null}
          <div className="min-h-0 flex-1 overflow-auto rounded bg-white">
            {result ? (
              <table className="data-table">
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column.key}>{column.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={result.columns.length}>No rows for this period.</td>
                    </tr>
                  ) : (
                    result.rows.map((row, index) => (
                      <tr key={index}>
                        {result.columns.map((column) => (
                          <td key={column.key} className={column.align === "right" ? "num" : ""}>
                            {row[column.key] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <p className="p-4 text-[var(--tp-ink)]">Choose a report and press Preview.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function download(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
