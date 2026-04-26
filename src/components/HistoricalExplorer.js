// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Historical Data Explorer
//
// Full-page view for exploring IBEX historical price data
// with year/quarter/month dropdown filters, date range picker,
// YoY comparison, rolling averages, daily deltas, weekly view,
// summary cards, time-series charts, and data table.
// ═══════════════════════════════════════════════════════

import { Chart, LineController, BarController, LineElement, BarElement, PointElement,
         LinearScale, TimeScale, CategoryScale, Tooltip, Filler, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns';
import {
    loadHistoricalData, filterRecords, getFilterOptions,
    computeStats, dailyAverages, hourlyProfile, monthlySummary,
    dailyAveragesWithDelta, computeRollingAverage, weeklyAverages,
    computeYoYComparison, filterByDateRange,
    MONTH_NAMES, MONTH_SHORT,
} from '../data/historicalDataService.js';

Chart.register(LineController, BarController, LineElement, BarElement, PointElement,
               LinearScale, TimeScale, CategoryScale, Tooltip, Filler, Legend);

// ── State ────────────────────────────────────────────

let allRecords = [];
let filteredData = [];
let filterState = { year: null, quarter: 'All', month: 0, dateFrom: null, dateTo: null };

let priceChart = null;
let hourlyChart = null;
let monthlyChart = null;
let yoyChart = null;
let weeklyChart = null;

// ── Main Export ──────────────────────────────────────

export async function createHistoricalExplorer() {
    const container = document.createElement('div');
    container.className = 'hist-explorer';
    container.id = 'historical-explorer';

    // Loading state
    container.innerHTML = `
        <div class="hist-explorer__loading">
            <div class="hist-explorer__spinner"></div>
            <p>Loading historical IBEX data…</p>
        </div>
    `;

    // Load data asynchronously
    try {
        const data = await loadHistoricalData();
        allRecords = data.records;
        
        const maxDate = allRecords.length > 0 ? allRecords.map(r => r.datetime).reduce((a, b) => a > b ? a : b) : new Date();
        const endOfMaxDay = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59);
        const startOf7DaysAgo = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 0, 0, 0);
        startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 7);
        
        filterState.year = null;
        filterState.quarter = 'All';
        filterState.month = 0;
        filterState.dateFrom = startOf7DaysAgo;
        filterState.dateTo = endOfMaxDay;
        
        filteredData = allRecords;
        container.innerHTML = '';
        renderExplorer(container, data.meta);
    } catch (err) {
        container.innerHTML = `
            <div class="hist-explorer__error">
                <h3>⚠️ Failed to load historical data</h3>
                <p>${err.message}</p>
                <p class="hist-explorer__error-hint">
                    Run <code>python3 src/export_historical.py</code> to generate the data file.
                </p>
            </div>
        `;
    }

    return container;
}

// ── Render ───────────────────────────────────────────

function renderExplorer(container, meta) {
    // Header
    const header = document.createElement('div');
    header.className = 'hist-explorer__header';
    header.innerHTML = `
        <div class="hist-explorer__title-row">
            <h2 class="hist-explorer__title">📊 Historical IBEX Price Explorer</h2>
            <div class="hist-explorer__meta">
                <span class="hist-explorer__meta-item">${meta.totalRows.toLocaleString()} records</span>
                <span class="hist-explorer__meta-sep">•</span>
                <span class="hist-explorer__meta-item">${meta.uniqueDays} days</span>
                <span class="hist-explorer__meta-sep">•</span>
                <span class="hist-explorer__meta-item">${meta.dateRange.start.slice(0, 10)} → ${meta.dateRange.end.slice(0, 10)}</span>
            </div>
        </div>
    `;
    container.appendChild(header);

    // Filter bar
    container.appendChild(createFilterBar());

    // Stats cards
    const statsRow = document.createElement('div');
    statsRow.className = 'hist-explorer__stats';
    statsRow.id = 'hist-stats';
    container.appendChild(statsRow);

    // Charts area (row 1: full-width price history)
    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'hist-explorer__charts-grid';

    // Price chart (with rolling averages)
    const priceCard = createChartCard('hist-price-chart', 'Price History', 'Daily avg + 7d / 30d rolling — EUR/MWh');
    chartsGrid.appendChild(priceCard);

    // Hourly profile chart
    const hourlyCard = createChartCard('hist-hourly-chart', 'Hourly Price Profile', 'Average price by hour of day');
    hourlyCard.classList.add('hist-explorer__chart-card--half');
    chartsGrid.appendChild(hourlyCard);

    // Monthly chart
    const monthlyCard = createChartCard('hist-monthly-chart', 'Monthly Averages', 'Average price by month');
    monthlyCard.classList.add('hist-explorer__chart-card--half');
    chartsGrid.appendChild(monthlyCard);

    // YoY comparison chart
    const yoyCard = createChartCard('hist-yoy-chart', 'Year-over-Year Comparison', 'Same day overlay across years');
    chartsGrid.appendChild(yoyCard);

    // Weekly averages chart
    const weeklyCard = createChartCard('hist-weekly-chart', 'Weekly Averages', 'Avg price per ISO week');
    chartsGrid.appendChild(weeklyCard);

    container.appendChild(chartsGrid);

    // Data table (with % change column)
    const tableSection = document.createElement('div');
    tableSection.className = 'hist-explorer__table-section';
    tableSection.id = 'hist-table-section';
    container.appendChild(tableSection);

    // Initial render
    updateView(container);
}

