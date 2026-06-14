# Progress — Stock Portfolio Dashboard v2

## Status: READY TO RUN (npm install needed)

---

## Phase 1: Project Setup ✅

- [x] Analyzed source CSV (`Portfolio Risk Management - Investment Portfolio.csv`)
- [x] Identified 32 IDX stocks, excluded foreign/gold/bonds/ETF/e-IPO
- [x] Created directory structure (`engine/`, `dashboard/`, `data/raw/`, `data/cache/`)
- [x] Copied CSV to `data/raw/portfolio_transactions.csv`

---

## Phase 2: Backend Engine ✅

- [x] `config.py` — 32 TICKER_MAP entries, T0=2023-01-13, port 8003 reference
- [x] `data_loader.py` — CSV parser with:
  - Filter: `Sector=="Stock"` only
  - Filter: `EXCLUDED_INSTRUMENTS` set (14 excluded)
  - Price cleaning: removes `Rp`, commas (e.g. `"5,375"` → `5375`)
  - Date parsing: `"13 Jan 2023"` format via `pd.to_datetime(dayfirst=True)`
- [x] `portfolio_engine.py` — Holdings timeline, daily valuation, cumulative P/L
- [x] `price_fetcher.py` — Yahoo Finance + parquet cache (incremental fetch)
- [x] `benchmark.py` — IHSG normalization to T0
- [x] `main.py` — FastAPI app on port 8003, APScheduler 15:35 WIB
- [x] `requirements.txt`

---

## Phase 3: Frontend Dashboard ✅

- [x] Config: `package.json`, `vite.config.ts` (proxy → 8003), `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- [x] Core: `main.tsx`, `index.css` (added `--surface` var), `App.tsx` (updated header: T0=13 JAN 2023, 32 instruments)
- [x] Lib: `api.ts`, `types.ts`
- [x] Components:
  - [x] `SummaryCards.tsx` — 8 metrics with Indonesian tooltips
  - [x] `PerformanceChart.tsx` — Added 1Y range button (vs v1 which had 1W/1M/3M/MAX)
  - [x] `HoldingsTable.tsx` — Updated `APPROACH_MAP` for 32 v2 tickers
  - [x] `AllocationPanel.tsx` — Updated `TICKER_APPROACH`, added "Unclassified" group for legacy tickers
  - [x] `ContributionChart.tsx` — Identical to v1
  - [x] `PortfolioStats.tsx` — Identical to v1
  - [x] `TransactionLog.tsx` — Identical to v1

---

## Phase 4: Dependencies ⏳

- [ ] `npm install` in `dashboard/` (run once)

---

## TODO / Next Steps

- [ ] Run `npm install` and start both backend + frontend
- [ ] Verify CSV parsing: check `data_loader.py` loads correctly with no errors
- [ ] First REFRESH: click button to fetch prices for all 32 tickers from Yahoo Finance
  - Note: initial fetch may take 2–3 min (32 tickers × 3 years of history)
- [ ] Validate performance chart looks correct from Jan 2023
- [ ] Update `data/raw/portfolio_transactions.csv` when source CSV changes
- [ ] Consider renaming "PERSONAL PORTFOLIO" in `App.tsx` header to actual name

---

## Key Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-12 | T0 = 2023-01-13 | First IDX stock transaction (ASII BUY) |
| 2026-06-12 | Port 8003 | Avoids conflict with v1 (8002) and other projects |
| 2026-06-12 | Filter Sector=="Stock" | Cleaner than instrument-name-only filter |
| 2026-06-12 | EXCLUDED_INSTRUMENTS set | Foreign stocks, gold, bonds excluded from IHSG comparison |
| 2026-06-12 | Added 1Y range in PerformanceChart | 3+ years of data benefits from 1Y view |
| 2026-06-12 | AllocationPanel Unclassified group | Legacy tickers (pre-approach era) still may appear in holdings |
| 2026-06-12 | Weighted avg cost (not FIFO) | Consistent with DCA strategy, matches broker reporting |

---

## Known Issues / Watchlist

- Initial price fetch is slow (32 tickers × ~3 years = ~96 ticker-year fetches)
- Some tickers (KSIX, TAPG, DPNS) started trading 2025 — Yahoo Finance may have limited history
- LSIP: partially sold multiple times (May–Jun 2025), fully sold by Jun 2025
- DPNS: bought Aug 2025, fully sold Aug 2025 (same month)
- Performance chart may show flat line Jan–Dec 2023 if prices unavailable for some tickers
