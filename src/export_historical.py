"""
═══════════════════════════════════════════════════════
BG Energy Dashboard — Export Historical IBEX Data

Runs the data_loader pipeline and exports the full
merged dataset to a JSON file that the web frontend
can consume as a static asset.

Output: public/data/ibex-historical.json

Usage:
    python src/export_historical.py
═══════════════════════════════════════════════════════
"""

import json
import logging
import sys
from pathlib import Path

# Ensure imports work from any directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.data_loader import load_all_sources

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

OUTPUT_DIR = PROJECT_ROOT / "public" / "data"


def export_to_json(data_dir=None):
    """
    Load all IBEX sources and export to a compact JSON format.

    JSON structure:
    {
        "meta": { "totalRows", "dateRange", "exportedAt", "years", "months" },
        "records": [
            { "dt": "2025-01-01T00:00:00", "p": 45.23, "h": 0, "d": 1, "m": 1 },
            ...
        ]
    }

    Uses short keys to minimize file size:
        dt = datetime, p = price, h = hour, d = day, m = month
    """
    # Load all data
    df = load_all_sources(data_dir=data_dir)

    if df.empty:
        logger.error("No data to export!")
        return

    # Drop rows with missing prices
    df = df.dropna(subset=["price"])

    # Build compact records
    records = []
    for _, row in df.iterrows():
        records.append({
            "dt": row["datetime"].isoformat(),
            "p": round(row["price"], 2),
            "h": int(row["hour"]),
            "d": int(row["day"]),
            "m": int(row["month"]),
        })

    # Meta info
    years = sorted(df["datetime"].dt.year.unique().tolist())
    months = sorted(df["month"].unique().tolist())

    payload = {
        "meta": {
            "totalRows": len(records),
            "dateRange": {
                "start": df["datetime"].min().isoformat(),
                "end": df["datetime"].max().isoformat(),
            },
            "exportedAt": __import__("datetime").datetime.now().isoformat(),
            "years": years,
            "months": months,
            "uniqueDays": int(df["datetime"].dt.date.nunique()),
        },
        "records": records,
    }

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "ibex-historical.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)

    logger.info("═" * 55)
    logger.info("  EXPORT COMPLETE")
    logger.info("  Output    : %s", output_path)
    logger.info("  Records   : %d", len(records))
    logger.info("  File size : %.2f MB", file_size_mb)
    logger.info("  Years     : %s", years)
    logger.info("  Date range: %s → %s",
                payload["meta"]["dateRange"]["start"],
                payload["meta"]["dateRange"]["end"])
    logger.info("═" * 55)


if __name__ == "__main__":
    export_to_json()
