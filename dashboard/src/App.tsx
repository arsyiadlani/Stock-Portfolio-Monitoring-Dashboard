import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "./lib/api";
import { SummaryCards } from "./components/SummaryCards";
import { PerformanceChart } from "./components/PerformanceChart";
import { HoldingsTable } from "./components/HoldingsTable";
import { ContributionChart } from "./components/ContributionChart";
import { PortfolioStats } from "./components/PortfolioStats";
import { AllocationPanel } from "./components/AllocationPanel";
import { TransactionLog } from "./components/TransactionLog";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="bb-num bb-orange">
      {now.toLocaleTimeString("en-GB", { hour12: false })}
    </span>
  );
}

function fmtAsOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

export default function App() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [includeDividends, setIncludeDividends] = useState(false);
  const { data: summaryData } = useQuery({ queryKey: ["summary"], queryFn: api.getSummary });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshPrices();
      queryClient.invalidateQueries();
      setLastRefresh(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Top status bar */}
      <div
        className="flex items-center justify-between px-3 py-1 shrink-0"
        style={{ background: "#000", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <span className="font-condensed text-xs tracking-wide" style={{ color: "var(--text-secondary)" }}>
            IDX EQUITY PORTFOLIO MONITOR
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="bb-dim">JKT</span>
          <Clock />
          <span className="bb-dim">|</span>
          {summaryData?.data_as_of && (
            <span className="bb-dim">PRICES AS OF <span className="bb-num" style={{ color: "var(--amber)" }}>{fmtAsOf(summaryData.data_as_of)}</span></span>
          )}
          {lastRefresh && (
            <span className="bb-dim">SYNCED <span className="bb-num" style={{ color: "var(--cyan)" }}>{lastRefresh}</span></span>
          )}
          {/* Dividend toggle pill */}
          <div
            className="flex items-center font-condensed font-semibold text-xs tracking-wider"
            style={{ border: "1px solid var(--border-bright)", borderRadius: 2 }}
          >
            <button
              onClick={() => setIncludeDividends(false)}
              className="px-2 py-0.5 transition"
              style={{
                background: !includeDividends ? "var(--text-secondary)" : "transparent",
                color: !includeDividends ? "#000" : "var(--text-dim)",
              }}
            >
              EXCL DIV
            </button>
            <button
              onClick={() => setIncludeDividends(true)}
              className="px-2 py-0.5 transition"
              style={{
                background: includeDividends ? "var(--green)" : "transparent",
                color: includeDividends ? "#000" : "var(--text-dim)",
              }}
            >
              INCL DIV
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="font-condensed font-semibold text-xs px-3 py-0.5 tracking-wider transition disabled:opacity-40"
            style={{
              background: refreshing ? "var(--border)" : "var(--orange)",
              color: refreshing ? "var(--text-secondary)" : "#000",
            }}
          >
            {refreshing ? "FETCHING..." : "REFRESH"}
          </button>
        </div>
      </div>

      {/* Portfolio header */}
      <div
        className="flex items-center gap-6 px-3 py-2 shrink-0"
        style={{ background: "#050505", borderBottom: "1px solid var(--border-bright)" }}
      >
        <div>
          <div className="font-condensed font-bold text-sm tracking-wider" style={{ color: "var(--text-primary)" }}>
            PERSONAL PORTFOLIO
          </div>
          <div className="text-xs bb-dim tracking-wide">IDX · LONG TERM INVESTING · VALUE STRATEGY</div>
        </div>
        <div className="h-6 w-px" style={{ background: "var(--border-bright)" }} />
        <div className="text-xs">
          <span className="bb-dim">T0 </span>
          <span className="bb-num" style={{ color: "var(--amber)" }}>28 FEB 2025</span>
        </div>
        <div className="h-6 w-px" style={{ background: "var(--border-bright)" }} />
        <div className="text-xs">
          <span className="bb-dim">UNIVERSE </span>
          <span className="bb-num bb-orange">20</span>
          <span className="bb-dim"> INSTRUMENTS</span>
        </div>
        <div className="h-6 w-px" style={{ background: "var(--border-bright)" }} />
        <div className="text-xs flex gap-3">
          <span><span style={{ color: "var(--cyan)" }}>●</span> <span className="bb-dim">DEEP VALUE</span></span>
          <span><span style={{ color: "var(--amber)" }}>●</span> <span className="bb-dim">GROWTH VALUE</span></span>
          <span><span style={{ color: "var(--green)" }}>●</span> <span className="bb-dim">DIVIDEND VALUE</span></span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="bb-cursor" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-2 flex flex-col gap-2 overflow-auto">
        <SummaryCards includeDividends={includeDividends} />
        <PerformanceChart includeDividends={includeDividends} />
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <PortfolioStats />
          <AllocationPanel />
          <ContributionChart />
        </div>
        <HoldingsTable />
        <TransactionLog />
      </div>
    </div>
  );
}
