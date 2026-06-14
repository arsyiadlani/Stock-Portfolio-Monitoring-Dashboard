import pandas as pd
from dataclasses import dataclass
from datetime import date
from typing import Literal
from config import TRANSACTIONS_CSV, TICKER_MAP

# Instruments to skip — foreign stocks, gold, bonds, excluded ETFs, e-IPO
EXCLUDED_INSTRUMENTS = {
    "ANTAM Gold", "Neo Gold", "NEO Gold", "AMZN", "Deposits", "INTC",
    "KLAS", "KO", "MAXI", "MAXI-W", "SPY", "VKTR", "XIHD", "XIIT", "XISR",
}


@dataclass
class Transaction:
    date: date
    ticker: str
    action: Literal["BUY", "SELL"]
    price: float
    lots: int
    total_spend: float


def load_transactions() -> list[Transaction]:
    df = pd.read_csv(TRANSACTIONS_CSV)
    df.columns = [c.strip() for c in df.columns]

    # Keep IDX stocks only — exclude foreign, commodities, bonds, ETFs
    df = df[df["Sector"].str.strip() == "Stock"]
    df = df[~df["Instrument"].str.strip().isin(EXCLUDED_INSTRUMENTS)]

    # Date filter: 2025+ only
    df["action_date"] = pd.to_datetime(df["Action Date"], dayfirst=True)
    df = df[df["action_date"] >= pd.Timestamp("2025-01-01")].copy()

    # Drop tickers with no BUY in 2025+ (can't compute cost basis; pre-2025 positions)
    tickers_with_buy = set(df.loc[df["Action"].str.strip() == "BUY", "Instrument"].str.strip())
    df = df[df["Instrument"].str.strip().isin(tickers_with_buy)].copy()

    # Rename and parse types
    df = df.rename(columns={
        "Instrument": "ticker",
        "Action": "action",
        "Price": "price",
        "Lots/grams": "lots",
        "Total Spend": "total_spend",
    })

    df["ticker"] = df["ticker"].str.strip()
    df["action"] = df["action"].str.strip()

    df["total_spend"] = (
        df["total_spend"]
        .astype(str)
        .str.replace(r"[Rp,\s]", "", regex=True)
        .astype(float)
    )

    df["price"] = (
        df["price"]
        .astype(str)
        .str.replace(r"[Rp,\s]", "", regex=True)
        .astype(float)
    )

    df["lots"] = pd.to_numeric(df["lots"], errors="coerce").astype(int)
    df = df.sort_values("action_date").reset_index(drop=True)

    # Cap SELL lots to 2025+ holdings only.
    # Stocks like ASII/ADRO have pre-2025 positions that are partially sold —
    # only count the portion attributable to 2025+ BUYs.
    holdings_sim: dict[str, int] = {}
    rows_out = []
    for _, row in df.iterrows():
        ticker = row["ticker"]
        action = row["action"]
        lots_val = int(row["lots"])
        r = row.copy()
        if action == "BUY":
            holdings_sim[ticker] = holdings_sim.get(ticker, 0) + lots_val
            rows_out.append(r)
        elif action == "SELL":
            available = holdings_sim.get(ticker, 0)
            if available <= 0:
                continue  # no 2025+ lots — skip entirely
            actual = min(lots_val, available)
            holdings_sim[ticker] = available - actual
            if actual < lots_val:
                # Trim to 2025+ portion; adjust total_spend proportionally
                r["lots"] = actual
                r["total_spend"] = row["total_spend"] * (actual / lots_val)
            rows_out.append(r)
    df = pd.DataFrame(rows_out, columns=df.columns).reset_index(drop=True)

    unknown = set(df["ticker"]) - set(TICKER_MAP.keys())
    for t in unknown:
        TICKER_MAP[t] = f"{t}.JK"
        print(f"[data_loader] New ticker auto-registered: {t} -> {t}.JK")

    transactions = [
        Transaction(
            date=row.action_date.date(),
            ticker=row.ticker,
            action=row.action,
            price=row.price,
            lots=int(row.lots),
            total_spend=row.total_spend,
        )
        for row in df.itertuples()
    ]

    transactions.sort(key=lambda t: t.date)
    return transactions


def get_all_tickers(transactions: list[Transaction]) -> list[str]:
    return sorted(set(t.ticker for t in transactions))
