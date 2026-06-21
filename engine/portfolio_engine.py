import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional
import pandas as pd
from data_loader import Transaction, load_transactions
from price_fetcher import get_price_on
from config import SHARES_PER_LOT, PORTFOLIO_START


@dataclass
class HoldingSnapshot:
    ticker: str
    lots: int
    avg_cost: float  # per share (IDR)


@dataclass
class DailyPortfolioValue:
    date: date
    market_value: float       # current market value of all holdings
    total_invested: float     # net cash deployed (BUY spend - SELL proceeds)
    total_buy: float          # gross cumulative BUY spend (denominator for return%)
    realized_pnl: float       # cumulative realized P/L from SELLs
    holdings: dict[str, HoldingSnapshot] = field(default_factory=dict)


def build_holdings_timeline(
    transactions: list[Transaction],
) -> dict[date, dict[str, HoldingSnapshot]]:
    """
    Returns {date: {ticker: HoldingSnapshot}} for every transaction date.
    Holdings accumulate — each entry is the state AFTER that day's transactions.
    """
    lots: dict[str, int] = {}
    avg_costs: dict[str, float] = {}  # per share
    timeline: dict[date, dict[str, HoldingSnapshot]] = {}

    for txn in transactions:
        ticker = txn.ticker

        if txn.action == "BUY":
            prev_lots = lots.get(ticker, 0)
            prev_avg = avg_costs.get(ticker, 0.0)
            new_lots = prev_lots + txn.lots
            new_avg = (
                (prev_lots * SHARES_PER_LOT * prev_avg + txn.total_spend)
                / (new_lots * SHARES_PER_LOT)
            )
            lots[ticker] = new_lots
            avg_costs[ticker] = new_avg

        elif txn.action == "SELL":
            prev_lots = lots.get(ticker, 0)
            remaining = prev_lots - txn.lots
            if remaining < 0:
                raise ValueError(f"SELL {txn.lots} lots of {ticker} on {txn.date} exceeds holdings {prev_lots}")
            lots[ticker] = remaining

        snapshot = {
            t: HoldingSnapshot(ticker=t, lots=l, avg_cost=avg_costs.get(t, 0.0))
            for t, l in lots.items()
            if l > 0
        }
        timeline[txn.date] = snapshot

    return timeline


def get_holdings_on(
    target_date: date,
    timeline: dict[date, dict[str, HoldingSnapshot]],
) -> dict[str, HoldingSnapshot]:
    """Get holdings state as of target_date (uses last transaction date <= target_date)."""
    past_dates = [d for d in timeline if d <= target_date]
    if not past_dates:
        return {}
    return timeline[max(past_dates)]


def build_daily_value_series(
    prices: dict[str, pd.DataFrame],
    end: Optional[date] = None,
) -> list[DailyPortfolioValue]:
    end = end or date.today()
    transactions = load_transactions()
    timeline = build_holdings_timeline(transactions)

    invested_by_date: dict[date, float] = {}
    buy_by_date: dict[date, float] = {}
    cumulative_invested = 0.0
    cumulative_buy = 0.0
    for txn in transactions:
        if txn.action == "BUY":
            cumulative_invested += txn.total_spend
            cumulative_buy += txn.total_spend
        elif txn.action == "SELL":
            cumulative_invested -= txn.total_spend
        invested_by_date[txn.date] = cumulative_invested
        buy_by_date[txn.date] = cumulative_buy

    # Cumulative realized P&L per date — only count SELLs up to each day
    realized_by_date: dict[date, float] = {}
    cumulative_realized = 0.0
    for txn in transactions:
        if txn.action == "SELL":
            past = [d for d in timeline if d < txn.date]
            if past:
                prev_snapshot = timeline[max(past)]
                avg_cost = prev_snapshot.get(txn.ticker, HoldingSnapshot(txn.ticker, 0, 0.0)).avg_cost
                # Use total_spend (net proceeds) for consistency with net_invested denominator
                cost_basis_sold = avg_cost * txn.lots * SHARES_PER_LOT
                cumulative_realized += txn.total_spend - cost_basis_sold
        realized_by_date[txn.date] = cumulative_realized

    results: list[DailyPortfolioValue] = []
    current = PORTFOLIO_START
    last_invested = 0.0
    last_buy = 0.0
    last_realized = 0.0

    while current <= end:
        holdings = get_holdings_on(current, timeline)

        invested_by = invested_by_date.get(current)
        if invested_by is not None:
            last_invested = invested_by

        buy_by = buy_by_date.get(current)
        if buy_by is not None:
            last_buy = buy_by

        realized_by = realized_by_date.get(current)
        if realized_by is not None:
            last_realized = realized_by

        market_value = 0.0
        for ticker, holding in holdings.items():
            price = get_price_on(ticker, current, prices)
            if price is not None:
                market_value += holding.lots * SHARES_PER_LOT * price

        results.append(DailyPortfolioValue(
            date=current,
            market_value=market_value,
            total_invested=last_invested,
            total_buy=last_buy,
            realized_pnl=last_realized,
            holdings=holdings,
        ))
        current += timedelta(days=1)

    return results


