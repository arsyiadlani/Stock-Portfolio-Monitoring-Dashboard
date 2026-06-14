import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";

type ActionFilter = "ALL" | "BUY" | "SELL";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "IDR",
  }).format(n);

const fmtIDRFull = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function TransactionLog() {
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [tickerFilter, setTickerFilter] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions"],
    queryFn: api.getTransactions,
  });

  if (isLoading)
    return (
      <div className="bb-panel px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="bb-cursor" /> LOADING TRANSACTIONS...
      </div>
    );
  if (error || !data)
    return (
      <div className="bb-panel px-2 py-2 text-xs" style={{ color: "var(--red)" }}>
        ERR: TRANSACTIONS UNAVAILABLE
      </div>
    );

  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = sorted.filter((t) => {
    if (actionFilter !== "ALL" && t.action !== actionFilter) return false;
    if (tickerFilter && t.ticker !== tickerFilter) return false;
    return true;
  });

  const tickers = [...new Set(data.map((t) => t.ticker))].sort();
  const totalBuySpend = data.filter((t) => t.action === "BUY").reduce((s, t) => s + t.total_spend, 0);
  const totalSellProceeds = data.filter((t) => t.action === "SELL").reduce((s, t) => s + t.total_spend, 0);

  return (
    <div className="bb-panel flex flex-col">
      <div className="bb-panel-header flex items-center justify-between">
        <span>TRANSACTION HISTORY — {data.length} TRANSACTIONS</span>
        <div className="flex items-center gap-2">
          <select
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            className="text-xs px-1 py-0.5"
            style={{
              background: "var(--surface)",
              color: tickerFilter ? "var(--orange)" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontFamily: "IBM Plex Mono, monospace",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">ALL TICKERS</option>
            {tickers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {(["ALL", "BUY", "SELL"] as ActionFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              className="text-xs px-2 py-0.5 font-semibold tracking-wider transition"
              style={{
                fontFamily: "IBM Plex Sans Condensed, sans-serif",
                background: actionFilter === f ? "var(--orange)" : "transparent",
                color: actionFilter === f ? "#000" : "var(--text-secondary)",
                border: `1px solid ${actionFilter === f ? "var(--orange)" : "var(--border)"}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex gap-6 px-2 py-1.5 text-xs"
        style={{ borderBottom: "1px solid var(--border)", background: "#050505" }}
      >
        <span className="bb-dim">
          TOTAL DEPLOYED{" "}
          <span className="bb-num bb-orange">{fmtIDR(totalBuySpend)}</span>
        </span>
        <span className="bb-dim">
          TOTAL PROCEEDS{" "}
          <span className="bb-num" style={{ color: "var(--cyan)" }}>{fmtIDR(totalSellProceeds)}</span>
        </span>
        <span className="bb-dim">
          SHOWING{" "}
          <span className="bb-num" style={{ color: "var(--text-primary)" }}>{filtered.length}</span>
          {" "}OF{" "}
          <span className="bb-num">{data.length}</span>
        </span>
      </div>

      <div className="overflow-auto" style={{ maxHeight: 320 }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-bright)" }}>
              {[
                { label: "DATE",         align: "left"  },
                { label: "TICKER",       align: "left"  },
                { label: "ACTION",       align: "right" },
                { label: "PRICE (IDR)",  align: "right" },
                { label: "LOTS",         align: "right" },
                { label: "TOTAL SPEND",  align: "right" },
              ].map(({ label, align }) => (
                <th
                  key={label}
                  className={`px-2 py-1.5 text-xs font-medium tracking-wider ${align === "right" ? "text-right" : "text-left"}`}
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "IBM Plex Sans Condensed, sans-serif",
                    position: "sticky",
                    top: 0,
                    background: "var(--bg)",
                    zIndex: 1,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} className="bb-row" style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="px-2 py-1.5 bb-num text-xs" style={{ color: "var(--text-secondary)" }}>
                  {t.date}
                </td>
                <td
                  className="px-2 py-1.5 bb-num text-xs font-semibold"
                  style={{ color: "var(--orange)" }}
                >
                  {t.ticker}
                </td>
                <td
                  className="px-2 py-1.5 text-xs font-semibold text-right"
                  style={{
                    color: t.action === "BUY" ? "var(--green)" : "var(--cyan)",
                    fontFamily: "IBM Plex Mono, monospace",
                  }}
                >
                  {t.action}
                </td>
                <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-primary)" }}>
                  {t.price.toLocaleString("id-ID")}
                </td>
                <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-primary)" }}>
                  {t.lots}
                </td>
                <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--amber)" }}>
                  {fmtIDRFull(t.total_spend)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid var(--border-bright)" }}>
              <td colSpan={5} className="px-2 py-1.5 text-xs bb-dim tracking-wider"
                style={{ fontFamily: "IBM Plex Sans Condensed, sans-serif" }}>
                {actionFilter !== "ALL" ? `${actionFilter} SUBTOTAL` : "SUBTOTAL"}
              </td>
              <td className="px-2 py-1.5 bb-num text-xs text-right font-semibold" style={{ color: "var(--amber)" }}>
                {fmtIDRFull(filtered.reduce((s, t) => s + t.total_spend, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
