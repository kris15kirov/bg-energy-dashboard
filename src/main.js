// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Main Entry Point
// ═══════════════════════════════════════════════════════

import './styles/variables.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/charts.css';
import './styles/table.css';
import './styles/animations.css';
import './styles/ibex-table.css';
import './styles/ibex-monthly-stats.css';
import './styles/weather-dashboard.css';
import './styles/historical-explorer.css';
import './styles/analysis-modules.css';

import { createTopNav } from './components/TopNav.js';
import { createSidebar, updateSidebarActive } from './components/Sidebar.js';
import { createFilterBar } from './components/FilterBar.js';
import { TimeSeriesChart } from './components/TimeSeriesChart.js';
import { createCommentary } from './components/Commentary.js';
import { createDataTable } from './components/DataTable.js';
import { createIbexDamTable, scheduleIbexAutoRefresh } from './components/IbexDamTable.js';
import { createIbexMonthlyStatsView } from './components/IbexMonthlyStats.js';
import { WeatherDashboard } from './components/WeatherDashboard.js';
import { createHistoricalExplorer } from './components/HistoricalExplorer.js';
import { createMarketRegime } from './components/MarketRegime.js';
import { createBatteryArbitrage } from './components/BatteryArbitrage.js';
import { createInsightPanel } from './components/InsightPanel.js';
import { createFooter } from './components/Footer.js';
import { DataService } from './data/dataService.js';
import { loadAnalysisData } from './data/analysisDataService.js';
import { CHART_CONFIGS, MODELS } from './data/constants.js';

// ── Application State ────────────────────────────────

const state = {
    activeView: 'overview',
    activeTab: 'forecasts',
    resolution: 'Hourly',
    enabledModels: new Set(MODELS.map(m => m.id)),
    currency: 'EUR',
};

const dataService = new DataService();
let charts = [];
let sidebarEl = null;
let mainContentEl = null;
let filterBarEl = null;

// ── Theme State ──────────────────────────────────────

const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update Theme Toggle UI
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('.theme-toggle-icon');
        const text = themeToggle.querySelector('.theme-toggle-text');
        
        if (theme === 'light') {
            // In light mode, show "Dark" option with Moon icon
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
            text.textContent = 'Dark';
            themeToggle.dataset.nextTheme = 'dark';
        } else {
            // In dark mode, show "Light" option with Sun icon
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
            text.textContent = 'Light';
            themeToggle.dataset.nextTheme = 'light';
        }
    }
    
    // Force charts to update for new CSS vars
    charts.forEach(c => {
        if (typeof c.updateTheme === 'function') c.updateTheme();
    });
};

// ── Initialize App ───────────────────────────────────

async function init() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    // Top Nav
    app.appendChild(createTopNav());

    // Apply initial theme and listener
    const savedTheme = getInitialTheme();
    
    // Must be done after DOM insertion for elements to bind
    requestAnimationFrame(() => {
        applyTheme(savedTheme);
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                applyTheme(themeToggle.dataset.nextTheme);
            });
        }
    });

    // App Body
    const body = document.createElement('div');
    body.className = 'app-body';

    // Sidebar
    sidebarEl = createSidebar(state.activeView, navigateTo);
    body.appendChild(sidebarEl);

    // Main Content
    mainContentEl = document.createElement('main');
    mainContentEl.className = 'main-content';

    // Content Tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'content-tabs';
    tabsContainer.id = 'content-tabs';
    mainContentEl.appendChild(tabsContainer);

    // Filter Bar
    filterBarEl = createFilterBar(state, handleFilterChange);
    mainContentEl.appendChild(filterBarEl);

    // Scroll area
    const scrollArea = document.createElement('div');
    scrollArea.className = 'content-scroll';
    scrollArea.id = 'content-scroll';
    mainContentEl.appendChild(scrollArea);

    body.appendChild(mainContentEl);
    app.appendChild(body);

    // Sidebar Overlay (for mobile)
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebarEl.classList.toggle('sidebar--open');
            overlay.classList.toggle('sidebar-overlay--active');
        });
    }

    // Close on overlay click
    overlay.addEventListener('click', () => {
        sidebarEl.classList.remove('sidebar--open');
        overlay.classList.remove('sidebar-overlay--active');
    });

    // Initial data load
    console.log('[Main] Initializing data services...');
    await dataService.initLiveData();
    await dataService.initWeatherData();
    const analysisData = await loadAnalysisData();
    console.log('[Main] Analysis data loaded:', analysisData ? 'Success' : 'Failed');
    state.analysisData = analysisData;

    // Schedule auto-refresh at 14:15 EET
    if (dataService.isLive()) {
        scheduleIbexAutoRefresh();
    }

    // Render current view
    renderView();
}

