import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Holding, Transaction } from "../lib/types";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "IDR",
  }).format(n);

const fmtIDRFull = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// Approach labels and colors for all v2 IDX tickers
const APPROACH_MAP: Record<string, { label: string; color: string }> = {
  // Deep Value
  BUKA: { label: "DV",  color: "var(--text-secondary)" },
  DIVA: { label: "DV",  color: "var(--text-secondary)" },
  INCI: { label: "DV",  color: "var(--text-secondary)" },
  LPKR: { label: "DV",  color: "var(--text-secondary)" },
  LPLI: { label: "DV",  color: "var(--text-secondary)" },
  PUDP: { label: "DV",  color: "var(--text-secondary)" },
  SCCO: { label: "DV",  color: "var(--text-secondary)" },
  UCID: { label: "DV",  color: "var(--text-secondary)" },
  KSIX: { label: "DV",  color: "var(--text-secondary)" },
  DPNS: { label: "DV",  color: "var(--text-secondary)" },
  // Growth Value
  ASGR: { label: "GV",  color: "var(--amber)" },
  AUTO: { label: "GV",  color: "var(--amber)" },
  BAYU: { label: "GV",  color: "var(--amber)" },
  IGAR: { label: "GV",  color: "var(--amber)" },
  RIGS: { label: "GV",  color: "var(--amber)" },
  TAPG: { label: "GV",  color: "var(--amber)" },
  // Dividend Value
  LPIN: { label: "DIV", color: "var(--green)" },
};

type SortKey =
  | "ticker" | "lots" | "avg_cost" | "current_price"
  | "chg" | "market_value" | "weight" | "unrealized_pnl" | "pnl_pct";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "ticker",         label: "TICKER"    },
  { key: null,             label: "TYPE"      },
  { key: "lots",           label: "LOTS"      },
  { key: "avg_cost",       label: "AVG COST"  },
  { key: "current_price",  label: "PRICE"     },
  { key: "chg",            label: "CHG"       },
  { key: "market_value",   label: "MKT VALUE" },
  { key: "weight",         label: "WEIGHT"    },
  { key: "unrealized_pnl", label: "P&L"       },
  { key: "pnl_pct",        label: "P&L %"     },
];

function getValue(h: Holding, key: SortKey, totalValue: number): number | string {
  if (key === "ticker")         return h.ticker;
  if (key === "lots")           return h.lots;
  if (key === "avg_cost")       return h.avg_cost;
  if (key === "current_price")  return h.current_price;
  if (key === "chg")            return h.current_price - h.avg_cost;
  if (key === "market_value")   return h.market_value;
  if (key === "weight")         return totalValue > 0 ? h.market_value / totalValue : 0;
  if (key === "unrealized_pnl") return h.unrealized_pnl;
  if (key === "pnl_pct")        return h.pnl_pct;
  return 0;
}

// ── Per-ticker modal ──────────────────────────────────────────────────────────

