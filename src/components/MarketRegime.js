// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Market Regime Comparison
// ═══════════════════════════════════════════════════════

export function createMarketRegime(data) {
    const container = document.createElement('div');
    container.className = 'analysis-module';
    
    if (!data || !data.Comparison_2025_vs_2026) {
        container.innerHTML = '<p>No comparison data available.</p>';
        return container;
    }

    const kpis = data.Comparison_2025_vs_2026;
    
    // Mapping internal names to human readable labels
    const labelMap = {
        'avg_price': 'Average Price',
        'median_price': 'Median Price',
        'min_price': 'Minimum Price',
        'max_price': 'Maximum Price',
        'std_dev_volatility': 'Volatility (Std Dev)',
        'negative_hours_pct': 'Negative Price Hours (%)',
        'hours_above_150_pct': 'Price > 150 EUR (%)',
        'avg_daily_spread': 'Average Daily Spread'
    };

    let kpiHtml = '';
    kpis.forEach(kpi => {
        const label = labelMap[kpi.metric] || kpi.metric;
        const v2025 = kpi['Sep-Dec 2025'];
        const v2026 = kpi['Jan-Apr 2026'];
        const pctChange = (typeof kpi.pct_change === 'number') ? kpi.pct_change * 100 : 0;
        const changeClass = pctChange > 0 ? 'trend--up' : 'trend--down';
        const changeIcon = pctChange > 0 ? '▲' : '▼';
        
        // Formatting
        const formatVal = (val, metric) => {
            if (typeof val !== 'number') return 'N/A';
            if (metric.includes('pct')) return (val * 100).toFixed(2) + '%';
            return val.toFixed(2);
        };

        kpiHtml += `
            <div class="kpi-row">
                <div class="kpi-label" style="color: var(--text-primary); font-weight: 500;">${label}</div>
                <div class="kpi-val" style="color: var(--text-muted);">2025: <span style="color: var(--text-primary); font-weight: 600;">${formatVal(v2025, kpi.metric)}</span></div>
                <div class="kpi-val" style="color: var(--text-muted);">2026: <span style="color: var(--text-primary); font-weight: 600;">${formatVal(v2026, kpi.metric)}</span></div>
                <div class="kpi-change ${changeClass}" style="font-weight: 600; text-align: right;">${changeIcon} ${Math.abs(pctChange).toFixed(1)}%</div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="analysis-card">
            <h3 class="analysis-card__title">⚖️ Market Regime Comparison (2025 vs 2026)</h3>
            <div class="kpi-grid">
                ${kpiHtml}
            </div>
            <div class="analysis-footer">
                * Comparison based on Sep-Dec 2025 vs Jan-Apr 2026 available data.
            </div>
        </div>
    `;

    return container;
}
