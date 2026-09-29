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

async function startAdminServer() {
    const store = createMemoryStore();
    let clock = new Date(Date.UTC(2026, 8, 28, 12)).getTime();
    const app = createApp({ store, env: { ...ENV, ADMIN_TOKEN: 'admin-secret' }, now: () => new Date(clock) });
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, { token, body, method } = {}) => {
        const response = await fetch(base + path, {
            method: method || (body !== undefined || path === '/api/account' ? 'POST' : 'GET'),
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        return { status: response.status, data: await response.json() };
    };
    const account = async name => {
        const { data } = await call('/api/account');
        if(name) assert.equal((await call('/api/name', { token: data.token, body: { name } })).status, 200);
        return data;
    };
    return { store, call, account, advanceDays: days => { clock += days * 86400000; }, close: () => new Promise(r => server.close(r)) };
}

test('statistics need consent, keep only days and allowed event counts, and go on opt-out', async () => {
    const s = await startAdminServer();
    try {
        const a = await s.account();
        assert.equal((await s.call('/api/events', { token: a.token, body: { events: ['run_start'] } })).status, 403, 'no consent yet');
        assert.equal((await s.call('/api/privacy', { token: a.token, body: { ageBand: 'nope' } })).status, 400);
        assert.equal((await s.call('/api/privacy', { token: a.token, body: { ageBand: 'adult', statsConsent: true } })).data.statsConsent, true);
        await s.call('/api/events', { token: a.token, body: { events: ['session_start', 'run_start', 'run_start', 'evil_event', { x: 1 }] } });
        s.advanceDays(1);
        await s.call('/api/events', { token: a.token, body: { events: ['session_start'] } });
        const stats = s.store.getUser(a.userId).analytics;
        assert.deepEqual(stats.days, ['2026-09-28', '2026-09-29']);
        assert.deepEqual(stats.counts, { session_start: 2, run_start: 2 });
        await s.call('/api/privacy', { token: a.token, body: { ageBand: 'adult', statsConsent: false } });
        assert.equal(s.store.getUser(a.userId).analytics, undefined, 'opting out removes the statistics');

        const child = await s.account();
        const answer = await s.call('/api/privacy', { token: child.token, body: { ageBand: 'under13', statsConsent: true } });
        assert.equal(answer.data.statsConsent, false, 'children never share statistics');
        assert.equal((await s.call('/api/events', { token: child.token, body: { events: ['run_start'] } })).status, 403);
        assert.equal((await s.call('/api/name', { token: child.token, body: { name: 'DUSTY KID' } })).status, 400, 'children cannot type names');
        assert.equal((await s.call('/api/name', { token: child.token, body: { name: 'RIDER 0042' } })).status, 200);
    } finally {
        await s.close();
    }
});

test('names reported by three accounts leave the boards until the owner reviews them', async () => {
    const s = await startAdminServer();
    try {
        const target = await s.account('RUDE DUDE');
        await s.call('/api/run', { token: target.token, body: { score: 900, seconds: 120, outlawIndex: 0, bounty: 'banked', kills: {} } });
        const reporters = [await s.account('ONE'), await s.account('TWO'), await s.account('THREE')];
        const onBoard = async () => (await s.call('/api/leaderboard?board=weekly', { token: reporters[0].token })).data.entries.some(e => e.name === 'RUDE DUDE');
        assert.equal(await onBoard(), true);
        for(const r of reporters.slice(0, 2)) await s.call('/api/report', { token: r.token, body: { name: 'RUDE DUDE' } });
        await s.call('/api/report', { token: reporters[0].token, body: { name: 'RUDE DUDE' } }); // repeat reports count once
        assert.equal(await onBoard(), true, 'two distinct reports are not enough');
        assert.equal((await s.call('/api/report', { token: reporters[2].token, body: { name: 'NO SUCH NAME' } })).status, 200, 'unknown names answer the same');
        await s.call('/api/report', { token: reporters[2].token, body: { name: 'RUDE DUDE' } });
        assert.equal(await onBoard(), false, 'hidden after three');
        assert.equal((await s.call('/api/profile', { token: target.token })).data.nameHidden, true, 'the player is told');

        assert.equal((await s.call('/admin/reports')).status, 401, 'admin needs the token');
        assert.equal((await s.call('/admin/reports', { token: target.token })).status, 401, 'a player token is not an admin token');
        const { data } = await s.call('/admin/reports', { token: 'admin-secret' });
        assert.deepEqual(data.reported, [{ userId: target.userId, name: 'RUDE DUDE', reports: 3, hidden: true }]);
        await s.call('/admin/name', { token: 'admin-secret', body: { userId: target.userId, action: 'keep' } });
        assert.equal(await onBoard(), true, 'kept after review');
        await s.call('/admin/name', { token: 'admin-secret', body: { userId: target.userId, action: 'reset' } });
        assert.equal((await s.call('/api/profile', { token: target.token })).data.profile.name, '', 'reset: the player picks a new name');
    } finally {
        await s.close();
    }
});

test('deleting an account removes the player and keeps only purchase ids', async () => {
    const s = await startAdminServer();
    try {
        const a = await s.account('GONE SOON');
        s.store.getUser(a.userId).profile.processed.push('rc:tx-1');
        const other = await s.account('STAYS');
        await s.call('/api/report', { token: a.token, body: { name: 'STAYS' } });
        assert.equal((await s.call('/api/account/delete', { token: a.token, body: {} })).data.deleted, true);
        assert.equal(s.store.getUser(a.userId), null);
        assert.equal((await s.call('/api/profile', { token: a.token })).status, 401, 'the old token no longer works');
        assert.deepEqual(s.store.retainedPurchases().map(p => p.transactionId), ['rc:tx-1']);
        assert.deepEqual(s.store.getUser(other.userId).reportedBy, [], 'their reports are removed too');
    } finally {
        await s.close();
    }
});

test('the town uses the server clock', async () => {
    const s = await startAdminServer();
    try {
        const a = await s.account();
        await s.call('/api/run', { token: a.token, body: { score: 900, seconds: 120, outlawIndex: 0, bounty: 'banked', kills: {} } });
        const before = (await s.call('/api/profile', { token: a.token })).data.profile.balances.dollars;
        s.advanceDays(3 / 24);
        const collected = await s.call('/api/town/collect', { token: a.token, body: {} });
        assert.equal(collected.data.collected, 3 * 5, 'three hours of Dusty Pete');
        assert.equal(collected.data.profile.balances.dollars, before + 15);
        assert.equal((await s.call('/api/town/collect', { token: a.token, body: {} })).data.collected, 0);
        const poor = await s.call('/api/town/upgrade', { token: a.token, body: { building: 'sheriff' } });
        assert.equal(poor.status, 400);
        assert.equal(poor.data.code, 'funds');
    } finally {
        await s.close();
    }
});

test('event runs reach the MOST WANTED board and pay their prizes on the server', async () => {
    const { eventForWeek } = await import('../src/events.js');
    const { weekKey } = await import('../src/profile.js');
    const s = await startAdminServer();
    try {
        const week = weekKey(new Date(Date.UTC(2026, 8, 28, 12)));
        const event = eventForWeek(week);
        const a = await s.account('EVENT RIDER');
        const run = await s.call('/api/run', { token: a.token, body: { score: event.targets[0], seconds: 300, outlawIndex: event.outlaw, event: week, kills: {} } });
        assert.ok(run.data.lines.some(line => line.label === `Most Wanted target 1: ${event.targets[0].toLocaleString()}`));
        const board = await s.call('/api/leaderboard?board=event', { token: a.token });
        assert.deepEqual(board.data.entries.map(e => [e.name, e.value]), [['EVENT RIDER', event.targets[0]]]);
        const weekly = await s.call('/api/leaderboard?board=weekly', { token: a.token });
        assert.equal(weekly.data.entries.length, 0, 'event scores stay off the normal weekly board');
    } finally {
        await s.close();
    }
});

test('restore asks RevenueCat, never the game, and gives back only one-time items', async () => {
    const { createProfile } = await import('../src/profile.js');
    void createProfile;
    const store = createMemoryStore();
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push([url, options.headers.Authorization]);
        return { ok: true, json: async () => ({ subscriber: { non_subscriptions: { starter_pack: [{ id: 'x' }], nuggets_550: [{ id: 'y' }] } } }) };
    };
    const app = createApp({ store, env: { ...ENV, REVENUECAT_SECRET_KEY: 'sk_test' }, fetchImpl });
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const account = await (await fetch(`${base}/api/account`, { method: 'POST' })).json();
        const response = await fetch(`${base}/api/restore`, { method: 'POST', headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' }, body: '{}' });
        const data = await response.json();
        assert.deepEqual(data.restored, ['starter_pack'], 'consumable nugget packs are not restored');
        assert.equal(data.profile.balances.nuggets, 0);
        assert.ok(data.profile.owned.includes('hat-deputy'));
        assert.equal(calls[0][0], `https://api.revenuecat.com/v1/subscribers/${account.userId}`);
        assert.equal(calls[0][1], 'Bearer sk_test');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('a starter pack webhook credits items and nuggets once', async () => {
    const s = await startServer();
    try {
        const { data: account } = await s.call('/api/account');
        const hook = id => s.call('/webhooks/revenuecat', { headers: { Authorization: 'Bearer rc-secret' }, body: { event: { type: 'NON_RENEWING_PURCHASE', app_user_id: account.userId, product_id: 'starter_pack', transaction_id: id } } });
        await hook('kit-1');
        await hook('kit-1');
        const profile = (await s.call('/api/profile', { token: account.token })).data.profile;
        assert.equal(profile.balances.nuggets, 200);
        assert.ok(profile.owned.includes('coat-deputy'));
        assert.deepEqual(profile.bought, ['starter_pack']);
    } finally {
        await s.close();
    }
});
