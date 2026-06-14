import pandas as pd
from datetime import date
from price_fetcher import fetch_ihsg


def get_ihsg_normalized(start: date, end: date | None = None) -> list[dict]:
    """
    Returns IHSG daily values normalized to 100 at start date.
    Used for comparing portfolio return % vs IHSG return % on same chart.
    """
    end = end or date.today()
    df = fetch_ihsg(end)
    if df.empty:
        return []

    df = df[df.index >= pd.Timestamp(start)]
    df = df[df.index <= pd.Timestamp(end)]

    if df.empty:
        return []

    base = float(df["close"].iloc[0])
    if base == 0:
        return []

    result = []
    for ts, row in df.iterrows():
        result.append({
            "date": ts.date().isoformat(),
            "ihsg_normalized": round(float(row["close"]) / base * 100, 4),
            "ihsg_return_pct": round((float(row["close"]) - base) / base * 100, 2),
        })
    return result
