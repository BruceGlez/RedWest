import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createProfile, normalizeProfile, buyItem, equipItem, applyRun, grantProduct, restoreProduct, revokePurchase, refreshJobs, setName, rankBoard, EconomyError } from '../src/profile.js';
import { getProduct } from '../src/products.js';
import { validateName, isGeneratedName } from '../src/names.js';
import { AGE_BANDS } from '../src/privacy.js';
import { collectJail, upgradeBuilding } from '../src/town.js';
import { farmAction } from '../src/farm.js';
import { ANALYTICS_EVENTS } from '../src/analytics.js';
import { createApple, AppleError } from './apple.js';

// Red West economy server. The game talks to /api/*; the stores talk to /webhooks/*.
// Paid Gold Nuggets are only ever credited from a verified store webhook, never by the client.

const MIN_SECONDS_BETWEEN_RUNS = 20; // a real run takes minutes; faster reports are rejected
const STRIPE_TOLERANCE_SECONDS = 300;
const PURCHASE_EVENTS = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']);
const REPORTS_TO_HIDE = 3; // distinct accounts reporting a name before it is hidden from leaderboards
const REPORTER_MIN_RUNS = 3; // brand-new accounts cannot report, so throwaway accounts cannot hide a name
// Requests allowed per window, per caller (IP for new accounts, account id otherwise).
const LIMITS = {
    // Generous: phones on the same mobile carrier often share one address. Still stops a flood.
    account: { max: 200, windowMs: 60 * 60 * 1000 },
    report: { max: 30, windowMs: 24 * 60 * 60 * 1000 },
    restore: { max: 5, windowMs: 10 * 60 * 1000 },
    name: { max: 20, windowMs: 60 * 60 * 1000 }
};
const REFUND_EVENTS = new Set(['CANCELLATION']); // RevenueCat reports a refunded one-off purchase this way
const MAX_ACTIVE_DAYS = 400;
const MAX_DEVICE_TOKENS = 5; // phones and browsers signed in to one Apple-linked account
const ALLOWED_EVENTS = new Set(ANALYTICS_EVENTS);
const dayOf = date => date.toISOString().slice(0, 10); // UTC day

const sha256 = text => createHash('sha256').update(text).digest('hex');

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
}

// Stripe-Signature: "t=<unix>,v1=<hex hmac of `${t}.${rawBody}`>" (possibly several v1 values).
export function verifyStripeSignature(rawBody, header, secret, now = Date.now()) {
    if(!header || !secret) return false;
    const fields = String(header).split(',').map(kv => kv.split('='));
    const timestamp = fields.find(([k]) => k === 't')?.[1];
    const signatures = fields.filter(([k]) => k === 'v1').map(([, v]) => v);
    if(!timestamp || !signatures.length) return false;
    if(Math.abs(now / 1000 - Number(timestamp)) > STRIPE_TOLERANCE_SECONDS) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    return signatures.some(signature => safeEqual(signature, expected));
}

// A small in-memory limiter: enough for one server process. Resets on restart.
export function createRateLimiter(now = () => Date.now()) {
    const hits = new Map();
    return (kind, who) => {
        const { max, windowMs } = LIMITS[kind];
        const key = `${kind}:${who}`;
        const t = now();
        const recent = (hits.get(key) || []).filter(at => t - at < windowMs);
        if(recent.length >= max) {
            hits.set(key, recent);
            return false;
        }
        recent.push(t);
        hits.set(key, recent);
        if(hits.size > 50000) hits.clear(); // never let the limiter itself grow without bound
        return true;
    };
}

