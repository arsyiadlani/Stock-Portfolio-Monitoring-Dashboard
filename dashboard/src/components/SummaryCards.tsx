import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg" | "neu" | "orange" | "cyan" | "amber" | "green";
  info?: string;
  leftBorder?: boolean;
}

function Metric({ label, value, sub, tone = "neu", info, leftBorder }: MetricProps) {
  const [show, setShow] = useState(false);

  const colorMap = {
    pos: "var(--green)",
    neg: "var(--red)",
    neu: "var(--text-primary)",
    orange: "var(--orange)",
    cyan: "var(--cyan)",
    amber: "var(--amber)",
    green: "var(--green)",
  };

  return (
    <div
      className="bb-panel flex flex-col"
      style={leftBorder ? { borderLeft: "2px solid var(--border-bright)" } : undefined}
    >
      <div className="bb-panel-header-dark flex items-center justify-between gap-1">
        <span className="truncate">{label}</span>
        {info && (
          <span
            className="relative shrink-0"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
          >
            <span
              className="bb-num cursor-default select-none"
              style={{
                color: "var(--text-dim)",
                border: "1px solid var(--text-dim)",
                borderRadius: "50%",
                width: 13,
                height: 13,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                lineHeight: 1,
              }}
            >
              i
            </span>
            {show && (
              <div
                className="absolute z-50 text-xs"
                style={{
                  top: "calc(100% + 4px)",
                  right: 0,
                  minWidth: 200,
                  maxWidth: 260,
                  background: "#111",
                  border: "1px solid var(--border-bright)",
                  padding: "6px 8px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  fontFamily: "IBM Plex Sans Condensed, sans-serif",
                  fontWeight: 400,
                  whiteSpace: "pre-wrap",
                }}
              >
                {info}
              </div>
            )}
          </span>
        )}
      </div>
      <div className="px-2 py-2 flex flex-col gap-0.5">
        <div
          className="bb-num font-medium text-sm leading-none"
          style={{ color: colorMap[tone] }}
        >
          {value}
        </div>
        {sub && (
          <div className="bb-num text-xs" style={{ color: "var(--text-secondary)" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryCardsProps {
  includeDividends: boolean;
}

export function SummaryCards({ includeDividends }: SummaryCardsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["summary"],
    queryFn: api.getSummary,
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="bb-cursor" />
        LOADING SUMMARY...
      </div>
    );
  if (error || !data)
    return <div className="text-xs px-2" style={{ color: "var(--red)" }}>ERR: SUMMARY UNAVAILABLE</div>;

  const divTotal = data.dividend_total ?? 0;

  // Dividend-adjusted figures (dividends added to realized P&L when mode ON)
  const adjRealizedPnl = includeDividends ? data.realized_pnl + divTotal : data.realized_pnl;
  const pnlTotal = data.unrealized_pnl + adjRealizedPnl;
  const adjTotalReturnPct = data.total_buy > 0 ? (pnlTotal / data.total_buy * 100) : 0;
  const adjAlpha = adjTotalReturnPct - data.ihsg_return_pct;

  const MONTH_ABB = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${MONTH_ABB[d.getMonth()]} ${d.getFullYear()}`;
  }
  const T0_ISO = "2025-02-28";
  const asOfISO = data.data_as_of ?? new Date().toISOString().slice(0, 10);
  const cagrDays = Math.round((new Date(asOfISO + "T00:00:00").getTime() - new Date(T0_ISO + "T00:00:00").getTime()) / 86400000);
  const cagrYears = cagrDays / 365.25;
  const adjPortfolioCagr = cagrYears > 0 && data.total_buy > 0
    ? (Math.pow(1 + adjTotalReturnPct / 100, 1 / cagrYears) - 1) * 100
    : 0;
  const cagrInfo = `Compound Annual Growth Rate — return total disetahunkan.\nFormula: (1 + return)^(365.25/hari) − 1.\n\nPeriode: ${fmtDate(T0_ISO)} — ${fmtDate(asOfISO)} (${cagrDays} hari / ${cagrYears.toFixed(2)} tahun).\n\nSub-label = IHSG CAGR periode sama.${includeDividends ? "\n\n[INCL DIV] CAGR dihitung dengan dividen dimasukkan ke realized P&L." : ""}`;

  const divInfo = `Total dividen tunai yang diterima dari ex-dividend date selama periode portofolio.\n\nDihitung: shares dipegang saat ex-date × dividen per saham.\n\n${includeDividends ? "[INCL DIV aktif] Dividen sudah dimasukkan ke P&L dan return calculation." : "Toggle ke INCL DIV untuk memasukkan dividen ke perhitungan return."}`;

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${includeDividends ? 10 : 9}, 1fr)` }}>
      <Metric
        label="TOTAL INVESTED"
        value={fmtIDR(data.total_invested)}
        tone="neu"
        info="Total kas yang sudah di-deploy ke portofolio. Net dari semua transaksi BUY dikurangi SELL proceeds."
      />
      <Metric
        label="MARKET VALUE"
        value={fmtIDR(data.current_value)}
        tone="neu"
        info="Nilai pasar saat ini dari semua posisi terbuka. Lots × harga penutupan terkini."
      />
      <Metric
        label="UNREALIZED P&L"
        value={fmtIDR(data.unrealized_pnl)}
        sub={fmtPct(data.total_return_pct)}
        tone={data.unrealized_pnl >= 0 ? "pos" : "neg"}
        info="Keuntungan/kerugian di atas kertas dari posisi yang masih terbuka. Market value minus weighted average cost basis."
      />
      <Metric
        label={includeDividends ? "REALIZED + DIV" : "REALIZED P&L"}
        value={fmtIDR(adjRealizedPnl)}

        tone={adjRealizedPnl >= 0 ? "pos" : "neg"}
        info={includeDividends
          ? `Realized P&L dari SELL + total dividen diterima (${fmtIDR(divTotal)}). [INCL DIV mode aktif]`
          : "Profit/loss yang sudah terkunci dari transaksi SELL. Dihitung: (harga jual − avg cost) × lots × 100 saham."}
      />
      <Metric
        label="TOTAL P&L"
        value={fmtIDR(pnlTotal)}
        tone={pnlTotal >= 0 ? "pos" : "neg"}
        info={includeDividends
          ? "Unrealized + Realized + Dividends. [INCL DIV mode aktif]"
          : "Unrealized P&L + Realized P&L. Total keuntungan/kerugian keseluruhan portofolio."}
      />
      {includeDividends && (
        <Metric
          label="DIVIDENDS"
          value={fmtIDR(divTotal)}
          sub="INCL IN P&L"
          tone={divTotal > 0 ? "green" : "neu"}
          leftBorder
          info={divInfo}
        />
      )}
      <Metric
        label="PORTFOLIO RTN"
        value={fmtPct(adjTotalReturnPct)}
        tone={adjTotalReturnPct >= 0 ? "pos" : "neg"}
        leftBorder
        info={"Return dari T0 (28 Feb 2025). Formula: (unrealized + realized" + (includeDividends ? " + div" : "") + ") / total gross BUY spend." + (includeDividends ? " [INCL DIV aktif]" : "")}
      />
      <Metric
        label="IHSG RTN"
        value={fmtPct(data.ihsg_return_pct)}
        sub="SAME PERIOD"
        tone={data.ihsg_return_pct >= 0 ? "pos" : "neg"}
        info="Return IHSG (^JKSE) pada periode yang sama dari T0. Digunakan sebagai benchmark pembanding."
      />
      <Metric
        label="ALPHA"
        value={fmtPct(adjAlpha)}
        sub="PORT − IHSG"
        tone={adjAlpha >= 0 ? "cyan" : "neg"}
        info={"Portfolio return dikurangi IHSG return. Positif = outperforming benchmark." + (includeDividends ? " [INCL DIV aktif]" : "")}
      />
      <Metric
        label="CAGR"
        value={fmtPct(adjPortfolioCagr)}
        sub={`IHSG ${fmtPct(data.ihsg_cagr)}`}
        tone={adjPortfolioCagr >= 0 ? "pos" : "neg"}
        leftBorder
        info={cagrInfo}
      />
    </div>
  );
}
