"""
═══════════════════════════════════════════════════════
BG Energy Dashboard — CLI

Commands:
    python src/main.py pipeline     Run full analytics pipeline
    python src/main.py simulate     Simulate battery trading
    python src/main.py signals      Detect price signals
    python src/main.py load         Load & display merged data
═══════════════════════════════════════════════════════
"""

import argparse
import sys
from pathlib import Path

# Ensure imports work from any directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.data_loader import load_all_sources
from src.weather_loader import merge_with_prices, fetch_openmeteo_weather
from src.signals import add_price_signals, print_signal_summary, add_weather_signals, print_weather_signal_summary
from src.battery_logic import BatterySimulator, BatteryConfig, WeatherAwareBatterySimulator, compare_strategies


# ── Commands ─────────────────────────────────────────


def cmd_load(args):
    """Load & display the merged dataset."""
    df = load_all_sources(data_dir=args.data_dir)
    print(f"\n  📦 Dataset: {len(df):,} rows  |  {df['datetime'].dt.date.nunique()} days")
    print(f"  📅 Range:   {df['datetime'].min()} → {df['datetime'].max()}")
    print(f"  💰 Price:   mean={df['price'].mean():.2f}  min={df['price'].min():.2f}  max={df['price'].max():.2f}")
    print(f"\n{df.head(10).to_string(index=False)}\n")


def cmd_signals(args):
    """Detect & display price signals."""
    df = load_all_sources(data_dir=args.data_dir)
    df = add_price_signals(df)
    print_signal_summary(df)


def cmd_simulate(args):
    """Simulate battery trading and print summary."""
    # 1. Load data
    df = load_all_sources(data_dir=args.data_dir)
    print(f"\n  📦 Loaded {len(df):,} hourly prices")
    print(f"  📅 {df['datetime'].min()} → {df['datetime'].max()}\n")

    # 2. Configure battery
    config = BatteryConfig(
        capacity=args.capacity,
        charge_rate=args.charge_rate,
        discharge_rate=args.discharge_rate,
        efficiency=args.efficiency,
        initial_soc=args.capacity / 2,
    )

    # 3. Simulate
    sim = BatterySimulator(config)
    results = sim.run(df)
    summary = sim.summarize(results)

    # 4. Print clean summary
    print("═" * 50)
    print("  🔋 BATTERY SIMULATION RESULTS")
    print("═" * 50)

    profit = summary["total_profit"]
    emoji = "📈" if profit > 0 else "📉"

    print(f"\n  {emoji} Total Profit    : {profit:>12,.2f} EUR")
    print(f"  💵 Revenue (sales) : {summary['total_revenue']:>12,.2f} EUR")
    print(f"  💸 Cost (buys)     : {summary['total_cost']:>12,.2f} EUR")

    trades = summary["charge_count"] + summary["discharge_count"]
    print(f"\n  🔄 Total Trades    : {trades:>8,}")
    print(f"     ├─ Charges      : {summary['charge_count']:>8,}")
    print(f"     └─ Discharges   : {summary['discharge_count']:>8,}")
    print(f"  ⏸  Hold hours      : {summary['hold_count']:>8,}")

    print(f"\n  📊 Avg buy price   : {summary['avg_charge_price']:>8.2f} EUR/MWh")
    print(f"  📊 Avg sell price  : {summary['avg_discharge_price']:>8.2f} EUR/MWh")
    print(f"  📊 Spread          : {summary['spread']:>8.2f} EUR/MWh")

    print(f"\n  🔋 Cycles          : {summary['cycles']:>8.1f}")
    print(f"  🔋 Final SOC       : {summary['final_soc']:>8.0f} / {config.capacity:.0f}")
    print(f"  🔋 Utilization     : {summary['capacity_utilization_pct']:>7.1f}%")
    print("═" * 50 + "\n")


def cmd_weather(args):
    """Fetch and display weather data standalone."""
    print("\n  ⛅ Fetching Weather from Open-Meteo ...")
    df = fetch_openmeteo_weather()
    print(f"  ✅ Fetched {len(df):,} hours of weather data.")
    print(df.head(24).to_string(index=False))


