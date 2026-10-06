import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryStore } from '../server/store.js';
import { migrateJsonToStore, readJsonStore } from '../server/migrate.js';
import { createProfile } from '../src/profile.js';

// The JSON-to-Postgres migration (server/migrate.js). Runs against the memory store always, and against Postgres when TEST_DATABASE_URL is
// set (the tests empty its tables).

const player = (n, extra = {}) => ({ tokenHash: `hash-${n}`, profile: { ...createProfile(new Date('2026-10-01T12:00:00Z')), name: `PLAYER ${n}` }, lastRunAt: 0, createdAt: '2026-10-01T12:00:00.000Z', ...extra });
function writeFixture() {
    const file = join(mkdtempSync(join(tmpdir(), 'rw-migrate-')), 'redwest.json');
    const users = {
        rw_a: player(1, { apple: { sub: 'sub-1', clientId: 'x', linkedAt: 'now' }, reportedBy: ['rw_b'], ageBand: 'adult' }),
        rw_b: player(2, { tokenHash: undefined, tokenHashes: ['h2a', 'h2b'], nameHidden: true }),
        rw_c: player(3)
    };
    users.rw_a.profile.balances.dollars = 123;
    users.rw_a.profile.purchases = [{ tx: 'stripe:1', paymentIntent: 'pi_1' }];
    users.broken1 = { tokenHash: 'x' };           // no profile
    users.broken2 = { profile: {} };              // no token
    users.broken3 = 'nope';
    writeFileSync(file, JSON.stringify({ users, retainedPurchases: [{ transactionId: 'rc:1', deletedAt: '2026-09-01T00:00:00.000Z' }, { transactionId: 'rc:2', deletedAt: 'x' }, { nonsense: true }] }));
    return file;
}

const targets = [['memory', async () => createMemoryStore()]];
if(process.env.TEST_DATABASE_URL) {
    targets.push(['postgres', async () => {
        const { createPgStore } = await import('../server/pgStore.js');
        const store = await createPgStore({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
        await store.pool.query('truncate users, retained_purchases');
        return store;
    }]);
}

test('the file is read without trusting it: players are told from things that are not', () => {
    const { users, invalid, retained } = readJsonStore(writeFixture());
    assert.deepEqual(users.map(([id]) => id), ['rw_a', 'rw_b', 'rw_c']);
    assert.deepEqual(invalid.sort(), ['broken1', 'broken2', 'broken3']);
    assert.deepEqual(retained.map(r => r.transactionId), ['rc:1', 'rc:2']);
    const bad = join(mkdtempSync(join(tmpdir(), 'rw-migrate-')), 'bad.json');
    writeFileSync(bad, '{"people": {}}');
    assert.throws(() => readJsonStore(bad), /not a Red West JSON store/);
    writeFileSync(bad, 'not json');
    assert.throws(() => readJsonStore(bad), /Cannot read/);
    assert.throws(() => readJsonStore(join(tmpdir(), 'no-such-file.json')), /Cannot read/);
});

for(const [label, make] of targets) {
    test(`migration (${label}): a dry run changes nothing, a run copies every player identically, and a second run leaves them alone`, async () => {
        const file = writeFixture();
        const before = readFileSync(file, 'utf8');
        const store = await make();
        try {
            const dry = await migrateJsonToStore({ file, store, dryRun: true });
            assert.deepEqual({ users: dry.users, inserted: dry.inserted, invalid: dry.invalid, ok: dry.ok }, { users: 3, inserted: 3, invalid: 3, ok: true });
            assert.equal(await store.getUser('rw_a'), null, 'a dry run wrote nothing');
            assert.deepEqual(await store.retainedPurchases(), []);

            const run = await migrateJsonToStore({ file, store });
            assert.deepEqual({ inserted: run.inserted, alreadyThere: run.alreadyThere, failed: run.failed, mismatched: run.mismatched, ok: run.ok }, { inserted: 3, alreadyThere: 0, failed: [], mismatched: [], ok: true });
            const { users } = readJsonStore(file);
            for(const [id, user] of users) assert.deepEqual(await store.getUser(id), JSON.parse(JSON.stringify(user)), `${id} is the same as in the file`);
            assert.equal(await store.getUser('broken1'), null);
            assert.equal(await store.findUserByTokenHash('h2b'), 'rw_b');
            assert.equal((await store.findUserByAppleSub('sub-1')).id, 'rw_a');
            assert.equal((await store.findUserByPaymentIntent('pi_1')).id, 'rw_a');
            assert.deepEqual((await store.retainedPurchases()).map(r => r.transactionId).sort(), ['rc:1', 'rc:2']);

            // The game goes live on the new store and a player earns something; running the script again must not undo it.
            const live = await store.getUser('rw_a');
            live.profile.balances.dollars = 999;
            await store.putUser('rw_a', live);
            const again = await migrateJsonToStore({ file, store });
            assert.deepEqual({ inserted: again.inserted, alreadyThere: again.alreadyThere, ok: again.ok }, { inserted: 0, alreadyThere: 3, ok: true });
            assert.equal((await store.getUser('rw_a')).profile.balances.dollars, 999, 'newer progress is kept');
            assert.equal((await store.retainedPurchases()).length, 2, 'retained purchases are not doubled');

            const forced = await migrateJsonToStore({ file, store, overwrite: true });
            assert.equal(forced.replaced, 3);
            assert.equal((await store.getUser('rw_a')).profile.balances.dollars, 123, '--overwrite puts the file\'s version back');
            assert.equal(readFileSync(file, 'utf8'), before, 'the JSON file is never changed');
        } finally {
            await store.close?.();
        }
    });

    test(`migration (${label}): a player that cannot be copied is reported and the rest still go`, async () => {
        const file = writeFixture();
        const real = await make();
        try {
            const store = { ...real, putUser: async (id, user) => { if(id === 'rw_b') throw new Error('boom'); return real.putUser(id, user); } };
            const report = await migrateJsonToStore({ file, store });
            assert.equal(report.ok, false);
            assert.deepEqual(report.failed, [{ id: 'rw_b', error: 'boom' }]);
            assert.equal(report.inserted, 2);
            assert.notEqual(await real.getUser('rw_c'), null);
            const fixed = await migrateJsonToStore({ file, store: real });
            assert.deepEqual({ inserted: fixed.inserted, alreadyThere: fixed.alreadyThere, ok: fixed.ok }, { inserted: 1, alreadyThere: 2, ok: true }, 'running it again finishes the job');
        } finally {
            await real.close?.();
        }
    });
}
