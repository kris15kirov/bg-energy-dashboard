// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Data Service (Hybrid)
// Uses IBEX live data for spot prices when proxy is
// available, falls back to mock data otherwise.
// ═══════════════════════════════════════════════════════

import { generateAllData } from './mockDataGenerator.js';
import { fetchDAMRange, transformDAMToSpotSeries, checkProxyHealth } from './ibexService.js';
import { fetchWeatherRange } from './weatherService.js';
import { format, subDays, addDays, startOfHour } from 'date-fns';

let cachedData = null;
let ibexSpotData = null;
let isLive = false;

function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class DataService {
    constructor() {
        if (!cachedData) {
            cachedData = generateAllData();
        }
        this.data = cachedData;
    }

    /**
     * Try to fetch live IBEX DAM data. Falls back to mock on failure.
     * Call this once at startup before rendering charts.
     */
    async initLiveData() {
        try {
            const proxyUp = await checkProxyHealth();
            if (!proxyUp) {
                console.warn('[DataService] Proxy not available — using mock data');
                return false;
            }

            const now = new Date();
            const from = formatDate(subDays(now, 7));
            const tomorrow = addDays(now, 1);
            const to = formatDate(tomorrow);

            console.log(`[DataService] Fetching IBEX DAM data from ${from} to ${to}...`);
            const rawData = await fetchDAMRange(from, to);

            if (!rawData || rawData.length === 0 || rawData.error) {
                console.warn('[DataService] No IBEX data returned — using mock data');
                return false;
            }

            // Store the raw response for the latest day (for the IBEX table)
            const lastDay = rawData[rawData.length - 1];
            if (lastDay && lastDay.main_data) {
                this._latestDAMRaw = lastDay;
                this._deliveryDate = lastDay.date || formatDate(tomorrow);
            }

            ibexSpotData = transformDAMToSpotSeries(rawData);

            if (ibexSpotData.timestamps.length > 0) {
                this._mergeIBEXSpot();
                isLive = true;
                console.log(`[DataService] ✓ Loaded ${ibexSpotData.timestamps.length} real IBEX hourly prices`);
                return true;
            }

            console.warn('[DataService] IBEX data parsed but empty — using mock data');
            return false;
        } catch (err) {
            console.warn('[DataService] Failed to fetch IBEX data:', err.message);
            return false;
        }
    }

    async initWeatherData() {
        try {
            const now = new Date();
            const from = subDays(now, 7);
            const to = addDays(now, 1);
            
            console.log(`[DataService] Fetching Open-Meteo data from ${formatDate(from)} to ${formatDate(to)}...`);
            const weather = await fetchWeatherRange(42.70, 23.32, from, to);
            
            if (weather && weather.length > 0) {
                this._weatherData = weather;
                console.log(`[DataService] ✓ Loaded ${weather.length} weather records`);
                return true;
            }
            return false;
        } catch (err) {
            console.warn('[DataService] Failed to fetch Weather data:', err.message);
            return false;
        }
    }

    _mergeIBEXSpot() {
        if (!ibexSpotData || ibexSpotData.timestamps.length === 0) return;

        // Replace the spot price actuals with real IBEX data
        const ibexTs = ibexSpotData.timestamps;
        const ibexPrices = ibexSpotData.series.actuals;

        // Find the overlap between mock timestamps and IBEX timestamps
        const mockTimestamps = this.data.timestamps;
        const spotSeries = this.data.data.spotPrice;

        // Create a map of IBEX data by timestamp
        const ibexMap = new Map();
        for (let i = 0; i < ibexTs.length; i++) {
            if (ibexPrices[i] !== null && ibexPrices[i] !== 0) {
                ibexMap.set(ibexTs[i].getTime(), ibexPrices[i]);
            }
        }

        // Override mock spot prices where IBEX data exists
        let replaced = 0;
        for (let i = 0; i < mockTimestamps.length; i++) {
            const key = mockTimestamps[i].getTime();
            if (ibexMap.has(key)) {
                spotSeries.actuals[i] = ibexMap.get(key);
                replaced++;
            }
        }

        console.log(`[DataService] Replaced ${replaced} mock spot prices with IBEX actuals`);

        // Store summaries for the commentary component
        this.ibexSummaries = ibexSpotData.summaries || [];
    }

    isLive() { return isLive; }
    getTimestamps() { return this.data.timestamps; }
    getNowIndex() { return this.data.nowIdx; }
    getNow() { return this.data.now; }
    getLastUpdated() {
        return isLive
            ? format(new Date(), 'dd MMM yyyy HH:mm') + ' (IBEX Live)'
            : this.data.lastUpdated;
    }
    getIBEXSummaries() { return this.ibexSummaries || []; }
    getLatestDAMRaw() { return this._latestDAMRaw || null; }
    getDeliveryDate() { return this._deliveryDate || null; }
    
    getWeatherData() { return this._weatherData || []; }
    getWeatherSignals() { 
        if (!this._weatherData) return [];
        return this._weatherData.map(w => ({
            datetime: w.datetime,
            isSunny: w.isSunny,
            isExtremeTemp: w.isExtremeTemp,
            isHighWind: w.isHighWind
        }));
    }

    getSeries(key) {
        return this.data.data[key] || null;
    }

    getAllData() {
        return this.data;
    }
}
