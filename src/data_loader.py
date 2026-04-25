"""
═══════════════════════════════════════════════════════
BG Energy Dashboard — IBEX Data Loader & Merger

Loads IBEX DAM hourly price data from:
  1. Historical Excel workbooks (2025 + 2026)
  2. Scraped JSON (ibex-qh-data.json from the Node collector)

Merges both sources into a single clean DataFrame
with no duplicate timestamps & consistent format.

Final schema:
    datetime  — full timestamp (date + hour)
    price     — EUR/MWh
    hour      — 0..23
    day       — day of month (1..31)
    month     — month (1..12)

Usage:
    from src.data_loader import load_all_sources
    df = load_all_sources()
═══════════════════════════════════════════════════════
"""

import os
import re
import json
import logging
from typing import Optional, Union
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ── Configuration ────────────────────────────────────

DEFAULT_DATA_DIR = Path.home() / "Downloads"

# Project root (one level up from src/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

FILES = {
    2025: "IBEX-Prices-2025-monthly-calculations.xlsx",
    2026: "IBEX-Prices-2026-monthly-calculations.xlsx",
}

SCRAPED_JSON = PROJECT_ROOT / "server" / "ibex-qh-data.json"


# ── Helpers ──────────────────────────────────────────

_PH_RE = re.compile(r"^PH\s*(\d+)$", re.IGNORECASE)
_DATE_COL_RE = re.compile(
    r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*(\d{1,2})/(\d{1,2})$"
)


def _extract_hour(product: str) -> Optional[int]:
    """
    Convert a product label like 'PH 1' → 0, 'PH 24' → 23.
    Returns None for non-hour rows (summaries, etc.).
    """
    m = _PH_RE.match(str(product).strip())
    if m:
        return int(m.group(1)) - 1  # PH 1 = hour 0
    return None


def _parse_date_header(header: str, year: int) -> Optional[pd.Timestamp]:
    """
    Parse column headers like 'Fri, 09/12' → datetime(year, 9, 12).
    Returns None for non-date headers (Product, CET Time, Value, etc.).
    """
    m = _DATE_COL_RE.match(str(header).strip())
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        try:
            return pd.Timestamp(year=year, month=month, day=day)
        except ValueError:
            logger.warning("Invalid date in header: %s (year=%d)", header, year)
            return None
    return None


# ── Excel Loading ────────────────────────────────────


def load_ibex_excel(filepath: Union[str, Path], year: int) -> pd.DataFrame:
    """
    Load a single IBEX monthly-calculations Excel file.

    Reads Sheet1 (the cross-tab with all months), melts it
    into long form, and returns a DataFrame with columns:
        date  (datetime64)  — the delivery day
        hour  (int)         — 0..23
        price (float)       — EUR/MWh (NaN for missing)

    Parameters
    ----------
    filepath : path to the .xlsx file
    year     : calendar year (used to resolve MM/DD headers)
    """
    filepath = Path(filepath)
    if not filepath.exists():
        logger.warning("File not found, skipping: %s", filepath)
        return pd.DataFrame(columns=["date", "hour", "price"])

    logger.info("Loading %s …", filepath.name)

    # Read all sheets
    sheets = pd.read_excel(
        filepath,
        sheet_name=None,       # read all sheets
        header=0,              # first row is headers
        dtype=str,             # read everything as string first
    )

    all_records = []

    for sheet_name, df_raw in sheets.items():
        logger.info("  Processing sheet: %s (shape: %s)", sheet_name, df_raw.shape)

        # ── Identify date columns ────────────────────────
        date_columns = {}  # original col name → pd.Timestamp
        for col in df_raw.columns:
            dt = _parse_date_header(col, year)
            if dt is not None:
                date_columns[col] = dt

        if not date_columns:
            logger.warning("    No date columns found in sheet %s!", sheet_name)
            continue

        # ── Identify the product column ──────────────────
        product_col = df_raw.columns[0]

        # ── Filter to hourly rows only (PH 1 … PH 24) ───
        df_raw["_hour"] = df_raw[product_col].apply(_extract_hour)
        df_hours = df_raw.dropna(subset=["_hour"]).copy()
        df_hours["_hour"] = df_hours["_hour"].astype(int)

        if df_hours.empty:
            logger.warning("    No hourly rows found in sheet %s!", sheet_name)
            continue

        # ── Melt: wide → long ────────────────────────────
        for _, row in df_hours.iterrows():
            hour = row["_hour"]
            for col_name, dt in date_columns.items():
                raw_price = row.get(col_name)
                all_records.append({
                    "date": dt.normalize(),  # date only, no time
                    "hour": hour,
                    "price": raw_price,
                })

    if not all_records:
        logger.error("  No valid data found in any sheet for %s!", filepath.name)
        return pd.DataFrame(columns=["date", "hour", "price"])

    df = pd.DataFrame(all_records)

    # ── Clean prices ─────────────────────────────────
    df["price"] = pd.to_numeric(df["price"], errors="coerce")

    n_missing = df["price"].isna().sum()
    if n_missing > 0:
        logger.warning("  %d missing/invalid prices (%.1f%%)",
                        n_missing, 100 * n_missing / len(df))

    logger.info("  Final long-form rows: %d", len(df))
    return df


