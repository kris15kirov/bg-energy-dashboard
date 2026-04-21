// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — TimeSeriesChart Component
// ═══════════════════════════════════════════════════════

import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { getBaseChartOptions, createDatasets, createNowLine } from '../utils/chartConfig.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler);

export class TimeSeriesChart {
    constructor(container, { title, unit, dataKey, timestamps, series, nowDate, enabledModels, lastUpdated, weatherData }) {
        this.container = container;
        this.title = title;
        this.unit = unit;
        this.dataKey = dataKey;
        this.timestamps = timestamps;
        this.series = series;
        this.nowDate = nowDate;
        this.enabledModels = enabledModels;
        this.lastUpdated = lastUpdated;
        this.weatherData = weatherData || [];
        this.collapsed = false;
        this.overlayType = 'none';
        this.chart = null;

        this.render();
    }

    render() {
        const card = document.createElement('div');
        card.className = 'chart-card';

        card.innerHTML = `
      <div class="chart-card__header">
        <span class="chart-card__title">${this.title} – ${this.unit} – Bulgaria</span>
        <div class="chart-card__meta">
          ${(this.dataKey === 'spotPrice' && this.weatherData.length > 0) ? `
            <select class="chart-card__overlay-select" style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-size:11px;margin-right:8px;outline:none;">
              <option value="none">No Overlay</option>
              <option value="temperature">Overlay Temp (°C)</option>
              <option value="solar">Overlay Solar (W/m²)</option>
            </select>
          ` : ''}
          <span class="chart-card__updated">Updated ${this.lastUpdated}</span>
          <span class="chart-card__toggle">▾</span>
        </div>
      </div>
      <div class="chart-card__body">
        <div class="chart-card__canvas-wrap">
          <canvas></canvas>
        </div>
      </div>
    `;

        // Toggle collapse
        card.querySelector('.chart-card__header').addEventListener('click', () => {
            this.collapsed = !this.collapsed;
            card.classList.toggle('chart-card--collapsed', this.collapsed);
            if (!this.collapsed && this.chart) {
                setTimeout(() => this.chart.resize(), 400);
            }
        });

        this.container.appendChild(card);
        this.cardEl = card;

        const selectEl = card.querySelector('.chart-card__overlay-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                this.overlayType = e.target.value;
                if (this.chart) {
                    this.updateChartData();
                }
            });
        }

        const canvas = card.querySelector('canvas');
        this.createChart(canvas);
    }

    createChart(canvas) {
        const options = getBaseChartOptions(this.unit);

        this.chart = new Chart(canvas, {
            type: 'line',
            data: { datasets: [] },
            options,
            plugins: [createNowLine(this.nowDate)],
        });
        
        this.updateChartData();
    }

    updateModels(enabledModels) {
        this.enabledModels = enabledModels;
        if (this.chart) {
            this.updateChartData();
        }
    }

    updateChartData() {
        if (!this.chart) return;
        
        const labels = this.timestamps.map(t => t.getTime());
        const datasets = createDatasets(this.series, this.enabledModels);

        datasets.forEach(ds => {
            ds.data = ds.data.map((val, i) => ({ x: labels[i], y: val }));
            ds.yAxisID = 'y'; // Explicitly bind to main axis
        });

        // Add weather overlay if selected
        if (this.overlayType !== 'none' && this.weatherData.length > 0) {
            const wData = [];
            const wMap = new Map();
            this.weatherData.forEach(w => wMap.set(w.datetime.getTime(), w));
            
            labels.forEach(lx => {
                const w = wMap.get(lx);
                let val = null;
                if (w) {
                    if (this.overlayType === 'temperature') val = w.temperature;
                    if (this.overlayType === 'solar') val = w.solar_radiation;
                }
                wData.push({ x: lx, y: val });
            });
            
            const color = this.overlayType === 'temperature' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(245, 158, 11, 0.4)';
            const label = this.overlayType === 'temperature' ? 'Temperature (°C)' : 'Solar (W/m²)';
            
            datasets.push({
                label: label,
                data: wData,
                type: 'bar',
                backgroundColor: color,
                yAxisID: 'y2',
                order: 10 // Draw behind main lines
            });
        }

        this.chart.data.datasets = datasets;

        // Configure secondary axis
        if (this.overlayType !== 'none') {
            this.chart.options.scales.y2 = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    font: { family: 'Inter', size: 10 },
                    maxTicksLimit: 6,
                },
                border: { display: false }
            };
        } else {
            if (this.chart.options.scales.y2) {
                delete this.chart.options.scales.y2;
            }
        }

        this.chart.update('none');
    }

    updateTheme() {
        if (!this.chart || !this.cardEl) return;
        const canvas = this.cardEl.querySelector('canvas');
        
        // Save current state
        const isCollapsed = this.collapsed;
        
        // Destroy existing chart and recreate it to get fresh colors from CSS variables
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        this.createChart(canvas);
        
        if (isCollapsed) {
            this.cardEl.classList.add('chart-card--collapsed');
            this.collapsed = true;
        }
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        if (this.cardEl) {
            this.cardEl.remove();
        }
    }
}