// ── Filter Bar ───────────────────────────────────────

function createFilterBar() {
    const bar = document.createElement('div');
    bar.className = 'hist-explorer__filters';

    const options = getFilterOptions(allRecords);

    // Compute date bounds for the date pickers
    const allDates = allRecords.map(r => r.datetime);
    const minDate = allDates.length > 0 ? allDates.reduce((a, b) => a < b ? a : b) : new Date();
    const maxDate = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : new Date();
    const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    bar.innerHTML = `
        <div class="hist-filter">
            <label class="hist-filter__label" for="hist-filter-year">Year</label>
            <select class="hist-filter__select" id="hist-filter-year" name="year">
                <option value="">All Years</option>
                ${options.years.map(y => `<option value="${y}">${y}</option>`).join('')}
            </select>
        </div>
        <div class="hist-filter">
            <label class="hist-filter__label" for="hist-filter-quarter">Quarter</label>
            <select class="hist-filter__select" id="hist-filter-quarter" name="quarter">
                <option value="All">All Quarters</option>
                <option value="Q1">Q1 (Jan–Mar)</option>
                <option value="Q2">Q2 (Apr–Jun)</option>
                <option value="Q3">Q3 (Jul–Sep)</option>
                <option value="Q4">Q4 (Oct–Dec)</option>
            </select>
        </div>
        <div class="hist-filter">
            <label class="hist-filter__label" for="hist-filter-month">Month</label>
            <select class="hist-filter__select" id="hist-filter-month" name="month">
                <option value="0">All Months</option>
                ${options.months.map(m => `<option value="${m}">${MONTH_NAMES[m]}</option>`).join('')}
            </select>
        </div>
        <div class="hist-filter__separator"></div>
        <div class="hist-filter">
            <label class="hist-filter__label" for="hist-filter-from">From</label>
            <input type="date" class="hist-filter__date" id="hist-filter-from" name="date-from"
                   value="${filterState.dateFrom ? fmtDate(filterState.dateFrom) : ''}"
                   min="${fmtDate(minDate)}" max="${fmtDate(maxDate)}" />
        </div>
        <div class="hist-filter">
            <label class="hist-filter__label" for="hist-filter-to">To</label>
            <input type="date" class="hist-filter__date" id="hist-filter-to" name="date-to"
                   value="${filterState.dateTo ? fmtDate(filterState.dateTo) : ''}"
                   min="${fmtDate(minDate)}" max="${fmtDate(maxDate)}" />
        </div>
        <button class="hist-filter__reset-btn" id="hist-filter-reset" title="Reset all filters">✕ Reset</button>
        <div class="hist-filter__info" id="hist-filter-info">
            <span class="hist-filter__count">${allRecords.length.toLocaleString()} records</span>
        </div>
    `;

    // Event listeners
    bar.querySelector('#hist-filter-year').addEventListener('change', (e) => {
        filterState.year = e.target.value ? parseInt(e.target.value) : null;
        updateView();
    });

    bar.querySelector('#hist-filter-quarter').addEventListener('change', (e) => {
        filterState.quarter = e.target.value;
        // Reset month when quarter changes
        if (filterState.quarter !== 'All') {
            filterState.month = 0;
            bar.querySelector('#hist-filter-month').value = '0';
        }
        updateView();
    });

    bar.querySelector('#hist-filter-month').addEventListener('change', (e) => {
        filterState.month = parseInt(e.target.value);
        // Reset quarter when specific month is selected
        if (filterState.month !== 0) {
            filterState.quarter = 'All';
            bar.querySelector('#hist-filter-quarter').value = 'All';
        }
        updateView();
    });

    bar.querySelector('#hist-filter-from').addEventListener('change', (e) => {
        filterState.dateFrom = e.target.value ? new Date(e.target.value) : null;
        updateView();
    });

    bar.querySelector('#hist-filter-to').addEventListener('change', (e) => {
        filterState.dateTo = e.target.value ? new Date(e.target.value + 'T23:59:59') : null;
        updateView();
    });

    bar.querySelector('#hist-filter-reset').addEventListener('click', () => {
        const maxDate = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : new Date();
        const endOfMaxDay = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59);
        const startOf7DaysAgo = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 0, 0, 0);
        startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 7);

        filterState = { year: null, quarter: 'All', month: 0, dateFrom: startOf7DaysAgo, dateTo: endOfMaxDay };
        bar.querySelector('#hist-filter-year').value = '';
        bar.querySelector('#hist-filter-quarter').value = 'All';
        bar.querySelector('#hist-filter-month').value = '0';
        bar.querySelector('#hist-filter-from').value = fmtDate(startOf7DaysAgo);
        bar.querySelector('#hist-filter-to').value = fmtDate(endOfMaxDay);
        updateView();
    });

    return bar;
}

