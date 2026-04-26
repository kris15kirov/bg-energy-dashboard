// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — IBEX DAM Table Component
// Shows the day-ahead market prices from ibex.bg:
//   - Summary: Base, Peak, Off-peak, Volume
//   - QH 1-96 quarter-hour prices + volumes
//   - PH 1-24 hourly price index
// Auto-refreshes at 14:15 EET daily.
// ═══════════════════════════════════════════════════════

import { fetchDAMData } from '../data/ibexService.js';

const REFRESH_HOUR = 14;
const REFRESH_MINUTE = 15;

let refreshTimer = null;

/**
 * Create the IBEX DAM table component.
 * @param {Object|null} damData - Raw IBEX response for a single day
 * @param {string} deliveryDate - YYYY-MM-DD
 * @returns {HTMLElement}
 */
export function createIbexDamTable(damData, deliveryDate) {
    const el = document.createElement('div');
    el.className = 'ibex-table';
    el.id = 'ibex-dam-table';

    if (!damData || !damData.main_data) {
        el.innerHTML = `
      <div class="ibex-table__header">
        <h3 class="ibex-table__title">IBEX Day-Ahead Market</h3>
        <span class="ibex-table__badge ibex-table__badge--offline">Offline</span>
      </div>
      <div class="ibex-table__empty">
        No IBEX data available.<br>
        <small>Start the proxy server for live data.</small>
      </div>
    `;
        return el;
    }

    const mainData = damData.main_data || [];
    const summaryData = damData.summary_data || {};
    const phData = damData.ph_data || [];

    // Format delivery date
    const dDate = new Date(deliveryDate + 'T00:00:00');
    const dateDisplay = dDate.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Next refresh time
    const nextRefresh = getNextRefreshTime();
    const nextRefreshStr = nextRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `
    <div class="ibex-table__header">
      <h3 class="ibex-table__title">IBEX Day-Ahead Market</h3>
      <span class="ibex-table__badge ibex-table__badge--live">LIVE</span>
    </div>

    <div class="ibex-table__date">
      <span class="ibex-table__date-label">Delivery Day:</span>
      <span class="ibex-table__date-value">${dateDisplay}</span>
    </div>

    <div class="ibex-table__refresh-info">
      <span>Next update: ${nextRefreshStr} EET</span>
      <button class="ibex-table__refresh-btn" id="ibex-refresh-btn" title="Refresh now">⟳</button>
    </div>

    <!-- Summary -->
    <div class="ibex-table__summary">
      <div class="ibex-table__summary-item">
        <span class="ibex-table__summary-label">Base</span>
        <span class="ibex-table__summary-value">${formatPrice(summaryData.base_price)}</span>
        <span class="ibex-table__summary-unit">EUR/MWh</span>
      </div>
      <div class="ibex-table__summary-item">
        <span class="ibex-table__summary-label">Peak</span>
        <span class="ibex-table__summary-value">${formatPrice(summaryData.peak_price)}</span>
        <span class="ibex-table__summary-unit">EUR/MWh</span>
      </div>
      <div class="ibex-table__summary-item">
        <span class="ibex-table__summary-label">Off-peak</span>
        <span class="ibex-table__summary-value">${formatPrice(summaryData.off_peak_price)}</span>
        <span class="ibex-table__summary-unit">EUR/MWh</span>
      </div>
      <div class="ibex-table__summary-item">
        <span class="ibex-table__summary-label">Volume</span>
        <span class="ibex-table__summary-value">${formatVolume(summaryData.volume)}</span>
        <span class="ibex-table__summary-unit">MWh</span>
      </div>
    </div>

    <!-- Tabs: QH / PH -->
    <div class="ibex-table__tabs">
      <button class="ibex-table__tab ibex-table__tab--active" data-view="qh">15-min (QH)</button>
      <button class="ibex-table__tab" data-view="ph">Hourly (PH)</button>
    </div>

    <!-- QH Table -->
    <div class="ibex-table__panel ibex-table__panel--active" id="ibex-panel-qh">
      <div class="ibex-table__scroll">
        <table class="ibex-table__table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Period</th>
              <th>Price</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            ${mainData.map(row => {
        const price = parseFloat(row.price) || 0;
        const basePrice = parseFloat(summaryData.base_price) || 100;
        const deviation = ((price - basePrice) / basePrice) * 100;
        const colorClass = deviation > 5 ? 'ibex-cell--high' : deviation < -5 ? 'ibex-cell--low' : '';
        return `<tr>
                <td>${row.product}</td>
                <td>${row.delivery_period}</td>
                <td class="${colorClass}">${formatPrice(row.price)}</td>
                <td>${formatVolume(row.volume)}</td>
              </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- PH Table -->
    <div class="ibex-table__panel" id="ibex-panel-ph">
      <div class="ibex-table__scroll">
        <table class="ibex-table__table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price Index</th>
            </tr>
          </thead>
          <tbody>
            ${(phData.length > 0 ? phData : generatePHFromQH(mainData)).map(row => {
        const price = parseFloat(row.price || row.price_index) || 0;
        const basePrice = parseFloat(summaryData.base_price) || 100;
        const deviation = ((price - basePrice) / basePrice) * 100;
        const colorClass = deviation > 5 ? 'ibex-cell--high' : deviation < -5 ? 'ibex-cell--low' : '';
        return `<tr>
                <td>${row.product}</td>
                <td class="${colorClass}">${formatPrice(row.price || row.price_index)}</td>
              </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

    // Tab switching
    el.querySelectorAll('.ibex-table__tab').forEach(tab => {
        tab.addEventListener('click', () => {
            el.querySelectorAll('.ibex-table__tab').forEach(t => t.classList.remove('ibex-table__tab--active'));
            el.querySelectorAll('.ibex-table__panel').forEach(p => p.classList.remove('ibex-table__panel--active'));
            tab.classList.add('ibex-table__tab--active');
            const panelId = `ibex-panel-${tab.dataset.view}`;
            el.querySelector(`#${panelId}`).classList.add('ibex-table__panel--active');
        });
    });

    // Manual refresh button
    const refreshBtn = el.querySelector('#ibex-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => refreshIbexTable());
    }

    return el;
}

