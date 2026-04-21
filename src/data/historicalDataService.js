// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Historical Data Service
//
// Loads the exported IBEX historical JSON and provides
// filtering by year, quarter, month, and date range.
// ═══════════════════════════════════════════════════════

const DATA_URL = '/data/ibex-historical.json';

let cachedRaw = null;

const QUARTER_MONTHS = {
    Q1: [1, 2, 3],
    Q2: [4, 5, 6],
    Q3: [7, 8, 9],
    Q4: [10, 11, 12],
};

const MONTH_NAMES = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Load historical data from the exported JSON.
 * Caches the parsed result for subsequent calls.
 */
export async function loadHistoricalData() {
    if (cachedRaw) return cachedRaw;

    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load historical data: ${res.status}`);

    const json = await res.json();

    // Parse datetime strings into Date objects and add year/quarter fields
    const records = json.records.map(r => {
        const dt = new Date(r.dt);
        const year = dt.getFullYear();
        const month = r.m;
        const quarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
        return {
            datetime: dt,
            price: r.p,
            hour: r.h,
            day: r.d,
            month,
            year,
            quarter,
        };
    });

    cachedRaw = {
        meta: json.meta,
        records,
    };

    console.log(`[HistoricalData] Loaded ${records.length} records (${json.meta.dateRange.start} → ${json.meta.dateRange.end})`);

    return cachedRaw;
}

/**
 * Filter records by year, quarter, and month.
 * Pass null/undefined to skip a filter.
 */
export function filterRecords(records, { year = null, quarter = null, month = null } = {}) {
    let filtered = records;

    if (year != null) {
        filtered = filtered.filter(r => r.year === year);
    }

    if (quarter != null && quarter !== 'All') {
        const months = QUARTER_MONTHS[quarter];
        if (months) {
            filtered = filtered.filter(r => months.includes(r.month));
        }
    }

    if (month != null && month !== 0) {
        filtered = filtered.filter(r => r.month === month);
    }

    return filtered;
}

/**
 * Get available filter options from the data.
 */
export function getFilterOptions(records) {
    const years = [...new Set(records.map(r => r.year))].sort();
    const months = [...new Set(records.map(r => r.month))].sort((a, b) => a - b);
    const quarters = [...new Set(records.map(r => r.quarter))].sort();

    return { years, months, quarters };
}

/**
 * Compute summary statistics for a set of records.
 */
export function computeStats(records) {
    if (records.length === 0) {
        return {
            count: 0, days: 0, avgPrice: 0, medianPrice: 0,
            minPrice: 0, maxPrice: 0, stdPrice: 0,
            negativeHours: 0, lowHours: 0, highHours: 0,
        };
    }

    const prices = records.map(r => r.price).sort((a, b) => a - b);
    const n = prices.length;
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / n;
    const median = n % 2 === 0
        ? (prices[n / 2 - 1] + prices[n / 2]) / 2
        : prices[Math.floor(n / 2)];

    const variance = prices.reduce((acc, p) => acc + (p - avg) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    const uniqueDays = new Set(records.map(r =>
        `${r.year}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`
    )).size;

    return {
        count: n,
        days: uniqueDays,
        avgPrice: avg,
        medianPrice: median,
        minPrice: prices[0],
        maxPrice: prices[n - 1],
        stdPrice: std,
        negativeHours: prices.filter(p => p <= 0).length,
        lowHours: prices.filter(p => p < 20).length,
        highHours: prices.filter(p => p > 70).length,
    };
}

/**
 * Group records by a time key for chart display.
 */
export function groupByDay(records) {
    const map = new Map();
    for (const r of records) {
        const key = `${r.year}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
    }
    return map;
}

/**
 * Compute daily averages for chart display.
 */
export function dailyAverages(records) {
    const dayMap = groupByDay(records);
    const result = [];
    for (const [dateStr, dayRecords] of dayMap) {
        const avgPrice = dayRecords.reduce((s, r) => s + r.price, 0) / dayRecords.length;
        const minPrice = Math.min(...dayRecords.map(r => r.price));
        const maxPrice = Math.max(...dayRecords.map(r => r.price));
        result.push({
            date: new Date(dateStr),
            dateStr,
            avgPrice,
            minPrice,
            maxPrice,
            count: dayRecords.length,
        });
    }
    return result.sort((a, b) => a.date - b.date);
}

/**
 * Compute hourly profile (average price per hour of day).
 */
