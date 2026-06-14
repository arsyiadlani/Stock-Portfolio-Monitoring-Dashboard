import time
import pandas as pd
import yfinance as yf
from datetime import date, timedelta
from pathlib import Path
from config import DATA_CACHE_PRICES, IHSG_PARQUET, TICKER_MAP, IHSG_TICKER, PORTFOLIO_START


def _parquet_path(ticker: str) -> Path:
    return DATA_CACHE_PRICES / f"{ticker}.parquet"


def _load_cached(path: Path) -> pd.DataFrame | None:
    if path.exists():
        return pd.read_parquet(path)
    return None


def _save_cache(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=True)


def _fetch_yf(yf_ticker: str, start: date, end: date) -> pd.DataFrame:
    raw = yf.download(
        yf_ticker,
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        progress=False,
        auto_adjust=False,
    )
    if raw.empty:
        return pd.DataFrame()

    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    df = raw[["Close"]].copy()
    df.index = pd.to_datetime(df.index).normalize()
    df.index.name = "date"
    df = df.rename(columns={"Close": "close"})
    df["close"] = df["close"].astype(float)
    return df


def fetch_stock(ticker: str, end: date | None = None) -> pd.DataFrame:
    """
    Returns daily close prices for an IDX ticker.
    Loads from cache; fetches only missing date range from Yahoo Finance.
    """
    end = end or date.today()
    yf_ticker = TICKER_MAP[ticker]
    path = _parquet_path(ticker)
    cached = _load_cached(path)

    if cached is not None:
        cached_end = cached.index.max().date()
        if cached_end >= end:
            return cached
        fetch_start = cached_end + timedelta(days=1)
        new_data = _fetch_yf(yf_ticker, fetch_start, end)
        if not new_data.empty:
            combined = pd.concat([cached, new_data])
            combined = combined[~combined.index.duplicated(keep="last")].sort_index()
            _save_cache(combined, path)
            return combined
        return cached
    else:
        df = _fetch_yf(yf_ticker, PORTFOLIO_START, end)
        if not df.empty:
            _save_cache(df, path)
        return df


def fetch_ihsg(end: date | None = None) -> pd.DataFrame:
    end = end or date.today()
    cached = _load_cached(IHSG_PARQUET)

    if cached is not None:
        cached_end = cached.index.max().date()
        if cached_end >= end:
            return cached
        fetch_start = cached_end + timedelta(days=1)
        new_data = _fetch_yf(IHSG_TICKER, fetch_start, end)
        if not new_data.empty:
            combined = pd.concat([cached, new_data])
            combined = combined[~combined.index.duplicated(keep="last")].sort_index()
            _save_cache(combined, IHSG_PARQUET)
            return combined
        return cached
    else:
        df = _fetch_yf(IHSG_TICKER, PORTFOLIO_START, end)
        if not df.empty:
            _save_cache(df, IHSG_PARQUET)
        return df


def fetch_all(end: date | None = None, delay_seconds: float = 0.5) -> dict[str, pd.DataFrame]:
    """Fetch + cache all portfolio stocks. Returns dict keyed by IDX ticker."""
    prices: dict[str, pd.DataFrame] = {}
    for ticker in TICKER_MAP:
        print(f"Fetching {ticker}...")
        prices[ticker] = fetch_stock(ticker, end)
        time.sleep(delay_seconds)
    print("Fetching IHSG...")
    prices["IHSG"] = fetch_ihsg(end)
    return prices


def get_price_on(ticker: str, target_date: date, prices: dict[str, pd.DataFrame]) -> float | None:
    """Get closing price for ticker on or before target_date (forward-fills weekends/holidays)."""
    df = prices.get(ticker)
    if df is None or df.empty:
        return None
    ts = pd.Timestamp(target_date)
    subset = df[df.index <= ts]
    if subset.empty:
        return None
    return float(subset["close"].iloc[-1])
