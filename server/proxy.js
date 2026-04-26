// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — Production Proxy & Static Server
// ═══════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import https from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

const IBEX_PAGE = 'https://ibex.bg/sdac-mc-en/';
const IBEX_API = 'https://ibex.bg/Ext/SDAC_PROD/MC_Table/api/get_data.php';

app.use(cors());
app.use(express.json());

// ── Local JSON Cache (Fallback) ──────────────────────
let localCache = new Map();
try {
    const jsonPath = join(__dirname, 'ibex-qh-data.json');
    if (existsSync(jsonPath)) {
        const raw = readFileSync(jsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.rawDays && Array.isArray(parsed.rawDays)) {
            for (const d of parsed.rawDays) {
                if (d.date) localCache.set(d.date, d);
            }
            console.log(`[Proxy] Loaded ${localCache.size} days from ibex-qh-data.json`);
        }
    }
} catch (err) {
    console.warn(`[Proxy] Failed to load ibex-qh-data.json: ${err.message}`);
}

// ── HTTP helpers ─────────────────────────────────────
function httpsRequest(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, text/html, */*',
            },
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body,
            }));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}


// ── IBEX Session State ───────────────────────────────
let csrfToken = null;
let sessionCreated = 0;
const SESSION_TTL = 30 * 60 * 1000; // CSRF token usually lasts longer

async function fetchToken() {
    console.log('[IBEX] Fetching new CSRF token...');
    const res = await httpsRequest(IBEX_PAGE);
    const match = res.body.match(/const csrfToken = "([^"]+)"/);
    if (!match) throw new Error('Could not find CSRF token in IBEX page');
    csrfToken = match[1];
    sessionCreated = Date.now();
    console.log(`[IBEX] Token acquired`);
}

async function ensureToken() {
    if (!csrfToken || Date.now() - sessionCreated > SESSION_TTL) {
        await fetchToken();
    }
}

async function fetchDAMData(date, retried = false) {
    // date is YYYY-MM-DD, convert to DD.MM.YYYY
    const [y, m, d] = date.split('-');
    const ibexDate = `${d}.${m}.${y}`;
    
    await ensureToken();
    const url = `${IBEX_API}?date=${ibexDate}&csrf_token=${csrfToken}&rand=${Math.random()}`;
    
    try {
        const res = await httpsRequest(url);
        if (res.body.includes('Access denied')) throw new Error('Access Denied');
        
        const raw = JSON.parse(res.body);
        if (!raw.data || !Array.isArray(raw.data)) throw new Error('Invalid API response structure');

        // Map the new hourly format to the old QH format for frontend compatibility
        const main_data = [];
        let totalVolume = 0;
        let totalPrice = 0;
        let peakPrice = 0;
        let peakCount = 0;
        
        raw.data.forEach((h, idx) => {
            const price = parseFloat(h.bg_prices) || 0;
            const volume = parseFloat(h.bg_volumes) || 0;
            totalVolume += volume;
            totalPrice += price;
            
            // Peak hours (08:00 - 20:00)
            if (idx >= 8 && idx < 20) {
                peakPrice += price;
                peakCount++;
            }

            // Create 4 QH entries for each hour
            for (let q = 1; q <= 4; q++) {
                const qNum = idx * 4 + q;
                const startMin = (q - 1) * 15;
                const endMin = q * 15;
                const period = `${String(idx).padStart(2, '0')}:${String(startMin).padStart(2, '0')} - ${String(q === 4 ? idx + 1 : idx).padStart(2, '0')}:${String(q === 4 ? '00' : endMin).padStart(2, '0')}`;
                
                main_data.push({
                    product: `QH ${qNum}`,
                    delivery_period: period,
                    price: price.toFixed(2),
                    volume: (volume / 4).toFixed(2)
                });
            }
        });

        const base_price = (totalPrice / 24).toFixed(2);
        const peak_price = (peakPrice / peakCount).toFixed(2);
        
        return {
            date,
            main_data,
            summary_data: {
                base_price,
                peak_price,
                off_peak_price: ((totalPrice - peakPrice) / (24 - peakCount)).toFixed(2),
                volume: totalVolume.toFixed(2)
            }
        };
    } catch (err) {
        if (!retried) {
            csrfToken = null;
            return fetchDAMData(date, true);
        }
        throw err;
    }
}

// ── In-Memory API Cache ──────────────────────────────
const apiCache = new Map();
const API_CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
    const e = apiCache.get(key);
    return (e && Date.now() - e.ts < API_CACHE_TTL) ? e.data : null;
}
function setCache(key, data) { apiCache.set(key, { data, ts: Date.now() }); }

// ── API Routes ───────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/api/dam', async (req, res) => {
    const date = req.query.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date (YYYY-MM-DD)' });
    }

    try {
        let data = getCached(`dam_${date}`);
        if (!data) {
            console.log(`[IBEX] Fetching ${date}...`);
            try {
                data = await fetchDAMData(date);
                setCache(`dam_${date}`, data);
            } catch (fetchErr) {
                console.warn(`[IBEX] Fetch failed for ${date}: ${fetchErr.message}`);
                if (localCache.has(date)) {
                    console.log(`[IBEX] 🧠 Using local fallback for ${date}`);
                    data = localCache.get(date);
                } else {
                    throw fetchErr;
                }
            }
        }
        res.json(data);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

app.get('/api/dam/range', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Missing from/to' });

    try {
        const results = [];
        const cur = new Date(from);
        const end = new Date(to);
        while (cur <= end) {
            const d = cur.toISOString().split('T')[0];
            let data = getCached(`dam_${d}`);
            if (!data) {
                try {
                    data = await fetchDAMData(d);
                    setCache(`dam_${d}`, data);
                } catch {
                    if (localCache.has(d)) data = localCache.get(d);
                }
                if (data) await new Promise(r => setTimeout(r, 100));
            }
            if (data) results.push({ date: d, ...data });
            cur.setDate(cur.getDate() + 1);
        }
        res.json(results);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

app.get('/api/ibex-monthly-stats', (req, res) => {
    const jsonPath = join(__dirname, 'ibex-qh-data.json');
    if (!existsSync(jsonPath)) return res.status(404).json({ error: 'No data' });
    res.sendFile(jsonPath);
});

// ── Static Files (Production) ────────────────────────
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
    console.log(`[Proxy] Serving static files from ${distPath}`);
    app.use(express.static(distPath));
    app.use((req, res) => {
        res.sendFile(join(distPath, 'index.html'));
    });
} else {
    console.warn(`[Proxy] Warning: /dist folder not found. Run 'npm run build' first.`);
}

app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  BG Energy Dashboard Server running on ${PORT}  ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
});