def cmd_compare(args):
    """Run strategy comparison between basic and weather-aware simulators."""
    df = load_all_sources(data_dir=args.data_dir)
    df = merge_with_prices(df, weather_file=args.weather)
    df = add_price_signals(df)
    df = add_weather_signals(df)
    
    print("\n  📦 Dataset ready for comparison.")
    compare_strategies(df)


def cmd_pipeline(args):
    """Run the full analytics pipeline."""
    output_dir = PROJECT_ROOT / "output"
    output_dir.mkdir(exist_ok=True)

    # Step 1
    print("\n  [1/4] Loading prices …")
    df = load_all_sources(data_dir=args.data_dir)
    print(f"        ✅ {len(df):,} rows loaded")

    # Step 2
    print("  [2/4] Merging weather …")
    df = merge_with_prices(df, weather_file=args.weather)
    print(f"        ✅ Weather merged")

    # Step 3
    print("  [3/4] Detecting signals …")
    df = add_price_signals(df)
    df = add_weather_signals(df)
    print_signal_summary(df)
    print_weather_signal_summary(df)

    # Step 4
    print("  [4/4] Simulating battery strategies …")
    compare_strategies(df)

    # Export
    sim = BatterySimulator()
    res_b = sim.run(df)
    ws = WeatherAwareBatterySimulator()
    res_w = ws.run(df)
    
    df.to_csv(output_dir / "merged_prices.csv", index=False)
    
    weather_cols = [c for c in ["datetime", "temperature", "solar_radiation", "cloud_cover", "wind_speed", "precipitation"] if c in df.columns]
    if "temperature" in df.columns:
        df[weather_cols].to_csv(output_dir / "weather_data.csv", index=False)
        
    signals_cols = [c for c in ["datetime", "price", "solar_surplus", "cold_spike", "wind_dump", "optimal_charge", "optimal_discharge"] if c in df.columns]
    if "solar_surplus" in df.columns:
        df[signals_cols].to_csv(output_dir / "weather_signals.csv", index=False)
        
    res_b[["datetime", "price", "hour", "action", "soc", "energy_delta", "revenue"]].to_csv(
        output_dir / "battery_simulation_basic.csv", index=False
    )
    res_w[["datetime", "price", "hour", "action", "soc", "energy_delta", "revenue", "confidence"]].to_csv(
        output_dir / "battery_simulation_weather.csv", index=False
    )
    print(f"\n  📁 Exports saved to: {output_dir}/\n")


# ── CLI Setup ────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        prog="bg-energy",
        description="BG Energy Dashboard — CLI tools",
    )
    sub = parser.add_subparsers(dest="command", help="Available commands")

    # Shared arguments
    def add_common(p):
        p.add_argument("--data-dir", type=str, default=None,
                        help="Directory with IBEX Excel files (default: ~/Downloads)")

    # ── load ──
    p_load = sub.add_parser("load", help="Load & display merged data")
    add_common(p_load)

    # ── signals ──
    p_sig = sub.add_parser("signals", help="Detect price signal patterns")
    add_common(p_sig)

    # ── simulate ──
    p_sim = sub.add_parser("simulate", help="Simulate battery trading")
    add_common(p_sim)
    p_sim.add_argument("--capacity", type=float, default=100, help="Battery capacity (default: 100)")
    p_sim.add_argument("--charge-rate", type=float, default=10, help="Charge rate per hour (default: 10)")
    p_sim.add_argument("--discharge-rate", type=float, default=10, help="Discharge rate per hour (default: 10)")
    p_sim.add_argument("--efficiency", type=float, default=0.9, help="Round-trip efficiency (default: 0.9)")

    # ── pipeline ──
    p_pipe = sub.add_parser("pipeline", help="Run full analytics pipeline")
    add_common(p_pipe)
    p_pipe.add_argument("--weather", type=str, default=None, help="Path to weather CSV/Excel")

    # ── weather ──
    p_wea = sub.add_parser("weather", help="Fetch and display weather data standalone")

    # ── compare ──
    p_comp = sub.add_parser("compare", help="Compare battery simulation strategies")
    add_common(p_comp)
    p_comp.add_argument("--weather", type=str, default=None, help="Path to weather CSV/Excel")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "load": cmd_load,
        "signals": cmd_signals,
        "simulate": cmd_simulate,
        "pipeline": cmd_pipeline,
        "weather": cmd_weather,
        "compare": cmd_compare,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