// ── Navigation ───────────────────────────────────────

function navigateTo(viewId) {
    state.activeView = viewId;
    state.activeTab = 'forecasts';
    updateSidebarActive(sidebarEl, viewId);
    
    // Close mobile menu if open
    sidebarEl.classList.remove('sidebar--open');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.remove('sidebar-overlay--active');
    
    renderView();
}

// ── Filter Changes ───────────────────────────────────

function handleFilterChange(changes) {
    Object.assign(state, changes);
    if (changes.enabledModels) {
        charts.forEach(c => c.updateModels(state.enabledModels));
    }
}

// ── Render Views ─────────────────────────────────────

async function renderView() {
    let tabsContainer = document.getElementById('content-tabs');
    let scrollArea = document.getElementById('content-scroll');
    let filterBar = mainContentEl.querySelector('.filter-bar');

    // If structure was wiped, restore it
    if (!tabsContainer || !scrollArea) {
        mainContentEl.innerHTML = '';
        
        tabsContainer = document.createElement('div');
        tabsContainer.className = 'content-tabs';
        tabsContainer.id = 'content-tabs';
        mainContentEl.appendChild(tabsContainer);

        filterBar = createFilterBar(state, handleFilterChange);
        mainContentEl.appendChild(filterBar);

        scrollArea = document.createElement('div');
        scrollArea.className = 'content-scroll';
        scrollArea.id = 'content-scroll';
        mainContentEl.appendChild(scrollArea);
    }

    // Destroy old charts
    charts.forEach(c => c.destroy());
    charts = [];
    
    // Default visibility
    scrollArea.innerHTML = '';
    tabsContainer.innerHTML = '';
    tabsContainer.style.display = 'flex';
    if (filterBar) filterBar.style.display = 'flex';

    if (state.activeView === 'overview') {
        renderOverview(tabsContainer, scrollArea);
    } else if (state.activeView === 'spot-exchange') {
        renderSpotExchange(tabsContainer, scrollArea);
    } else if (state.activeView === 'weather-dashboard') {
        // Hide tabs and filter bar for dashboard
        tabsContainer.style.display = 'none';
        if (filterBar) filterBar.style.display = 'none';
        renderWeatherDashboard(scrollArea);
    } else if (state.activeView === 'historical-explorer') {
        tabsContainer.style.display = 'none';
        if (filterBar) filterBar.style.display = 'none';
        await renderHistoricalExplorer(scrollArea);
    } else if (state.activeView === 'analysis-suite') {
        tabsContainer.style.display = 'none';
        if (filterBar) filterBar.style.display = 'none';
        renderAnalysisSuite(scrollArea);
    } else if (state.activeView === 'qh-monthly-stats') {
        await renderQHMonthlyStats(tabsContainer, scrollArea);
    } else {
        renderFundamentalDetail(tabsContainer, scrollArea);
    }

    // Footer (scrolls with content)
    scrollArea.appendChild(createFooter());
}

// ── Overview Page ────────────────────────────────────

