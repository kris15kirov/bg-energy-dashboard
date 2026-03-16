// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — IBEX Monthly QH Stats Component
// Displays mean & median prices per 15-min slot per month
// from collected IBEX DAM data (Jan–Mar 2026).
// ═══════════════════════════════════════════════════════

const PROXY_BASE = '/api';

/**
 * Fetch the collected monthly stats from the proxy server.
 */
async function fetchMonthlyStats() {
    const res = await fetch(`${PROXY_BASE}/ibex-monthly-stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/**
 * Color interpolation for heatmap cells.
 * Maps a value within [min, max] to a color gradient:
 *   low (green) → mid (transparent) → high (red)
 */
function heatColor(value, min, max) {
    if (value === null || value === undefined) return '';
    const range = max - min;
    if (range === 0) return '';
    const ratio = (value - min) / range; // 0..1

    if (ratio < 0.5) {
        // Green → neutral
        const intensity = (0.5 - ratio) / 0.5;
        return `rgba(46, 213, 115, ${(intensity * 0.35).toFixed(2)})`;
    } else {
        // Neutral → red
        const intensity = (ratio - 0.5) / 0.5;
        return `rgba(238, 90, 111, ${(intensity * 0.35).toFixed(2)})`;
    }
}

/**
 * Format price for display.
 */
function fmtPrice(val) {
    if (val === null || val === undefined) return '—';
    return val.toFixed(2);
}

/**
 * Create the IBEX Monthly QH Stats view.
 * @returns {HTMLElement}
 */
export async function createIbexMonthlyStatsView() {
    const el = document.createElement('div');
    el.className = 'ibex-monthly-stats';
    el.id = 'ibex-monthly-stats';

    // Loading state
    el.innerHTML = `
    <div class="ims__loading">
      <div class="ims__spinner"></div>
      <span>Loading IBEX monthly statistics…</span>
    </div>
  `;

    try {
        const data = await fetchMonthlyStats();
        renderStats(el, data);
    } catch (err) {
        el.innerHTML = `
      <div class="ims__error">
        <h3>⚠ Could not load monthly stats</h3>
        <p>${err.message}</p>
        <small>Make sure the proxy server is running and the data has been collected.<br>
        Run: <code>node server/collect-ibex-data.js</code></small>
      </div>
    `;
    }

    return el;
}

/**
 * Render the full stats view with tabs per month and the big table.
 */
function renderStats(el, data) {
    const { meta, monthlyStats } = data;

    // Group by month
    const months = [...new Set(monthlyStats.map(r => r.month))].sort();
    // Filter out any months before 2026
    const filteredMonths = months.filter(m => m >= '2026-01');

    // Compute global price range for heatmap
    const allMeans = monthlyStats.filter(r => r.mean !== null).map(r => r.mean);
    const globalMin = Math.min(...allMeans);
    const globalMax = Math.max(...allMeans);

    // Monthly summaries
    const monthSummaries = filteredMonths.map(month => {
        const slots = monthlyStats.filter(r => r.month === month);
        const means = slots.map(r => r.mean).filter(v => v !== null);
        const medians = slots.map(r => r.median).filter(v => v !== null);
        const overallMean = means.length > 0 ? means.reduce((a, b) => a + b) / means.length : null;
        const sortedMedians = [...medians].sort((a, b) => a - b);
        const overallMedian = sortedMedians.length > 0
            ? sortedMedians.length % 2 !== 0
                ? sortedMedians[Math.floor(sortedMedians.length / 2)]
                : (sortedMedians[sortedMedians.length / 2 - 1] + sortedMedians[sortedMedians.length / 2]) / 2
            : null;
        const days = slots[0]?.count || 0;
        return { month, overallMean, overallMedian, days };
    });

    const monthNames = {
        '2026-01': 'January 2026',
        '2026-02': 'February 2026',
        '2026-03': 'March 2026',
    };

    el.innerHTML = `
    <div class="ims__header">
      <div class="ims__header-left">
        <h2 class="ims__title">IBEX Day-Ahead — Quarter-Hour Monthly Statistics</h2>
        <span class="ims__subtitle">Mean & median price per 15-min slot (QH 1–96) per month</span>
      </div>
      <div class="ims__header-right">
        <span class="ims__meta">
          ${meta.fetchedDays} days collected · Generated ${new Date(meta.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>

    <!-- Monthly summary cards -->
    <div class="ims__summary-cards">
      ${monthSummaries.map(s => `
        <div class="ims__card">
          <div class="ims__card-month">${monthNames[s.month] || s.month}</div>
          <div class="ims__card-stats">
            <div class="ims__card-stat">
              <span class="ims__card-label">Mean</span>
              <span class="ims__card-value">${fmtPrice(s.overallMean)}</span>
              <span class="ims__card-unit">EUR/MWh</span>
            </div>
            <div class="ims__card-stat">
              <span class="ims__card-label">Median</span>
              <span class="ims__card-value">${fmtPrice(s.overallMedian)}</span>
              <span class="ims__card-unit">EUR/MWh</span>
            </div>
            <div class="ims__card-stat">
              <span class="ims__card-label">Days</span>
              <span class="ims__card-value">${s.days}</span>
              <span class="ims__card-unit">&nbsp;</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- View mode tabs -->
    <div class="ims__view-tabs">
      <button class="ims__view-tab ims__view-tab--active" data-view="all">All Months</button>
      ${filteredMonths.map(m => `
        <button class="ims__view-tab" data-view="${m}">${monthNames[m]?.split(' ')[0] || m}</button>
      `).join('')}
    </div>

    <!-- Table container -->
    <div class="ims__table-wrap" id="ims-table-wrap"></div>
  `;

    // Initial render
    renderTable(el, monthlyStats, filteredMonths, globalMin, globalMax, 'all', monthNames);

    // Tab switching
    el.querySelectorAll('.ims__view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            el.querySelectorAll('.ims__view-tab').forEach(t => t.classList.remove('ims__view-tab--active'));
            tab.classList.add('ims__view-tab--active');
            const view = tab.dataset.view;
            renderTable(el, monthlyStats, filteredMonths, globalMin, globalMax, view, monthNames);
        });
    });
}

/**
 * Render the data table.
 */
function renderTable(el, monthlyStats, months, globalMin, globalMax, view, monthNames) {
    const wrap = el.querySelector('#ims-table-wrap');
    const visibleMonths = view === 'all' ? months : [view];

    // Build the table HTML
    let html = `
    <div class="ims__scroll">
      <table class="ims__table">
        <thead>
          <tr>
            <th class="ims__th-slot">Slot</th>
            <th class="ims__th-period">Period</th>
            ${visibleMonths.map(m => `
              <th class="ims__th-month" colspan="2">${monthNames[m]?.split(' ')[0] || m}</th>
            `).join('')}
          </tr>
          <tr class="ims__subheader">
            <th></th>
            <th></th>
            ${visibleMonths.map(() => `
              <th class="ims__th-stat">Mean</th>
              <th class="ims__th-stat">Median</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
  `;

    for (let slot = 1; slot <= 96; slot++) {
        const isHourBorder = slot % 4 === 0;
        const hourClass = isHourBorder ? ' ims__row--hour-end' : '';
        const slotData = {};
        for (const m of visibleMonths) {
            slotData[m] = monthlyStats.find(r => r.month === m && r.slot === slot);
        }

        const period = slotData[visibleMonths[0]]?.period || '';

        html += `<tr class="ims__row${hourClass}">`;
        html += `<td class="ims__td-slot">QH ${slot}</td>`;
        html += `<td class="ims__td-period">${period}</td>`;

        for (const m of visibleMonths) {
            const d = slotData[m];
            const meanVal = d?.mean;
            const medianVal = d?.median;
            const meanBg = heatColor(meanVal, globalMin, globalMax);
            const medianBg = heatColor(medianVal, globalMin, globalMax);

            html += `<td class="ims__td-mean" style="background:${meanBg}">${fmtPrice(meanVal)}</td>`;
            html += `<td class="ims__td-median" style="background:${medianBg}">${fmtPrice(medianVal)}</td>`;
        }

        html += `</tr>`;
    }

    html += `
        </tbody>
      </table>
    </div>

    <!-- Legend -->
    <div class="ims__legend">
      <span class="ims__legend-label">Low price</span>
      <div class="ims__legend-gradient"></div>
      <span class="ims__legend-label">High price</span>
    </div>
  `;

    wrap.innerHTML = html;
}
