# BG Energy Dashboard

A professional, dark-themed Bulgarian energy market dashboard with **live IBEX DAM data** integration.

![Dashboard Screenshot](docs/screenshot.png)

## Features

- 📊 **14 time-series charts** — Spot price, Wind, Solar, Nuclear, Hydro, and more
- 🔴 **Live IBEX data** — Real day-ahead market spot prices from [ibex.bg](https://ibex.bg)
- 📈 **5 forecast models** — EC, ECsr, GFS, ICON, ICONsr with diverging lines
- 📋 **Dense data table** — Hourly values with color-coded deviations
- 💬 **Market commentary** — Settlement analysis, key drivers, bull/bear signals
- 🎨 **Dark theme** — Professional UI with Inter typography

## Tech Stack

- **Vite** — Dev server & build tool
- **Chart.js** — Time-series charting
- **Vanilla JS** — No framework overhead
- **Node.js** — IBEX proxy server

## Quick Start

```bash
# Install dependencies
npm install

# Run with live IBEX data (proxy + frontend)
npm start

# Run frontend only (mock data)
npm run dev
```

Dashboard at **http://localhost:5173/**

## Architecture

```
bg-energy-dashboard/
├── server/proxy.js          ← IBEX API proxy (port 3001)
├── src/
│   ├── main.js              ← App entry, routing, state
│   ├── data/
│   │   ├── ibexService.js   ← IBEX API client
│   │   ├── dataService.js   ← Hybrid mock/live data
│   │   ├── mockDataGenerator.js
│   │   └── constants.js
│   ├── components/          ← TopNav, Sidebar, Charts, Table
│   ├── utils/               ← Formatters, chart config
│   └── styles/              ← CSS design system
├── vite.config.js
└── package.json
```

## IBEX Integration

The dashboard fetches real spot prices from the Bulgarian Independent Energy Exchange (IBEX) via a Node.js proxy that handles session management and CSRF tokens.

- `npm start` — Runs both proxy and Vite (live data)
- `npm run dev` — Runs frontend only (falls back to mock data)
- `npm run proxy` — Runs proxy server standalone

## License

MIT