def compute_dividends(
    dividend_data: dict[str, pd.DataFrame],
    timeline: dict[date, dict[str, HoldingSnapshot]],
) -> tuple[list[dict], float]:
    """
    For each dividend event (ex_date, ticker), look up shares held on that date,
    compute IDR received. Returns (events_list, total_idr).
    """
    events: list[dict] = []
    total = 0.0

    for ticker, df in dividend_data.items():
        if df.empty:
            continue
        for ex_ts, row in df.iterrows():
            ex_date = ex_ts.date() if hasattr(ex_ts, "date") else ex_ts
            per_share = float(row["per_share"])
            holdings_on_day = get_holdings_on(ex_date, timeline)
            holding = holdings_on_day.get(ticker)
            if holding is None or holding.lots == 0:
                continue
            shares = holding.lots * SHARES_PER_LOT
            received = shares * per_share
            total += received
            events.append({
                "date": ex_date.isoformat(),
                "ticker": ticker,
                "lots": holding.lots,
                "shares": shares,
                "per_share": round(per_share, 4),
                "total_received": round(received),
            })

    events.sort(key=lambda x: x["date"])
    return events, round(total)


def compute_summary(
    daily_series: list[DailyPortfolioValue],
    ihsg_df: pd.DataFrame,
) -> dict:
    if not daily_series:
        return {}

    latest = daily_series[-1]
    first = daily_series[0]

    total_buy = latest.total_buy
    current_value = latest.market_value  # market value of current holdings
    # cost_basis of current holdings = total_buy - cost_basis_sold
    # cost_basis_sold = total_sell_proceeds - realized_pnl = (total_buy - total_invested) - realized_pnl
    # → cost_basis_current = total_invested + realized_pnl
    unrealized_pnl = latest.market_value - latest.total_invested - latest.realized_pnl
    # total P&L = unrealized + realized; return vs all capital ever deployed
    total_pnl = unrealized_pnl + latest.realized_pnl
    total_return_pct = (total_pnl / total_buy * 100) if total_buy else 0

    ihsg_start = ihsg_df[ihsg_df.index <= pd.Timestamp(first.date)]
    ihsg_end = ihsg_df[ihsg_df.index <= pd.Timestamp(latest.date)]
    ihsg_return_pct = 0.0
    if not ihsg_start.empty and not ihsg_end.empty:
        v0 = float(ihsg_start["close"].iloc[-1])
        v1 = float(ihsg_end["close"].iloc[-1])
        ihsg_return_pct = (v1 - v0) / v0 * 100 if v0 else 0.0

    days_elapsed = (latest.date - first.date).days
    years = days_elapsed / 365.25
    portfolio_cagr = (((1 + total_return_pct / 100) ** (1 / years)) - 1) * 100 if years > 0 and total_buy > 0 else 0.0
    ihsg_cagr = (((1 + ihsg_return_pct / 100) ** (1 / years)) - 1) * 100 if years > 0 else 0.0

    # Daily portfolio values (market_value + cash from sells)
    port_values = [e.market_value + (e.total_buy - e.total_invested) for e in daily_series if e.total_buy > 0]

    # Sharpe Ratio (annualized, BI Rate 5.75% as risk-free)
    sharpe_ratio = 0.0
    if len(port_values) >= 2:
        daily_rets = [(port_values[i] - port_values[i-1]) / port_values[i-1]
                      for i in range(1, len(port_values)) if port_values[i-1] > 0]
        rf_daily = 0.0575 / 252
        excess = [r - rf_daily for r in daily_rets]
        if len(excess) > 1:
            mean_ex = sum(excess) / len(excess)
            variance = sum((r - mean_ex) ** 2 for r in excess) / (len(excess) - 1)
            std_ex = math.sqrt(variance)
            sharpe_ratio = round(mean_ex / std_ex * math.sqrt(252), 2) if std_ex > 0 else 0.0

    # Maximum Drawdown (peak-to-trough from T0)
    max_drawdown_pct = 0.0
    if port_values:
        running_max = port_values[0]
        for v in port_values:
            if v > running_max:
                running_max = v
            dd = (v - running_max) / running_max if running_max > 0 else 0.0
            if dd < max_drawdown_pct:
                max_drawdown_pct = dd
        max_drawdown_pct = round(max_drawdown_pct * 100, 2)

    # IHSG Sharpe + Max Drawdown (same period as portfolio)
    ihsg_sharpe = 0.0
    ihsg_max_drawdown_pct = 0.0
    ihsg_period = ihsg_df[
        (ihsg_df.index >= pd.Timestamp(first.date)) &
        (ihsg_df.index <= pd.Timestamp(latest.date))
    ]
    if not ihsg_period.empty:
        ihsg_vals = ihsg_period["close"].tolist()
        if len(ihsg_vals) >= 2:
            ihsg_rets = [(ihsg_vals[i] - ihsg_vals[i-1]) / ihsg_vals[i-1]
                         for i in range(1, len(ihsg_vals)) if ihsg_vals[i-1] > 0]
            rf_daily = 0.0575 / 252
            ihsg_excess = [r - rf_daily for r in ihsg_rets]
            if len(ihsg_excess) > 1:
                mean_ex = sum(ihsg_excess) / len(ihsg_excess)
                variance = sum((r - mean_ex) ** 2 for r in ihsg_excess) / (len(ihsg_excess) - 1)
                std_ex = math.sqrt(variance)
                ihsg_sharpe = round(mean_ex / std_ex * math.sqrt(252), 2) if std_ex > 0 else 0.0
            running_max = ihsg_vals[0]
            for v in ihsg_vals:
                if v > running_max:
                    running_max = v
                dd = (v - running_max) / running_max if running_max > 0 else 0.0
                if dd < ihsg_max_drawdown_pct:
                    ihsg_max_drawdown_pct = dd
            ihsg_max_drawdown_pct = round(ihsg_max_drawdown_pct * 100, 2)

    return {
        "total_invested": latest.total_invested,
        "total_buy": total_buy,
        "current_value": current_value,
        "unrealized_pnl": unrealized_pnl,
        "realized_pnl": latest.realized_pnl,
        "total_return_pct": round(total_return_pct, 2),
        "ihsg_return_pct": round(ihsg_return_pct, 2),
        "alpha": round(total_return_pct - ihsg_return_pct, 2),
        "portfolio_cagr": round(portfolio_cagr, 2),
        "ihsg_cagr": round(ihsg_cagr, 2),
        "sharpe_ratio": sharpe_ratio,
        "max_drawdown_pct": max_drawdown_pct,
        "ihsg_sharpe": ihsg_sharpe,
        "ihsg_max_drawdown_pct": ihsg_max_drawdown_pct,
    }
