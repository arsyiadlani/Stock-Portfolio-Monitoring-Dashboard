import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Holding } from "../lib/types";

const APPROACH_CONFIG: Record<string, { label: string; fullLabel: string; color: string }> = {
  DV:  { label: "DV",  fullLabel: "DEEP VALUE",     color: "var(--cyan)"  },
  GV:  { label: "GV",  fullLabel: "GROWTH VALUE",   color: "var(--amber)" },
  DIV: { label: "DIV", fullLabel: "DIVIDEND VALUE", color: "var(--green)" },
};

// Maps each v2 IDX ticker to its investment approach
const TICKER_APPROACH: Record<string, string> = {
  // Deep Value
  BUKA: "DV", DIVA: "DV", INCI: "DV", LPKR: "DV",
  LPLI: "DV", PUDP: "DV", SCCO: "DV", UCID: "DV",
  KSIX: "DV", DPNS: "DV", IGAR: "DV", RIGS: "DV",
  // Growth Value
  ASGR: "GV", AUTO: "GV", BAYU: "GV",
  TAPG: "GV",
  // Dividend Value
  LPIN: "DIV",
};

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "IDR",
  }).format(n);

export function AllocationPanel() {
  const { data: holdings, isLoading } = useQuery({ queryKey: ["holdings"], queryFn: api.getHoldings });

  if (isLoading || !holdings)
    return (
      <div className="bb-panel flex items-center gap-2 px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="bb-cursor" /> LOADING...
      </div>
    );

  const totalValue = holdings.reduce((s, h) => s + h.market_value, 0);

  const groups = ["DV", "GV", "DIV"].map((approach) => {
    const stocks = holdings.filter((h) => TICKER_APPROACH[h.ticker] === approach);
    const value = stocks.reduce((s, h) => s + h.market_value, 0);
    const pnl = stocks.reduce((s, h) => s + h.unrealized_pnl, 0);
    const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
    return { approach, stocks, value, pnl, pct, config: APPROACH_CONFIG[approach] };
  });

  // Tickers not in any approach (legacy/sold tickers still held)
  const unclassified = holdings.filter((h) => !TICKER_APPROACH[h.ticker]);
  const unclassifiedValue = unclassified.reduce((s, h) => s + h.market_value, 0);
  const unclassifiedPnl = unclassified.reduce((s, h) => s + h.unrealized_pnl, 0);
  const unclassifiedPct = totalValue > 0 ? (unclassifiedValue / totalValue) * 100 : 0;

  return (
    <div className="bb-panel flex flex-col">
      <div className="bb-panel-header">ALLOCATION BY APPROACH</div>

      {/* Stacked bar */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex h-3 w-full overflow-hidden rounded-none gap-px">
          {groups.map((g) => (
            <div
              key={g.approach}
              style={{
                width: `${g.pct}%`,
                background: g.config.color,
                opacity: 0.8,
                transition: "width 0.3s",
              }}
              title={`${g.config.fullLabel}: ${g.pct.toFixed(1)}%`}
            />
          ))}
          {unclassifiedPct > 0 && (
            <div
              style={{
                width: `${unclassifiedPct}%`,
                background: "var(--text-dim)",
                opacity: 0.5,
              }}
              title={`Unclassified: ${unclassifiedPct.toFixed(1)}%`}
            />
          )}
        </div>
      </div>

      <div className="px-3 pb-2 flex-1 overflow-auto">
        {groups.map((g) => (
          <div key={g.approach} className="py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-none" style={{ background: g.config.color }} />
                <span
                  className="text-xs font-semibold tracking-wider"
                  style={{ color: g.config.color, fontFamily: "IBM Plex Sans Condensed, sans-serif" }}
                >
                  {g.config.fullLabel}
                </span>
              </div>
              <span className="bb-num text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {g.pct.toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <div>
                <span style={{ color: "var(--text-secondary)" }}>MKT VALUE </span>
                <span className="bb-num" style={{ color: "var(--text-primary)" }}>{fmtIDR(g.value)}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>P&L </span>
                <span className="bb-num" style={{ color: g.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                  {g.pnl >= 0 ? "+" : ""}{fmtIDR(g.pnl)}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>{g.stocks.length} STK</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mt-1.5">
              {g.stocks.map((h: Holding) => (
                <span
                  key={h.ticker}
                  className="bb-num text-xs px-1.5 py-0.5"
                  style={{
                    background: "var(--border)",
                    color: h.pnl_pct >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {h.ticker} <span style={{ color: "var(--text-secondary)" }}>{h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct.toFixed(1)}%</span>
                </span>
              ))}
            </div>
          </div>
        ))}

        {/* Unclassified (legacy tickers still held) */}
        {unclassified.length > 0 && (
          <div className="py-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-none" style={{ background: "var(--text-dim)" }} />
                <span
                  className="text-xs font-semibold tracking-wider"
                  style={{ color: "var(--text-dim)", fontFamily: "IBM Plex Sans Condensed, sans-serif" }}
                >
                  UNCLASSIFIED
                </span>
              </div>
              <span className="bb-num text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                {unclassifiedPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <div>
                <span style={{ color: "var(--text-secondary)" }}>MKT VALUE </span>
                <span className="bb-num" style={{ color: "var(--text-primary)" }}>{fmtIDR(unclassifiedValue)}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>P&L </span>
                <span className="bb-num" style={{ color: unclassifiedPnl >= 0 ? "var(--green)" : "var(--red)" }}>
                  {unclassifiedPnl >= 0 ? "+" : ""}{fmtIDR(unclassifiedPnl)}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>{unclassified.length} STK</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {unclassified.map((h: Holding) => (
                <span
                  key={h.ticker}
                  className="bb-num text-xs px-1.5 py-0.5"
                  style={{
                    background: "var(--border)",
                    color: h.pnl_pct >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {h.ticker} <span style={{ color: "var(--text-secondary)" }}>{h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct.toFixed(1)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