export function createApp({ store, env = {}, now = () => new Date(), fetchImpl = globalThis.fetch }) {
    const allow = createRateLimiter(() => now().getTime());
    const apple = createApple({ env, fetchImpl, now: () => now().getTime() });
    // Behind a proxy (Render, Fly, ...) set TRUST_PROXY=1 so the caller's address comes from X-Forwarded-For.
    const callerIp = req => (env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim())
        || req.socket?.remoteAddress || 'unknown';
    const tooMany = res => send(res, 429, { code: 'rate_limited', message: 'Too many requests. Try again later.' });
    const stripeLinks = (() => {
        try { return JSON.parse(env.STRIPE_PAYMENT_LINKS || '{}'); } catch { return {}; }
    })();

    // ALLOWED_ORIGIN: one origin or a comma-separated list (the web game and the iPhone app,
    // capacitor://localhost). The matching one is echoed back; unset means any origin.
    const allowedOrigins = String(env.ALLOWED_ORIGIN || '*').split(',').map(o => o.trim()).filter(Boolean);
    function corsOrigin(requestOrigin) {
        if(allowedOrigins.includes('*')) return '*';
        return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
    }

    function send(res, status, body) {
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin(res.requestOrigin),
            Vary: 'Origin',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });
        res.end(JSON.stringify(body));
    }

    function readBody(req) {
        return new Promise((resolve, reject) => {
            let size = 0;
            const chunks = [];
            req.on('data', chunk => {
                size += chunk.length;
                if(size > 64 * 1024) { reject(new Error('too large')); req.destroy(); return; }
                chunks.push(chunk);
            });
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
        });
    }

    function loadUser(id) {
        const user = store.getUser(id);
        if(!user) return null;
        user.profile = normalizeProfile(user.profile, now());
        return user;
    }

    function authenticate(req) {
        const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
        if(!token) return null;
        const id = store.findUserByTokenHash(sha256(token));
        return id ? { id, user: loadUser(id) } : null;
    }

    function creditPurchase(userId, productId, transactionId, extra = {}) {
        const product = getProduct(productId);
        const user = loadUser(userId);
        if(!product || !user) return { ok: false, status: 404, message: 'unknown user or product' };
        const credited = grantProduct(user.profile, product, transactionId, now(), extra);
        store.putUser(userId, user);
        store.save();
        return { ok: true, credited };
    }

    function newAccount(extra = {}) {
        const userId = `rw_${randomBytes(9).toString('hex')}`;
        const token = randomBytes(32).toString('hex');
        store.putUser(userId, { tokenHash: sha256(token), profile: createProfile(now()), lastRunAt: 0, createdAt: now().toISOString(), ...extra });
        store.save();
        return { userId, token };
    }

    // One Apple ID, one account. Three cases:
    // - the Apple ID already has an account: this device gets a token for it (a new phone, or after a reinstall);
    // - the device's current account has no Apple ID yet: link it, keeping all progress;
    // - no account on this device: make one, linked from the start.
    async function appleSignIn(body, caller) {
        const { sub, clientId } = await apple.verifyIdentityToken(body.identityToken, body.nonce);
        const existing = store.listUsers().find(entry => entry.user.apple?.sub === sub);
        if(existing) {
            const token = randomBytes(32).toString('hex');
            existing.user.tokenHashes = [...(existing.user.tokenHashes || []), sha256(token)].slice(-MAX_DEVICE_TOKENS);
            store.putUser(existing.id, existing.user);
            store.save();
            return { userId: existing.id, token, linked: false, switched: !!caller && caller.id !== existing.id };
        }
        const link = { sub, clientId, linkedAt: now().toISOString() };
        const refreshToken = await apple.refreshTokenFor(body.authorizationCode, clientId, !!body.web);
        if(refreshToken) link.refreshToken = refreshToken;
        if(caller?.user) {
            caller.user.apple = link;
            store.putUser(caller.id, caller.user);
            store.save();
            return { userId: caller.id, token: null, linked: true, switched: false };
        }
        return { ...newAccount({ apple: link }), linked: true, switched: false };
    }

    return async function handle(req, res) {
        res.requestOrigin = req.headers.origin;
        try {
            const url = new URL(req.url, 'http://localhost');
            if(req.method === 'OPTIONS') return send(res, 204, {});
            if(url.pathname === '/health') return send(res, 200, { ok: true });

            if(url.pathname === '/api/account' && req.method === 'POST') {
                if(!allow('account', callerIp(req))) return tooMany(res);
                return send(res, 201, newAccount());
            }

            // ---- Sign in with Apple (optional, see server/apple.js) ----
            if(url.pathname.startsWith('/api/apple/')) {
                if(!apple.enabled) return send(res, 404, { code: 'apple_off', message: 'Sign in with Apple is not set up.' });
                if(!allow('account', callerIp(req))) return tooMany(res);
                if(url.pathname === '/api/apple/nonce' && req.method === 'POST') return send(res, 200, { nonce: apple.issueNonce() });
                if(url.pathname === '/api/apple/signin' && req.method === 'POST') {
                    const body = JSON.parse((await readBody(req)) || '{}');
                    try {
                        return send(res, 200, await appleSignIn(body, authenticate(req)));
                    } catch(error) {
                        if(error instanceof AppleError) return send(res, error.code === 'apple_down' ? 503 : 400, { code: error.code, message: error.message });
                        throw error;
                    }
                }
            }

            // ---- Store webhooks ----
            if(url.pathname === '/webhooks/revenuecat' && req.method === 'POST') {
                if(!env.REVENUECAT_WEBHOOK_AUTH || !safeEqual(req.headers.authorization || '', env.REVENUECAT_WEBHOOK_AUTH)) {
                    return send(res, 401, { message: 'bad webhook auth' });
                }
                const event = JSON.parse(await readBody(req)).event || {};
                if(REFUND_EVENTS.has(event.type) && getProduct(event.product_id)) {
                    const user = loadUser(event.app_user_id);
                    if(!user) return send(res, 404, { message: 'unknown user' });
                    const reversed = revokePurchase(user.profile, `rc:${event.transaction_id || event.id}`, now());
                    store.putUser(event.app_user_id, user);
                    store.save();
                    return send(res, 200, { reversed });
                }
                if(!PURCHASE_EVENTS.has(event.type)) return send(res, 200, { ignored: event.type || 'unknown' });
                const result = creditPurchase(event.app_user_id, event.product_id, `rc:${event.transaction_id || event.id}`);
                return send(res, result.ok ? 200 : result.status, result);
            }

            if(url.pathname === '/webhooks/stripe' && req.method === 'POST') {
                const raw = await readBody(req);
                if(!verifyStripeSignature(raw, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET, now().getTime())) {
                    return send(res, 400, { message: 'bad signature' });
                }
                const event = JSON.parse(raw);
                if(event.type === 'charge.refunded') {
                    // Full refunds only; a partial refund is a goodwill gesture and changes nothing in the game.
                    const charge = event.data?.object || {};
                    if(!charge.payment_intent || charge.amount_refunded < charge.amount) return send(res, 200, { ignored: 'partial refund' });
                    const owner = store.listUsers().find(entry => entry.user.profile?.purchases?.some(p => p.paymentIntent === charge.payment_intent));
                    if(!owner) return send(res, 200, { ignored: 'unknown payment' });
                    const user = loadUser(owner.id);
                    const record = user.profile.purchases.find(p => p.paymentIntent === charge.payment_intent);
                    const reversed = revokePurchase(user.profile, record.tx, now());
                    store.putUser(owner.id, user);
                    store.save();
                    return send(res, 200, { reversed });
                }
                if(event.type !== 'checkout.session.completed') return send(res, 200, { ignored: event.type });
                const session = event.data?.object || {};
                if(session.payment_status !== 'paid') return send(res, 200, { ignored: 'unpaid' });
                const productId = stripeLinks[session.payment_link];
                const result = creditPurchase(session.client_reference_id, productId, `stripe:${session.id}`,
                    session.payment_intent ? { paymentIntent: session.payment_intent } : {});
                return send(res, result.ok ? 200 : result.status, result);
            }

            // ---- Moderation (ADMIN_TOKEN, for the owner only) ----
            if(url.pathname.startsWith('/admin/')) {
                if(!env.ADMIN_TOKEN || !safeEqual(req.headers.authorization || '', `Bearer ${env.ADMIN_TOKEN}`)) {
                    return send(res, 401, { message: 'bad admin token' });
                }
                if(url.pathname === '/admin/reports' && req.method === 'GET') {
                    const reported = store.listUsers()
                        .filter(entry => entry.user.reportedBy?.length)
                        .map(entry => ({ userId: entry.id, name: entry.user.profile?.name || '', reports: entry.user.reportedBy.length, hidden: !!entry.user.nameHidden }))
                        .sort((a, b) => b.reports - a.reports);
                    return send(res, 200, { reported });
                }
                if(url.pathname === '/admin/name' && req.method === 'POST') {
                    const body = JSON.parse((await readBody(req)) || '{}');
                    const user = store.getUser(body.userId);
                    if(!user) return send(res, 404, { message: 'unknown user' });
                    // keep: the name is fine, clear the reports. reset: remove the name; the player picks another.
                    if(body.action === 'reset') user.profile.name = '';
                    else if(body.action !== 'keep') return send(res, 400, { message: 'action must be keep or reset' });
                    user.reportedBy = [];
                    user.nameHidden = false;
                    store.putUser(body.userId, user);
                    store.save();
                    return send(res, 200, { ok: true });
                }
                return send(res, 404, { message: 'not found' });
            }

            // ---- Game API (authenticated) ----
            if(url.pathname.startsWith('/api/')) {
                const auth = authenticate(req);
                if(!auth?.user) return send(res, 401, { message: 'Sign in again.' });
                const { id, user } = auth;
                const save = () => { store.putUser(id, user); store.save(); };

                if(url.pathname === '/api/leaderboard' && req.method === 'GET') {
                    // Account boards: every named player's best, ranked server-side from reported runs.
                    // Names hidden after reports stay off the boards until reviewed or changed.
                    const accounts = store.listUsers()
                        .filter(entry => !entry.user.nameHidden)
                        .map(entry => ({ id: entry.id, profile: normalizeProfile(entry.user.profile, now()) }));
                    const board = rankBoard(accounts, url.searchParams.get('board') || 'weekly', id, 50, now());
                    return send(res, 200, board);
                }
                if(url.pathname === '/api/profile' && req.method === 'GET') {
                    refreshJobs(user.profile, now());
                    save();
                    return send(res, 200, { userId: id, profile: user.profile, nameHidden: !!user.nameHidden, apple: !!user.apple });
                }
                const body = JSON.parse((await readBody(req)) || '{}');
                if(url.pathname === '/api/run' && req.method === 'POST') {
                    const seconds = (now().getTime() - (user.lastRunAt || 0)) / 1000;
                    if(seconds < MIN_SECONDS_BETWEEN_RUNS) return send(res, 429, { code: 'too_fast', message: 'Runs are reported too quickly.' });
                    user.lastRunAt = now().getTime();
                    const result = applyRun(user.profile, body, now());
                    save();
                    return send(res, 200, { ...result, profile: user.profile });
                }
                if(url.pathname === '/api/name' && req.method === 'POST') {
                    if(!allow('name', id)) return tooMany(res);
                    const wanted = validateName(body.name);
                    if(!wanted.ok) throw new EconomyError('bad_name', wanted.error);
                    // Players under 13 never choose a name; the game gives them a generated one.
                    if(user.ageBand === 'under13' && !isGeneratedName(wanted.name)) throw new EconomyError('bad_name', 'Names are chosen for you.');
                    // Names are unique so a leaderboard row always means one player.
                    if(store.listUsers().some(entry => entry.id !== id && entry.user.profile?.name === wanted.name)) {
                        return send(res, 409, { code: 'name_taken', message: 'That name is taken. Try another.' });
                    }
                    setName(user.profile, wanted.name);
                    user.reportedBy = [];
                    user.nameHidden = false;
                    save();
                    return send(res, 200, { profile: user.profile });
                }
                // "Restore purchases" (App Store rule for non-consumables): ask RevenueCat, never the game,
                // which one-time products this account owns, and give back their items.
                if(url.pathname === '/api/restore' && req.method === 'POST') {
                    if(!allow('restore', id)) return tooMany(res);
                    if(!env.REVENUECAT_SECRET_KEY) return send(res, 503, { message: 'Restoring purchases is not set up yet.' });
                    const response = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, {
                        headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}` }
                    });
                    if(!response.ok) return send(res, 502, { message: 'The store could not be reached. Try again later.' });
                    const owned = Object.keys((await response.json()).subscriber?.non_subscriptions || {});
                    const restored = [];
                    for(const productId of owned) {
                        const product = getProduct(productId);
                        if(product?.oneTime) {
                            restoreProduct(user.profile, product);
                            restored.push(product.id);
                        }
                    }
                    save();
                    return send(res, 200, { restored, profile: user.profile });
                }
                if(url.pathname === '/api/privacy' && req.method === 'POST') {
                    if(!AGE_BANDS.includes(body.ageBand)) throw new EconomyError('bad_age', 'Unknown age band.');
                    user.ageBand = body.ageBand;
                    user.statsConsent = body.ageBand !== 'under13' && body.statsConsent === true;
                    if(!user.statsConsent) delete user.analytics; // opting out also removes what was collected
                    save();
                    return send(res, 200, { ageBand: user.ageBand, statsConsent: user.statsConsent });
                }
                if(url.pathname === '/api/events' && req.method === 'POST') {
                    if(!user.statsConsent) return send(res, 403, { message: 'Statistics are switched off.' });
                    const names = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
                    const today = dayOf(now());
                    const stats = user.analytics ??= { firstDay: today, days: [], counts: {} };
                    if(stats.days.at(-1) !== today) stats.days = [...stats.days, today].slice(-MAX_ACTIVE_DAYS);
                    for(const name of names) {
                        if(ALLOWED_EVENTS.has(name)) stats.counts[name] = (stats.counts[name] || 0) + 1;
                    }
                    save();
                    return send(res, 200, { ok: true });
                }
                if(url.pathname === '/api/report' && req.method === 'POST') {
                    if(!allow('report', id)) return tooMany(res);
                    // Only players with a few runs behind them count, so fresh throwaway accounts cannot gang up.
                    if((user.profile.stats?.runs || 0) < REPORTER_MIN_RUNS) return send(res, 200, { ok: true });
                    const name = String(body.name || '');
                    const target = store.listUsers().find(entry => entry.id !== id && name && entry.user.profile?.name === name);
                    if(target && !target.user.reportedBy?.includes(id)) {
                        target.user.reportedBy = [...(target.user.reportedBy || []), id];
                        if(target.user.reportedBy.length >= REPORTS_TO_HIDE) target.user.nameHidden = true;
                        store.putUser(target.id, target.user);
                        store.save();
                    }
                    // The same answer either way, so reports cannot be used to probe accounts.
                    return send(res, 200, { ok: true });
                }
                if(url.pathname === '/api/account/delete' && req.method === 'POST') {
                    // Keep only purchase transaction ids (tax, refunds, fraud), with no link to the player.
                    const deletedAt = now().toISOString();
                    const appleRevoked = user.apple ? await apple.revoke(user.apple.refreshToken, user.apple.clientId) : false;
                    store.retainPurchases((user.profile.processed || []).map(transactionId => ({ transactionId, deletedAt })));
                    for(const entry of store.listUsers()) {
                        if(!entry.user.reportedBy?.includes(id)) continue;
                        entry.user.reportedBy = entry.user.reportedBy.filter(reporter => reporter !== id);
                        store.putUser(entry.id, entry.user);
                    }
                    store.deleteUser(id);
                    store.save();
                    return send(res, 200, { deleted: true, appleRevoked });
                }
                // Frontier Town: the server clock decides what the Jail has earned.
                if(url.pathname === '/api/town/collect' && req.method === 'POST') {
                    const collected = collectJail(user.profile, now());
                    save();
                    return send(res, 200, { collected, profile: user.profile });
                }
                if(url.pathname === '/api/town/upgrade' && req.method === 'POST') {
                    upgradeBuilding(user.profile, body.building, now());
                    save();
                    return send(res, 200, { profile: user.profile });
                }
                // Calloway Farm (src/farm.js): the server clock decides what has grown.
                if(url.pathname === '/api/town/farm' && req.method === 'POST') {
                    const result = farmAction(user.profile, body, now());
                    save();
                    return send(res, 200, { result, profile: user.profile });
                }
                if(url.pathname === '/api/buy' && req.method === 'POST') {
                    buyItem(user.profile, body.itemId);
                    save();
                    return send(res, 200, { profile: user.profile });
                }
                if(url.pathname === '/api/equip' && req.method === 'POST') {
                    equipItem(user.profile, body.itemId);
                    save();
                    return send(res, 200, { profile: user.profile });
                }
            }
            return send(res, 404, { message: 'not found' });
        } catch(error) {
            if(error instanceof EconomyError) return send(res, 400, { code: error.code, message: error.message });
            if(error instanceof SyntaxError) return send(res, 400, { message: 'bad JSON' });
            return send(res, 500, { message: 'server error' });
        }
    };
}
