// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — DataTable Component
// ═══════════════════════════════════════════════════════

import { formatNumber, formatDeviation, formatHour, formatDate } from '../utils/formatters.js';

const TABLE_METRICS = [
    { key: 'residualLoad', label: 'Residual load', unit: 'MWh/h' },
    { key: 'consumption', label: 'Consumption', unit: 'MWh/h' },
    { key: 'wind', label: 'Wind power', unit: 'MWh/h' },
    { key: 'solar', label: 'Solar power', unit: 'MWh/h' },
    { key: 'temperature', label: 'Temperature', unit: '°C' },
];

export function createDataTable(allData) {
    const wrap = document.createElement('div');
    wrap.className = 'table-view';

    const { timestamps, nowIdx, data } = allData;

    // Show 48 hours of data centered around now
    const start = Math.max(0, nowIdx - 6);
    const end = Math.min(timestamps.length, nowIdx + 42);
    const visibleTimestamps = timestamps.slice(start, end);

    let html = `
    <div class="table-view__header">
      <h3 class="table-view__title">Hourly Forecast Data — Bulgaria</h3>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${visibleTimestamps.map((t, i) => {
        const isNewDay = i === 0 || t.getDate() !== visibleTimestamps[i - 1].getDate();
        return `<th>${isNewDay ? formatDate(t) + ' ' : ''}${formatHour(t)}</th>`;
    }).join('')}
          </tr>
        </thead>
        <tbody>
  `;

    for (const metric of TABLE_METRICS) {
        const series = data[metric.key];
        if (!series) continue;

        const ec12Values = series.forecasts.ec.slice(start, end);
        const normalBase = ec12Values.reduce((s, v) => s + (v || 0), 0) / ec12Values.length;

        // Group header
        html += `
      <tr class="data-table__group-header">
        <td colspan="${visibleTimestamps.length + 1}">
          <strong>${metric.label}</strong> – EC12 – ${formatDate(timestamps[nowIdx])} – ${metric.unit}
        </td>
      </tr>
    `;

        // Value row
        html += `<tr><td>${metric.label} – EC12</td>`;
        for (let i = start; i < end; i++) {
            const val = series.forecasts.ec[i];
            html += `<td>${formatNumber(val, metric.key === 'temperature' ? 2 : 1)}</td>`;
        }
        html += '</tr>';

        // Dev. normal row
        html += `<tr class="data-table__sub-row"><td>... Dev. normal</td>`;
        for (let i = start; i < end; i++) {
            const val = series.forecasts.ec[i];
            const dev = val != null ? val - normalBase : null;
            const cls = dev != null ? (dev >= 0 ? 'val-positive' : 'val-negative') : '';
            html += `<td class="${cls}">${formatDeviation(dev)}</td>`;
        }
        html += '</tr>';

        // Shift row
        html += `<tr class="data-table__sub-row"><td>... Shift from EC00</td>`;
        for (let i = start; i < end; i++) {
            const ecVal = series.forecasts.ec[i];
            const gfsVal = series.forecasts.gfs[i];
            const shift = (ecVal != null && gfsVal != null) ? ecVal - gfsVal : null;
            const cls = shift != null ? (shift >= 0 ? 'val-positive' : 'val-negative') : '';
            html += `<td class="${cls}">${formatDeviation(shift)}</td>`;
        }
        html += '</tr>';
    }

    html += `</tbody></table></div>`;

    // Footer schedule
    html += `
    <div class="app-footer">
      <div class="app-footer__schedule-title">
        Fundamentals- and weather update schedule ± 12 hours in local time (Europe/Sofia)
      </div>
      <div class="app-footer__schedule">
        ${Array.from({ length: 24 }, (_, i) => {
        const types = ['red', 'blue', 'green'];
        const type = types[i % 3];
        const width = 10 + Math.random() * 30;
        return i % 3 === 0 ? `<div class="schedule-block schedule-block--${type}" style="width:${width}px"></div>` : '';
    }).join('')}
      </div>
      <div class="app-footer__links">
        <a href="#" class="app-footer__link">Settings</a>
        <a href="#" class="app-footer__link">Subscriptions</a>
        <a href="#" class="app-footer__link">Notifications</a>
        <a href="#" class="app-footer__link">Knowledge base</a>
        <a href="#" class="app-footer__link">Changelog</a>
        <a href="#" class="app-footer__link">Status</a>
      </div>
    </div>
  `;

    wrap.innerHTML = html;
    return wrap;
}
