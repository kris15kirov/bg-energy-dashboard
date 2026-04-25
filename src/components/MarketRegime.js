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

    const formatVal = (val, metric) => {
        if (typeof val !== 'number') return 'N/A';
        if (metric.includes('pct')) return (val * 100).toFixed(2) + '%';
        return val.toFixed(2);
    };

    let tableRows = '';
    kpis.forEach(kpi => {
        const metricKey = kpi.metric || kpi.Metric || '';
        const label = labelMap[metricKey] || metricKey || 'Unknown KPI';
        const v2025 = kpi['Sep-Dec 2025'] || 0;
        const v2026 = kpi['Jan-Apr 2026'] || 0;
        const pctChange = (typeof kpi.pct_change === 'number') ? kpi.pct_change * 100 : 
                          (typeof kpi.pct_change_abs === 'number' ? kpi.pct_change_abs * 100 : 0);
        
        const colorClass = pctChange >= 0 ? 'text-positive' : 'text-negative';
        const changeIcon = pctChange >= 0 ? '▲' : '▼';

        tableRows += `
            <tr class="analysis-table__row">
                <td class="analysis-table__cell analysis-table__cell--label">${label}</td>
                <td class="analysis-table__cell">${formatVal(v2025, kpi.metric)}</td>
                <td class="analysis-table__cell">${formatVal(v2026, kpi.metric)}</td>
                <td class="analysis-table__cell analysis-table__cell--change">
                    <span class="change-badge ${colorClass}">
                        ${changeIcon} ${Math.abs(pctChange).toFixed(1)}%
                    </span>
                </td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="analysis-card">
            <h3 class="analysis-card__title">⚖️ Market Regime Comparison (2025 vs 2026)</h3>
            <div class="analysis-table-wrapper">
                <table class="analysis-table">
                    <thead>
                        <tr>
                            <th class="analysis-table__header" style="min-width: 140px;">Metric</th>
                            <th class="analysis-table__header">2025</th>
                            <th class="analysis-table__header">2026</th>
                            <th class="analysis-table__header" style="text-align: right;">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            <div class="analysis-footer">
                * Comparison based on Sep-Dec 2025 vs Jan-Apr 2026.
            </div>
        </div>
    `;

    return container;
}
