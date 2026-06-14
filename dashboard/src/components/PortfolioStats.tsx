import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "IDR",
  }).format(n);

interface StatRowProps {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}

function StatRow({ label, value, valueColor = "var(--text-primary)", sub }: StatRowProps) {
  return (
    <div className="flex justify-between items-baseline py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-xs tracking-wide" style={{ color: "var(--text-secondary)", fontFamily: "IBM Plex Sans Condensed, sans-serif" }}>
        {label}
      </span>
      <div className="text-right">
        <span className="bb-num text-xs font-medium" style={{ color: valueColor }}>{value}</span>
        {sub && <span className="bb-num text-xs ml-1" style={{ color: "var(--text-secondary)" }}>{sub}</span>}
      </div>
    </div>
  );
}

export function PortfolioStats() {
  const { data: holdings, isLoading } = useQuery({ queryKey: ["holdings"], queryFn: api.getHoldings });
  const { data: summary } = useQuery({ queryKey: ["summary"], queryFn: api.getSummary });

  if (isLoading || !holdings || !summary)
    return (
      <div className="bb-panel flex items-center gap-2 px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="bb-cursor" /> LOADING...
      </div>
    );

  const winners = holdings.filter((h) => h.pnl_pct >= 0);
  const losers = holdings.filter((h) => h.pnl_pct < 0);
  const winRate = (winners.length / holdings.length) * 100;

  const avgGain = winners.length > 0
    ? winners.reduce((s, h) => s + h.pnl_pct, 0) / winners.length
    : 0;
  const avgLoss = losers.length > 0
    ? losers.reduce((s, h) => s + h.pnl_pct, 0) / losers.length
    : 0;

  const best = [...holdings].sort((a, b) => b.pnl_pct - a.pnl_pct)[0];
  const worst = [...holdings].sort((a, b) => a.pnl_pct - b.pnl_pct)[0];
  const biggestValue = [...holdings].sort((a, b) => b.market_value - a.market_value)[0];
  const biggestDrag = [...holdings].sort((a, b) => a.unrealized_pnl - b.unrealized_pnl)[0];

  const totalLots = holdings.reduce((s, h) => s + h.lots, 0);
  const totalShares = totalLots * 100;

  return (
    <div className="bb-panel flex flex-col">
      <div className="bb-panel-header">PORTFOLIO STATISTICS</div>
      <div className="px-3 py-1 flex-1">

        {/* Win Rate bar */}
        <div className="py-2 mb-1">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: "var(--text-secondary)", fontFamily: "IBM Plex Sans Condensed, sans-serif" }}>WIN RATE</span>
            <span className="bb-num font-semibold" style={{ color: winRate >= 50 ? "var(--green)" : "var(--red)" }}>
              {winners.length}/{holdings.length} ({winRate.toFixed(0)}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-none overflow-hidden" style={{ background: "var(--red-dim)", opacity: 0.6 }}>
            <div
              className="h-full transition-all"
              style={{ width: `${winRate}%`, background: "var(--green)" }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-xs" style={{ color: "var(--green)", fontFamily: "IBM Plex Sans Condensed, sans-serif" }}>
              {winners.length} PROFIT
            </span>
            <span className="text-xs" style={{ color: "var(--red)", fontFamily: "IBM Plex Sans Condensed, sans-serif" }}>
              {losers.length} LOSS
            </span>
          </div>
        </div>

        <StatRow
          label="AVG GAIN (WINNERS)"
          value={`+${avgGain.toFixed(2)}%`}
          valueColor="var(--green)"
        />
        <StatRow
          label="AVG LOSS (LOSERS)"
          value={`${avgLoss.toFixed(2)}%`}
          valueColor="var(--red)"
        />
        <StatRow
          label="PROFIT FACTOR"
          value={losers.length > 0 ? (Math.abs(avgGain) / Math.abs(avgLoss)).toFixed(2) : "∞"}
          valueColor={Math.abs(avgGain) >= Math.abs(avgLoss) ? "var(--amber)" : "var(--red)"}
        />

        <div className="mt-1 mb-0.5" style={{ borderTop: "1px solid var(--border-bright)" }} />

        <StatRow
          label="BEST PERFORMER"
          value={best?.ticker ?? "—"}
          valueColor="var(--orange)"
          sub={`+${best?.pnl_pct.toFixed(2)}%`}
        />
        <StatRow
          label="WORST PERFORMER"
          value={worst?.ticker ?? "—"}
          valueColor="var(--red)"
          sub={`${worst?.pnl_pct.toFixed(2)}%`}
        />
        <StatRow
          label="LARGEST POSITION"
          value={biggestValue?.ticker ?? "—"}
          valueColor="var(--cyan)"
          sub={fmtIDR(biggestValue?.market_value ?? 0)}
        />
        <StatRow
          label="BIGGEST P&L DRAG"
          value={biggestDrag?.ticker ?? "—"}
          valueColor="var(--red)"
          sub={fmtIDR(biggestDrag?.unrealized_pnl ?? 0)}
        />

        <div className="mt-1 mb-0.5" style={{ borderTop: "1px solid var(--border-bright)" }} />

        <StatRow label="TOTAL POSITIONS" value={`${holdings.length}`} />
        <StatRow label="TOTAL LOTS HELD" value={totalLots.toLocaleString("id-ID")} />
        <StatRow label="TOTAL SHARES" value={totalShares.toLocaleString("id-ID")} />
      </div>
    </div>
  );
}
