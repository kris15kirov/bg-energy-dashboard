"""
═══════════════════════════════════════════════════════
BG Energy Dashboard — IBEX Scraper Bridge

Wraps the scraped JSON data (from the Node collector)
into a Python-friendly loader.

The Node scraper (server/collect-ibex-data.js) fetches
QH prices from IBEX and saves ibex-qh-data.json.
This module reads that JSON and returns a clean DataFrame.

Usage:
    from src.scraper import load_scraped_data
    df = load_scraped_data()
═══════════════════════════════════════════════════════
"""

import json
import logging
from pathlib import Path
from typing import Optional, Union

import pandas as pd

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSON = PROJECT_ROOT / "server" / "ibex-qh-data.json"


def load_scraped_data(filepath: Optional[Union[str, Path]] = None) -> pd.DataFrame:
    """
    Load scraped IBEX QH data from the Node collector's JSON.

    Converts 96 quarter-hour prices into 24 hourly averages per day.

    Returns DataFrame with columns: datetime, price, hour, day, month
    """
    filepath = Path(filepath) if filepath else DEFAULT_JSON

    if not filepath.exists():
        logger.warning("Scraped JSON not found: %s", filepath)
        return pd.DataFrame(columns=["datetime", "price", "hour", "day", "month"])

    logger.info("Loading scraped data from %s …", filepath.name)

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw_days = data.get("rawDays", [])
    if not raw_days:
        logger.warning("  No rawDays in JSON")
        return pd.DataFrame(columns=["datetime", "price", "hour", "day", "month"])

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
            key=lambda e: int(e.get("product", "QH 0").replace("QH ", "") or "0"),
        )

        # Extract all 96 QH prices
        qh_prices = []
        for entry in sorted_qh:
            try:
                qh_prices.append(float(entry.get("price", "nan")))
            except (ValueError, TypeError):
                qh_prices.append(float("nan"))

        # Average every 4 QH slots into 1 hourly value
        dt_base = pd.Timestamp(date_str)
        for hour in range(24):
            slot_prices = [
                p for p in qh_prices[hour * 4 : hour * 4 + 4]
                if not pd.isna(p)
            ]
            avg_price = sum(slot_prices) / len(slot_prices) if slot_prices else float("nan")
            dt = dt_base + pd.Timedelta(hours=hour)

            records.append({
                "datetime": dt,
                "price": avg_price,
                "hour": hour,
                "day": dt.day,
                "month": dt.month,
            })

    df = pd.DataFrame(records)
    logger.info("  Scraped rows: %d", len(df))
    return df
