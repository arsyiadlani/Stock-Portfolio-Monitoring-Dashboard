import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { api } from "../lib/api";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "IDR",
  }).format(n);

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bb-panel text-xs" style={{ border: "1px solid var(--border-bright)" }}>
      <div className="bb-panel-header-dark px-2 py-1">{d.payload.ticker}</div>
      <div className="px-2 py-1.5">
        <div className="flex justify-between gap-4">
          <span style={{ color: "var(--text-secondary)" }}>P&L</span>
          <span
            className="bb-num font-medium"
            style={{ color: d.value >= 0 ? "var(--green)" : "var(--red)" }}
          >
            {fmtIDR(d.value)}
          </span>
        </div>
        <div className="flex justify-between gap-4 mt-0.5">
          <span style={{ color: "var(--text-secondary)" }}>P&L %</span>
          <span
            className="bb-num"
            style={{ color: d.payload.pnl_pct >= 0 ? "var(--green)" : "var(--red)" }}
          >
            {d.payload.pnl_pct >= 0 ? "+" : ""}{d.payload.pnl_pct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export function ContributionChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["holdings"],
    queryFn: api.getHoldings,
  });

  if (isLoading)
    return (
      <div className="bb-panel flex items-center gap-2 px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="bb-cursor" />
        LOADING...
      </div>
    );
  if (error || !data) return null;

  const sorted = [...data].sort((a, b) => a.unrealized_pnl - b.unrealized_pnl);

  return (
    <div className="bb-panel flex flex-col">
      <div className="bb-panel-header">P&L CONTRIBUTION</div>
      <div className="p-2 flex-1">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 9, fill: "var(--text-secondary)", fontFamily: "IBM Plex Mono" }}
              tickFormatter={fmtIDR}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="ticker"
              type="category"
              tick={{ fontSize: 10, fill: "var(--orange)", fontFamily: "IBM Plex Mono", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <ReferenceLine x={0} stroke="var(--border-bright)" strokeWidth={1} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,108,0,0.04)" }} />
            <Bar dataKey="unrealized_pnl" radius={[0, 2, 2, 0]}>
              {sorted.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.unrealized_pnl >= 0 ? "var(--green-dim)" : "var(--red-dim)"}
                  stroke={entry.unrealized_pnl >= 0 ? "var(--green)" : "var(--red)"}
                  strokeWidth={0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
