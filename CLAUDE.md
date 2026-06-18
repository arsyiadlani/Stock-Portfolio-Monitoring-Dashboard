# Stock Portfolio Dashboard v2 — Personal Portfolio

## Project Purpose

Dashboard to track and visualize personal IDX investment portfolio performance vs IHSG.
Data source: `Portfolio Risk Management - Investment Portfolio.csv` (personal transaction log).

**Key difference from v1:** Larger universe (20 active IDX stocks), multiple strategies (DV/GV/DIV),
dividend tracking, CAGR metric, dividend toggle mode. Foreign stocks (AMZN, INTC, KO, SPY), gold,
bonds, ETFs, and e-IPO stocks intentionally excluded — IHSG stocks only.

## Architecture

```
StockPortfoliov2/
├── Portfolio Risk Management - Investment Portfolio.csv  # Original source (do not modify)
├── data/
│   ├── raw/
│   │   └── portfolio_transactions.csv  # Copy of source CSV (engine reads this)
│   └── cache/
│       ├── prices/                     # Per-stock historical prices (parquet)
│       ├── ihsg/                       # ^JKSE historical data (parquet)
│       └── dividends/                  # Per-stock dividend history (parquet, tz-naive)
├── engine/                             # Python FastAPI backend (port 8004)
│   ├── main.py                         # FastAPI app + APScheduler (15:35 WIB Mon–Fri)
│   ├── config.py                       # 20 tickers, T0=2025-02-28, paths
│   ├── data_loader.py                  # CSV parser with exclusion filter
│   ├── price_fetcher.py                # Yahoo Finance fetch + parquet cache (auto_adjust=False)
│   ├── portfolio_engine.py             # Holdings timeline, daily valuation, P/L, CAGR, dividends
│   ├── dividend_fetcher.py             # yfinance dividends fetch + parquet cache (tz-naive)
│   ├── benchmark.py                    # IHSG normalization + return% series
│   └── requirements.txt
└── dashboard/                          # React + Vite frontend (port 5190)
    ├── src/
    │   ├── App.tsx                     # Layout: status bar (EXCL/INCL DIV toggle), header, grid
    │   ├── main.tsx                    # QueryClient (refetchInterval: 5 min)
    │   ├── components/
    │   │   ├── SummaryCards.tsx        # 9 or 10 metric cards — dividend-aware (toggle-driven)
    │   │   ├── PerformanceChart.tsx    # Portfolio vs IHSG (1W/1M/3M/1Y/MAX), div-adjusted line
    │   │   ├── HoldingsTable.tsx       # Sortable table + TickerModal (v2 approach map)
    │   │   ├── TransactionLog.tsx      # Full history, filterable
    │   │   ├── ContributionChart.tsx   # Horizontal bar per-stock P&L
    │   │   ├── PortfolioStats.tsx      # Win rate, avg gain/loss, best/worst
    │   │   └── AllocationPanel.tsx     # DV/GV/DIV + Unclassified groups (v2 map)
    │   └── lib/
    │       ├── api.ts                  # Typed axios client
    │       └── types.ts                # TypeScript interfaces
    ├── package.json
    └── vite.config.ts                  # proxy /api → localhost:8004
```

## Data Flow

1. `data_loader.py` reads CSV → filters `Sector=="Stock"` + exclusion list → Transaction objects
2. `price_fetcher.py` fetches Yahoo Finance (`.JK` suffix, `^JKSE` for IHSG, `auto_adjust=False`)
   - Cache-first: reads parquet, fetches only missing date range
3. `dividend_fetcher.py` fetches `yf.Ticker(ticker).dividends` → strips timezone → filters from PORTFOLIO_START
   - Cache: `data/cache/dividends/{TICKER}.JK.parquet` (tz-naive DatetimeIndex)
4. `portfolio_engine.py` builds daily time series (PORTFOLIO_START → today)
   - Weighted avg cost (not FIFO), cumulative realized P/L per-date
   - `compute_dividends()`: per ex-date, checks holdings, returns events + total IDR received
   - `compute_summary()`: includes CAGR (portfolio + IHSG), dividend_total
5. `benchmark.py` normalizes IHSG to T0 and computes return% series
6. FastAPI exposes 6 endpoints; React polls every 5 min
7. Frontend: `includeDividends` state in App.tsx — toggles adjusted vs base P&L/return/CAGR/chart line

## CSV Format (v2 vs v1)

v2 CSV columns: `Purpose, Sector, Instrument, Action, Price, Lots/grams, Total Spend, Action Date, Notes, Approach`

Key parsing differences vs v1:
- **Price**: `"5,375"` (comma as thousands separator) — cleaned with `str.replace(r"[Rp,\s]", "")`
- **Date**: `"13 Jan 2023"` format — parsed with `pd.to_datetime(dayfirst=True)`
- **Filter**: `Sector=="Stock"` + `EXCLUDED_INSTRUMENTS` set in `data_loader.py`

## CSV Sync Workflow

- **Source**: `Portfolio Risk Management - Investment Portfolio.csv` (root, user updates this)
- **Engine reads**: `data/raw/portfolio_transactions.csv`

**Automatic:** `POST /api/refresh-prices` (REFRESH button in dashboard) now auto-copies source → engine before re-fetching prices. No manual step needed.

Manual fallback if needed:
```bash
cp "/home/arsyi/workspace/StockPortfoliov2/Portfolio Risk Management - Investment Portfolio.csv" \
   /home/arsyi/workspace/StockPortfoliov2/data/raw/portfolio_transactions.csv
```

## Excluded Instruments

`ANTAM Gold, Neo Gold, AMZN, Deposits, INTC, KLAS, KO, MAXI, MAXI-W, SPY, VKTR, XIHD, XIIT, XISR`

