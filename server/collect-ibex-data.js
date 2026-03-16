// ═══════════════════════════════════════════════════════
// IBEX DAM QH Data Collector
// Fetches all QH prices from Jan 1, 2026 to today via
// the proxy server, then computes mean & median per
// QH slot per month and exports CSV + JSON.
//
// Usage:
//   1. Start proxy:  node server/proxy.js
//   2. Run this:     node server/collect-ibex-data.js
// ═══════════════════════════════════════════════════════

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROXY = 'http://localhost:3001';
const START_DATE = '2026-01-01';
// Latest delivery day with published data — yesterday
const END_DATE = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
})();

// QH slot labels (QH 1 = 00:00–00:15, ..., QH 96 = 23:45–00:00)
function slotLabel(n) {
    const startMin = (n - 1) * 15;
    const h1 = String(Math.floor(startMin / 60)).padStart(2, '0');
    const m1 = String(startMin % 60).padStart(2, '0');
    const endMin = n * 15;
    const h2 = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
    const m2 = String(endMin % 60).padStart(2, '0');
    return `${h1}:${m1}-${h2}:${m2}`;
}

// ── Helpers ──────────────────────────────────────────

function median(arr) {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr) {
    if (arr.length === 0) return null;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function dateRange(from, to) {
    const dates = [];
    const cur = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (cur <= end) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

// ── Main ─────────────────────────────────────────────

async function main() {
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  IBEX QH Data Collector                          ║`);
    console.log(`║  Range: ${START_DATE} → ${END_DATE}              ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);

    // Check proxy is alive
    try {
        const health = await fetch(`${PROXY}/api/health`);
        if (!health.ok) throw new Error(`status ${health.status}`);
    } catch (err) {
        console.error(`❌  Proxy server not reachable at ${PROXY}`);
        console.error(`    Start it first:  node server/proxy.js`);
        process.exit(1);
    }
    console.log(`✔  Proxy server is running\n`);

    const dates = dateRange(START_DATE, END_DATE);
    console.log(`   Fetching ${dates.length} days of data...\n`);

    // month → slot → [prices]
    const byMonth = {};
    // Also keep the raw daily data
    const rawDays = [];
    let fetched = 0;
    let errors = 0;

    for (const date of dates) {
        try {
            const res = await fetch(`${PROXY}/api/dam?date=${date}`);
            if (!res.ok) {
                console.warn(`   ⚠  ${date}: HTTP ${res.status}`);
                errors++;
                await sleep(300);
                continue;
            }

            const data = await res.json();

            if (data.error) {
                console.warn(`   ⚠  ${date}: ${data.error}`);
                errors++;
                await sleep(300);
                continue;
            }

            const mainData = data.main_data || [];
            if (mainData.length === 0) {
                console.warn(`   ⚠  ${date}: no QH data`);
                errors++;
                await sleep(200);
                continue;
            }

            // Determine month key
            const monthKey = date.slice(0, 7); // "2026-01"
            if (!byMonth[monthKey]) {
                byMonth[monthKey] = {};
                for (let s = 1; s <= 96; s++) byMonth[monthKey][s] = [];
            }

            // Sort by QH number and push prices
            const sorted = [...mainData].sort((a, b) => {
                const an = parseInt(a.product?.replace('QH ', '') || '0');
                const bn = parseInt(b.product?.replace('QH ', '') || '0');
                return an - bn;
            });

            for (const entry of sorted) {
                const slotNum = parseInt(entry.product?.replace('QH ', '') || '0');
                const price = parseFloat(entry.price);
                if (slotNum >= 1 && slotNum <= 96 && !isNaN(price)) {
                    byMonth[monthKey][slotNum].push(price);
                }
            }

            rawDays.push({ date, main_data: sorted, summary_data: data.summary_data });
            fetched++;

            // Progress
            if (fetched % 10 === 0 || fetched === dates.length) {
                process.stdout.write(`\r   📊  ${fetched}/${dates.length} days fetched (${errors} errors)`);
            }

            await sleep(200);
        } catch (err) {
            console.warn(`   ❌  ${date}: ${err.message}`);
            errors++;
            await sleep(500);
        }
    }

    console.log(`\n\n   ✔  Collection complete: ${fetched} days, ${errors} errors\n`);

    // ── Compute stats ────────────────────────────────

    const months = Object.keys(byMonth).sort();
    const statsRows = [];

    for (const month of months) {
        for (let slot = 1; slot <= 96; slot++) {
            const prices = byMonth[month][slot];
            statsRows.push({
                month,
                slot,
                period: slotLabel(slot),
                count: prices.length,
                mean: mean(prices),
                median: median(prices),
                min: prices.length > 0 ? Math.min(...prices) : null,
                max: prices.length > 0 ? Math.max(...prices) : null,
            });
        }
    }

    // ── Print summary table ──────────────────────────

    console.log(`   Monthly summary (Base price averages):\n`);
    for (const month of months) {
        const slots = statsRows.filter(r => r.month === month);
        const allMeans = slots.map(s => s.mean).filter(v => v !== null);
        const overallMean = mean(allMeans);
        const overallMedian = median(allMeans);
        console.log(`   ${month}:  Mean = ${overallMean?.toFixed(2)} EUR/MWh  |  Median = ${overallMedian?.toFixed(2)} EUR/MWh  |  Days = ${slots[0]?.count || 0}`);
    }
    console.log('');

    // ── Write CSV ────────────────────────────────────

    const csvHeader = 'Month,Slot,Period,Days,Mean_EUR_MWh,Median_EUR_MWh,Min_EUR_MWh,Max_EUR_MWh';
    const csvLines = statsRows.map(r =>
        `${r.month},${r.slot},${r.period},${r.count},${r.mean?.toFixed(2) ?? ''},${r.median?.toFixed(2) ?? ''},${r.min?.toFixed(2) ?? ''},${r.max?.toFixed(2) ?? ''}`
    );
    const csvPath = join(__dirname, 'ibex-qh-monthly-stats.csv');
    writeFileSync(csvPath, [csvHeader, ...csvLines].join('\n'), 'utf-8');
    console.log(`   📄  CSV saved to: ${csvPath}`);

    // ── Write JSON ───────────────────────────────────

    const jsonPath = join(__dirname, 'ibex-qh-data.json');
    writeFileSync(jsonPath, JSON.stringify({
        meta: {
            startDate: START_DATE,
            endDate: END_DATE,
            fetchedDays: fetched,
            errors,
            generatedAt: new Date().toISOString(),
        },
        monthlyStats: statsRows,
        rawDays,
    }, null, 2), 'utf-8');
    console.log(`   📄  JSON saved to: ${jsonPath}`);

    console.log(`\n   ✅  Done!\n`);
}

main().catch(err => {
    console.error(`\n❌  Fatal error: ${err.message}`);
    process.exit(1);
});
