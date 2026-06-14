from pathlib import Path
from datetime import date

ROOT = Path(__file__).parent.parent
DATA_RAW = ROOT / "data" / "raw"
DATA_CACHE_PRICES = ROOT / "data" / "cache" / "prices"
DATA_CACHE_IHSG = ROOT / "data" / "cache" / "ihsg"
DATA_CACHE_DIVIDENDS = ROOT / "data" / "cache" / "dividends"

TRANSACTIONS_CSV = DATA_RAW / "portfolio_transactions.csv"
IHSG_PARQUET = DATA_CACHE_IHSG / "JKSE.parquet"

# First transaction date in the active window (2025+)
PORTFOLIO_START = date(2025, 2, 28)

TICKER_MAP = {
    # Tickers with BUY transactions from 2025 onwards (20 active)
    "ADRO": "ADRO.JK",
    "ASGR": "ASGR.JK",
    "ASII": "ASII.JK",
    "AUTO": "AUTO.JK",
    "BAYU": "BAYU.JK",
    "BUKA": "BUKA.JK",
    "DIVA": "DIVA.JK",
    "DPNS": "DPNS.JK",
    "IGAR": "IGAR.JK",
    "INCI": "INCI.JK",
    "KSIX": "KSIX.JK",
    "LPIN": "LPIN.JK",
    "LPKR": "LPKR.JK",
    "LPLI": "LPLI.JK",
    "PUDP": "PUDP.JK",
    "RIGS": "RIGS.JK",
    "SCCO": "SCCO.JK",
    "SMDR": "SMDR.JK",
    "TAPG": "TAPG.JK",
    "UCID": "UCID.JK",
}

IHSG_TICKER = "^JKSE"
SHARES_PER_LOT = 100