export function hourlyProfile(records) {
    const hourSums = new Array(24).fill(0);
    const hourCounts = new Array(24).fill(0);
    for (const r of records) {
        hourSums[r.hour] += r.price;
        hourCounts[r.hour]++;
    }
    return hourSums.map((sum, h) => ({
        hour: h,
        avgPrice: hourCounts[h] > 0 ? sum / hourCounts[h] : 0,
        count: hourCounts[h],
    }));
}

/**
 * Compute monthly summary.
 */
export function monthlySummary(records) {
    const map = new Map();
    for (const r of records) {
        const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
    }

    const result = [];
    for (const [key, monthRecords] of map) {
        const prices = monthRecords.map(r => r.price);
        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
        const [yearStr, monthStr] = key.split('-');
        result.push({
            key,
            year: parseInt(yearStr),
            month: parseInt(monthStr),
            monthName: MONTH_SHORT[parseInt(monthStr)],
            avgPrice: avg,
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
            count: prices.length,
            days: new Set(monthRecords.map(r => r.day)).size,
        });
    }
    return result.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Filter records by a custom date range (inclusive).
 */
export function filterByDateRange(records, startDate, endDate) {
    if (!startDate && !endDate) return records;
    return records.filter(r => {
        if (startDate && r.datetime < startDate) return false;
        if (endDate && r.datetime > endDate) return false;
        return true;
    });
}

/**
 * Compute daily averages with day-over-day % change.
 */
export function dailyAveragesWithDelta(records) {
    const daily = dailyAverages(records);
    for (let i = 0; i < daily.length; i++) {
        if (i === 0) {
            daily[i].deltaAbs = null;
            daily[i].deltaPct = null;
        } else {
            const prev = daily[i - 1].avgPrice;
            const curr = daily[i].avgPrice;
            daily[i].deltaAbs = curr - prev;
            daily[i].deltaPct = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;
        }
    }
    return daily;
}

/**
 * Compute rolling (moving) averages over daily data.
 * @param {Array} dailyData — output of dailyAverages()
 * @param {number} window — window size in days (e.g. 7 or 30)
 * @returns {Array} same items with added `rollingAvg` property
 */
export function computeRollingAverage(dailyData, window) {
    const result = [];
    for (let i = 0; i < dailyData.length; i++) {
        if (i < window - 1) {
            result.push({ ...dailyData[i], rollingAvg: null });
        } else {
            let sum = 0;
            for (let j = i - window + 1; j <= i; j++) {
                sum += dailyData[j].avgPrice;
            }
            result.push({ ...dailyData[i], rollingAvg: sum / window });
        }
    }
    return result;
}

/**
 * Compute weekly averages from records.
 */
export function weeklyAverages(records) {
    const weekMap = new Map();
    for (const r of records) {
        const d = r.datetime;
        // ISO week: get the Monday of the week
        const dayOfWeek = d.getDay() || 7; // Sunday = 7
        const monday = new Date(d);
        monday.setDate(d.getDate() - dayOfWeek + 1);
        const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key).push(r);
    }

    const result = [];
    for (const [weekStart, weekRecords] of weekMap) {
        const prices = weekRecords.map(r => r.price);
        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
        result.push({
            weekStart,
            weekStartDate: new Date(weekStart),
            avgPrice: avg,
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
            hours: prices.length,
            days: new Set(weekRecords.map(r => `${r.year}-${r.month}-${r.day}`)).size,
        });
    }
    return result.sort((a, b) => a.weekStartDate - b.weekStartDate);
}

/**
 * Year-over-Year comparison.
 * Returns data structured for overlaying multiple years on the same
 * month-day axis. Each entry has { monthDay, years: { 2025: avgPrice, 2026: avgPrice } }.
 */
export function computeYoYComparison(records) {
    const years = [...new Set(records.map(r => r.year))].sort();
    if (years.length < 2) return { years, dailyByYear: {}, monthlyByYear: {} };

    // Daily by year: group by (year, month, day) → avg price
    const dailyByYear = {};
    const monthlyByYear = {};

    for (const year of years) {
        const yearRecords = records.filter(r => r.year === year);
        dailyByYear[year] = dailyAverages(yearRecords).map(d => ({
            ...d,
            // Normalize to a common year (2000) for overlay alignment
            alignedDate: new Date(2000, d.date.getMonth(), d.date.getDate()),
            monthDay: `${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.date.getDate()).padStart(2, '0')}`,
        }));
        monthlyByYear[year] = monthlySummary(yearRecords);
    }

    return { years, dailyByYear, monthlyByYear };
}

export { MONTH_NAMES, MONTH_SHORT, QUARTER_MONTHS };
