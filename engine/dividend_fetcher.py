import pandas as pd
import yfinance as yf
from datetime import date
from pathlib import Path
from config import DATA_CACHE_DIVIDENDS, TICKER_MAP, PORTFOLIO_START


def _parquet_path(ticker: str) -> Path:
    return DATA_CACHE_DIVIDENDS / f"{TICKER_MAP[ticker]}.parquet"


def fetch_dividends(ticker: str, force: bool = False) -> pd.DataFrame:
    """
    Returns DataFrame with columns [ex_date (DatetimeIndex), per_share (float)].
    Caches to parquet. ex_date is the ex-dividend date from yfinance.
    """
    path = _parquet_path(ticker)
    DATA_CACHE_DIVIDENDS.mkdir(parents=True, exist_ok=True)

    if path.exists() and not force:
        df = pd.read_parquet(path)
        df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
        return df

    yf_ticker = TICKER_MAP[ticker]
    t = yf.Ticker(yf_ticker)
    divs = t.dividends  # Series: DatetimeIndex -> per_share amount

    if divs.empty:
        df = pd.DataFrame(columns=["per_share"])
        df.index.name = "ex_date"
    else:
        df = divs.to_frame(name="per_share")
        df.index.name = "ex_date"
        # Strip timezone so we can compare to naive PORTFOLIO_START timestamp
        df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
        # Only keep dividends from portfolio start onwards
        df = df[df.index >= pd.Timestamp(PORTFOLIO_START)]
        df = df[df["per_share"] > 0]

    df.to_parquet(path)
    return df


def fetch_all_dividends(force: bool = False) -> dict[str, pd.DataFrame]:
    """Returns {ticker: dividends_df} for all portfolio tickers."""
    result = {}
    for ticker in TICKER_MAP:
        try:
            result[ticker] = fetch_dividends(ticker, force=force)
        except Exception as e:
            print(f"[dividends] {ticker}: {e}")
            result[ticker] = pd.DataFrame(columns=["per_share"])
    return result
