"""
═══════════════════════════════════════════════════════
BG Energy Dashboard — Price Signal Detection Engine

Detects price windows in the IBEX electricity market:
  • negative_price  →  price ≤ 0 EUR/MWh
  • low_price       →  price < 20 EUR/MWh
  • high_price      →  price > 70 EUR/MWh

Groups by hour of day to uncover daily patterns and
optimal charge/discharge windows.

Usage:
    from src.signals import add_price_signals, hourly_signal_frequency

    df = add_price_signals(df)
    freq = hourly_signal_frequency(df)
═══════════════════════════════════════════════════════
"""

import logging
from typing import Dict, Optional

import pandas as pd

logger = logging.getLogger(__name__)


# ── Signal Thresholds ────────────────────────────────

THRESHOLDS = {
    "negative_price": {"op": "<=", "value": 0},
    "low_price":      {"op": "<",  "value": 20},
    "high_price":     {"op": ">",  "value": 70},
}


# ── Core Functions ───────────────────────────────────


def add_price_signals(
    df: pd.DataFrame,
    price_col: str = "price",
    thresholds: Optional[Dict] = None,
) -> pd.DataFrame:
    """
    Add boolean signal columns to the DataFrame.

    Signals:
        negative_price  — price ≤ 0 EUR/MWh
        low_price       — price < 20 EUR/MWh
        high_price      — price > 70 EUR/MWh

    Parameters
    ----------
    df         : DataFrame with a price column
    price_col  : name of the price column (default: 'price')
    thresholds : optional override dict, e.g.:
                 {"neg": {"op": "<=", "value": 0}, ...}

    Returns
    -------
    DataFrame with signal columns added (not a copy — modifies in place).
    """
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found in DataFrame")

    th = thresholds or THRESHOLDS

    for signal_name, config in th.items():
        op = config["op"]
        val = config["value"]

        if op == "<=":
            df[signal_name] = df[price_col] <= val
        elif op == "<":
            df[signal_name] = df[price_col] < val
        elif op == ">":
            df[signal_name] = df[price_col] > val
        elif op == ">=":
            df[signal_name] = df[price_col] >= val
        elif op == "==":
            df[signal_name] = df[price_col] == val
        else:
            raise ValueError(f"Unknown operator: {op}")

    # Count
    total = len(df)
    for signal_name in th:
        count = df[signal_name].sum()
        pct = 100 * count / total if total > 0 else 0
        logger.info("  Signal %-16s: %5d / %d  (%.1f%%)", signal_name, count, total, pct)

    return df


