import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { api } from "../lib/api";

type Range = "1W" | "1M" | "3M" | "1Y" | "MAX";

const RANGES: Range[] = ["1W", "1M", "3M", "1Y", "MAX"];

const RANGE_DAYS: Record<Range, number | null> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
  "MAX": null,
};

const TICK_INTERVAL: Record<Range, number> = {
  "1W": 1,
  "1M": 4,
  "3M": 7,
  "1Y": 30,
  "MAX": 60,
};

const MONTH_ABB = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatTick(dateStr: string, range: Range): string {
  const [year, month, day] = dateStr.split("-");
  const mo = MONTH_ABB[parseInt(month) - 1];
  const yy = year.slice(2);
  if (range === "MAX") return `${mo} '${yy}`;
  if (range === "1Y") return `${parseInt(day)} ${mo}`;
  return `${month}-${day}`;
}

function formatTooltipDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day)} ${MONTH_ABB[parseInt(month) - 1]} ${year}`;
}

const CustomTooltip = ({ active, payload, label, includeDividends }: any) => {
  if (!active || !payload?.length) return null;
  const port = payload.find((p: any) => p.dataKey === "portfolio" || p.dataKey === "portfolio_div");
  const ihsg = payload.find((p: any) => p.dataKey === "ihsg");

  return (
    <div className="bb-panel text-xs" style={{ border: "1px solid var(--border-bright)", minWidth: 160 }}>
      <div className="bb-panel-header-dark px-2 py-1">{formatTooltipDate(label)}</div>
      <div className="px-2 py-1.5 flex flex-col gap-1">
        {port && (
          <div className="flex justify-between gap-4">
            <span style={{ color: "var(--text-secondary)" }}>{includeDividends ? "PORT+DIV" : "PORTFOLIO"}</span>
            <span className="bb-num font-medium" style={{ color: port.value >= 0 ? "var(--green)" : "var(--red)" }}>
              {port.value >= 0 ? "+" : ""}{port.value?.toFixed(2)}%
            </span>
          </div>
        )}
        {ihsg && ihsg.value != null && (
          <div className="flex justify-between gap-4">
            <span style={{ color: "var(--text-secondary)" }}>IHSG</span>
            <span className="bb-num font-medium" style={{ color: "var(--cyan)" }}>
              {ihsg.value >= 0 ? "+" : ""}{ihsg.value?.toFixed(2)}%
            </span>
          </div>
        )}
        {port && ihsg?.value != null && (
          <div style={{ borderTop: "1px solid var(--border)" }} className="mt-0.5 pt-0.5 flex justify-between gap-4">
            <span style={{ color: "var(--text-secondary)" }}>ALPHA</span>
            <span
              className="bb-num font-medium"
              style={{ color: (port.value - ihsg.value) >= 0 ? "var(--amber)" : "var(--red)" }}
            >
              {(port.value - ihsg.value) >= 0 ? "+" : ""}{(port.value - ihsg.value).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface PerformanceChartProps {
  includeDividends: boolean;
}

export function PerformanceChart({ includeDividends }: PerformanceChartProps) {
  const [range, setRange] = useState<Range>("MAX");

  const { data, isLoading, error } = useQuery({
    queryKey: ["performance"],
    queryFn: api.getPerformance,
  });

  if (isLoading)
    return (
      <div className="bb-panel flex items-center gap-2 px-2 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="bb-cursor" /> LOADING PERFORMANCE DATA...
      </div>
    );
  if (error || !data)
    return (
      <div className="bb-panel px-2 py-2 text-xs" style={{ color: "var(--red)" }}>
        ERR: PERFORMANCE DATA UNAVAILABLE
      </div>
    );

  const allPoints = data
    .filter((d) => d.ihsg_return_pct !== null || d.portfolio_return_pct !== 0)
    .map((d) => ({
      date: d.date,
      label: d.date,
      portfolio: d.portfolio_return_pct,
      portfolio_div: d.portfolio_return_pct_div,
      ihsg: d.ihsg_return_pct,
    }));

  const days = RANGE_DAYS[range];
  const filtered = days === null ? allPoints : allPoints.slice(-days);

  return (
    <div className="bb-panel">
      <div className="flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="bb-panel-header" style={{ border: "none" }}>
          {includeDividends
            ? "PERFORMANCE — PORTFOLIO + DIV vs IHSG (RETURN % FROM T0)"
            : "PERFORMANCE — PORTFOLIO vs IHSG (RETURN % FROM T0)"}
        </div>
        <div className="flex items-center gap-px pr-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="bb-num text-xs px-2 py-0.5 transition-colors"
              style={{
                background: range === r ? "var(--orange)" : "transparent",
                color: range === r ? "#000" : "var(--text-secondary)",
                fontWeight: range === r ? 700 : 400,
                letterSpacing: "0.05em",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={filtered} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="1 4" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "var(--text-secondary)", fontFamily: "IBM Plex Mono" }}
              axisLine={{ stroke: "var(--border-bright)" }}
              tickLine={false}
              interval={TICK_INTERVAL[range]}
              tickFormatter={(v) => formatTick(v, range)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--text-secondary)", fontFamily: "IBM Plex Mono" }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip includeDividends={includeDividends} />} />
            <ReferenceLine y={0} stroke="var(--border-bright)" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey={includeDividends ? "portfolio_div" : "portfolio"}
              stroke="var(--green)"
              strokeWidth={1.5}
              dot={false}
              name={includeDividends ? "Portfolio+Div" : "Portfolio"}
            />
            <Line
              type="monotone"
              dataKey="ihsg"
              stroke="var(--cyan)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              name="IHSG"
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="flex items-center gap-4 mt-1 px-1">
          <div className="flex items-center gap-1.5">
            <div className="h-px w-6" style={{ background: "var(--green)" }} />
            <span className="text-xs tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {includeDividends ? "PORTFOLIO + DIV" : "PORTFOLIO"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-px w-6" style={{ background: "var(--cyan)" }} />
            <span className="text-xs tracking-wider" style={{ color: "var(--text-secondary)" }}>IHSG (^JKSE)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
