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

import { createTopNav } from './components/TopNav.js';
import { createSidebar, updateSidebarActive } from './components/Sidebar.js';
import { createFilterBar } from './components/FilterBar.js';
import { TimeSeriesChart } from './components/TimeSeriesChart.js';
import { createCommentary } from './components/Commentary.js';
import { createDataTable } from './components/DataTable.js';
import { createIbexDamTable, scheduleIbexAutoRefresh } from './components/IbexDamTable.js';
import { DataService } from './data/dataService.js';
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

// ── Initialize App ───────────────────────────────────

async function init() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    // Top Nav
    app.appendChild(createTopNav());

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

    // Try to load live IBEX data (falls back to mock silently)
    await dataService.initLiveData();

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

function renderView() {
    const tabsContainer = document.getElementById('content-tabs');
    const scrollArea = document.getElementById('content-scroll');

    // Destroy old charts
    charts.forEach(c => c.destroy());
    charts = [];
    scrollArea.innerHTML = '';

    if (state.activeView === 'overview') {
        renderOverview(tabsContainer, scrollArea);
    } else if (state.activeView === 'spot-exchange') {
        renderSpotExchange(tabsContainer, scrollArea);
    } else {
        renderFundamentalDetail(tabsContainer, scrollArea);
    }
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
        });
        charts.push(chart);
    }
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
            });
            charts.push(chart);
        }
    }
}

// ── Boot ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
