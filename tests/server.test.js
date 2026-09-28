import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { createApp, verifyStripeSignature } from '../server/app.js';
import { createMemoryStore } from '../server/store.js';

const ENV = {
    REVENUECAT_WEBHOOK_AUTH: 'Bearer rc-secret',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_PAYMENT_LINKS: JSON.stringify({ plink_550: 'nuggets_550' })
};

async function startServer() {
    let clock = new Date(2026, 8, 28, 12).getTime();
    const app = createApp({ store: createMemoryStore(), env: ENV, now: () => new Date(clock) });
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, { token, body, headers = {}, raw } = {}) => {
        const response = await fetch(base + path, {
            method: body !== undefined || raw !== undefined ? 'POST' : (path === '/api/account' ? 'POST' : 'GET'),
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...headers },
            body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined)
        });
        return { status: response.status, data: await response.json() };
    };
    return { server, call, advance: seconds => { clock += seconds * 1000; }, close: () => new Promise(r => server.close(r)) };
}

test('accounts, runs, buying and equipping go through the server', async () => {
    const s = await startServer();
    try {
        const { data: account } = await s.call('/api/account');
        assert.match(account.userId, /^rw_/);
        assert.equal((await s.call('/api/profile')).status, 401, 'no token, no profile');
        assert.equal((await s.call('/api/profile', { token: 'nope' })).status, 401);

        const run = await s.call('/api/run', { token: account.token, body: { score: 800, bounty: 'banked', newStars: 1, kills: {} } });
        assert.equal(run.status, 200);
        assert.equal(run.data.profile.balances.dollars, run.data.dollars);
        assert.ok(run.data.dollars >= 200 + 25 + 40);

        const tooFast = await s.call('/api/run', { token: account.token, body: { score: 800 } });
        assert.equal(tooFast.status, 429, 'runs reported seconds apart are rejected');

        const bought = await s.call('/api/buy', { token: account.token, body: { itemId: 'hat-black' } });
        assert.equal(bought.status, 200);
        assert.ok(bought.data.profile.owned.includes('hat-black'));
        const broke = await s.call('/api/buy', { token: account.token, body: { itemId: 'hat-gold' } });
        assert.equal(broke.status, 400);
        assert.equal(broke.data.code, 'funds');
        const equipped = await s.call('/api/equip', { token: account.token, body: { itemId: 'hat-black' } });
        assert.equal(equipped.data.profile.loadout.hat, 'hat-black');
    } finally {
        await s.close();
    }
});

test('RevenueCat webhooks need the shared secret and credit each purchase once', async () => {
    const s = await startServer();
    try {
        const { data: account } = await s.call('/api/account');
        const event = { event: { type: 'NON_RENEWING_PURCHASE', app_user_id: account.userId, product_id: 'nuggets_550', transaction_id: 't-1' } };
        assert.equal((await s.call('/webhooks/revenuecat', { body: event })).status, 401);
        assert.equal((await s.call('/webhooks/revenuecat', { body: event, headers: { Authorization: 'Bearer wrong' } })).status, 401);
        const ok = await s.call('/webhooks/revenuecat', { body: event, headers: { Authorization: 'Bearer rc-secret' } });
        assert.equal(ok.data.credited, true);
        const again = await s.call('/webhooks/revenuecat', { body: event, headers: { Authorization: 'Bearer rc-secret' } });
        assert.equal(again.data.credited, false, 'duplicate deliveries do not double-credit');
        const ignored = await s.call('/webhooks/revenuecat', { body: { event: { type: 'TEST' } }, headers: { Authorization: 'Bearer rc-secret' } });
        assert.equal(ignored.data.ignored, 'TEST');
        assert.equal((await s.call('/api/profile', { token: account.token })).data.profile.balances.nuggets, 550);
    } finally {
        await s.close();
    }
});