function renderOverview(tabsContainer, scrollArea) {
    // Tabs: Forecasts | Table
    tabsContainer.innerHTML = `
    <button class="content-tab${state.activeTab === 'forecasts' ? ' content-tab--active' : ''}" data-tab="forecasts">Forecasts</button>
    <button class="content-tab${state.activeTab === 'table' ? ' content-tab--active' : ''}" data-tab="table">Table</button>
  `;
    tabsContainer.querySelectorAll('.content-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.activeTab = tab.dataset.tab;
            renderView();
        });
    });

    if (state.activeTab === 'table') {
        const allData = dataService.getAllData();
        scrollArea.appendChild(createDataTable(allData));
        return;
    }

    // Status banner
    const live = dataService.isLive();
    scrollArea.innerHTML = `
    <div class="trial-banner">
      <div class="trial-banner__text">
        <strong>Bulgarian Energy Market Dashboard</strong> — ${live
            ? 'Connected to <strong style="color:var(--accent-gfs)">IBEX DAM</strong>. Spot prices are live data from ibex.bg.'
            : 'Short-term forecasts overview with mock data. Start the proxy server for live IBEX data.'}
      </div>
      ${live
            ? '<div class="trial-banner__expiry" style="color:var(--accent-gfs)">● LIVE DATA</div>'
            : '<div class="trial-banner__expiry" style="color:var(--accent-icon)">● MOCK DATA</div>'}
    </div>
  `;

    // Two-column layout
    const layout = document.createElement('div');
    layout.className = 'content-with-sidebar';

    const chartsCol = document.createElement('div');
    chartsCol.className = 'charts-column';

    const commentaryCol = document.createElement('div');
    commentaryCol.className = 'commentary-column';

    // Render charts by section
    let currentSection = '';
    for (const cfg of CHART_CONFIGS) {
        if (cfg.section !== currentSection) {
            currentSection = cfg.section;
            const sectionTitle = document.createElement('h2');
            sectionTitle.className = 'section-title';
            sectionTitle.innerHTML = `${currentSection} <span class="section-title__icon">ⓘ</span>`;
            chartsCol.appendChild(sectionTitle);
        }

        const series = dataService.getSeries(cfg.dataKey);
        if (!series) continue;

        const chart = new TimeSeriesChart(chartsCol, {
            title: cfg.title,
            unit: cfg.unit,
            dataKey: cfg.dataKey,
            timestamps: dataService.getTimestamps(),
            series,
            nowDate: dataService.getNow(),
            enabledModels: state.enabledModels,
            lastUpdated: dataService.getLastUpdated(),
            weatherData: dataService.getWeatherData(),
        });
        charts.push(chart);
    }

    // IBEX DAM Table (above commentary)
    const damRaw = dataService.getLatestDAMRaw();
    const deliveryDate = dataService.getDeliveryDate();
    commentaryCol.appendChild(createIbexDamTable(damRaw, deliveryDate));

    // Commentary
    commentaryCol.appendChild(createCommentary(dataService.getNow(), dataService.getLastUpdated()));

    layout.appendChild(chartsCol);
    layout.appendChild(commentaryCol);
    scrollArea.appendChild(layout);
}

// ── Spot & Exchange Page ─────────────────────────────

