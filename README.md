# Stock Portfolio Monitoring Dashboard

Personal IDX equity portfolio tracker benchmarked against IHSG. Bloomberg Terminal-inspired UI built with FastAPI + React.

![Dashboard](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-orange) ![Exchange](https://img.shields.io/badge/exchange-IDX-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **20-ticker IDX portfolio** — weighted average cost basis, cumulative realized P&L per date
- **IHSG benchmark** — portfolio return vs ^JKSE from T0 (28 Feb 2025)
- **Dividend tracking** — ex-date events, IDR received per ticker based on shares held
- **EXCL / INCL DIV toggle** — switch between base and dividend-adjusted P&L, return%, CAGR, and chart line
- **CAGR metric** — annualized return with dynamic tooltip (period, formula, days/years)
- **Performance chart** — portfolio vs IHSG return% from T0, with 1W/1M/3M/1Y/MAX range selector
- **Holdings table** — per-stock lots, avg cost, current price, unrealized P&L
- **Contribution chart** — horizontal bar chart of per-stock P&L contribution
- **Allocation panel** — DV / GV / DIV strategy breakdown
- **Transaction log** — full history, filterable
- **Auto-refresh** — prices updated daily at 15:35 WIB (Mon–Fri) via APScheduler

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python, FastAPI, yfinance, pandas, APScheduler |
| Frontend | React, Vite, TypeScript, Recharts, TanStack Query |
| Data | Yahoo Finance (`.JK` suffix, `^JKSE` IHSG) |
| Cache | Parquet files (prices, IHSG, dividends) |

---

## Project Structure

```
StockPortfoliov2/
├── engine/                  # FastAPI backend (port 8004)
│   ├── main.py              # 6 API endpoints + scheduler
│   ├── config.py            # Tickers, T0, paths
│   ├── portfolio_engine.py  # Holdings timeline, P&L, CAGR, dividends
│   ├── dividend_fetcher.py  # yfinance dividends + parquet cache
│   ├── price_fetcher.py     # Yahoo Finance prices + parquet cache
│   ├── data_loader.py       # CSV parser
│   ├── benchmark.py         # IHSG normalization
│   └── requirements.txt
├── dashboard/               # React + Vite frontend (port 5180)
│   └── src/
│       ├── App.tsx          # Layout, dividend toggle state
│       ├── components/
│       │   ├── SummaryCards.tsx      # 9–10 metric cards
│       │   ├── PerformanceChart.tsx  # Portfolio vs IHSG chart
│       │   ├── HoldingsTable.tsx
│       │   ├── ContributionChart.tsx
│       │   ├── AllocationPanel.tsx
│       │   ├── PortfolioStats.tsx
│       │   └── TransactionLog.tsx
│       └── lib/
│           ├── api.ts       # Typed axios client
│           └── types.ts     # TypeScript interfaces
└── data/
    ├── raw/                 # portfolio_transactions.csv (engine input)
    └── cache/               # prices/, ihsg/, dividends/ (auto-generated)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/summary` | Portfolio summary: P&L, return%, CAGR, dividend total |
| GET | `/api/performance` | Daily return% series (base + dividend-adjusted) |
| GET | `/api/holdings` | Per-stock snapshot |
| GET | `/api/transactions` | Full transaction history |
| GET | `/api/dividends` | Dividend events with IDR received per ex-date |
| POST | `/api/refresh-prices` | Force re-fetch all prices + dividends |

---

## Running Locally

### Prerequisites

- Python 3.11+ with conda (`stock_portfolio` env)
- Node 20 + npm

### Backend

```bash
cd engine
pip install -r requirements.txt

uvicorn main:app --port 8004 --reload
```

### Frontend

```bash
cd dashboard
npm install
npm run dev
# → http://localhost:5180
```

### Update transactions

When the source CSV changes:

```bash
cp "Portfolio Risk Management - Investment Portfolio.csv" data/raw/portfolio_transactions.csv
```

Then hit **REFRESH** in the dashboard or `POST /api/refresh-prices`.

---

## Portfolio Strategy

Stocks classified into three approaches:

| Approach | Description |
|----------|-------------|
| **Deep Value (DV)** | Cheap relative to book/earnings, often unloved by market |
| **Growth Value (GV)** | Quality business at reasonable price, re-rating potential |
| **Dividend Value (DIV)** | Consistent dividend payer, low leverage |

---

## Key Design Decisions

- **Return denominator = gross BUY spend** (`total_buy`), not net invested — prevents return spike on large SELLs
- **Weighted average cost** (not FIFO) — consistent with DCA strategy
- **`auto_adjust=False`** in yfinance — prevents split/dividend price adjustment
- **tz-naive dividends** — yfinance returns Asia/Jakarta tz-aware index; stripped with `.tz_localize(None)` before save/compare
- **T0 = 2025-02-28** — first transaction date in active portfolio window

---

## License

MIT
