// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — IBEX API Client
// Fetches real DAM data from the proxy server and
// transforms it into the format used by the dashboard.
//
// IBEX response format:
//   main_data: [{ product: "QH 1", delivery_period: "00:00 - 00:15",
//                 price: "138.85", volume: "3391.8" }, ...]
//   summary_data: { base_price, peak_price, off_peak_price, volume }
//   ph_data: [{ product: "PH 1", price: "...", volume: "..." }, ...]
// ═══════════════════════════════════════════════════════

const PROXY_BASE = '/api';

/**
 * Fetch DAM data for a date range
 */
export async function fetchDAMRange(from, to) {
    const res = await fetch(`${PROXY_BASE}/dam/range?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(`IBEX API error: ${res.status}`);
    return res.json();
}

/**
 * Transform IBEX DAM range data into hourly spot price time-series.
 * Averages 4 quarter-hour prices into hourly values.
 */
export function transformDAMToSpotSeries(dailyData) {
    const timestamps = [];
    const actuals = [];
    const summaries = [];

    for (const day of dailyData) {
        const dateStr = day.date;
        if (!dateStr) continue;

        // Extract hourly prices from QH data
        const hourlyPrices = qhToHourly(day.main_data || []);

        for (let h = 0; h < hourlyPrices.length; h++) {
            const dt = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00`);
            timestamps.push(dt);
            actuals.push(hourlyPrices[h]);
        }

        // Save daily summary
        const summary = extractSummary(day);
        if (summary) summaries.push({ date: dateStr, ...summary });
    }

    return {
        timestamps,
        series: {
            actuals,
            // No forecast models from IBEX — those remain mock
            forecasts: { ec: [], ecsr: [], gfs: [], icon: [], iconsr: [] },
        },
        summaries,
    };
}

/**
 * Convert QH (quarter-hour) entries to hourly averages.
 * IBEX returns 96 QH entries per day (QH 1 – QH 96).
 */
function qhToHourly(mainData) {
    if (!mainData || mainData.length === 0) return [];

    // Sort by QH number
    const sorted = [...mainData].sort((a, b) => {
        const aNum = parseInt(a.product?.replace('QH ', '') || '0');
        const bNum = parseInt(b.product?.replace('QH ', '') || '0');
        return aNum - bNum;
    });

    // Extract all prices
    const qhPrices = sorted.map(d => parseFloat(d.price) || 0);

    // Average every 4 QH into 1 hour
    const hourly = [];
    for (let h = 0; h < 24; h++) {
        const slice = qhPrices.slice(h * 4, h * 4 + 4);
        if (slice.length > 0) {
            hourly.push(slice.reduce((a, b) => a + b, 0) / slice.length);
        } else {
            hourly.push(null);
        }
    }

    return hourly;
}

/**
 * Extract daily summary from IBEX response.
 */
function extractSummary(dayData) {
    const s = dayData.summary_data || dayData;
    return {
        basePrice: parseFloat(s.base_price) || null,
        peakPrice: parseFloat(s.peak_price) || null,
        offPeakPrice: parseFloat(s.off_peak_price) || null,
        volume: parseFloat(s.volume || s.total_volume) || null,
    };
}

/**
 * Check if the proxy server is available
 */
export async function checkProxyHealth() {
    try {
        const res = await fetch(`${PROXY_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}
