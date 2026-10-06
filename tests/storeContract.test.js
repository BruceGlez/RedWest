import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { createMemoryStore, createFileStore, createKeyedLock, StoreConflictError } from '../server/store.js';

// One contract, run against every store: the JSON memory and file stores always, and Postgres when TEST_DATABASE_URL points at a
// throwaway database (the tests empty its tables). `npm test` skips the Postgres runs without it. (docs/DEPLOY.md, "Testing the Postgres store".)

const stores = [
    ['memory', async () => createMemoryStore()],
    ['file', async () => createFileStore(join(mkdtempSync(join(tmpdir(), 'rw-contract-')), 'data', 'redwest.json'))]
];
if(process.env.TEST_DATABASE_URL) {
    stores.push(['postgres', async () => {
        const { createPgStore } = await import('../server/pgStore.js');
        const store = await createPgStore({ connectionString: process.env.TEST_DATABASE_URL, max: 5 });
        await store.pool.query('truncate users, retained_purchases');
        return store;
    }]);
}

const user = (name, extra = {}) => ({ tokenHash: `h-${name.toLowerCase()[0]}`, profile: { name, purchases: [], balances: { dollars: 0, nuggets: 0 } }, lastRunAt: 0, ...extra });

for(const [label, make] of stores) {
    test(`store contract (${label}): players, lookups and reports`, async () => {
        const store = await make();
        try {
            assert.equal(await store.getUser('nobody'), null);
            await store.putUser('a', user('ANNIE', { apple: { sub: 'sub-a' }, tokenHashes: ['ha2'], reportedBy: ['b'] }));
            await store.putUser('b', user('BOB', { nameHidden: true }));
            await store.putUser('c', user('CARL'));
            await store.save();
            const a = await store.getUser('a');
            assert.equal(a.profile.name, 'ANNIE');
            assert.deepEqual(a.reportedBy, ['b'], 'the whole user comes back as it went in');

            assert.equal(await store.findUserByTokenHash('h-b'), 'b');
            assert.equal(await store.findUserByTokenHash('ha2'), 'a', 'a second device token finds the player');
            assert.equal(await store.findUserByTokenHash('nope'), null);
            assert.equal((await store.findUserByAppleSub('sub-a')).id, 'a');
            assert.equal(await store.findUserByAppleSub('sub-z'), null);
            assert.equal((await store.findUserByName('BOB', 'a')).id, 'b');
            assert.equal(await store.findUserByName('BOB', 'b'), null, 'a player does not take his own name');
            assert.equal(await store.findUserByName('NOBODY', 'a'), null);
            assert.deepEqual((await store.listReportedUsers()).map(e => e.id), ['a']);
            assert.deepEqual((await store.listBoardUsers()).map(e => e.id).sort(), ['a', 'c'], 'a hidden name is off the boards');

            // A purchase is found by its Stripe payment intent.
            const c = await store.getUser('c');
            c.profile.purchases.push({ tx: 'stripe:1', paymentIntent: 'pi_1' });
            await store.putUser('c', c);
            assert.equal((await store.findUserByPaymentIntent('pi_1')).id, 'c');
            assert.equal(await store.findUserByPaymentIntent('pi_2'), null);

            // A change by name moves the name lookup with it.
            c.profile.name = 'CARLA';
            await store.putUser('c', c);
            assert.equal(await store.findUserByName('CARL', 'a'), null);
            assert.equal((await store.findUserByName('CARLA', 'a')).id, 'c');

            await store.removeReporter('b');
            assert.deepEqual(await store.listReportedUsers(), [], 'a deleted account no longer counts as a reporter');
            assert.deepEqual((await store.getUser('a')).reportedBy, []);

            await store.retainPurchases([{ transactionId: 'rc:1', deletedAt: '2026-10-01T00:00:00.000Z' }, { transactionId: 'rc:1', deletedAt: 'again' }]);
            const retained = await store.retainedPurchases();
            assert.deepEqual(retained.map(r => r.transactionId), ['rc:1'], 'a transaction is retained once');
            assert.equal(retained[0].deletedAt, '2026-10-01T00:00:00.000Z');

            await store.deleteUser('b');
            assert.equal(await store.getUser('b'), null);
            assert.equal(await store.findUserByTokenHash('h-b'), null);
            assert.equal(await store.ping(), true);
        } finally {
            await store.close?.();
        }
    });

    test(`store contract (${label}): two quick buys of one thing cost one price (the player's requests run one at a time)`, async () => {
        const store = await make();
        // Writes take a moment, so without the lock every request would read the old balance before the first write lands.
        const slowWrites = { ...store, putUser: async (...args) => { await new Promise(r => setTimeout(r, 25)); return store.putUser(...args); } };
        let clock = new Date('2026-10-01T12:00:00Z').getTime();
        const server = createServer(createApp({ store: slowWrites, env: {}, now: () => new Date(clock) }));
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        const call = async (path, token, body) => {
            const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
            return { status: response.status, data: await response.json() };
        };
        try {
            const account = await (await fetch(`${base}/api/account`, { method: 'POST' })).json();
            const stored = await store.getUser(account.userId);
            stored.profile.balances.dollars = 100;
            await store.putUser(account.userId, stored);
            const answers = await Promise.all(Array.from({ length: 6 }, () => call('/api/mine/buy', account.token, { id: 'lantern' })));
            const ok = answers.filter(a => a.status === 200);
            assert.equal(ok.length, 1, `one buy goes through, the rest are told they own it: ${JSON.stringify(answers.map(a => a.status))}`);
            assert.ok(answers.filter(a => a.status !== 200).every(a => a.data.code === 'owned'));
            const after = (await call('/api/profile', account.token)).data.profile;
            assert.equal(after.balances.dollars, 100 - 60, 'the lantern was paid for once');
        } finally {
            await new Promise(resolve => server.close(resolve));
            await store.close?.();
        }
    });
}