/**
 * Generate PH data from QH data (average every 4 QH → 1 PH).
 */
function generatePHFromQH(mainData) {
    const ph = [];
    for (let h = 0; h < 24; h++) {
        const qhSlice = mainData.slice(h * 4, h * 4 + 4);
        if (qhSlice.length > 0) {
            const avg = qhSlice.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0) / qhSlice.length;
            ph.push({ product: `PH ${h + 1}`, price_index: avg.toFixed(2) });
        }
    }
    return ph;
}

/**
 * Refresh the IBEX table with fresh data.
 */
async function refreshIbexTable() {
    const tableEl = document.getElementById('ibex-dam-table');
    if (!tableEl) return;

    // Show loading state
    const badge = tableEl.querySelector('.ibex-table__badge');
    if (badge) {
        badge.textContent = 'Refreshing…';
        badge.className = 'ibex-table__badge ibex-table__badge--refreshing';
    }

    try {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const today = new Date(now);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const datesToTry = [formatDate(tomorrow), formatDate(today), formatDate(yesterday)];
        let success = false;

        for (const dateStr of datesToTry) {
            try {
                console.log(`[IBEX Table] Trying to fetch data for ${dateStr}...`);
                const data = await fetchDAMData(dateStr);
                if (data && data.main_data && data.main_data.length > 0) {
                    const newTable = createIbexDamTable(data, dateStr);
                    tableEl.replaceWith(newTable);
                    console.log(`[IBEX Table] Successfully refreshed with data for ${dateStr}`);
                    success = true;
                    break;
                }
            } catch (err) {
                console.warn(`[IBEX Table] Failed for ${dateStr}:`, err.message);
            }
        }

        if (!success) throw new Error('No data found for the last 3 days');
    } catch (err) {
        console.warn('[IBEX Table] Refresh failed:', err.message);
        if (badge) {
            badge.textContent = 'Error';
            badge.className = 'ibex-table__badge ibex-table__badge--offline';
        }
    }
}

/**
 * Get the next 14:15 EET time as a Date object.
 */
function getNextRefreshTime() {
    const now = new Date();
    // EET is UTC+2, EEST is UTC+3. Use local time since user is in EET.
    const next = new Date(now);
    next.setHours(REFRESH_HOUR, REFRESH_MINUTE, 0, 0);
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

/**
 * Schedule auto-refresh at 14:15 EET daily.
 */
export function scheduleIbexAutoRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);

    const next = getNextRefreshTime();
    const ms = next.getTime() - Date.now();

    console.log(`[IBEX Table] Auto-refresh scheduled at ${next.toLocaleTimeString('en-GB')} (in ${Math.round(ms / 60000)} min)`);

    refreshTimer = setTimeout(() => {
        console.log('[IBEX Table] Auto-refresh triggered at 14:15 EET');
        refreshIbexTable();
        // Reschedule for next day
        scheduleIbexAutoRefresh();
    }, ms);
}

// ── Helpers ──────────────────────────────────────────

function formatPrice(val) {
    const num = parseFloat(val);
    return isNaN(num) ? '—' : num.toFixed(2);
}

function formatVolume(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '—';
    return num >= 1000 ? num.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : num.toFixed(1);
}
