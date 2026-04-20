"""
═══════════════════════════════════════════════════════
BG Energy Dashboard — Battery Decision Engine

Simulates a simple battery storage system operating
on IBEX electricity prices.

Decision rules:
  • price ≤ 0   →  CHARGE  (buy at negative/zero cost)
  • price < 20  →  CHARGE  (if capacity available)
  • price > 70  →  DISCHARGE (if SOC > 0)
  • otherwise   →  HOLD

Tracks:
  - State of Charge (SOC) over time
  - Actions taken (CHARGE / DISCHARGE / HOLD)
  - Revenue from each action
  - Total profit and cycle counts

Usage:
    from src.battery_logic import BatterySimulator

    sim = BatterySimulator()
    results = sim.run(df)
    sim.print_report(results)
═══════════════════════════════════════════════════════
"""

import logging
from dataclasses import dataclass
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


# ── Battery Configuration ────────────────────────────


@dataclass
class BatteryConfig:
    """Battery parameters for the simulation."""

    capacity: float = 100.0       # Total capacity (units, e.g., MWh)
    charge_rate: float = 10.0     # Max charge per hour (units/h)
    discharge_rate: float = 10.0  # Max discharge per hour (units/h)
    efficiency: float = 0.90      # Round-trip efficiency (0..1)
    initial_soc: float = 50.0     # Starting state of charge (units)

    # Price thresholds
    charge_price_neg: float = 0.0    # price ≤ this → always charge
    charge_price_low: float = 20.0   # price < this → charge if capacity
    discharge_price: float = 70.0    # price > this → discharge

    def __post_init__(self):
        assert 0 <= self.initial_soc <= self.capacity, \
            f"initial_soc ({self.initial_soc}) must be in [0, {self.capacity}]"
        assert 0 < self.efficiency <= 1, \
            f"efficiency ({self.efficiency}) must be in (0, 1]"


# ── Simulator ────────────────────────────────────────


