# BG Energy Dashboard

A comprehensive, dark-themed Bulgarian energy market dashboard and analytics pipeline featuring **live IBEX DAM data** integration, advanced historical data exploration, meteorological tracking, and battery storage simulation.

## Core Features

### 🌐 Frontend Web Application (Vanilla JS / Vite)
- 📊 **14 time-series charts** — Spot price, Residual Load, Wind, Solar, Nuclear, Hydro, and more with overlaid forecast models (EC, ECsr, GFS, ICON, ICONsr).
- 🔴 **Live IBEX Integration** — Real-time day-ahead market spot prices from [ibex.bg](https://ibex.bg) updated automatically via Node.js proxy.
- 🕒 **Historical Data Explorer** — Full-page interactive analyzer featuring custom date pickers, Year-over-Year (YoY) curve matching, 7d/30d rolling averages, weekly ISO profiles, and day-over-day (Δ%) tables.
- 📉 **IBEX Analysis Suite** — Strategic insight layer including Market Regime Comparisons (2025 vs 2026), Battery Arbitrage Optimization tools (with efficiency modeling), and AI-driven decision support panels.
- 🌤️ **Weather Dashboard** — Predictive 7-day visualizations utilizing Open-Meteo API, dynamic signal metric cards (Solar Surplus, Temp Spikes), and interactive calendar heatmaps. 
- 📈 **Smart Overlays** — Correlation layers for price against Temperature (°C) or Solar Output (W/m²) dual axes.
- 🌓 **Dual-Theme Support** — Responsive, high-performance UI with a dynamic light/dark mode toggle and polished HSL color systems.
- 🎨 **Modern Design** — Utilizes `Inter` typography, glassmorphism effects, and premium SVG iconography.

### 🐍 Backend Analytics Pipeline (Python)
- 🔄 **Data Loading Engine** — Scrapes JSON and merges historical (2025/2026) Excel files cleanly through `src/data_loader.py`.
- 🌦️ **Meteorological Sync** — `src/weather_loader.py` fetches dense local coordinate weather directly from the Open-Meteo Archive without requiring API keys.
- ⚡ **Signal Detection** — Computes custom multi-dimensional conditions (e.g. `solar_surplus`, `wind_dump`, `cold_spike`, `high_price`) to build a robust trading timeline via `src/signals.py`.
- 🔋 **Battery Storage Simulator** — An algorithmic `WeatherAwareBatterySimulator` (`src/battery_logic.py`) calibrates charge/discharge windows utilizing confidence thresholds and generates projected profitability comparisons.

## Tech Stack

- **Frontend**: Vanilla JS, Vite, Chart.js 
- **Live Proxy**: Node.js
- **Backend Analytics**: Python 3, Pandas, Open-Meteo API

## Quick Start

### 1. Web Application
```bash
# Install dependencies
npm install

# Run Unified Production Server (Best for demo)
# This serves the frontend and proxy from a single port (3001)
npm run build
npm start

# Run Development Server (Port 5173)
# Uses mock data unless the proxy is running separately
npm run dev

# Run Proxy Server separately (Port 3001)
npm run server
```
> The production server runs on **http://localhost:3001/**, the dev server on **http://localhost:5173/**.

### 2. Python Analytics CLI
Ensure you have `pandas` installed globally or in your virtual environment:
```bash
pip install pandas
```

Run advanced operations through the main CLI pipeline:
```bash
# Run the complete data simulation pipeline and export CSVs
python3 src/main.py pipeline

# Run comparative battery strategy simulations (Basic vs Weather-Aware)
python3 src/main.py compare

# Only fetch the latest weather logs
python3 src/main.py weather
```
Generated reports and battery simulation logs are securely saved into `/output/`.

### 3. Data Export (for UI)
Before using the Historical Explorer or Analysis Suite, you must export the latest Excel/CSV data to JSON:
```bash
# Export historical records for the Data Explorer
python3 src/export_historical.py

# Export pre-calculated analysis for the Analysis Suite
python3 src/export_analysis.py
```

## Architecture Overview

```text
bg-energy-dashboard/
├── server/
│   └── proxy.js             ← IBEX API scraper / Live Proxy (port 3001)
├── output/                  ← Generated CSV datasets from the CLI
├── src/
│   ├── components/          ← HistoricalExplorer, Analysis Suite, WeatherDashboard, Charts
│   ├── data/                ← dataService, ibexService, analysisDataService
│   ├── styles/              ← Organized CSS design system
│   ├── main.js              ← Frontend app entry & routing
│   ├── main.py              ← Python CLI Analytics controller
│   ├── export_historical.py ← Export JSON for Historical Explorer
│   ├── export_analysis.py   ← Export JSON for Analysis Suite
│   ├── battery_logic.py     ← Storage Simulation classes
│   ├── data_loader.py       ← Merge data source logic
│   ├── signals.py           ← Price/Weather algorithmic evaluation
│   └── weather_loader.py    ← Open-Meteo integration
└── vite.config.js
```

## License

MIT
