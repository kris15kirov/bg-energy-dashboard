// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Mock Data Generator
// ═══════════════════════════════════════════════════════

import { addHours, startOfHour, subDays, format } from 'date-fns';

const HOURS_BACK = 7 * 24;   // 1 week historical
const HOURS_FWD = 14 * 24;  // 2 weeks forecast
const TOTAL_HOURS = HOURS_BACK + HOURS_FWD;

function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function noise(rng, amplitude) {
    return (rng() - 0.5) * 2 * amplitude;
}

function dailyCycle(hour, peak, trough) {
    // Peak around 19:00, trough around 04:00
    const t = ((hour - 4 + 24) % 24) / 24;
    const val = trough + (peak - trough) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t - 0.25)));
    return val;
}

function solarCurve(hour) {
    // Bell curve: sunrise ~6, peak ~12, sunset ~18
    if (hour < 6 || hour > 19) return 0;
    const t = (hour - 6) / 13;
    return Math.sin(t * Math.PI);
}

function generateTimestamps(now) {
    const start = subDays(startOfHour(now), 7);
    const timestamps = [];
    for (let i = 0; i < TOTAL_HOURS; i++) {
        timestamps.push(addHours(start, i));
    }
    return timestamps;
}

function generateSeries(timestamps, nowIdx, genFn, seed = 42) {
    const rng = seededRandom(seed);
    const actuals = [];
    const forecasts = { ec: [], ecsr: [], gfs: [], icon: [], iconsr: [] };

    let prevVal = genFn(timestamps[0].getHours(), rng, 0);

    for (let i = 0; i < timestamps.length; i++) {
        const hour = timestamps[i].getHours();
        const dayOfWeek = timestamps[i].getDay();
        const baseVal = genFn(hour, rng, i, dayOfWeek, prevVal);
        prevVal = baseVal;

        if (i <= nowIdx) {
            actuals.push(baseVal);
        } else {
            actuals.push(null);
        }

        // Forecast models diverge slightly from the base
        forecasts.ec.push(baseVal + noise(rng, baseVal * 0.06));
        forecasts.ecsr.push(baseVal + noise(rng, baseVal * 0.07));
        forecasts.gfs.push(baseVal + noise(rng, baseVal * 0.08));
        forecasts.icon.push(baseVal + noise(rng, baseVal * 0.05));
        forecasts.iconsr.push(baseVal + noise(rng, baseVal * 0.09));
    }

    return { actuals, forecasts };
}

// ── Individual metric generators ────────────────────────

function spotPriceGen(hour, rng, i, dow, prev) {
    const base = dailyCycle(hour, 180, 60);
    const weekendDip = (dow === 0 || dow === 6) ? -25 : 0;
    const trend = Math.sin(i / 80) * 30;
    const n = noise(rng, 20);
    return Math.max(10, base + weekendDip + trend + n);
}

function netExportGen(hour, rng, i, dow, prev) {
    const base = dailyCycle(hour, 1500, -1000);
    return base + noise(rng, 500);
}

function consumptionGen(hour, rng, i, dow, prev) {
    const base = dailyCycle(hour, 5200, 3600);
    const weekendDip = (dow === 0 || dow === 6) ? -400 : 0;
    return base + weekendDip + noise(rng, 200);
}

function windGen(hour, rng, i, dow, prev) {
    // Wind is largely random with slow variation
    const base = 200 + Math.sin(i / 30) * 150;
    const n = noise(rng, 120);
    return Math.max(0, base + n + (prev || 200) * 0.1);
}

function solarGen(hour, rng, i) {
    const curve = solarCurve(hour);
    const cloudFactor = 0.5 + 0.5 * Math.sin(i / 20);
    return Math.max(0, curve * 1000 * cloudFactor + noise(rng, 30));
}

function nuclearGen(hour, rng, i) {
    // Near-constant baseload with minor variation
    const base = 1500 + Math.sin(i / 200) * 200;
    return Math.max(800, base + noise(rng, 30));
}

function hydroGen(hour, rng, i) {
    const base = dailyCycle(hour, 600, 250);
    return Math.max(50, base + noise(rng, 80));
}

function gasGen(hour, rng, i, dow, prev) {
    const base = dailyCycle(hour, 450, 100);
    return Math.max(0, base + noise(rng, 60));
}

function coalGen(hour, rng, i) {
    const base = 800 + Math.sin(i / 50) * 200;
    return Math.max(100, base + noise(rng, 80));
}

function ligniteGen(hour, rng, i) {
    const base = 600 + Math.sin(i / 60) * 150;
    return Math.max(50, base + noise(rng, 60));
}

function temperatureGen(hour, rng, i) {
    const daily = dailyCycle(hour, 12, 3);
    const seasonal = Math.sin(i / 300) * 5;
    return daily + seasonal + noise(rng, 2);
}

function precipitationGen(hour, rng, i) {
    const base = 2 + Math.sin(i / 40) * 3;
    return Math.max(0, base + noise(rng, 2));
}

function residualProdGen(hour, rng, i, dow) {
    const base = dailyCycle(hour, 4000, 2500);
    return base + noise(rng, 300);
}

function residualLoadGen(hour, rng, i, dow) {
    const base = dailyCycle(hour, 3500, 1800);
    const weekendDip = (dow === 0 || dow === 6) ? -300 : 0;
    return Math.max(500, base + weekendDip + noise(rng, 200));
}

// ── Main export ──────────────────────────────────────────

export function generateAllData() {
    const now = startOfHour(new Date());
    const timestamps = generateTimestamps(now);
    const nowIdx = HOURS_BACK;

    const generators = {
        spotPrice: { fn: spotPriceGen, seed: 101 },
        netExport: { fn: netExportGen, seed: 202 },
        consumption: { fn: consumptionGen, seed: 303 },
        wind: { fn: windGen, seed: 404 },
        solar: { fn: solarGen, seed: 505 },
        nuclear: { fn: nuclearGen, seed: 606 },
        hydro: { fn: hydroGen, seed: 707 },
        gas: { fn: gasGen, seed: 808 },
        coal: { fn: coalGen, seed: 909 },
        lignite: { fn: ligniteGen, seed: 111 },
        temperature: { fn: temperatureGen, seed: 222 },
        precipitation: { fn: precipitationGen, seed: 333 },
        residualProd: { fn: residualProdGen, seed: 444 },
        residualLoad: { fn: residualLoadGen, seed: 555 },
    };

    const data = {};
    for (const [key, { fn, seed }] of Object.entries(generators)) {
        data[key] = generateSeries(timestamps, nowIdx, fn, seed);
    }

    return {
        timestamps,
        nowIdx,
        now,
        data,
        lastUpdated: format(now, 'dd MMM yyyy HH:mm'),
    };
}