// ── Update View ──────────────────────────────────────

function updateView(root = document) {
    // Apply dropdown filters first
    let data = filterRecords(allRecords, filterState);
    // Then apply date range
    data = filterByDateRange(data, filterState.dateFrom, filterState.dateTo);
    filteredData = data;

    // Update filter info
    const info = root.querySelector('#hist-filter-info') || document.getElementById('hist-filter-info');
    if (info) {
        info.innerHTML = `<span class="hist-filter__count">${filteredData.length.toLocaleString()} records</span>`;
    }

    updateStatsCards(root);
    updatePriceChart(root);
    updateHourlyChart(root);
    updateMonthlyChart(root);
    updateYoYChart(root);
    updateWeeklyChart(root);
    updateDataTable(root);
}

// ── Stats Cards ──────────────────────────────────────

function updateStatsCards(root = document) {
    const container = root.querySelector('#hist-stats') || document.getElementById('hist-stats');
    if (!container) return;

    const stats = computeStats(filteredData);

    // Compute week-over-week and daily change context
    const daily = dailyAveragesWithDelta(filteredData);
    const latestDelta = daily.length > 1 ? daily[daily.length - 1] : null;
    const deltaHtml = latestDelta && latestDelta.deltaPct !== null
        ? `<div class="hist-stat-card">
                <div class="hist-stat-card__icon">${latestDelta.deltaPct >= 0 ? '📈' : '📉'}</div>
                <div class="hist-stat-card__content">
                    <div class="hist-stat-card__value ${latestDelta.deltaPct >= 0 ? 'hist-stat-card__val--up' : 'hist-stat-card__val--down'}">${latestDelta.deltaPct >= 0 ? '+' : ''}${latestDelta.deltaPct.toFixed(1)}%</div>
                    <div class="hist-stat-card__label">Latest Day Δ</div>
                </div>
           </div>`
        : '';

    container.innerHTML = `
        <div class="hist-stat-card">
            <div class="hist-stat-card__icon">📈</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.avgPrice.toFixed(2)}</div>
                <div class="hist-stat-card__label">Avg Price (EUR/MWh)</div>
            </div>
        </div>
        <div class="hist-stat-card">
            <div class="hist-stat-card__icon">📊</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.medianPrice.toFixed(2)}</div>
                <div class="hist-stat-card__label">Median Price</div>
            </div>
        </div>
        <div class="hist-stat-card hist-stat-card--low">
            <div class="hist-stat-card__icon">📉</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.minPrice.toFixed(2)}</div>
                <div class="hist-stat-card__label">Min Price</div>
            </div>
        </div>
        <div class="hist-stat-card hist-stat-card--high">
            <div class="hist-stat-card__icon">🔺</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.maxPrice.toFixed(2)}</div>
                <div class="hist-stat-card__label">Max Price</div>
            </div>
        </div>
        <div class="hist-stat-card">
            <div class="hist-stat-card__icon">📅</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.days}</div>
                <div class="hist-stat-card__label">Days of Data</div>
            </div>
        </div>
        <div class="hist-stat-card">
            <div class="hist-stat-card__icon">σ</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.stdPrice.toFixed(2)}</div>
                <div class="hist-stat-card__label">Std Deviation</div>
            </div>
        </div>
        <div class="hist-stat-card hist-stat-card--negative">
            <div class="hist-stat-card__icon">⚡</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.negativeHours}</div>
                <div class="hist-stat-card__label">Negative Price Hours</div>
            </div>
        </div>
        <div class="hist-stat-card hist-stat-card--signal">
            <div class="hist-stat-card__icon">🔋</div>
            <div class="hist-stat-card__content">
                <div class="hist-stat-card__value">${stats.lowHours} / ${stats.highHours}</div>
                <div class="hist-stat-card__label">Low (&lt;20) / High (&gt;70)</div>
            </div>
        </div>
        ${deltaHtml}
    `;
}

