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

const IBEX_API = 'https://ibex.bg/Ext/SDAC_PROD/DAM_Page/api.php';
const REFERER = 'https://ibex.bg/sdac-pv-en/';

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

// ── IBEX Session State ───────────────────────────────
let sessionCookie = null;
let csrfToken = null;
let sessionCreated = 0;
const SESSION_TTL = 8 * 60 * 1000;

// ── HTTP helpers ─────────────────────────────────────
function httpsRequest(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json, text/html, */*',
                'Referer': REFERER,
                ...extraHeaders,
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

async function initSession() {
    console.log('[IBEX] Initializing session...');
    const res = await httpsRequest(`${IBEX_API}?action=get_csrf_token`);
    const cookies = res.headers['set-cookie'];
    if (cookies) {
        const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
        for (const c of cookieArr) {
            const match = c.match(/PHPSESSID=([^;]+)/);
            if (match) { sessionCookie = `PHPSESSID=${match[1]}`; break; }
        }
    }
    if (!sessionCookie) throw new Error('No PHPSESSID in response headers');
    let data = JSON.parse(res.body);
    if (data.error) throw new Error(`CSRF error: ${data.error}`);
    csrfToken = data.csrf_token;
    sessionCreated = Date.now();
    console.log(`[IBEX] Session ready`);
}

async function ensureSession() {
    if (!sessionCookie || !csrfToken || Date.now() - sessionCreated > SESSION_TTL) {
        sessionCookie = null;
        csrfToken = null;
        await initSession();
    }
}

async function fetchDAMData(date, lang = 'en', retried = false) {
    await ensureSession();
    const url = `${IBEX_API}?action=get_data&csrf_token=${encodeURIComponent(csrfToken)}&date=${date}&lang=${lang}`;
    const res = await httpsRequest(url, { 'Cookie': sessionCookie });
    let data = JSON.parse(res.body);
    if (data.error && !retried) {
        sessionCookie = null;
        csrfToken = null;
        return fetchDAMData(date, lang, true);
    }
    if (data.error) throw new Error(`IBEX error: ${data.error}`);
    return data;
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