test('Stripe webhooks are signature-checked and mapped by payment link', async () => {
    const s = await startServer();
    try {
        const { data: account } = await s.call('/api/account');
        const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', client_reference_id: account.userId, payment_link: 'plink_550' } } });
        const t = Math.floor(new Date(2026, 8, 28, 12).getTime() / 1000);
        const sign = (body, secret = 'whsec_test', ts = t) => `t=${ts},v1=${createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`;
        assert.equal((await s.call('/webhooks/stripe', { raw: payload, headers: { 'Stripe-Signature': sign(payload, 'wrong') } })).status, 400);
        assert.equal((await s.call('/webhooks/stripe', { raw: payload, headers: { 'Stripe-Signature': sign(payload, 'whsec_test', t - 3600) } })).status, 400, 'old signatures are rejected');
        const ok = await s.call('/webhooks/stripe', { raw: payload, headers: { 'Stripe-Signature': sign(payload) } });
        assert.equal(ok.data.credited, true);
        await s.call('/webhooks/stripe', { raw: payload, headers: { 'Stripe-Signature': sign(payload) } });
        assert.equal((await s.call('/api/profile', { token: account.token })).data.profile.balances.nuggets, 550);
    } finally {
        await s.close();
    }
});

test('Stripe signature check accepts any listed v1 signature and rejects tampering', () => {
    const secret = 'whsec_x';
    const body = '{"a":1}';
    const now = 1_800_000_000_000;
    const t = now / 1000;
    const good = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    assert.equal(verifyStripeSignature(body, `t=${t},v1=deadbeef,v1=${good}`, secret, now), true);
    assert.equal(verifyStripeSignature('{"a":2}', `t=${t},v1=${good}`, secret, now), false);
    assert.equal(verifyStripeSignature(body, '', secret, now), false);
});

test('account names are unique and leaderboards rank named accounts', async () => {
    const s = await startServer();
    try {
        const { data: a } = await s.call('/api/account');
        const { data: b } = await s.call('/api/account');
        assert.equal((await s.call('/api/name', { token: a.token, body: { name: 'dusty rhodes' } })).data.profile.name, 'DUSTY RHODES');
        const taken = await s.call('/api/name', { token: b.token, body: { name: 'Dusty  Rhodes' } });
        assert.equal(taken.status, 409);
        assert.equal(taken.data.code, 'name_taken');
        assert.equal((await s.call('/api/name', { token: b.token, body: { name: 'x' } })).status, 400);
        assert.equal((await s.call('/api/name', { token: b.token, body: { name: 'Kid Cole' } })).status, 200);

        await s.call('/api/run', { token: a.token, body: { score: 900, seconds: 200, outlawIndex: 0, bounty: 'banked', heatAtOutlaw: 2 } });
        await s.call('/api/run', { token: b.token, body: { score: 1500, seconds: 240, outlawIndex: 0, bounty: 'escaped', heatAtOutlaw: 3 } });
        s.advance(30);
        await s.call('/api/run', { token: a.token, body: { score: 99999, seconds: 25, outlawIndex: 0 } });

        const weekly = await s.call('/api/leaderboard?board=weekly', { token: a.token });
        assert.equal(weekly.status, 200);
        assert.deepEqual(weekly.data.entries.map(e => [e.name, e.value]), [['KID COLE', 1500], ['DUSTY RHODES', 900]], 'the implausible run is not ranked');
        assert.equal(weekly.data.me.rank, 2);
        const stars = await s.call('/api/leaderboard?board=stars', { token: b.token });
        assert.equal(stars.data.entries[0].name, 'KID COLE');
        assert.equal(stars.data.entries[0].value, 3);
        assert.equal((await s.call('/api/leaderboard?board=stage-0', { token: a.token })).data.entries.length, 2);
        assert.equal((await s.call('/api/leaderboard?board=nope', { token: a.token })).status, 400);
        assert.equal((await s.call('/api/leaderboard')).status, 401);
    } finally {
        await s.close();
    }
});
