// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Battery Arbitrage Analysis
// ═══════════════════════════════════════════════════════

export function createBatteryArbitrage(data) {
    const container = document.createElement('div');
    container.className = 'analysis-module';
    
    if (!data || !data.Battery_Summary) {
        container.innerHTML = '<p>No battery analysis data available.</p>';
        return container;
    }

    const summary = (data.Battery_Summary && data.Battery_Summary.length > 0) ? data.Battery_Summary[0] : null;
    
    if (!summary) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No summary data found in Battery Summary.</p>';
        return container;
    }

    // Determine best hours from Hourly_Profile if missing in summary
    let bestCharge = summary.best_charge_hour;
    let bestDischarge = summary.best_discharge_hour;

    if (bestCharge === undefined || bestCharge === "" || bestCharge === null) {
        const profile = data.Hourly_Profile || [];
        if (profile.length > 0) {
            const sorted = [...profile].sort((a, b) => a.avg_price - b.avg_price);
            bestCharge = sorted[0].hour;
            bestDischarge = [...profile].sort((a, b) => b.avg_price - a.avg_price)[0].hour;
        } else {
            bestCharge = 4;
            bestDischarge = 19;
        }
    }

    const baseProfit = summary.avg_daily_revenue_eur_per_mwh || summary.avg_monthly_profit_90_eff || 0;
    const dailySpread = summary.avg_daily_spread || 0;
    const profitableDays = (summary.profitable_days_pct || 0) * 100;

    container.innerHTML = `
        <div class="analysis-card">
            <h3 class="analysis-card__title">🔋 Battery Arbitrage Optimization</h3>
            
            <div class="battery-settings">
                <div class="setting-item">
                    <label>Round-trip Efficiency</label>
                    <input type="range" id="battery-eff" min="70" max="100" value="90" step="1">
                    <span id="eff-val">90%</span>
                </div>
            </div>

            <div class="analysis-table-wrapper" style="margin-bottom: 1.5rem;">
                <table class="analysis-table">
                    <thead>
                        <tr>
                            <th class="analysis-table__header">Metric</th>
                            <th class="analysis-table__header" style="text-align: right;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="analysis-table__row">
                            <td class="analysis-table__cell analysis-table__cell--label">Best Charge Hour</td>
                            <td class="analysis-table__cell" style="text-align: right; font-weight: 600;">${String(bestCharge).padStart(2, '0')}:00</td>
                        </tr>
                        <tr class="analysis-table__row">
                            <td class="analysis-table__cell analysis-table__cell--label">Best Discharge Hour</td>
                            <td class="analysis-table__cell" style="text-align: right; font-weight: 600;">${String(bestDischarge).padStart(2, '0')}:00</td>
                        </tr>
                        <tr class="analysis-table__row">
                            <td class="analysis-table__cell analysis-table__cell--label">Avg Daily Spread</td>
                            <td class="analysis-table__cell" style="text-align: right; font-weight: 600;">${dailySpread.toFixed(2)} EUR</td>
                        </tr>
                        <tr class="analysis-table__row">
                            <td class="analysis-table__cell analysis-table__cell--label">Profitable Days</td>
                            <td class="analysis-table__cell" style="text-align: right; font-weight: 600;">${profitableDays.toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="revenue-estimate">
                <h4>Daily Revenue Estimate (1MW / 1MWh)</h4>
                <div class="rev-val" id="rev-display">${baseProfit.toFixed(2)} EUR</div>
            </div>
        </div>
    `;

    // Interaction logic
    setTimeout(() => {
        const slider = container.querySelector('#battery-eff');
        const display = container.querySelector('#eff-val');
        const revDisplay = container.querySelector('#rev-display');

        slider?.addEventListener('input', (e) => {
            const eff = parseInt(e.target.value);
            display.textContent = `${eff}%`;
            const multiplier = eff / 90;
            const newProfit = baseProfit * multiplier;
            revDisplay.textContent = `${newProfit.toFixed(2)} EUR`;
        });
    }, 100);

    return container;
}
