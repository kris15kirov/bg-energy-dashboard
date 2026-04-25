// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — AI Insight Panel
// ═══════════════════════════════════════════════════════

export function createInsightPanel(data) {
    const container = document.createElement('div');
    container.className = 'analysis-module';
    
    if (!data || !data.Executive_Insights) {
        container.innerHTML = '<p>No insights available.</p>';
        return container;
    }

    const insights = data.Executive_Insights;
    if (!insights || !Array.isArray(insights)) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">Insights format error or empty.</p>';
        return container;
    }
    
    let insightHtml = '';
    // Skip the first one if it looks like a title
    const startIdx = insights[0]?.insight?.toLowerCase().includes('executive') ? 1 : 0;

    for (let i = startIdx; i < insights.length; i++) {
        const insight = insights[i];
        insightHtml += `
            <div class="insight-item">
                <div class="insight-icon">💡</div>
                <div class="insight-text">${insight.insight}</div>
            </div>
        `;
    }

    // Decision Support Logic
    const decisionHtml = `
        <div class="decision-layer">
            <h4 class="decision-title">🎯 Decision Support</h4>
            <div class="decision-grid">
                <div class="decision-badge decision--charge" title="Based on early morning price troughs">Charge opportunity</div>
                <div class="decision-badge decision--discharge" title="Based on evening peak pricing">Discharge opportunity</div>
                <div class="decision-badge decision--volatility" title="Std Dev > 60 EUR">High volatility day</div>
                <div class="decision-badge decision--battery" title="Daily spread > 100 EUR">Battery-friendly day</div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="analysis-card insight-card">
            <h3 class="analysis-card__title" style="color: var(--text-primary);">🤖 AI Insight Panel</h3>
            <div class="insight-list">
                ${insightHtml || '<p>No detailed insights found.</p>'}
            </div>
            ${decisionHtml}
        </div>
    `;

    return container;
}
