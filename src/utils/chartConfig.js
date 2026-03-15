// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Chart.js Shared Configuration
// ═══════════════════════════════════════════════════════

import { MODELS, ACTUAL_COLOR } from '../data/constants.js';

export function getChartColors() {
    return {
        actual: ACTUAL_COLOR,
        ...Object.fromEntries(MODELS.map(m => [m.id, m.color]))
    };
}

export function createNowLine(nowDate) {
    return {
        id: 'nowLine',
        beforeDraw(chart) {
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            if (!xScale || !yScale) return;

            const x = xScale.getPixelForValue(nowDate.getTime());
            if (x < xScale.left || x > xScale.right) return;

            const ctx = chart.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1;
            ctx.moveTo(x, yScale.top);
            ctx.lineTo(x, yScale.bottom);
            ctx.stroke();

            // "Now" label
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Now', x, yScale.top - 4);
            ctx.restore();
        }
    };
}

export function getBaseChartOptions(unit) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 600,
            easing: 'easeOutQuart',
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 30, 0.95)',
                titleColor: '#e8e8f0',
                bodyColor: '#9090aa',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 10,
                bodyFont: { family: 'Inter', size: 11 },
                titleFont: { family: 'Inter', size: 12, weight: '600' },
                displayColors: true,
                boxWidth: 8,
                boxHeight: 8,
                callbacks: {
                    title(items) {
                        if (!items.length) return '';
                        const d = new Date(items[0].parsed.x);
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return `${d.getDate()} ${months[d.getMonth()]} ${d.getHours().toString().padStart(2, '0')}:00`;
                    },
                    label(ctx) {
                        const val = ctx.parsed.y;
                        if (val == null) return null;
                        return ` ${ctx.dataset.label}: ${val.toFixed(1)} ${unit}`;
                    }
                }
            },
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: { day: 'd MMM', hour: 'HH:mm' },
                },
                grid: {
                    color: 'rgba(255,255,255,0.04)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#5c5c78',
                    font: { family: 'Inter', size: 10 },
                    maxTicksLimit: 14,
                },
                border: { display: false },
            },
            y: {
                grid: {
                    color: 'rgba(255,255,255,0.04)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#5c5c78',
                    font: { family: 'Inter', size: 10 },
                    maxTicksLimit: 6,
                },
                border: { display: false },
            }
        }
    };
}

export function createDatasets(series, enabledModels) {
    const datasets = [];

    // Actuals
    datasets.push({
        label: 'Actual',
        data: series.actuals,
        borderColor: ACTUAL_COLOR,
        backgroundColor: ACTUAL_COLOR,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        order: 0,
    });

    // Forecast models
    for (const model of MODELS) {
        if (!enabledModels.has(model.id)) continue;
        datasets.push({
            label: model.label,
            data: series.forecasts[model.id],
            borderColor: model.color,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.3,
            borderDash: [],
            order: 1,
        });
    }

    return datasets;
}
