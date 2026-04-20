"""
═══════════════════════════════════════════════════════
BG Energy Dashboard — Weather Data Loader (НИМХ)

Loads weather data from CSV or Excel, parses datetime,
keeps relevant columns, and merges with electricity
price data.

Includes a demo mode that generates synthetic weather
data matching the price dataset's date range so the
pipeline works end-to-end without real weather files.

Usage:
    from src.weather_loader import load_weather_data, merge_with_prices

    # Real data:
    df_w = load_weather_data("path/to/weather.csv")
    df   = merge_with_prices(df_prices, df_w)

    # Demo mode (synthetic):
    df   = merge_with_prices(df_prices)
═══════════════════════════════════════════════════════
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Union

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ── Configuration ────────────────────────────────────

# Columns we want to keep from the weather data
WEATHER_COLUMNS = {
    "temperature": [
        "temperature", "temp", "t", "air_temp", "air_temperature",
        "temp_c", "температура",
    ],
    "solar_radiation": [
        "solar_radiation", "solar", "radiation", "ghi",
        "global_radiation", "слънчева_радиация",
    ],
    "cloud_cover": [
        "cloud_cover", "clouds", "cloudiness",
        "облачност",
    ],
}


# ── Helpers ──────────────────────────────────────────


def _find_column(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    """Find a column in the DataFrame matching one of the candidate names."""
    df_cols_lower = {c.lower().strip(): c for c in df.columns}
    for candidate in candidates:
        if candidate.lower() in df_cols_lower:
            return df_cols_lower[candidate.lower()]
    return None


def _find_datetime_column(df: pd.DataFrame) -> Optional[str]:
    """Auto-detect the datetime column."""
    candidates = [
        "datetime", "date_time", "timestamp", "time", "date",
        "дата", "дата_час",
    ]
    df_cols_lower = {c.lower().strip(): c for c in df.columns}
    for candidate in candidates:
        if candidate in df_cols_lower:
            return df_cols_lower[candidate]

    # Fallback: try to find a column that parses as datetime
    for col in df.columns:
        try:
            parsed = pd.to_datetime(df[col].head(10), errors="coerce")
            if parsed.notna().sum() >= 5:
                return col
        except Exception:
            continue
    return None


# ── Loading ──────────────────────────────────────────


def load_weather_data(filepath: Union[str, Path]) -> pd.DataFrame:
    """
    Load weather data from CSV or Excel file.

    Auto-detects:
      - File format (CSV / Excel) from extension
      - Datetime column
      - Temperature, solar radiation, cloud cover columns

    Returns DataFrame with columns:
        datetime       — hourly timestamp
        temperature    — °C
        solar_radiation — W/m² (if available)
        cloud_cover    — % or okta (if available)
    """
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"Weather file not found: {filepath}")

    logger.info("Loading weather data from %s …", filepath.name)

    # ── Read file ────────────────────────────────────
    ext = filepath.suffix.lower()
    if ext in (".csv", ".tsv"):
        # Try common CSV encodings
        for encoding in ["utf-8", "cp1251", "latin-1"]:
            try:
                df = pd.read_csv(filepath, encoding=encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError(f"Could not decode {filepath.name} with any encoding")
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(filepath)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

    logger.info("  Raw shape: %s", df.shape)
    logger.info("  Columns: %s", list(df.columns))

    # ── Find & parse datetime ────────────────────────
    dt_col = _find_datetime_column(df)
    if dt_col is None:
        raise ValueError("Could not find a datetime column in the weather file")

    logger.info("  Using datetime column: '%s'", dt_col)
    df["datetime"] = pd.to_datetime(df[dt_col], errors="coerce", dayfirst=True)
    df.dropna(subset=["datetime"], inplace=True)

    # ── Find weather columns ─────────────────────────
    result_cols = {"datetime": df["datetime"]}
    found_any = False

    for target_name, candidates in WEATHER_COLUMNS.items():
        original_col = _find_column(df, candidates)
        if original_col is not None:
            result_cols[target_name] = pd.to_numeric(df[original_col], errors="coerce")
            logger.info("  Found '%s' → mapped to '%s'", original_col, target_name)
            found_any = True
        else:
            logger.info("  Column '%s' not found (optional)", target_name)

    if not found_any:
        raise ValueError(
            "No weather columns found! Expected at least 'temperature'. "
            f"Available columns: {list(df.columns)}"
        )

    df_clean = pd.DataFrame(result_cols)

    # ── Resample to hourly if needed ─────────────────
    df_clean.set_index("datetime", inplace=True)
    df_clean = df_clean.resample("h").mean()  # average sub-hourly readings
    df_clean.reset_index(inplace=True)

    logger.info("  Clean weather rows: %d", len(df_clean))
    return df_clean


# ── Demo / Synthetic Data ────────────────────────────


def generate_demo_weather(
    start: pd.Timestamp,
    end: pd.Timestamp,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate realistic synthetic weather data for Bulgaria.

    Uses seasonal temperature patterns + daily cycles + noise.
    Solar radiation follows a simple sunrise–sunset model.

    Parameters
    ----------
    start, end : date range to cover
    seed       : random seed for reproducibility
    """
    rng = np.random.default_rng(seed)

    hours = pd.date_range(start, end, freq="h")
    n = len(hours)

    # ── Temperature model (Sofia-like) ───────────────
    # Seasonal base: ~0°C in Jan, ~25°C in Jul
    day_of_year = hours.dayofyear
    seasonal = 12.5 + 12.5 * np.sin(2 * np.pi * (day_of_year - 100) / 365)

    # Daily cycle: ±5°C variation, coolest at 5am, warmest at 15pm
    hour_of_day = hours.hour
    daily_cycle = 5 * np.sin(2 * np.pi * (hour_of_day - 5) / 24)

    # Random noise
    noise = rng.normal(0, 2, n)

    temperature = seasonal + daily_cycle + noise

    # ── Solar radiation model ────────────────────────
    # Simple: 0 at night, peak ~800 W/m² at noon in summer
    sunrise = 6 - 1.5 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
    sunset = 18 + 1.5 * np.sin(2 * np.pi * (day_of_year - 80) / 365)

    solar = np.zeros(n)
    for i in range(n):
        h = hour_of_day[i]
        sr, ss = sunrise[i], sunset[i]
        if sr < h < ss:
            # Fraction of daylight
            mid = (sr + ss) / 2
            half_day = (ss - sr) / 2
            frac = 1 - ((h - mid) / half_day) ** 2
            # Seasonal peak: higher in summer
            peak = 600 + 200 * np.sin(2 * np.pi * (day_of_year[i] - 80) / 365)
            solar[i] = max(0, frac * peak + rng.normal(0, 30))

    # ── Cloud cover model (0–100%) ───────────────────
    # More clouds in winter, less in summer
    cloud_base = 50 - 20 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
    cloud_cover = np.clip(cloud_base + rng.normal(0, 15, n), 0, 100)

    df = pd.DataFrame({
        "datetime": hours,
        "temperature": np.round(temperature, 1),
        "solar_radiation": np.round(solar, 1),
        "cloud_cover": np.round(cloud_cover, 1),
    })

    logger.info("  Generated %d hours of demo weather data (%s → %s)",
                len(df),
                df["datetime"].min().strftime("%Y-%m-%d"),
                df["datetime"].max().strftime("%Y-%m-%d"))

    return df