Rationale: focus on IDX-listed stocks only for accurate IHSG benchmarking.

## Portfolio Stocks (20 active IDX instruments)

### Category Classification (hardcoded in analysis scripts)
| Ticker | Approach | Notes |
|--------|----------|-------|
| BUKA   | Deep Value | Bukalapak |
| DIVA   | Deep Value | Distribusi Voucher |
| INCI   | Deep Value | Intan Wijaya |
| LPKR   | Deep Value | Lippo Karawaci |
| LPLI   | Deep Value | Star Pacific |
| PUDP   | Deep Value | Pudjiadi Prestige |
| SCCO   | Deep Value | Supreme Cable |
| UCID   | Deep Value | Uni-Charm Indonesia |
| KSIX   | Deep Value | |
| DPNS   | Deep Value | |
| ASGR   | Growth Value | Astra Graphia |
| AUTO   | Growth Value | Astra Otoparts |
| BAYU   | Growth Value | Bayu Buana Travel |
| IGAR   | Deep Value | Champion Pacific |
| RIGS   | Deep Value | Rig Tenders |
| TAPG   | Growth Value | |
| LPIN   | Dividend Value | Multi Prima Sejahtera |

### Historical / Fully Sold (legacy)
ASII, INDF, UNTR, CPIN, SMGR, ADRO, LSIP, ACES, RALS, PTBA, SIDO, TLKM, AKRA, CMRY, SMDR, KSIX, DPNS

## API Endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/summary` | total_invested, current_value, unrealized_pnl, realized_pnl, total_return_pct, ihsg_return_pct, alpha, **portfolio_cagr, ihsg_cagr, dividend_total**, data_as_of |
| GET | `/api/performance` | Daily: date, portfolio_value, total_invested, portfolio_return_pct, **portfolio_return_pct_div**, ihsg_return_pct |
| GET | `/api/holdings` | Per-stock: ticker, lots, avg_cost, current_price, market_value, unrealized_pnl, pnl_pct |
| GET | `/api/transactions` | All filtered IDX transactions |
| GET | `/api/dividends` | `{events: [{date, ticker, lots, shares, per_share, total_received}], total}` |
| POST | `/api/refresh-prices` | Clear cache + re-fetch all prices + dividends from Yahoo Finance |

## Return Formula

- **Portfolio return %** = `(unrealized_pnl + realized_pnl) / total_buy × 100`
  - Denominator = **gross BUY spend** (total_buy), NOT net invested — avoids spike when SELL reduces net_invested
  - `unrealized_pnl = market_value - total_invested - realized_pnl`
- **CAGR** = `(1 + return)^(365.25/days) − 1`
- **Dividend-adjusted return %** = `(unrealized_pnl + realized_pnl + dividend_total) / total_buy × 100`

## Dividend Toggle (EXCL DIV / INCL DIV)

Pill toggle in top status bar. State in `App.tsx`, passed as prop to `SummaryCards` and `PerformanceChart`.

**EXCL DIV (default):** 9 summary cards, base return/CAGR/alpha, chart shows base portfolio line.
**INCL DIV:** 10 summary cards (DIVIDENDS card appears), "REALIZED + DIV" label, all metrics adjusted, chart shows div-adjusted line labeled "PORTFOLIO + DIV".

Dividend data: fetched from yfinance at startup + daily auto-refresh. Cached per-ticker in parquet.
Important: yfinance dividend index is tz-aware (Asia/Jakarta) — must `.tz_localize(None)` before saving/comparing.

## Running the Project

```bash
# Backend (port 8004)
cd /home/arsyi/workspace/StockPortfoliov2/engine
nohup /home/arsyi/anaconda3/envs/stock_portfolio/bin/uvicorn main:app --port 8004 > /tmp/portfolio_v2_backend.log 2>&1 &

# Kill backend
kill $(lsof -ti:8004)

# Frontend (port 5190)
cd /home/arsyi/workspace/StockPortfoliov2/dashboard
npm run dev

# Check backend log
tail -f /tmp/portfolio_v2_backend.log
```

## Key Design Decisions

- **Port 8004**: avoids conflict with v1 (8002) and other projects (8000)
- **T0 = 2025-02-28**: first transaction date in active portfolio window
- **Weighted avg cost** (not FIFO): consistent with DCA strategy
- **Realized P/L cumulative per-date**: only counts SELLs up to each day
- **Gross BUY denominator**: `total_buy` (not net_invested) for return% — prevents dilution spike on large SELLs
- **auto_adjust=False** in yfinance: critical for correct historical prices (prevent split/div adjustment)
- **CAGR**: computed in backend (`compute_summary`), frontend also recomputes locally for div-adjusted variant
- **tz-naive dividends**: yfinance returns tz-aware (Asia/Jakarta); must strip with `.tz_localize(None)` before parquet save and comparison
- **PerformanceChart**: both `portfolio_return_pct` and `portfolio_return_pct_div` in API response; frontend switches dataKey based on toggle
- **SummaryCards grid**: 9 cols (EXCL DIV) or 10 cols (INCL DIV), DIVIDENDS card conditionally rendered
- **AllocationPanel**: "Unclassified" group for legacy tickers without approach label
- **Same Bloomberg Terminal UI** as v1: black bg, IBM Plex Mono, orange accent

## Environment

- Python env: `stock_portfolio` conda at `/home/arsyi/anaconda3/envs/stock_portfolio/`
- Node 20, npm 10
- Source CSV must be kept updated at `data/raw/portfolio_transactions.csv`
  (copy from original when CSV changes — see CSV Sync Workflow above)
