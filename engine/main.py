from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import date
import pandas as pd
from apscheduler.schedulers.background import BackgroundScheduler

from config import PORTFOLIO_START, TICKER_MAP, SHARES_PER_LOT
from data_loader import load_transactions
from price_fetcher import fetch_all, fetch_ihsg, get_price_on
from portfolio_engine import (
    build_holdings_timeline,
    build_daily_value_series,
    compute_summary,
    compute_dividends,
)
from dividend_fetcher import fetch_all_dividends
from benchmark import get_ihsg_normalized

app = FastAPI(title="Portfolio Engine v2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_prices: dict[str, pd.DataFrame] = {}
_ihsg: pd.DataFrame = pd.DataFrame()
_dividends: dict[str, pd.DataFrame] = {}

scheduler = BackgroundScheduler(timezone="Asia/Jakarta")


def _auto_refresh():
    global _prices, _ihsg, _dividends
    print("[scheduler] Auto-refreshing prices (market close)...")
    _prices = fetch_all()
    _ihsg = fetch_ihsg()
    _dividends = fetch_all_dividends(force=True)
    print("[scheduler] Price + dividend refresh complete.")


@app.on_event("startup")
def startup():
    global _prices, _ihsg, _dividends
    _prices = fetch_all()
    _ihsg = fetch_ihsg()
    _dividends = fetch_all_dividends()
    # Auto-refresh daily at 15:35 WIB (Mon–Fri), after IDX market close (15:30)
    scheduler.add_job(
        _auto_refresh,
        "cron",
        day_of_week="mon-fri",
        hour=15,
        minute=35,
        id="daily_price_refresh",
        replace_existing=True,
    )
    scheduler.start()


@app.on_event("shutdown")
def shutdown():
    scheduler.shutdown()


@app.get("/api/summary")
def summary():
    transactions = load_transactions()
    timeline = build_holdings_timeline(transactions)
    daily = build_daily_value_series(_prices)
    result = compute_summary(daily, _ihsg)
    last_priced = next((e.date.isoformat() for e in reversed(daily) if e.market_value > 0), None)
    result["data_as_of"] = last_priced
    _, dividend_total = compute_dividends(_dividends, timeline)
    result["dividend_total"] = dividend_total
    return result


@app.get("/api/dividends")
def dividends():
    transactions = load_transactions()
    timeline = build_holdings_timeline(transactions)
    events, total = compute_dividends(_dividends, timeline)
    return {"events": events, "total": total}


@app.get("/api/performance")
def performance():
    """Daily portfolio value + IHSG normalized, merged on date."""
    transactions = load_transactions()
    timeline = build_holdings_timeline(transactions)
    daily = build_daily_value_series(_prices)

    ihsg_map: dict[str, dict] = {
        item["date"]: item for item in get_ihsg_normalized(PORTFOLIO_START)
    }

    # Build cumulative dividends by date: {date_iso: cumulative_idr}
    div_events, _ = compute_dividends(_dividends, timeline)
    cumulative_div: dict[str, float] = {}
    running = 0.0
    for ev in div_events:  # already sorted by date
        running += ev["total_received"]
        cumulative_div[ev["date"]] = running

    result = []
    last_div = 0.0

    for entry in daily:
        d = entry.date.isoformat()
        total_sell_proceeds = entry.total_buy - entry.total_invested
        total_value = entry.market_value + total_sell_proceeds

        # Use total_buy (gross) as denominator
        base_pnl = entry.market_value - entry.total_invested
        portfolio_return_pct = (
            round(base_pnl / entry.total_buy * 100, 2)
            if entry.total_buy > 0 else 0.0
        )

        if d in cumulative_div:
            last_div = cumulative_div[d]
        portfolio_return_pct_div = (
            round((base_pnl + last_div) / entry.total_buy * 100, 2)
            if entry.total_buy > 0 else 0.0
        )

        ihsg_entry = ihsg_map.get(d, {})
        result.append({
            "date": d,
            "portfolio_value": round(total_value),
            "total_invested": round(entry.total_invested),
            "portfolio_return_pct": portfolio_return_pct,
            "portfolio_return_pct_div": portfolio_return_pct_div,
            "ihsg_return_pct": ihsg_entry.get("ihsg_return_pct", None),
        })

    return result


@app.get("/api/holdings")
def holdings():
    transactions = load_transactions()
    timeline = build_holdings_timeline(transactions)
    today = date.today()

    past_dates = [d for d in timeline if d <= today]
    if not past_dates:
        return []

    current_holdings = timeline[max(past_dates)]
    result = []

    for ticker, holding in current_holdings.items():
        current_price = get_price_on(ticker, today, _prices)
        if current_price is None:
            current_price = 0.0

        market_value = holding.lots * SHARES_PER_LOT * current_price
        cost_basis = holding.lots * SHARES_PER_LOT * holding.avg_cost
        unrealized_pnl = market_value - cost_basis
        pnl_pct = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0.0

        result.append({
            "ticker": ticker,
            "lots": holding.lots,
            "avg_cost": round(holding.avg_cost, 2),
            "current_price": round(current_price, 2),
            "market_value": round(market_value),
            "unrealized_pnl": round(unrealized_pnl),
            "pnl_pct": round(pnl_pct, 2),
        })

    result.sort(key=lambda x: x["market_value"], reverse=True)
    return result


@app.get("/api/transactions")
def transactions():
    txns = load_transactions()
    return [
        {
            "date": t.date.isoformat(),
            "ticker": t.ticker,
            "action": t.action,
            "price": t.price,
            "lots": t.lots,
            "total_spend": t.total_spend,
        }
        for t in txns
    ]


@app.post("/api/refresh-prices")
def refresh_prices():
    global _prices, _ihsg
    from config import DATA_CACHE_PRICES, IHSG_PARQUET, SOURCE_CSV, TRANSACTIONS_CSV
    import shutil
    if SOURCE_CSV.exists():
        shutil.copy2(SOURCE_CSV, TRANSACTIONS_CSV)
    shutil.rmtree(DATA_CACHE_PRICES, ignore_errors=True)
    DATA_CACHE_PRICES.mkdir(parents=True, exist_ok=True)
    if IHSG_PARQUET.exists():
        IHSG_PARQUET.unlink()
    _prices = fetch_all()
    _ihsg = fetch_ihsg()
    return {"status": "ok", "tickers_refreshed": list(TICKER_MAP.keys()) + ["IHSG"]}