def load_and_combine(data_dir: Optional[Union[str, Path]] = None) -> pd.DataFrame:
    """
    Load both IBEX Excel files, combine, and return a clean
    analysis-ready DataFrame.

    Columns:
        date     (datetime64)  — delivery day
        hour     (int 0..23)   — delivery hour
        price    (float)       — EUR/MWh
        datetime (datetime64)  — date + hour as full timestamp

    The DataFrame is sorted chronologically and de-duplicated.

    Parameters
    ----------
    data_dir : directory containing the Excel files.
               Defaults to ~/Downloads
    """
    data_dir = Path(data_dir) if data_dir else DEFAULT_DATA_DIR

    frames = []
    for year, filename in sorted(FILES.items()):
        filepath = data_dir / filename
        df = load_ibex_excel(filepath, year)
        if not df.empty:
            frames.append(df)

    if not frames:
        logger.error("No data loaded from any file!")
        return pd.DataFrame(columns=["date", "hour", "price", "datetime"])

    combined = pd.concat(frames, ignore_index=True)

    # ── Create datetime column (date + hour) ─────────
    combined["datetime"] = combined["date"] + pd.to_timedelta(combined["hour"], unit="h")

    # ── Sort and de-duplicate ────────────────────────
    combined.sort_values("datetime", inplace=True)
    before = len(combined)
    combined.drop_duplicates(subset=["datetime"], keep="last", inplace=True)
    dupes = before - len(combined)
    if dupes > 0:
        logger.info("Removed %d duplicate rows", dupes)

    combined.reset_index(drop=True, inplace=True)

    # ── Summary ──────────────────────────────────────
    logger.info("═" * 50)
    logger.info("Combined dataset ready:")
    logger.info("  Rows        : %d", len(combined))
    logger.info("  Date range  : %s → %s",
                combined["datetime"].min().strftime("%Y-%m-%d %H:%M"),
                combined["datetime"].max().strftime("%Y-%m-%d %H:%M"))
    logger.info("  Missing vals: %d", combined["price"].isna().sum())
    logger.info("═" * 50)

    return combined


# ── Scraped JSON Loading ─────────────────────────────


def load_scraped_json(filepath: Optional[Union[str, Path]] = None) -> pd.DataFrame:
    """
    Load scraped IBEX QH data from the Node collector's JSON output.

    The JSON has structure:
        { rawDays: [{ date, main_data: [{ product: "QH 1", price, ... }] }] }

    Converts 96 quarter-hour prices into 24 hourly averages per day.

    Returns DataFrame with columns: date, hour, price
    (same schema as load_ibex_excel for easy merging).
    """
    filepath = Path(filepath) if filepath else SCRAPED_JSON

    if not filepath.exists():
        logger.warning("Scraped JSON not found: %s", filepath)
        return pd.DataFrame(columns=["date", "hour", "price"])

    logger.info("Loading scraped data from %s …", filepath.name)

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw_days = data.get("rawDays", [])
    if not raw_days:
        logger.warning("  No rawDays in JSON")
        return pd.DataFrame(columns=["date", "hour", "price"])

    logger.info("  Found %d days in scraped JSON", len(raw_days))

    records = []
    for day_entry in raw_days:
        date_str = day_entry.get("date")
        if not date_str:
            continue

        main_data = day_entry.get("main_data", [])
        if not main_data:
            continue

        # Sort QH entries by slot number
        sorted_qh = sorted(
            main_data,
            key=lambda e: int(e.get("product", "QH 0").replace("QH ", "") or "0")
        )

        # Extract all 96 QH prices
        qh_prices = []
        for entry in sorted_qh:
            try:
                qh_prices.append(float(entry.get("price", "nan")))
            except (ValueError, TypeError):
                qh_prices.append(float("nan"))

        # Average every 4 QH slots into 1 hourly value
        for hour in range(24):
            slot_start = hour * 4
            slot_end = slot_start + 4
            slot_prices = [p for p in qh_prices[slot_start:slot_end] if not pd.isna(p)]

            if slot_prices:
                avg_price = sum(slot_prices) / len(slot_prices)
            else:
                avg_price = float("nan")

            records.append({
                "date": pd.Timestamp(date_str).normalize(),
                "hour": hour,
                "price": avg_price,
            })

    df = pd.DataFrame(records)

    n_missing = df["price"].isna().sum()
    if n_missing > 0:
        logger.warning("  %d missing prices in scraped data", n_missing)

    logger.info("  Scraped rows: %d (from %s to %s)",
                len(df),
                df["date"].min().strftime("%Y-%m-%d") if not df.empty else "N/A",
                df["date"].max().strftime("%Y-%m-%d") if not df.empty else "N/A")

    return df