class BatterySimulator:
    """
    Simple battery storage simulator.

    Processes a time-series of electricity prices and decides
    when to charge, discharge, or hold based on price thresholds.
    """

    def __init__(self, config: Optional[BatteryConfig] = None):
        self.config = config or BatteryConfig()

    def decide_action(self, price: float, soc: float) -> str:
        """
        Determine the battery action based on current price and SOC.

        Returns: 'CHARGE', 'DISCHARGE', or 'HOLD'
        """
        cfg = self.config

        if pd.isna(price):
            return "HOLD"

        # Priority 1: Charge at negative/zero prices
        if price <= cfg.charge_price_neg:
            if soc < cfg.capacity:
                return "CHARGE"
            return "HOLD"  # Battery full

        # Priority 2: Charge at low prices
        if price < cfg.charge_price_low:
            if soc < cfg.capacity:
                return "CHARGE"
            return "HOLD"

        # Priority 3: Discharge at high prices
        if price > cfg.discharge_price:
            if soc > 0:
                return "DISCHARGE"
            return "HOLD"  # Battery empty

        # Default: Hold
        return "HOLD"

    def run(self, df: pd.DataFrame, price_col: str = "price") -> pd.DataFrame:
        """
        Run the battery simulation over a price time-series.

        Parameters
        ----------
        df        : DataFrame with price data (must have 'datetime' and price_col)
        price_col : name of the price column

        Returns
        -------
        DataFrame with added columns:
            action        — CHARGE / DISCHARGE / HOLD
            soc           — state of charge after action
            energy_delta  — energy moved (+ = charge, - = discharge)
            revenue       — revenue from this hour
                            (positive = selling/discharging,
                             negative = buying/charging)
        """
        if price_col not in df.columns:
            raise ValueError(f"Column '{price_col}' not found")

        cfg = self.config
        result = df.copy()

        n = len(result)
        actions = [""] * n
        socs = [0.0] * n
        deltas = [0.0] * n
        revenues = [0.0] * n

        current_soc = cfg.initial_soc

        for i in range(n):
            price = result.iloc[i][price_col]
            action = self.decide_action(price, current_soc)

            if action == "CHARGE":
                # How much can we charge?
                available_capacity = cfg.capacity - current_soc
                charge_amount = min(cfg.charge_rate, available_capacity)

                current_soc += charge_amount
                deltas[i] = charge_amount

                # Cost of charging (buying electricity)
                # Negative revenue = cost
                revenues[i] = -charge_amount * price

            elif action == "DISCHARGE":
                # How much can we discharge?
                discharge_amount = min(cfg.discharge_rate, current_soc)

                current_soc -= discharge_amount
                deltas[i] = -discharge_amount

                # Revenue from discharging (selling electricity)
                # Apply efficiency: we deliver less than we stored
                delivered = discharge_amount * cfg.efficiency
                revenues[i] = delivered * price

            else:  # HOLD
                deltas[i] = 0.0
                revenues[i] = 0.0

            actions[i] = action
            socs[i] = current_soc

        result["action"] = actions
        result["soc"] = socs
        result["energy_delta"] = deltas
        result["revenue"] = revenues

        logger.info("  Battery simulation complete: %d steps", n)
        return result

    def summarize(self, results: pd.DataFrame) -> dict:
        """
        Generate summary statistics from simulation results.

        Returns dict with:
            total_profit, total_revenue, total_cost,
            charge_count, discharge_count, hold_count,
            avg_charge_price, avg_discharge_price,
            total_energy_charged, total_energy_discharged,
            final_soc, cycles, capacity_utilization
        """
        charges = results[results["action"] == "CHARGE"]
        discharges = results[results["action"] == "DISCHARGE"]
        holds = results[results["action"] == "HOLD"]

        total_revenue = results.loc[results["revenue"] > 0, "revenue"].sum()
        total_cost = abs(results.loc[results["revenue"] < 0, "revenue"].sum())
        total_profit = results["revenue"].sum()

        total_charged = charges["energy_delta"].sum()
        total_discharged = abs(discharges["energy_delta"].sum())

        # Average prices during charge/discharge
        avg_charge_price = (
            charges["price"].mean() if len(charges) > 0 else 0.0
        )
        avg_discharge_price = (
            discharges["price"].mean() if len(discharges) > 0 else 0.0
        )

        # Cycles = total energy throughput / capacity
        cycles = total_discharged / self.config.capacity if self.config.capacity > 0 else 0

        # Capacity utilization: % of time battery was > 10% SOC
        active_hours = (results["soc"] > self.config.capacity * 0.1).sum()
        utilization = 100 * active_hours / len(results) if len(results) > 0 else 0

        return {
            "total_profit": round(total_profit, 2),
            "total_revenue": round(total_revenue, 2),
            "total_cost": round(total_cost, 2),
            "charge_count": len(charges),
            "discharge_count": len(discharges),
            "hold_count": len(holds),
            "avg_charge_price": round(avg_charge_price, 2),
            "avg_discharge_price": round(avg_discharge_price, 2),
            "total_energy_charged": round(total_charged, 2),
            "total_energy_discharged": round(total_discharged, 2),
            "final_soc": round(results["soc"].iloc[-1], 2) if len(results) > 0 else 0,
            "cycles": round(cycles, 1),
            "capacity_utilization_pct": round(utilization, 1),
            "spread": round(avg_discharge_price - avg_charge_price, 2),
        }

    def print_report(self, results: pd.DataFrame) -> None:
        """Print a comprehensive battery simulation report."""

        summary = self.summarize(results)
        cfg = self.config

        print("\n" + "═" * 60)
        print("  🔋 BATTERY SIMULATION REPORT")
        print("═" * 60)

        print(f"\n  ⚙️  Configuration:")
        print(f"     Capacity       : {cfg.capacity:.0f} units")
        print(f"     Charge rate    : {cfg.charge_rate:.0f} units/h")
        print(f"     Discharge rate : {cfg.discharge_rate:.0f} units/h")
        print(f"     Efficiency     : {cfg.efficiency * 100:.0f}%")
        print(f"     Initial SOC    : {cfg.initial_soc:.0f} units")

        print(f"\n  💰 Financial Summary:")
        profit = summary["total_profit"]
        emoji = "📈" if profit > 0 else "📉"
        print(f"     {emoji} Total Profit   : {profit:,.2f} EUR")
        print(f"     Revenue (sales) : {summary['total_revenue']:,.2f} EUR")
        print(f"     Cost (purchases): {summary['total_cost']:,.2f} EUR")
        print(f"     Price spread    : {summary['spread']:.2f} EUR/MWh")

        print(f"\n  🔄 Operations:")
        print(f"     Charge hours    : {summary['charge_count']:,}")
        print(f"     Discharge hours : {summary['discharge_count']:,}")
        print(f"     Hold hours      : {summary['hold_count']:,}")
        print(f"     Total cycles    : {summary['cycles']:.1f}")
        print(f"     Energy charged  : {summary['total_energy_charged']:,.0f} units")
        print(f"     Energy discharged: {summary['total_energy_discharged']:,.0f} units")

        print(f"\n  📊 Pricing:")
        print(f"     Avg charge price    : {summary['avg_charge_price']:.2f} EUR/MWh")
        print(f"     Avg discharge price : {summary['avg_discharge_price']:.2f} EUR/MWh")

        print(f"\n  🔋 State:")
        print(f"     Final SOC           : {summary['final_soc']:.0f} / {cfg.capacity:.0f} units")
        print(f"     Capacity utilization: {summary['capacity_utilization_pct']:.1f}%")

        # ── Daily profit breakdown (top 10 best days) ─
        if "datetime" in results.columns:
            daily = results.groupby(results["datetime"].dt.date)["revenue"].sum()
            daily = daily.sort_values(ascending=False)

            print(f"\n  📅 Top 10 Most Profitable Days:")
            for date, rev in daily.head(10).items():
                print(f"     {date}  →  {rev:+,.2f} EUR")

            print(f"\n  📅 Top 5 Worst Days:")
            for date, rev in daily.tail(5).items():
                print(f"     {date}  →  {rev:+,.2f} EUR")

        print("\n" + "═" * 60)


# ── CLI entry point ──────────────────────────────────

if __name__ == "__main__":
    # Quick test with synthetic price data
    np.random.seed(42)
    n = 24 * 30  # 30 days

    prices = np.random.normal(50, 35, n)
    prices = np.clip(prices, -10, 200)

    df = pd.DataFrame({
        "datetime": pd.date_range("2025-01-01", periods=n, freq="h"),
        "price": prices,
        "hour": [h % 24 for h in range(n)],
    })

    sim = BatterySimulator()
    results = sim.run(df)
    sim.print_report(results)