# ── Merging ──────────────────────────────────────────


def merge_with_prices(
    df_prices: pd.DataFrame,
    df_weather: Optional[pd.DataFrame] = None,
    weather_file: Optional[Union[str, Path]] = None,
) -> pd.DataFrame:
    """
    Merge electricity price data with weather data on datetime.

    If no weather DataFrame or file is provided, generates synthetic
    demo weather data covering the price dataset's date range.

    Parameters
    ----------
    df_prices    : price DataFrame with 'datetime' column
    df_weather   : pre-loaded weather DataFrame (optional)
    weather_file : path to weather CSV/Excel (optional)

    Returns
    -------
    Merged DataFrame with all price columns + weather columns.
    Missing weather values are forward-filled, then remaining NaN dropped.
    """
    if df_prices.empty:
        logger.warning("Empty price DataFrame, nothing to merge")
        return df_prices

    # ── Load or generate weather data ────────────────
    if df_weather is not None:
        logger.info("Using provided weather DataFrame (%d rows)", len(df_weather))
    elif weather_file is not None:
        df_weather = load_weather_data(weather_file)
    else:
        logger.info("No weather file provided — generating demo data")
        df_weather = generate_demo_weather(
            start=df_prices["datetime"].min(),
            end=df_prices["datetime"].max(),
        )

    # ── Ensure consistent datetime types ─────────────
    df_prices = df_prices.copy()
    df_weather = df_weather.copy()

    df_prices["datetime"] = pd.to_datetime(df_prices["datetime"])
    df_weather["datetime"] = pd.to_datetime(df_weather["datetime"])

    # Round both to nearest hour for matching
    df_prices["_merge_dt"] = df_prices["datetime"].dt.floor("h")
    df_weather["_merge_dt"] = df_weather["datetime"].dt.floor("h")

    # ── Left merge (keep all prices) ─────────────────
    weather_cols = [c for c in df_weather.columns if c not in ("datetime",)]
    merged = df_prices.merge(
        df_weather[weather_cols],
        on="_merge_dt",
        how="left",
    )

    # Drop merge key
    merged.drop(columns=["_merge_dt"], inplace=True)

    # ── Handle missing values ────────────────────────
    weather_col_names = [c for c in ["temperature", "solar_radiation", "cloud_cover"]
                         if c in merged.columns]

    before_missing = merged[weather_col_names].isna().sum().sum()

    # Forward fill (use last known weather reading)
    merged[weather_col_names] = merged[weather_col_names].ffill()

    # Backward fill remaining (start-of-series gaps)
    merged[weather_col_names] = merged[weather_col_names].bfill()

    after_missing = merged[weather_col_names].isna().sum().sum()

    logger.info("  Weather merge complete:")
    logger.info("    Rows          : %d", len(merged))
    logger.info("    Weather cols  : %s", weather_col_names)
    logger.info("    Missing fixed : %d → %d", before_missing, after_missing)

    return merged


# ── CLI entry point ──────────────────────────────────

if __name__ == "__main__":
    # Quick demo: generate synthetic weather and show it
    demo = generate_demo_weather(
        pd.Timestamp("2025-01-01"),
        pd.Timestamp("2026-03-15"),
    )
    print(f"\nDemo weather shape: {demo.shape}")
    print(f"Columns: {list(demo.columns)}")
    print(f"\nFirst 24 hours:")
    print(demo.head(24).to_string(index=False))
    print(f"\nStats:\n{demo.describe().round(1)}")
