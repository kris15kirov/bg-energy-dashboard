// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Constants
// ═══════════════════════════════════════════════════════

export const MODELS = [
    { id: 'ec', label: 'EC', color: '#f368e0' },
    { id: 'ecsr', label: 'ECsr', color: '#c44dcc' },
    { id: 'gfs', label: 'GFS', color: '#0abde3' },
    { id: 'icon', label: 'ICON', color: '#feca57' },
    { id: 'iconsr', label: 'ICONsr', color: '#10ac84' },
];

export const ACTUAL_COLOR = '#ff9f43';

export const RESOLUTIONS = ['15min', '30min', 'Hourly', 'Base', 'Peak'];

export const NEIGHBORS = ['GR', 'MK', 'RO', 'RS', 'TR'];

export const SIDEBAR_NAV = [
    {
        group: 'MARKET',
        items: [
            { id: 'overview', label: 'Overview' },
            { id: 'spot-exchange', label: 'Spot & Exchange' },
            { id: 'balancing', label: 'Balancing' },
            { id: 'capture-prices', label: 'Capture Prices' },
            { id: 'qh-monthly-stats', label: 'QH Monthly Stats' },
        ]
    },
    {
        group: 'OUTLOOKS',
        items: [
            { id: 'outlook-72h', label: '72 Hours' },
            { id: 'outlook-15d', label: '15 Days' },
            { id: 'outlook-45d', label: '45 Days' },
        ]
    },
    {
        group: 'FUNDAMENTALS',
        items: [
            { id: 'residual-load', label: 'Residual Load' },
            { id: 'consumption', label: 'Consumption' },
            { id: 'wind-power', label: 'Wind Power' },
            { id: 'solar-power', label: 'Solar Power' },
            { id: 'nuclear', label: 'Nuclear' },
            { id: 'hydro', label: 'Hydro' },
            { id: 'thermal', label: 'Thermal' },
            { id: 'exchange', label: 'Cross-border Exchange' },
        ]
    },
    {
        group: 'WEATHER',
        items: [
            { id: 'temperature', label: 'Temperature' },
            { id: 'precipitation', label: 'Precipitation' },
        ]
    }
];

export const TOP_NAV_MODULES = [
    { id: 'short-term', label: 'Short term', active: true },
    { id: 'medium-term', label: 'Medium term', active: false },
    { id: 'fundamentals', label: 'Fundamentals', active: false },
    { id: 'weather', label: 'Weather', active: false },
    { id: 'data-explorer', label: 'Data Explorer', active: false },
];

export const CHART_CONFIGS = [
    // Price and Exchange
    { id: 'spot-price', section: 'Price and Exchange', title: 'Spot price', unit: 'EUR/MWh', dataKey: 'spotPrice' },
    { id: 'net-export', section: 'Price and Exchange', title: 'Day-ahead net export schedule', unit: 'MWh/h', dataKey: 'netExport' },
    // Residual
    { id: 'res-prod', section: 'Residual', title: 'Residual production day-ahead', unit: 'MWh/h', dataKey: 'residualProd' },
    { id: 'res-load', section: 'Residual', title: 'Residual load', unit: 'MWh/h', dataKey: 'residualLoad' },
    // Fundamentals
    { id: 'consumption', section: 'Fundamentals', title: 'Consumption', unit: 'MWh/h', dataKey: 'consumption' },
    { id: 'solar', section: 'Fundamentals', title: 'Solar photovoltaic', unit: 'MWh/h', dataKey: 'solar' },
    { id: 'wind', section: 'Fundamentals', title: 'Wind power', unit: 'MWh/h', dataKey: 'wind' },
    { id: 'nuclear', section: 'Fundamentals', title: 'Nuclear', unit: 'MWh/h', dataKey: 'nuclear' },
    { id: 'gas', section: 'Fundamentals', title: 'Natural gas', unit: 'MWh/h', dataKey: 'gas' },
    { id: 'coal', section: 'Fundamentals', title: 'Hard coal', unit: 'MWh/h', dataKey: 'coal' },
    { id: 'lignite', section: 'Fundamentals', title: 'Lignite', unit: 'MWh/h', dataKey: 'lignite' },
    { id: 'hydro', section: 'Fundamentals', title: 'Reservoir (Hydro)', unit: 'MWh/h', dataKey: 'hydro' },
    // Weather
    { id: 'temperature', section: 'Weather', title: 'Temperature (consumption-weighted)', unit: '°C', dataKey: 'temperature' },
    { id: 'precipitation', section: 'Weather', title: 'Precipitation energy', unit: 'mm', dataKey: 'precipitation' },
];

export const SPOT_TABS = ['Forecasts', 'Ensembles', 'Spreads', 'History', 'Benchmark', 'Map'];

export const COMMENTARY_TABS = ['Spot & Fundamentals', 'Shifts', 'REMIT', 'Weather'];