// ── Chart Helpers ────────────────────────────────────

function createChartCard(canvasId, title, subtitle) {
    const card = document.createElement('div');
    card.className = 'hist-explorer__chart-card';
    card.innerHTML = `
        <div class="hist-explorer__chart-header">
            <span class="hist-explorer__chart-title">${title}</span>
            <span class="hist-explorer__chart-subtitle">${subtitle}</span>
        </div>
        <div class="hist-explorer__chart-body">
            <canvas id="${canvasId}"></canvas>
        </div>
    `;
    return card;
}

function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    const get = (name, fb) => style.getPropertyValue(name).trim() || fb;
    return {
        text: get('--text-muted', '#64748b'),
        title: get('--text-primary', '#e2e8f0'),
        grid: get('--border-color', 'rgba(255,255,255,0.04)'),
        tooltipBg: get('--bg-secondary', '#0f2218'),
        tooltipBorder: get('--border-light', 'rgba(255,255,255,0.1)'),
        accent: get('--accent-actual', '#ff9f43'),
        positive: get('--color-positive', '#2ed573'),
        negative: get('--color-negative', '#ee5a6f'),
        info: get('--color-info', '#3498db'),
        gfs: get('--accent-gfs', '#0abde3'),
        ec: get('--accent-ec', '#f368e0'),
    };
}

function baseTooltip(colors) {
    return {
        backgroundColor: colors.tooltipBg,
        titleColor: colors.title,
        bodyColor: colors.text,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        bodyFont: { family: 'Inter', size: 11 },
        titleFont: { family: 'Inter', size: 12, weight: '600' },
    };
}

// ── Price Chart (with Rolling Averages) ──────────────