def add_weather_signals(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add weather-enhanced signals to the DataFrame.
    
    Requires 'price', 'temperature', 'solar_radiation', 'wind_speed' columns.
    
    Signals:
      solar_surplus     — low price + high solar radiation (>400)
      cold_spike        — high price + low temperature (<5)
      wind_dump         — low price + high wind speed (>8)
      optimal_charge    — low price + high solar + mild temp (5 to 25)
      optimal_discharge — high price + low solar (<100) + extreme temps (<5 or >25)
    """
    req_cols = ["price", "temperature", "solar_radiation", "wind_speed"]
    missing = [c for c in req_cols if c not in df.columns]
    if missing:
        logger.warning(f"Missing columns for weather signals: {missing}")
        return df

    # Basic price bools (just in case they aren't generated)
    is_low_price = df["price"] < 20
    is_high_price = df["price"] > 70
    
    # Weather conditions
    is_high_solar = df["solar_radiation"] > 400
    is_low_solar = df["solar_radiation"] < 100
    is_cold = df["temperature"] < 5
    is_hot = df["temperature"] > 25
    is_mild_temp = (df["temperature"] >= 5) & (df["temperature"] <= 25)
    is_high_wind = df["wind_speed"] > 8
    
    df["solar_surplus"] = is_low_price & is_high_solar
    df["cold_spike"] = is_high_price & is_cold
    df["wind_dump"] = is_low_price & is_high_wind
    df["optimal_charge"] = is_low_price & is_high_solar & is_mild_temp
    df["optimal_discharge"] = is_high_price & is_low_solar & (is_cold | is_hot)
    
    # Logging
    signals = ["solar_surplus", "cold_spike", "wind_dump", "optimal_charge", "optimal_discharge"]
    total = len(df)
    for sig in signals:
        count = df[sig].sum()
        pct = 100 * count / total if total > 0 else 0
        logger.info("  Weather Signal %-18s: %5d / %d  (%.1f%%)", sig, count, total, pct)

    return df


def hourly_signal_frequency(df: pd.DataFrame) -> pd.DataFrame:
    """
    Group by hour of day and calculate frequency of each signal.

    Returns a DataFrame with:
        hour               — 0..23
        total_observations — number of data points for that hour
        negative_price_pct — % of hours with price ≤ 0
        low_price_pct      — % of hours with price < 20
        high_price_pct     — % of hours with price > 70
        mean_price         — average price for that hour
        median_price       — median price for that hour

    This reveals daily patterns: which hours tend to have
    low/negative prices (charge windows) vs high prices
    (discharge windows).
    """
    if "hour" not in df.columns:
        raise ValueError("DataFrame must have an 'hour' column")

    signal_cols = [c for c in THRESHOLDS.keys() if c in df.columns]
    if not signal_cols:
        raise ValueError("No signal columns found. Run add_price_signals() first.")

    # Group by hour
    grouped = df.groupby("hour")

    result = pd.DataFrame({
        "hour": range(24),
        "total_observations": grouped.size().reindex(range(24), fill_value=0),
        "mean_price": grouped["price"].mean().reindex(range(24)),
        "median_price": grouped["price"].median().reindex(range(24)),
    })

    # Add percentage columns for each signal
    for signal in signal_cols:
        pct_name = f"{signal}_pct"
        signal_counts = grouped[signal].sum().reindex(range(24), fill_value=0)
        totals = grouped[signal].count().reindex(range(24), fill_value=1)
        result[pct_name] = (100 * signal_counts / totals).round(2)

    result.reset_index(drop=True, inplace=True)
    return result


def monthly_signal_frequency(df: pd.DataFrame) -> pd.DataFrame:
    """
    Group by month and calculate signal frequency.

    Returns a DataFrame with:
        month              — 1..12
        total_observations — data points per month
        negative_price_pct — % with price ≤ 0
        low_price_pct      — % with price < 20
        high_price_pct     — % with price > 70
        mean_price         — average price for the month
    """
    if "month" not in df.columns:
        raise ValueError("DataFrame must have a 'month' column")

    signal_cols = [c for c in THRESHOLDS.keys() if c in df.columns]

    grouped = df.groupby("month")

    result = pd.DataFrame({
        "month": grouped.size().index,
        "total_observations": grouped.size().values,
        "mean_price": grouped["price"].mean().values,
    })

    for signal in signal_cols:
        pct_name = f"{signal}_pct"
        result[pct_name] = (
            100 * grouped[signal].sum().values / grouped[signal].count().values
        ).round(2)

    return result


# ── Pretty-print ─────────────────────────────────────


def print_signal_summary(df: pd.DataFrame) -> None:
    """Print a comprehensive signal analysis to console."""

    total = len(df)
    price_mean = df["price"].mean()
    price_std = df["price"].std()
    price_min = df["price"].min()
    price_max = df["price"].max()

    print("\n" + "═" * 60)
    print("  PRICE SIGNAL ANALYSIS")
    print("═" * 60)

    print(f"\n  📊 Price Statistics:")
    print(f"     Total observations : {total:,}")
    print(f"     Mean price         : {price_mean:.2f} EUR/MWh")
    print(f"     Std deviation      : {price_std:.2f} EUR/MWh")
    print(f"     Min / Max          : {price_min:.2f} / {price_max:.2f} EUR/MWh")

    # ── Signal counts ────────────────────────────────
    print(f"\n  🚦 Signal Counts:")
    for signal_name in THRESHOLDS:
        if signal_name in df.columns:
            count = df[signal_name].sum()
            pct = 100 * count / total
            bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
            print(f"     {signal_name:20s}: {count:5d} ({pct:5.1f}%)  {bar}")

    # ── Hourly patterns ──────────────────────────────
    print(f"\n  🕐 Hourly Pattern Summary:")
    freq = hourly_signal_frequency(df)

    # Best charging hours (highest low_price frequency)
    if "low_price_pct" in freq.columns:
        best_charge = freq.nlargest(5, "low_price_pct")
        print(f"\n     Top 5 CHARGING windows (highest low-price frequency):")
        for _, row in best_charge.iterrows():
            h = int(row["hour"])
            print(f"       Hour {h:02d}:00  —  low_price: {row['low_price_pct']:.1f}%"
                  f"  |  mean: {row['mean_price']:.1f} EUR/MWh")

    # Best discharging hours (highest high_price frequency)
    if "high_price_pct" in freq.columns:
        best_discharge = freq.nlargest(5, "high_price_pct")
        print(f"\n     Top 5 DISCHARGE windows (highest high-price frequency):")
        for _, row in best_discharge.iterrows():
            h = int(row["hour"])
            print(f"       Hour {h:02d}:00  —  high_price: {row['high_price_pct']:.1f}%"
                  f"  |  mean: {row['mean_price']:.1f} EUR/MWh")

    # ── Monthly patterns ─────────────────────────────
    if "month" in df.columns:
        print(f"\n  📅 Monthly Pattern Summary:")
        monthly = monthly_signal_frequency(df)
        for _, row in monthly.iterrows():
            m = int(row["month"])
            print(f"     Month {m:2d}: mean={row['mean_price']:6.1f} EUR/MWh"
                  f"  |  low: {row.get('low_price_pct', 0):5.1f}%"
                  f"  |  high: {row.get('high_price_pct', 0):5.1f}%")

    print("\n" + "═" * 60)


def print_weather_signal_summary(df: pd.DataFrame) -> None:
    """Print weather-aware signals summary."""
    signals = ["solar_surplus", "cold_spike", "wind_dump", "optimal_charge", "optimal_discharge"]
    found_signals = [s for s in signals if s in df.columns]
    
    if not found_signals:
        return
        
    total = len(df)
    print("\n" + "═" * 60)
    print("  WEATHER SIGNAL ANALYSIS")
    print("═" * 60)
    
    print(f"\n  🌤  Weather Events Context:")
    for sig in found_signals:
        count = df[sig].sum()
        pct = 100 * count / total if total > 0 else 0
        bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
        print(f"     {sig:20s}: {count:5d} ({pct:5.1f}%)  {bar}")
        
    print("\n" + "═" * 60)

# ── CLI entry point ──────────────────────────────────

if __name__ == "__main__":
    # Quick test with synthetic data
    import numpy as np

    np.random.seed(42)
    n = 24 * 90  # 90 days

    df = pd.DataFrame({
        "datetime": pd.date_range("2025-01-01", periods=n, freq="h"),
        "price": np.random.normal(50, 30, n),
        "hour": [h % 24 for h in range(n)],
        "day": pd.date_range("2025-01-01", periods=n, freq="h").day,
        "month": pd.date_range("2025-01-01", periods=n, freq="h").month,
    })

    df = add_price_signals(df)
    print_signal_summary(df)
