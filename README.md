# ⚡ BG Energy Dashboard

A state-of-the-art, high-performance Bulgarian energy market intelligence platform. This dashboard provides **live day-ahead market data**, advanced meteorological analytics, historical price exploration, and AI-driven battery storage simulations.

## 🚀 Key Features

### 🌐 Intelligent Web Application (Vite / Vanilla JS)
- 📊 **Real-time Market Insights** — Live IBEX spot prices scraped directly from [ibex.bg](https://ibex.bg) via a secure Node.js proxy with automated CSRF handling.
- 📱 **100% Mobile Responsive** — Modern off-canvas navigation system (hamburger menu) and adaptive layouts for smartphones, tablets, and desktops.
- 🕒 **Historical Data Explorer** — Full-page interactive analyzer featuring custom date pickers, Year-over-Year (YoY) curve matching, 7d/30d rolling averages, and ISO week profiles.
- 📉 **Advanced Analysis Suite** — Strategic layer with Market Regime Comparisons (2025 vs 2026), Battery Arbitrage Optimization (with efficiency modeling), and algorithmic decision panels.
- 🌤️ **Meteorological Forecasts** — 7-day predictive dashboard utilizing the Open-Meteo Forecast API, featuring Solar Surplus signals, Temperature spikes, and interactive heatmaps. 
- 📈 **Dynamic Overlays** — Correlation layers allowing price comparison against Temperature (°C) or Solar Radiation (W/m²) on dual-axis charts.
- 🌓 **Premium UI/UX** — High-contrast design system with a robust component-based architecture, card-styled contact modules, and accessible mobile navigation (with explicit menu labeling).

### 🐍 Backend Analytics Engine (Python)
- 🔄 **Unified Pipeline** — Scrapes, cleans, and merges multi-year Excel datasets through `src/data_loader.py`.
- 🌦️ **Weather Intelligence** — `src/weather_loader.py` fetches dense local coordinate weather data (Temperature, Wind, Cloud Cover, Radiation) for precise correlation.
- ⚡ **Signal Algorithm** — Computes complex market conditions (e.g., `solar_surplus`, `wind_dump`, `cold_spike`) to identify trading opportunities.
- 🔋 **Battery Optimizer** — A sophisticated `WeatherAwareBatterySimulator` (`src/battery_logic.py`) that uses confidence thresholds to project storage profitability.

## 🛠️ Tech Stack

- **Frontend**: Vanilla ES6+ JavaScript, Vite, Chart.js (Time-series / Bar / Line)
- **Live Server**: Express 5 (Unified Production Server & Proxy)
- **Data Science**: Python 3.12+, Pandas, Open-Meteo API integration

## 🏃 Quick Start

### 1. Run the Web Dashboard
```bash
# Install dependencies
npm install

# Option A: Production Mode (Recommended)
# Serves both Frontend and IBEX Proxy on port 3001
npm run build
npm start

# Option B: Development Mode
# Runs Vite HMR on port 5173. 
# Note: Requires 'npm run server' in a separate terminal for live data.
npm run dev
```

### 2. Python Analytics CLI
Ensure you have the required dependencies:
```bash
pip install pandas
```

Run the analytics pipeline:
```bash
# Run the complete data pipeline and export results to CSV
python3 src/main.py pipeline

# Run comparative battery strategy simulations
python3 src/main.py compare

# Fetch the latest weather data logs
python3 src/main.py weather
```

### 3. Sync Data for the UI
Before using the **Historical Explorer** or **Analysis Suite**, generate the required JSON exports:
```bash
# Export records for the Historical Explorer
python3 src/export_historical.py

# Export metrics for the Analysis Suite
python3 src/export_analysis.py
```

## 📂 Architecture Overview

```text
bg-energy-dashboard/
├── server/
│   └── proxy.js             ← IBEX Scraper & Express 5 Production Server
├── src/
│   ├── components/          ← Modular UI: Explorer, Suite, Dashboard, Charts
│   ├── data/                ← Services: dataService, weatherService, analysisData
│   ├── styles/              ← Design System: layout, components, charts, IBEX-tables
│   ├── main.js              ← Frontend router and state manager
│   ├── main.py              ← Python CLI Analytics controller
│   ├── battery_logic.py     ← Core storage simulation logic
│   ├── data_loader.py       ← Historical data merging engine
│   └── export_historical.py ← JSON generator for the explorer
└── output/                  ← Generated CSV reports and simulation logs
```

## 📜 License
This project is licensed under the MIT License.