function updatePriceChart(root = document) {
    const canvas = root.querySelector('#hist-price-chart') || document.getElementById('hist-price-chart');
    if (!canvas) return;

    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }

    const daily = dailyAverages(filteredData);
    if (daily.length === 0) return;

    const rolling7 = computeRollingAverage(daily, 7);
    const rolling30 = computeRollingAverage(daily, 30);
    const colors = getThemeColors();

    priceChart = new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Avg Price',
                    data: daily.map(d => ({ x: d.date.getTime(), y: d.avgPrice })),
                    borderColor: colors.accent,
                    backgroundColor: colors.accent + '20',
                    borderWidth: 1.5,
                    pointRadius: daily.length > 90 ? 0 : 2,
                    pointHoverRadius: 4,
                    tension: 0.3,
                    fill: true,
                    order: 2,
                },
                {
                    label: 'Max Price',
                    data: daily.map(d => ({ x: d.date.getTime(), y: d.maxPrice })),
                    borderColor: colors.negative + '40',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.3,
                    borderDash: [4, 4],
                    order: 3,
                },
                {
                    label: 'Min Price',
                    data: daily.map(d => ({ x: d.date.getTime(), y: d.minPrice })),
                    borderColor: colors.positive + '40',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.3,
                    borderDash: [4, 4],
                    order: 3,
                },
                {
                    label: '7-Day MA',
                    data: rolling7.filter(d => d.rollingAvg !== null).map(d => ({ x: d.date.getTime(), y: d.rollingAvg })),
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    tension: 0.4,
                    order: 1,
                },
                {
                    label: '30-Day MA',
                    data: rolling30.filter(d => d.rollingAvg !== null).map(d => ({ x: d.date.getTime(), y: d.rollingAvg })),
                    borderColor: '#a855f7',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    tension: 0.4,
                    order: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: colors.text,
                        font: { family: 'Inter', size: 11 },
                        boxWidth: 12, boxHeight: 2, padding: 14,
                        usePointStyle: false,
                    },
                },
                tooltip: {
                    ...baseTooltip(colors),
                    callbacks: {
                        title(items) {
                            if (!items.length) return '';
                            const d = new Date(items[0].parsed.x);
                            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                        },
                        label(ctx) {
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} EUR/MWh`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: daily.length > 180 ? 'month' : daily.length > 30 ? 'week' : 'day',
                        displayFormats: { day: 'd MMM', week: 'd MMM', month: 'MMM yyyy' },
                    },
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 }, maxTicksLimit: 14 },
                    border: { display: false },
                },
                y: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 }, maxTicksLimit: 8 },
                    border: { display: false },
                    title: { display: true, text: 'EUR/MWh', color: colors.text, font: { family: 'Inter', size: 11 } },
                },
            },
        },
    });
}

// ── Hourly Profile Chart ─────────────────────────────

function updateHourlyChart(root = document) {
    const canvas = root.querySelector('#hist-hourly-chart') || document.getElementById('hist-hourly-chart');
    if (!canvas) return;

    if (hourlyChart) {
        hourlyChart.destroy();
        hourlyChart = null;
    }

    const profile = hourlyProfile(filteredData);
    if (profile.length === 0) return;

    const colors = getThemeColors();

    // Color bars based on price level
    const avgOfAll = profile.reduce((s, p) => s + p.avgPrice, 0) / 24;
    const barColors = profile.map(p => {
        if (p.avgPrice < avgOfAll * 0.8) return colors.positive + 'cc';
        if (p.avgPrice > avgOfAll * 1.2) return colors.negative + 'cc';
        return colors.gfs + 'cc';
    });

    hourlyChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: profile.map(p => `${String(p.hour).padStart(2, '0')}:00`),
            datasets: [{
                label: 'Avg Price',
                data: profile.map(p => p.avgPrice),
                backgroundColor: barColors,
                borderColor: barColors.map(c => c.replace('cc', 'ff')),
                borderWidth: 1,
                borderRadius: 3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...baseTooltip(colors),
                    callbacks: {
                        label(ctx) {
                            return ` ${ctx.parsed.y.toFixed(2)} EUR/MWh (${profile[ctx.dataIndex].count} hours)`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 9 } },
                    border: { display: false },
                },
                y: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 } },
                    border: { display: false },
                    title: { display: true, text: 'EUR/MWh', color: colors.text, font: { family: 'Inter', size: 10 } },
                },
            },
        },
    });
}

// ── Monthly Chart ────────────────────────────────────

function updateMonthlyChart(root = document) {
    const canvas = root.querySelector('#hist-monthly-chart') || document.getElementById('hist-monthly-chart');
    if (!canvas) return;

    if (monthlyChart) {
        monthlyChart.destroy();
        monthlyChart = null;
    }

    const monthly = monthlySummary(filteredData);
    if (monthly.length === 0) return;

    const colors = getThemeColors();

    monthlyChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: monthly.map(m => `${m.monthName} ${m.year}`),
            datasets: [
                {
                    label: 'Avg Price',
                    data: monthly.map(m => m.avgPrice),
                    backgroundColor: colors.accent + 'bb',
                    borderColor: colors.accent,
                    borderWidth: 1,
                    borderRadius: 3,
                    order: 1,
                },
                {
                    label: 'Min',
                    data: monthly.map(m => m.minPrice),
                    type: 'line',
                    borderColor: colors.positive + '80',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 3,
                    pointBackgroundColor: colors.positive,
                    tension: 0.3,
                    order: 0,
                },
                {
                    label: 'Max',
                    data: monthly.map(m => m.maxPrice),
                    type: 'line',
                    borderColor: colors.negative + '80',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 3,
                    pointBackgroundColor: colors.negative,
                    tension: 0.3,
                    order: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: { color: colors.text, font: { family: 'Inter', size: 10 }, boxWidth: 10, boxHeight: 2, padding: 10 },
                },
                tooltip: {
                    ...baseTooltip(colors),
                    callbacks: {
                        label(ctx) {
                            const m = monthly[ctx.dataIndex];
                            if (ctx.dataset.label === 'Avg Price') {
                                return ` Avg: ${ctx.parsed.y.toFixed(2)} EUR/MWh (${m.days} days, ${m.count} hrs)`;
                            }
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} EUR/MWh`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 9 } },
                    border: { display: false },
                },
                y: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 } },
                    border: { display: false },
                    title: { display: true, text: 'EUR/MWh', color: colors.text, font: { family: 'Inter', size: 10 } },
                },
            },
        },
    });
}

