// ═══════════════════════════════════════════════════════
// BG Energy Dashboard — IBEX Proxy Server
// Fetches DAM data from ibex.bg and serves it to the
// frontend, bypassing CORS restrictions.
//
// IBEX API flow:
//   1. GET csrf_token endpoint (with Referer header)
//      → returns JSON {csrf_token} + sets PHPSESSID cookie
//   2. GET get_data endpoint (with Referer + PHPSESSID cookie)
//      → returns JSON {main_data[], summary_data, ph_data}
// ═══════════════════════════════════════════════════════

import http from 'node:http';
import https from 'node:https';

const PORT = 3001;
const IBEX_API = 'https://ibex.bg/Ext/SDAC_PROD/DAM_Page/api.php';
const REFERER = 'https://ibex.bg/sdac-pv-en/';

// ── Session State ────────────────────────────────────

let sessionCookie = null;
let csrfToken = null;
let sessionCreated = 0;
const SESSION_TTL = 8 * 60 * 1000; // 8 minutes

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

// ── IBEX Auth ────────────────────────────────────────

async function initSession() {
    console.log('[IBEX] Initializing session...');

    // Single call to get both the PHPSESSID cookie and the CSRF token
    const res = await httpsRequest(`${IBEX_API}?action=get_csrf_token`);

    // Extract PHPSESSID from set-cookie header
    const cookies = res.headers['set-cookie'];
    if (cookies) {
        const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
        for (const c of cookieArr) {
            const match = c.match(/PHPSESSID=([^;]+)/);
            if (match) {
                sessionCookie = `PHPSESSID=${match[1]}`;
                break;
            }
        }
    }

    if (!sessionCookie) {
        throw new Error('No PHPSESSID in response headers');
    }

    // Parse the CSRF token
    let data;
    try {
        data = JSON.parse(res.body);
    } catch {
        throw new Error(`Non-JSON CSRF response: ${res.body.slice(0, 200)}`);
    }

    if (data.error) throw new Error(`CSRF error: ${data.error}`);
    if (!data.csrf_token) throw new Error('No csrf_token in response');

    csrfToken = data.csrf_token;
    sessionCreated = Date.now();
    console.log(`[IBEX] Session ready — cookie: ${sessionCookie.slice(0, 25)}..., token: ${csrfToken.slice(0, 16)}...`);
}

async function ensureSession() {
    if (!sessionCookie || !csrfToken || Date.now() - sessionCreated > SESSION_TTL) {
        sessionCookie = null;
        csrfToken = null;
        await initSession();
    }
}

// ── Fetch DAM data ───────────────────────────────────

async function fetchDAMData(date, lang = 'en', retried = false) {
    await ensureSession();

    const url = `${IBEX_API}?action=get_data&csrf_token=${encodeURIComponent(csrfToken)}&date=${date}&lang=${lang}`;
    const res = await httpsRequest(url, { 'Cookie': sessionCookie });

    let data;
    try {
        data = JSON.parse(res.body);
    } catch {
        throw new Error(`Non-JSON data response for ${date}: ${res.body.slice(0, 200)}`);
    }

    // If token expired, retry once with a fresh session
    if (data.error && !retried) {
        console.warn(`[IBEX] Error for ${date}: ${data.error} — refreshing session...`);
        sessionCookie = null;
        csrfToken = null;
        return fetchDAMData(date, lang, true);
    }

    if (data.error) {
        throw new Error(`IBEX error for ${date}: ${data.error}`);
    }

    return data;
}

// ── Cache ────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
    const e = cache.get(key);
    return (e && Date.now() - e.ts < CACHE_TTL) ? e.data : null;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// ── HTTP Server ──────────────────────────────────────

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Health
    if (url.pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ts: new Date().toISOString() }));
        return;
    }

    // Single day
    if (url.pathname === '/api/dam') {
        const date = url.searchParams.get('date');
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid date (YYYY-MM-DD)' }));
            return;
        }
        try {
            let data = getCached(`dam_${date}`);
            if (!data) {
                console.log(`[IBEX] Fetching ${date}...`);
                data = await fetchDAMData(date);
                setCache(`dam_${date}`, data);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (err) {
            console.error(`[IBEX] Error:`, err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Date range
    if (url.pathname === '/api/dam/range') {
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        if (!from || !to) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing from/to' }));
            return;
        }
        try {
            const results = [];
            const cur = new Date(from);
            const end = new Date(to);
            while (cur <= end) {
                const d = cur.toISOString().split('T')[0];
                let data = getCached(`dam_${d}`);
                if (!data) {
                    console.log(`[IBEX] Fetching ${d}...`);
                    data = await fetchDAMData(d);
                    setCache(`dam_${d}`, data);
                    await new Promise(r => setTimeout(r, 150));
                }
                results.push({ date: d, ...data });
                cur.setDate(cur.getDate() + 1);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(results));
        } catch (err) {
            console.error(`[IBEX] Range error:`, err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  IBEX Proxy Server running on port ${PORT}      ║`);
    console.log(`║  GET /api/health                             ║`);
    console.log(`║  GET /api/dam?date=YYYY-MM-DD                ║`);
    console.log(`║  GET /api/dam/range?from=...&to=...          ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
});
