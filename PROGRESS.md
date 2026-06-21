# Progress — Stock Portfolio Dashboard v2

## Status: LIVE ✅ (backend :8004, frontend :5190)

---

## Phase 1: Project Setup ✅
- [x] Source CSV analyzed, 20 active IDX stocks identified
- [x] Directory structure created
- [x] CSV synced to `data/raw/portfolio_transactions.csv`

## Phase 2: Backend Engine ✅
- [x] `config.py` — 20 TICKER_MAP, T0=2025-02-28, port 8004, SOURCE_CSV for auto-sync
- [x] `data_loader.py` — CSV parser (Sector=="Stock" filter, exclusion list, Rp price cleaning)
- [x] `portfolio_engine.py` — Holdings timeline, daily valuation, P/L, CAGR, Sharpe, MaxDD
- [x] `price_fetcher.py` — Yahoo Finance + parquet cache (`auto_adjust=False`)
- [x] `dividend_fetcher.py` — yfinance dividends, tz-naive parquet cache
- [x] `benchmark.py` — IHSG normalization to T0
- [x] `main.py` — FastAPI port 8004, APScheduler 15:35 WIB, REFRESH auto-syncs CSV

## Phase 3: Frontend Dashboard ✅
- [x] `vite.config.ts` — port 5190, `host: true` (network accessible), proxy → 8004
- [x] `App.tsx` — EXCL/INCL DIV toggle, layout grid
- [x] `SummaryCards.tsx` — 11 cards (EXCL DIV) / 12 cards (INCL DIV):
  - TOTAL INVESTED, MARKET VALUE, UNREALIZED P&L, REALIZED P&L, TOTAL P&L
  - SHARPE RATIO, MAX DRAWDOWN (dengan IHSG comparison + div-adjusted variant)
  - PORTFOLIO RTN, IHSG RTN, ALPHA, CAGR
  - [INCL DIV] DIVIDENDS card tambahan
- [x] `PerformanceChart.tsx` — Portfolio vs IHSG, 1W/1M/3M/1Y/MAX, div-adjusted line
- [x] `HoldingsTable.tsx` — Sortable, TickerModal, approach map (DV/GV/DIV)
- [x] `AllocationPanel.tsx` — DV/GV/DIV groups + Unclassified, stacked bar
- [x] `ContributionChart.tsx`, `PortfolioStats.tsx`, `TransactionLog.tsx`

## Phase 4: Classification ✅
- [x] RIGS → Deep Value (sebelumnya Growth Value)
- [x] IGAR → Deep Value (sebelumnya Growth Value)
- [x] Updated: AllocationPanel.tsx, HoldingsTable.tsx, CLAUDE.md, source CSV

## Phase 5: Risk Metrics ✅ (2026-06-21)
- [x] Sharpe Ratio — annualized, RF=BI Rate 5.75%, IHSG comparison sub-label
- [x] Max Drawdown — peak-to-trough dari T0, IHSG comparison sub-label
- [x] Div-adjusted variants (`sharpe_ratio_div`, `max_drawdown_pct_div`) — aktif saat INCL DIV toggle
- [x] Cards diposisikan antara TOTAL P&L dan PORTFOLIO RTN
- [x] Tooltip menjelaskan makna metrik sebelum formula

---

## Key Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-12 | T0 = 2025-02-28 | First transaction dalam active portfolio window |
| 2026-06-12 | Port 8004 | Avoids conflict with v1 (8002) dan projects lain |
| 2026-06-12 | Filter Sector=="Stock" | Focus IDX stocks untuk IHSG benchmarking akurat |
| 2026-06-12 | Weighted avg cost (not FIFO) | Konsisten dengan DCA strategy |
| 2026-06-12 | auto_adjust=False yfinance | Harga historis akurat tanpa split/div adjustment |
| 2026-06-12 | Gross BUY denominator | Prevent return spike saat SELL besar |
| 2026-06-15 | REFRESH auto-sync CSV | User tidak perlu manual cp setiap update transaksi |
| 2026-06-21 | Port 5190 + host:true | Port 5180-5182 dipakai proses lain; network accessible |
| 2026-06-21 | Sharpe RF = 5.75% | BI Rate sebagai risk-free benchmark IDR |
| 2026-06-21 | MaxDD dari portfolio value harian | Close price only, tidak intraday |
| 2026-06-21 | Div-adjusted Sharpe/MaxDD | Konsistensi dengan INCL DIV toggle di metrik lain |

---

## Known Issues / Watchlist

- DPNS.JK: sering muncul warning "possibly delisted" dari yfinance — tidak fatal
- Sharpe inflated pada periode bull market pendek (16 bulan) — wajar, bukan bug
- MaxDD hanya close price harian, bukan intraday — actual drawdown bisa lebih dalam