// ── YoY Comparison Chart ─────────────────────────────

const YOY_COLORS = ['#ff9f43', '#3b82f6', '#10b981', '#f43f5e', '#a855f7'];

function updateYoYChart(root = document) {
    const canvas = root.querySelector('#hist-yoy-chart') || document.getElementById('hist-yoy-chart');
    if (!canvas) return;

    if (yoyChart) {
        yoyChart.destroy();
        yoyChart = null;
    }

    // Always compute YoY from ALL records (not filtered) so both years appear
    const yoy = computeYoYComparison(allRecords);
    if (yoy.years.length < 2) {
        // Not enough years — hide chart gracefully
        const card = canvas.closest('.hist-explorer__chart-card');
        if (card) card.style.display = 'none';
        return;
    }

    const card = canvas.closest('.hist-explorer__chart-card');
    if (card) card.style.display = '';

    const colors = getThemeColors();

    const datasets = yoy.years.map((year, idx) => {
        const data = yoy.dailyByYear[year] || [];
        return {
            label: String(year),
            data: data.map(d => ({ x: d.alignedDate.getTime(), y: d.avgPrice })),
            borderColor: YOY_COLORS[idx % YOY_COLORS.length],
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.3,
        };
    });

    yoyChart = new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: colors.text,
                        font: { family: 'Inter', size: 12, weight: '600' },
                        boxWidth: 14, boxHeight: 3, padding: 16,
                    },
                },
                tooltip: {
                    ...baseTooltip(colors),
                    callbacks: {
                        title(items) {
                            if (!items.length) return '';
                            const d = new Date(items[0].parsed.x);
                            return `${MONTH_SHORT[d.getMonth() + 1]} ${d.getDate()}`;
                        },
                        label(ctx) {
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} EUR/MWh`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month', displayFormats: { month: 'MMM' } },
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 }, maxTicksLimit: 12 },
                    border: { display: false },
                    title: { display: true, text: 'Calendar Day (aligned)', color: colors.text, font: { family: 'Inter', size: 11 } },
                },
                y: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 }, maxTicksLimit: 8 },
                    border: { display: false },
                    title: { display: true, text: 'EUR/MWh', color: colors.text, font: { family: 'Inter', size: 11 } },
                },
            },
        },
    });
}

// ── Weekly Averages Chart ────────────────────────────

function updateWeeklyChart(root = document) {
    const canvas = root.querySelector('#hist-weekly-chart') || document.getElementById('hist-weekly-chart');
    if (!canvas) return;

    if (weeklyChart) {
        weeklyChart.destroy();
        weeklyChart = null;
    }

    const weekly = weeklyAverages(filteredData);
    if (weekly.length === 0) return;

    const colors = getThemeColors();

    weeklyChart = new Chart(canvas, {
        type: 'bar',
        data: {
            datasets: [
                {
                    label: 'Weekly Avg',
                    data: weekly.map(w => ({ x: w.weekStartDate.getTime(), y: w.avgPrice })),
                    backgroundColor: colors.gfs + '90',
                    borderColor: colors.gfs,
                    borderWidth: 1,
                    borderRadius: 3,
                    order: 1,
                },
                {
                    label: 'Min',
                    type: 'line',
                    data: weekly.map(w => ({ x: w.weekStartDate.getTime(), y: w.minPrice })),
                    borderColor: colors.positive + '70',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 2,
                    pointBackgroundColor: colors.positive,
                    tension: 0.3,
                    order: 0,
                },
                {
                    label: 'Max',
                    type: 'line',
                    data: weekly.map(w => ({ x: w.weekStartDate.getTime(), y: w.maxPrice })),
                    borderColor: colors.negative + '70',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 2,
                    pointBackgroundColor: colors.negative,
                    tension: 0.3,
                    order: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: { color: colors.text, font: { family: 'Inter', size: 10 }, boxWidth: 10, boxHeight: 2, padding: 10 },
                },
                tooltip: {
                    ...baseTooltip(colors),
                    callbacks: {
                        title(items) {
                            if (!items.length) return '';
                            const d = new Date(items[0].parsed.x);
                            return `Week of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        },
                        label(ctx) {
                            const w = weekly[ctx.dataIndex];
                            if (ctx.dataset.label === 'Weekly Avg') {
                                return ` Avg: ${ctx.parsed.y.toFixed(2)} EUR/MWh (${w.days} days, ${w.hours} hrs)`;
                            }
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} EUR/MWh`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: weekly.length > 26 ? 'month' : 'week',
                        displayFormats: { week: 'd MMM', month: 'MMM yyyy' },
                    },
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 }, maxTicksLimit: 14 },
                    border: { display: false },
                },
                y: {
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { family: 'Inter', size: 10 } },
                    border: { display: false },
                    title: { display: true, text: 'EUR/MWh', color: colors.text, font: { family: 'Inter', size: 10 } },
                },
            },
        },
    });
}

// ── Data Table (with Δ columns) ──────────────────────

function updateDataTable(root = document) {
    const section = root.querySelector('#hist-table-section') || document.getElementById('hist-table-section');
    if (!section) return;

    const daily = dailyAveragesWithDelta(filteredData);

    section.innerHTML = `
        <div class="hist-table__header">
            <h3 class="hist-table__title">📋 Daily Price Table</h3>
            <span class="hist-table__count">${daily.length} days</span>
        </div>
        <div class="hist-table__scroll">
            <table class="hist-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th class="hist-table__num">Avg Price</th>
                        <th class="hist-table__num">Δ Day</th>
                        <th class="hist-table__num">Δ %</th>
                        <th class="hist-table__num">Min</th>
                        <th class="hist-table__num">Max</th>
                        <th class="hist-table__num">Spread</th>
                        <th class="hist-table__num">Hours</th>
                        <th class="hist-table__bar">Distribution</th>
                    </tr>
                </thead>
                <tbody>
                    ${daily.map(d => {
                        const spread = d.maxPrice - d.minPrice;
                        const dayName = d.date.toLocaleDateString('en-US', { weekday: 'short' });
                        const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                        const avgClass = d.avgPrice > 70 ? 'hist-table__val--high' :
                                         d.avgPrice < 20 ? 'hist-table__val--low' : '';
                        // Mini bar showing where avg sits between min and max
                        const globalMax = Math.max(...daily.map(dd => dd.maxPrice), 1);
                        const barWidth = (d.avgPrice / globalMax * 100).toFixed(0);
                        const barColor = d.avgPrice > 70 ? 'var(--color-negative)' :
                                         d.avgPrice < 20 ? 'var(--color-positive)' : 'var(--accent-gfs)';
                        // Delta formatting
                        const deltaAbsStr = d.deltaAbs !== null ? `${d.deltaAbs >= 0 ? '+' : ''}${d.deltaAbs.toFixed(2)}` : '—';
                        const deltaPctStr = d.deltaPct !== null ? `${d.deltaPct >= 0 ? '+' : ''}${d.deltaPct.toFixed(1)}%` : '—';
                        const deltaClass = d.deltaPct === null ? '' :
                                           d.deltaPct > 0 ? 'hist-table__val--up' : 'hist-table__val--down';
                        return `
                            <tr class="${isWeekend ? 'hist-table__row--weekend' : ''}">
                                <td class="hist-table__date">${d.dateStr}</td>
                                <td class="hist-table__day">${dayName}</td>
                                <td class="hist-table__num ${avgClass}">${d.avgPrice.toFixed(2)}</td>
                                <td class="hist-table__num ${deltaClass}">${deltaAbsStr}</td>
                                <td class="hist-table__num ${deltaClass}">${deltaPctStr}</td>
                                <td class="hist-table__num hist-table__val--low">${d.minPrice.toFixed(2)}</td>
                                <td class="hist-table__num hist-table__val--high">${d.maxPrice.toFixed(2)}</td>
                                <td class="hist-table__num">${spread.toFixed(2)}</td>
                                <td class="hist-table__num">${d.count}</td>
                                <td class="hist-table__bar">
                                    <div class="hist-table__bar-track">
                                        <div class="hist-table__bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ── Cleanup ──────────────────────────────────────────

export function destroyHistoricalExplorer() {
    if (priceChart) { priceChart.destroy(); priceChart = null; }
    if (hourlyChart) { hourlyChart.destroy(); hourlyChart = null; }
    if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; }
    if (yoyChart) { yoyChart.destroy(); yoyChart = null; }
    if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }
}