function renderSpotExchange(tabsContainer, scrollArea) {
    const spotTabs = ['Forecasts', 'Ensembles', 'Spreads', 'History', 'Benchmark', 'Map'];
    tabsContainer.innerHTML = spotTabs.map(t => `
    <button class="content-tab${t.toLowerCase() === state.activeTab ? ' content-tab--active' : ''}"
            data-tab="${t.toLowerCase()}">${t}</button>
  `).join('');

    tabsContainer.querySelectorAll('.content-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.activeTab = tab.dataset.tab;
            renderView();
        });
    });

    if (state.activeTab !== 'forecasts') {
        scrollArea.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:400px;color:var(--text-muted);font-size:var(--fs-lg);">
        ${state.activeTab.charAt(0).toUpperCase() + state.activeTab.slice(1)} view — Coming soon
      </div>
    `;
        return;
    }

    // Full width spot charts
    const spotConfigs = CHART_CONFIGS.filter(c => c.section === 'Price and Exchange');
    for (const cfg of spotConfigs) {
        const series = dataService.getSeries(cfg.dataKey);
        if (!series) continue;

        const chart = new TimeSeriesChart(scrollArea, {
            title: cfg.title,
            unit: cfg.unit,
            dataKey: cfg.dataKey,
            timestamps: dataService.getTimestamps(),
            series,
            nowDate: dataService.getNow(),
            enabledModels: state.enabledModels,
            lastUpdated: dataService.getLastUpdated(),
            weatherData: dataService.getWeatherData(),
        });
        charts.push(chart);
    }
}

// ── QH Monthly Stats Page ────────────────────────────

async function renderQHMonthlyStats(tabsContainer, scrollArea) {
    tabsContainer.innerHTML = `
    <button class="content-tab content-tab--active" data-tab="table">Monthly Table</button>
  `;
    const view = await createIbexMonthlyStatsView();
    scrollArea.appendChild(view);
}

// ── Weather Dashboard Page ───────────────────────────

function renderWeatherDashboard(container) {
    const dashboard = new WeatherDashboard(container, dataService);
}

// ── Historical Explorer Page ─────────────────────────

async function renderHistoricalExplorer(container) {
    const explorer = await createHistoricalExplorer();
    container.appendChild(explorer);
}

// ── Analysis Suite Page ──────────────────────────────

function renderAnalysisSuite(container) {
    console.log('[Main] Rendering Analysis Suite...');
    if (!state.analysisData) {
        container.innerHTML = '<div style="padding: 2rem; color: var(--text-muted);">Loading analysis data or data unavailable...</div>';
        return;
    }

    const suite = document.createElement('div');
    suite.className = 'analysis-suite-container';
    suite.style.padding = '2rem';
    suite.style.maxWidth = '1200px';
    suite.style.margin = '0 auto';
    
    const header = document.createElement('div');
    header.style.marginBottom = '2rem';
    header.innerHTML = `
        <h2 style="font-size: 2rem; color: var(--text-primary); margin-bottom: 0.5rem;">📈 IBEX Analysis Suite</h2>
        <p style="color: var(--text-muted);">Deep insights into market regimes, battery optimization, and price dynamics.</p>
    `;
    suite.appendChild(header);
    
    const components = [
        { name: 'InsightPanel', fn: createInsightPanel },
        { name: 'MarketRegime', fn: createMarketRegime },
        { name: 'BatteryArbitrage', fn: createBatteryArbitrage }
    ];

    components.forEach(comp => {
        try {
            console.log(`[Main] Creating ${comp.name}...`);
            const el = comp.fn(state.analysisData);
            if (el instanceof Node) {
                suite.appendChild(el);
                console.log(`[Main] ✓ ${comp.name} appended`);
            } else {
                console.warn(`[Main] ${comp.name} did not return a valid Node:`, el);
            }
        } catch (err) {
            console.error(`[Main] Error rendering ${comp.name}:`, err);
            const errorEl = document.createElement('div');
            errorEl.style.color = 'var(--color-negative)';
            errorEl.style.padding = '1rem';
            errorEl.style.margin = '1rem 0';
            errorEl.style.border = '1px solid var(--color-negative)';
            errorEl.style.borderRadius = '8px';
            errorEl.textContent = `Error in ${comp.name}: ${err.message}`;
            suite.appendChild(errorEl);
        }
    });
    
    container.appendChild(suite);
}

// ── Fundamental Detail Pages ─────────────────────────

function renderFundamentalDetail(tabsContainer, scrollArea) {
    tabsContainer.innerHTML = `
    <button class="content-tab content-tab--active" data-tab="forecasts">Forecasts</button>
    <button class="content-tab" data-tab="table">Table</button>
  `;
    tabsContainer.querySelectorAll('.content-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.activeTab = tab.dataset.tab;
            renderView();
        });
    });

    if (state.activeTab === 'table') {
        const allData = dataService.getAllData();
        scrollArea.appendChild(createDataTable(allData));
        return;
    }

    // Find matching chart config
    const matchingConfigs = CHART_CONFIGS.filter(c => {
        const id = c.id;
        return id === state.activeView ||
            state.activeView.includes(id) ||
            id.includes(state.activeView.replace('-power', '').replace('-', ''));
    });

    if (matchingConfigs.length === 0) {
        // Show related charts
        const section = state.activeView.includes('temperature') || state.activeView.includes('precipitation')
            ? 'Weather'
            : 'Fundamentals';

        const sectionConfigs = CHART_CONFIGS.filter(c => c.section === section);
        for (const cfg of sectionConfigs) {
            const series = dataService.getSeries(cfg.dataKey);
            if (!series) continue;
            const chart = new TimeSeriesChart(scrollArea, {
                title: cfg.title,
                unit: cfg.unit,
                dataKey: cfg.dataKey,
                timestamps: dataService.getTimestamps(),
                series,
                nowDate: dataService.getNow(),
                enabledModels: state.enabledModels,
                lastUpdated: dataService.getLastUpdated(),
                weatherData: dataService.getWeatherData(),
            });
            charts.push(chart);
        }
    } else {
        for (const cfg of matchingConfigs) {
            const series = dataService.getSeries(cfg.dataKey);
            if (!series) continue;
            const chart = new TimeSeriesChart(scrollArea, {
                title: cfg.title,
                unit: cfg.unit,
                dataKey: cfg.dataKey,
                timestamps: dataService.getTimestamps(),
                series,
                nowDate: dataService.getNow(),
                enabledModels: state.enabledModels,
                lastUpdated: dataService.getLastUpdated(),
                weatherData: dataService.getWeatherData(),
            });
            charts.push(chart);
        }
    }
}

// ── Boot ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
