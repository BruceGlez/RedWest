import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createProfile, normalizeProfile, buyItem, equipItem, applyRun, creditNuggets, refreshJobs, setName, rankBoard, EconomyError } from '../src/profile.js';
import { getProduct } from '../src/products.js';
import { validateName } from '../src/names.js';

// Red West economy server. The game talks to /api/*; the stores talk to /webhooks/*.
// Paid Gold Nuggets are only ever credited from a verified store webhook, never by the client.

const MIN_SECONDS_BETWEEN_RUNS = 20; // a real run takes minutes; faster reports are rejected
const STRIPE_TOLERANCE_SECONDS = 300;
const PURCHASE_EVENTS = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']);

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

export function createApp({ store, env = {}, now = () => new Date() }) {
    const stripeLinks = (() => {
        try { return JSON.parse(env.STRIPE_PAYMENT_LINKS || '{}'); } catch { return {}; }
    })();

    function send(res, status, body) {
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
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

    function creditPurchase(userId, productId, transactionId) {
        const product = getProduct(productId);
        const user = loadUser(userId);
        if(!product || !user) return { ok: false, status: 404, message: 'unknown user or product' };
        const credited = creditNuggets(user.profile, product.nuggets, transactionId);
        store.putUser(userId, user);
        store.save();
        return { ok: true, credited };
    }

    return async function handle(req, res) {
        try {
            const url = new URL(req.url, 'http://localhost');
            if(req.method === 'OPTIONS') return send(res, 204, {});
            if(url.pathname === '/health') return send(res, 200, { ok: true });

            if(url.pathname === '/api/account' && req.method === 'POST') {
                const userId = `rw_${randomBytes(9).toString('hex')}`;
                const token = randomBytes(32).toString('hex');
                store.putUser(userId, { tokenHash: sha256(token), profile: createProfile(now()), lastRunAt: 0, createdAt: now().toISOString() });
                store.save();
                return send(res, 201, { userId, token });
            }

            // ---- Store webhooks ----
            if(url.pathname === '/webhooks/revenuecat' && req.method === 'POST') {
                if(!env.REVENUECAT_WEBHOOK_AUTH || !safeEqual(req.headers.authorization || '', env.REVENUECAT_WEBHOOK_AUTH)) {
                    return send(res, 401, { message: 'bad webhook auth' });
                }
                const event = JSON.parse(await readBody(req)).event || {};
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
                if(event.type !== 'checkout.session.completed') return send(res, 200, { ignored: event.type });
                const session = event.data?.object || {};
                if(session.payment_status !== 'paid') return send(res, 200, { ignored: 'unpaid' });
                const productId = stripeLinks[session.payment_link];
                const result = creditPurchase(session.client_reference_id, productId, `stripe:${session.id}`);
                return send(res, result.ok ? 200 : result.status, result);
            }

            // ---- Game API (authenticated) ----
            if(url.pathname.startsWith('/api/')) {
                const auth = authenticate(req);
                if(!auth?.user) return send(res, 401, { message: 'Sign in again.' });
                const { id, user } = auth;
                const save = () => { store.putUser(id, user); store.save(); };

                if(url.pathname === '/api/leaderboard' && req.method === 'GET') {
                    // Account boards: every named player's best, ranked server-side from reported runs.
                    const accounts = store.listUsers().map(entry => ({ id: entry.id, profile: normalizeProfile(entry.user.profile, now()) }));
                    const board = rankBoard(accounts, url.searchParams.get('board') || 'weekly', id, 50, now());
                    return send(res, 200, board);
                }
                if(url.pathname === '/api/profile' && req.method === 'GET') {
                    refreshJobs(user.profile, now());
                    save();
                    return send(res, 200, { userId: id, profile: user.profile });
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
                    const wanted = validateName(body.name);
                    if(!wanted.ok) throw new EconomyError('bad_name', wanted.error);
                    // Names are unique so a leaderboard row always means one player.
                    if(store.listUsers().some(entry => entry.id !== id && entry.user.profile?.name === wanted.name)) {
                        return send(res, 409, { code: 'name_taken', message: 'That name is taken. Try another.' });
                    }
                    setName(user.profile, wanted.name);
                    save();
                    return send(res, 200, { profile: user.profile });
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
