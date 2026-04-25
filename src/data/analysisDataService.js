// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Analysis Data Service
// Loads pre-calculated analysis from ibex-analysis.json
// ═══════════════════════════════════════════════════════

const DATA_URL = '/data/ibex-analysis.json';

let cachedAnalysis = null;

export async function loadAnalysisData() {
    if (cachedAnalysis) return cachedAnalysis;

    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`Failed to load analysis data: ${res.status}`);
        cachedAnalysis = await res.json();
        console.log('[AnalysisData] Loaded pre-calculated analysis');
        return cachedAnalysis;
    } catch (err) {
        console.error('[AnalysisData] Error loading analysis:', err.message);
        return null;
    }
}

export function getComparisonKPIs(data) {
    if (!data || !data.Comparison_2025_vs_2026) return [];
    return data.Comparison_2025_vs_2026;
}

export function getMonthlySummary(data) {
    if (!data || !data.Monthly_Summary) return [];
    return data.Monthly_Summary;
}

export function getBatterySummary(data) {
    if (!data || !data.Battery_Summary) return [];
    return data.Battery_Summary;
}

export function getHourlyProfile(data) {
    if (!data || !data.Hourly_Profile) return [];
    return data.Hourly_Profile;
}

export function getExecutiveInsights(data) {
    if (!data || !data.Executive_Insights) return [];
    return data.Executive_Insights;
}

export function getDailyBattery(data) {
    if (!data || !data.Daily_Battery) return [];
    return data.Daily_Battery;
}
