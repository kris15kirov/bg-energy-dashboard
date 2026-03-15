// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — TimeSeriesChart Component
// ═══════════════════════════════════════════════════════

import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { getBaseChartOptions, createDatasets, createNowLine } from '../utils/chartConfig.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler);

export class TimeSeriesChart {
    constructor(container, { title, unit, dataKey, timestamps, series, nowDate, enabledModels, lastUpdated }) {
        this.container = container;
        this.title = title;
        this.unit = unit;
        this.dataKey = dataKey;
        this.timestamps = timestamps;
        this.series = series;
        this.nowDate = nowDate;
        this.enabledModels = enabledModels;
        this.lastUpdated = lastUpdated;
        this.collapsed = false;
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

        const canvas = card.querySelector('canvas');
        this.createChart(canvas);
    }

    createChart(canvas) {
        const labels = this.timestamps.map(t => t.getTime());
        const datasets = createDatasets(this.series, this.enabledModels);

        // Add timestamps to each dataset
        datasets.forEach(ds => {
            ds.data = ds.data.map((val, i) => ({ x: labels[i], y: val }));
        });

        const options = getBaseChartOptions(this.unit);

        this.chart = new Chart(canvas, {
            type: 'line',
            data: { datasets },
            options,
            plugins: [createNowLine(this.nowDate)],
        });
    }

    updateModels(enabledModels) {
        this.enabledModels = enabledModels;
        if (!this.chart) return;

        const labels = this.timestamps.map(t => t.getTime());
        const datasets = createDatasets(this.series, enabledModels);
        datasets.forEach(ds => {
            ds.data = ds.data.map((val, i) => ({ x: labels[i], y: val }));
        });

        this.chart.data.datasets = datasets;
        this.chart.update('none');
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
