import '../styles/weather-dashboard.css';

export class WeatherDashboard {
    constructor(container, dataService) {
        this.container = container;
        this.dataService = dataService;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div style="display:flex; flex-direction: column; align-items:center; justify-content:center; height:400px; color:var(--text-muted); font-size:var(--fs-lg);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🌤️</div>
                <h3>Weather Dashboard</h3>
                <p>Advanced meteorological features are coming soon.</p>
            </div>
        `;
    }

    createSummaryCards(signals) {
        const cardsCont = document.createElement('div');
        cardsCont.className = 'weather-cards';
        
        const countSunny = signals.filter(s => s.isSunny).length;
        const countExtreme = signals.filter(s => s.isExtremeTemp).length;
        const countWind = signals.filter(s => s.isHighWind).length;

        cardsCont.innerHTML = `
            <div class="weather-card">
                <div class="weather-card__icon">☀️</div>
                <div class="weather-card__title">Solar Surplus</div>
                <div class="weather-card__val">${countSunny} hours</div>
                <div class="weather-card__sub">Expected price drops</div>
            </div>
            <div class="weather-card">
                <div class="weather-card__icon">❄️</div>
                <div class="weather-card__title">Temp Extremes</div>
                <div class="weather-card__val">${countExtreme} hours</div>
                <div class="weather-card__sub">High demand spikes</div>
            </div>
            <div class="weather-card">
                <div class="weather-card__icon">💨</div>
                <div class="weather-card__title">Wind Dumps</div>
                <div class="weather-card__val">${countWind} hours</div>
                <div class="weather-card__sub">Prolonged cheap energy</div>
            </div>
        `;
        return cardsCont;
    }

    createMainCharts(weatherData) {
        const chartsWrap = document.createElement('div');
        chartsWrap.className = 'weather-charts';
        
        const chartHTML = `
            <div class="chart-box">
                <h3 class="chart-box__title">Temperature Profile (°C)</h3>
                <div class="mini-bar-chart">
                    ${weatherData.slice(0, 168).map(w => {
                        const h = Math.max(0, Math.min(100, (w.temperature + 10) * 2)); // simple scale offset
                        const color = w.temperature < 5 ? 'var(--accent-icon)' : w.temperature > 25 ? '#ef4444' : '#10b981';
                        return `<div class="mini-bar" style="height: ${h}%; background-color: ${color};" title="${w.datetime.toLocaleString()}: ${w.temperature}°C"></div>`;
                    }).join('')}
                </div>
                <div class="chart-box__subtitle">First week preview (Hourly)</div>
            </div>
            <div class="chart-box">
                <h3 class="chart-box__title">Solar Radiation (W/m²)</h3>
                <div class="mini-bar-chart">
                    ${weatherData.slice(0, 168).map(w => {
                        const h = Math.max(0, Math.min(100, w.solar_radiation / 10)); // simple scale
                        return `<div class="mini-bar" style="height: ${h}%; background-color: #f59e0b;" title="${w.datetime.toLocaleString()}: ${w.solar_radiation} W/m²"></div>`;
                    }).join('')}
                </div>
                <div class="chart-box__subtitle">First week preview (GHI)</div>
            </div>
        `;
        chartsWrap.innerHTML = chartHTML;
        return chartsWrap;
    }

    createSignalHeatmap(signals) {
        const wrap = document.createElement('div');
        wrap.className = 'weather-heatmap-wrap';
        wrap.innerHTML = '<h3 class="chart-box__title">Weekly Weather Events Grid (168 hours)</h3>';
        
        const grid = document.createElement('div');
        grid.className = 'weather-heatmap';
        
        const week = signals.slice(0, 168);
        let gridHTML = '';
        week.forEach(s => {
            let clc = 'heat-cell--normal';
            if (s.isSunny) clc = 'heat-cell--sunny';
            else if (s.isExtremeTemp) clc = 'heat-cell--extreme';
            else if (s.isHighWind) clc = 'heat-cell--wind';
            gridHTML += `<div class="heat-cell ${clc}" title="${s.datetime.toLocaleString()}"></div>`;
        });
        
        grid.innerHTML = gridHTML;
        wrap.appendChild(grid);
        
        const legend = document.createElement('div');
        legend.className = 'weather-legend';
        legend.innerHTML = `
            <span class="legend-item"><span class="legend-box heat-cell--sunny"></span> Solar</span>
            <span class="legend-item"><span class="legend-box heat-cell--extreme"></span> Extreme Temp</span>
            <span class="legend-item"><span class="legend-box heat-cell--wind"></span> High Wind</span>
            <span class="legend-item"><span class="legend-box heat-cell--normal"></span> Normal</span>
        `;
        wrap.appendChild(legend);

        return wrap;
    }
}