function TickerModal({
  ticker,
  transactions,
  onClose,
}: {
  ticker: string;
  transactions: Transaction[];
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const txns = transactions
    .filter((t) => t.ticker === ticker)
    .sort((a, b) => b.date.localeCompare(a.date));

  const buys  = txns.filter((t) => t.action === "BUY");
  const sells = txns.filter((t) => t.action === "SELL");
  const totalBuyLots      = buys.reduce((s, t) => s + t.lots, 0);
  const totalSellLots     = sells.reduce((s, t) => s + t.lots, 0);
  const totalBuySpend     = buys.reduce((s, t) => s + t.total_spend, 0);
  const totalSellProceeds = sells.reduce((s, t) => s + t.total_spend, 0);
  const avgCost = totalBuyLots > 0 ? totalBuySpend / (totalBuyLots * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.80)" }}
      onClick={onClose}
    >
      <div
        className="bb-panel flex flex-col"
        style={{ minWidth: 540, maxWidth: 700, maxHeight: "78vh", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bb-panel-header flex items-center justify-between">
          <span style={{ color: "var(--orange)" }}>{ticker}</span>
          <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>— TRANSACTION HISTORY</span>
          <button
            onClick={onClose}
            className="ml-auto text-xs transition"
            style={{ color: "var(--text-dim)", fontFamily: "IBM Plex Mono, monospace" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            [×]
          </button>
        </div>

        <div
          className="grid gap-0 px-0 py-0"
          style={{
            gridTemplateColumns: "repeat(4, 1fr)",
            borderBottom: "1px solid var(--border)",
            background: "#050505",
          }}
        >
          {[
            { label: "BOUGHT",         value: `${totalBuyLots} LOTS`,             color: "var(--green)" },
            { label: "SOLD",           value: `${totalSellLots} LOTS`,            color: totalSellLots > 0 ? "var(--cyan)" : "var(--text-dim)" },
            { label: "AVG COST",       value: avgCost.toLocaleString("id-ID", { maximumFractionDigits: 0 }), color: "var(--text-primary)" },
            { label: "TOTAL DEPLOYED", value: fmtIDR(totalBuySpend),              color: "var(--amber)" },
          ].map(({ label, value, color }, i) => (
            <div
              key={label}
              className="flex flex-col px-2 py-2"
              style={{ borderRight: i < 3 ? "1px solid var(--border)" : undefined }}
            >
              <span className="text-xs bb-dim tracking-wider" style={{ fontFamily: "IBM Plex Sans Condensed, sans-serif" }}>
                {label}
              </span>
              <span className="bb-num text-sm font-semibold" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-bright)" }}>
                {[
                  { label: "DATE",        align: "left"  },
                  { label: "ACTION",      align: "left"  },
                  { label: "PRICE",       align: "right" },
                  { label: "LOTS",        align: "right" },
                  { label: "TOTAL SPEND", align: "right" },
                ].map(({ label, align }) => (
                  <th
                    key={label}
                    className={`px-2 py-1.5 text-xs font-medium tracking-wider ${align === "right" ? "text-right" : "text-left"}`}
                    style={{ color: "var(--text-secondary)", fontFamily: "IBM Plex Sans Condensed, sans-serif" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.map((t, i) => (
                <tr key={i} className="bb-row" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-2 py-1.5 bb-num text-xs" style={{ color: "var(--text-secondary)" }}>
                    {t.date}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold"
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
            {sells.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--border-bright)" }}>
                  <td colSpan={4} className="px-2 py-1.5 text-xs bb-dim tracking-wider"
                    style={{ fontFamily: "IBM Plex Sans Condensed, sans-serif" }}>
                    SELL PROCEEDS
                  </td>
                  <td className="px-2 py-1.5 bb-num text-xs text-right font-semibold" style={{ color: "var(--cyan)" }}>
                    {fmtIDRFull(totalSellProceeds)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div
          className="px-2 py-1.5 text-xs bb-dim text-right"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {txns.length} transactions · click outside or ESC to close
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HoldingsTable() {
  const [sortKey, setSortKey] = useState<SortKey>("market_value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["holdings"],
    queryFn: api.getHoldings,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: api.getTransactions,
  });

  if (isLoading)
    return (
      <div className="bb-panel flex items-center gap-2 px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="bb-cursor" /> LOADING HOLDINGS...
      </div>
    );
  if (error || !data)
    return (
      <div className="bb-panel px-2 py-2 text-xs" style={{ color: "var(--red)" }}>
        ERR: HOLDINGS UNAVAILABLE
      </div>
    );

  const totalValue = data.reduce((s, h) => s + h.market_value, 0);

  const sorted = [...data].sort((a, b) => {
    const av = getValue(a, sortKey, totalValue);
    const bv = getValue(b, sortKey, totalValue);
    const cmp =
      typeof av === "string"
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <>
      {selectedTicker && (
        <TickerModal
          ticker={selectedTicker}
          transactions={transactions}
          onClose={() => setSelectedTicker(null)}
        />
      )}

      <div className="bb-panel flex flex-col">
        <div className="bb-panel-header">
          HOLDINGS — {data.length} POSITIONS
          <span className="ml-2 text-xs bb-dim" style={{ fontWeight: 400 }}>
            · click ticker for transaction history
          </span>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-bright)" }}>
                {COLUMNS.map(({ key, label }) => {
                  const active   = key === sortKey;
                  const sortable = key !== null;
                  return (
                    <th
                      key={label}
                      onClick={() => handleSort(key)}
                      className="text-right first:text-left px-2 py-1.5 text-xs font-medium tracking-wider whitespace-nowrap"
                      style={{
                        color: active ? "var(--orange)" : "var(--text-secondary)",
                        fontFamily: "IBM Plex Sans Condensed, sans-serif",
                        cursor: sortable ? "pointer" : "default",
                        userSelect: "none",
                      }}
                    >
                      {label}
                      {active && (
                        <span className="ml-1" style={{ color: "var(--orange)", fontSize: 9 }}>
                          {sortDir === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                      {!active && sortable && (
                        <span className="ml-1" style={{ color: "var(--text-dim)", fontSize: 9 }}>⇅</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => {
                const approach = APPROACH_MAP[h.ticker] ?? { label: "—", color: "var(--text-dim)" };
                const chg      = h.current_price - h.avg_cost;
                const weight   = totalValue > 0 ? (h.market_value / totalValue) * 100 : 0;

                return (
                  <tr key={h.ticker} className="bb-row" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">
                      <button
                        onClick={() => setSelectedTicker(h.ticker)}
                        className="bb-num font-semibold transition"
                        style={{ color: "var(--orange)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {h.ticker}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-xs bb-num text-right">
                      <span style={{ color: approach.color }}>{approach.label}</span>
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-primary)" }}>
                      {h.lots}
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-secondary)" }}>
                      {h.avg_cost.toLocaleString("id-ID")}
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-primary)" }}>
                      {h.current_price.toLocaleString("id-ID")}
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right">
                      <span style={{ color: chg >= 0 ? "var(--green)" : "var(--red)" }}>
                        {chg >= 0 ? "+" : ""}{chg.toFixed(0)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-primary)" }}>
                      {fmtIDR(h.market_value)}
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-secondary)" }}>
                      {weight.toFixed(1)}%
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right">
                      <span style={{ color: h.unrealized_pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                        {fmtIDR(h.unrealized_pnl)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 bb-num text-xs text-right">
                      <span
                        className="px-1 py-0.5"
                        style={{
                          color: h.pnl_pct >= 0 ? "var(--green)" : "var(--red)",
                          background: h.pnl_pct >= 0 ? "rgba(0,212,106,0.08)" : "rgba(255,59,59,0.08)",
                        }}
                      >
                        {fmtPct(h.pnl_pct)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid var(--border-bright)" }}>
                <td
                  colSpan={6}
                  className="px-2 py-1.5 text-xs font-semibold tracking-wider"
                  style={{ color: "var(--text-secondary)", fontFamily: "IBM Plex Sans Condensed, sans-serif" }}
                >
                  TOTAL
                </td>
                <td className="px-2 py-1.5 bb-num text-xs text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                  {fmtIDR(totalValue)}
                </td>
                <td className="px-2 py-1.5 bb-num text-xs text-right" style={{ color: "var(--text-secondary)" }}>
                  100%
                </td>
                <td className="px-2 py-1.5 bb-num text-xs text-right font-semibold">
                  <span
                    style={{
                      color:
                        data.reduce((s, h) => s + h.unrealized_pnl, 0) >= 0
                          ? "var(--green)"
                          : "var(--red)",
                    }}
                  >
                    {fmtIDR(data.reduce((s, h) => s + h.unrealized_pnl, 0))}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
