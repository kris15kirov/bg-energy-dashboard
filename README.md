# BG Energy Dashboard

A comprehensive, dark-themed Bulgarian energy market dashboard and analytics pipeline featuring **live IBEX DAM data** integration, advanced historical data exploration, meteorological tracking, and battery storage simulation.

## Core Features

### 🌐 Frontend Web Application (Vanilla JS / Vite)
- 📊 **14 time-series charts** — Spot price, Residual Load, Wind, Solar, Nuclear, Hydro, and more with overlaid forecast models (EC, ECsr, GFS, ICON, ICONsr).
- 🔴 **Live IBEX Integration** — Real-time day-ahead market spot prices from [ibex.bg](https://ibex.bg) updated automatically via Node.js proxy.
- 🕒 **Historical Data Explorer** — Full-page interactive analyzer featuring custom date pickers, Year-over-Year (YoY) curve matching, 7d/30d rolling averages, weekly ISO profiles, and day-over-day (Δ%) tables.
- 🌤️ **Weather Dashboard** — Predictive 7-day visualizations utilizing Open-Meteo API, dynamic signal metric cards (Solar Surplus, Temp Spikes), and interactive calendar heatmaps. 
- 📈 **Smart Overlays** — Easily correlate price charts against Temperature (°C) or Solar Output (W/m²) dual axes.
- 🎨 **Modern Dark Theme** — Responsive, data-dense UI with `Inter` typography.

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

# Run with live IBEX data (requires active internet access to IBEX)
npm start

# Run frontend only (mock data fallback)
npm run dev

# Run proxy server standalone
npm run proxy
```
> The dashboard will run on **http://localhost:5173/**

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

## Architecture Overview

```text
bg-energy-dashboard/
├── server/
│   └── proxy.js             ← IBEX API scraper / Live Proxy (port 3001)
├── output/                  ← Generated CSV datasets from the CLI
├── src/
│   ├── components/          ← HistoricalExplorer, WeatherDashboard, Charts
│   ├── data/                ← dataService, ibexService, weatherService
│   ├── styles/              ← Organized CSS design system
│   ├── main.js              ← Frontend app entry & routing
│   ├── main.py              ← Python CLI Analytics controller
│   ├── battery_logic.py     ← Storage Simulation classes
│   ├── data_loader.py       ← Merge data source logic
│   ├── signals.py           ← Price/Weather algorithmic evaluation
│   └── weather_loader.py    ← Open-Meteo integration
└── vite.config.js
```

## License

MIT