# ── Unified Loader ───────────────────────────────────


def load_all_sources(
    data_dir: Optional[Union[str, Path]] = None,
    scraped_json: Optional[Union[str, Path]] = None,
) -> pd.DataFrame:
    """
    Load and merge ALL IBEX price sources:
      1. Historical Excel workbooks (2025 + 2026)
      2. Scraped JSON from the Node collector

    Returns a clean, de-duplicated DataFrame with columns:
        datetime  — full timestamp (date + hour)
        price     — EUR/MWh
        hour      — 0..23
        day       — day of month (1..31)
        month     — month (1..12)

    Parameters
    ----------
    data_dir     : directory with Excel files (default: ~/Downloads)
    scraped_json : path to ibex-qh-data.json (default: server/ibex-qh-data.json)
    """
    logger.info("╔══════════════════════════════════════════════════╗")
    logger.info("║  Loading ALL IBEX data sources                  ║")
    logger.info("╚══════════════════════════════════════════════════╝")

    frames = []

    # ── Source 1: Excel files ────────────────────────
    df_excel = load_and_combine(data_dir)
    if not df_excel.empty:
        logger.info("  Excel source: %d rows", len(df_excel))
        frames.append(df_excel[["date", "hour", "price"]])

    # ── Source 2: Scraped JSON ───────────────────────
    df_scraped = load_scraped_json(scraped_json)
    if not df_scraped.empty:
        logger.info("  Scraped source: %d rows", len(df_scraped))
        frames.append(df_scraped)

    if not frames:
        logger.error("No data loaded from ANY source!")
        return pd.DataFrame(columns=["datetime", "price", "hour", "day", "month"])

    # ── Merge ────────────────────────────────────────
    combined = pd.concat(frames, ignore_index=True)

    # Build datetime from date + hour
    combined["datetime"] = combined["date"] + pd.to_timedelta(combined["hour"], unit="h")

    # Sort chronologically
    combined.sort_values("datetime", inplace=True)

    # De-duplicate: keep LAST occurrence (scraped data is more recent)
    before = len(combined)
    combined.drop_duplicates(subset=["datetime"], keep="last", inplace=True)
    dupes = before - len(combined)
    if dupes > 0:
        logger.info("  Removed %d duplicate timestamps during merge", dupes)

    combined.reset_index(drop=True, inplace=True)

    # ── Add derived columns ──────────────────────────
    combined["hour"] = combined["datetime"].dt.hour
    combined["day"] = combined["datetime"].dt.day
    combined["month"] = combined["datetime"].dt.month

    # Drop the intermediate 'date' column
    combined = combined[["datetime", "price", "hour", "day", "month"]]

    # ── Summary ──────────────────────────────────────
    logger.info("═" * 55)
    logger.info("  MERGED DATASET READY")
    logger.info("  Total rows   : %d", len(combined))
    logger.info("  Date range   : %s → %s",
                combined["datetime"].min().strftime("%Y-%m-%d %H:%M"),
                combined["datetime"].max().strftime("%Y-%m-%d %H:%M"))
    logger.info("  Missing vals : %d", combined["price"].isna().sum())
    logger.info("  Unique days  : %d", combined["datetime"].dt.date.nunique())
    logger.info("═" * 55)

    return combined


# ── CLI entry point ──────────────────────────────────

if __name__ == "__main__":
    df = load_all_sources()
    print(f"\n{'─' * 50}")
    print(f"Shape : {df.shape}")
    print(f"Cols  : {list(df.columns)}")
    print(f"Types :\n{df.dtypes}\n")
    print("First 10 rows:")
    print(df.head(10).to_string(index=False))
    print(f"\nLast 10 rows:")
    print(df.tail(10).to_string(index=False))
    print(f"\nMissing prices: {df['price'].isna().sum()}")