if(process.env.TEST_DATABASE_URL) {
    test('postgres store: a stale write is refused, a fresh one goes through, and the account survives a restart', async () => {
        const { createPgStore } = await import('../server/pgStore.js');
        const one = await createPgStore({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
        await one.pool.query('truncate users, retained_purchases');
        await one.putUser('p', user('PAT'));
        const first = await one.getUser('p');
        const second = await one.getUser('p'); // another request, or another server instance, read the same version
        first.profile.balances.dollars = 5;
        await one.putUser('p', first);
        second.profile.balances.dollars = 9;
        await assert.rejects(() => one.putUser('p', second), StoreConflictError, 'the second write would have erased the first');
        assert.equal((await one.getUser('p')).profile.balances.dollars, 5);
        const again = await one.getUser('p');
        again.profile.balances.dollars = 7;
        await one.putUser('p', again);
        await one.putUser('p', again); // the same object saved twice in a request keeps working
        await one.close();
        const restarted = await createPgStore({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
        assert.equal((await restarted.getUser('p')).profile.balances.dollars, 7, 'schema creation is safe to run again and the data is still there');
        await restarted.close();
    });
}

test('the keyed lock lets one holder per key in at a time, in order, and keys do not wait for each other', async () => {
    const lock = createKeyedLock();
    const order = [];
    const work = async (key, name, ms) => {
        const release = await lock(key);
        try { order.push(`${name} in`); await new Promise(r => setTimeout(r, ms)); order.push(`${name} out`); } finally { release(); }
    };
    await Promise.all([work('a', 'a1', 30), work('a', 'a2', 1), work('b', 'b1', 1), work('a', 'a3', 1)]);
    assert.deepEqual(order.filter(x => x.startsWith('a')), ['a1 in', 'a1 out', 'a2 in', 'a2 out', 'a3 in', 'a3 out']);
    assert.ok(order.indexOf('b1 out') < order.indexOf('a1 out'), 'another player is not held up');
    const release = await lock('a'); // nothing left over once everyone is done
    release();
});
