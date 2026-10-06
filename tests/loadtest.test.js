import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { percentile, pickOperation, OPERATIONS, createStats, record, summarize, cpuPercent, sha256, tokenOf, idOf } from '../tools/loadtest/lib.mjs';

// The load test's own parts (tools/loadtest/). The last test runs the tool for a few seconds against its own throwaway server.

test('percentiles: the value under which that share of the requests fell', () => {
    assert.equal(percentile([], 95), null);
    assert.equal(percentile([7], 95), 7);
    const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(hundred, 50), 50);
    assert.equal(percentile(hundred, 95), 95);
    assert.equal(percentile(hundred, 99), 99);
    assert.equal(percentile(hundred, 100), 100);
    assert.equal(percentile([5, 1, 4, 2, 3], 50), 3, 'the list does not need to be sorted');
});

test('the mix: weights decide what a player does, and every operation names the right answers', () => {
    const counts = new Map();
    let n = 0;
    const random = () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; }; // a fixed stream, so the test never flakes
    for(let i = 0; i < 20000; i++) { const op = pickOperation(random); counts.set(op.name, (counts.get(op.name) ?? 0) + 1); }
    const total = OPERATIONS.reduce((s, o) => s + o.weight, 0);
    for(const op of OPERATIONS) {
        assert.ok(op.ok.length > 0 && op.path.startsWith('/api/'), op.name);
        assert.ok(Math.abs(counts.get(op.name) / 20000 - op.weight / total) < 0.02, `${op.name} is picked about as often as its weight says`);
    }
    assert.equal(pickOperation(() => 0.999999).name, OPERATIONS[OPERATIONS.length - 1].name);
});

test('a window is judged on p95 and on unexpected answers', () => {
    const stats = createStats();
    for(let i = 1; i <= 100; i++) record(stats, 'profile', i, 200, true);
    assert.equal(summarize(stats, { p95Budget: 95, errorBudget: 0.005 }).pass, true);
    assert.equal(summarize(stats, { p95Budget: 94, errorBudget: 0.005 }).pass, false, 'p95 over budget');
    record(stats, 'collect', 5, 500, false);
    const s = summarize(stats, { p95Budget: 1000, errorBudget: 0.005 });
    assert.equal(s.errors, 1);
    assert.equal(s.pass, false, 'one unexpected answer in 101 is over a 0.5% budget');
    assert.deepEqual(s.statuses, { 200: 100, 500: 1 });
    assert.equal(summarize(createStats(), { p95Budget: 1000, errorBudget: 1 }).pass, false, 'nothing measured is not a pass');
    assert.equal(summarize(stats, { p95Budget: 1000, errorBudget: 1, seconds: 10 }).rps, 10.1, 'requests a second are over the window, not over the time the last player took to finish');
    assert.equal(cpuPercent({ cpuSeconds: 1, at: 0 }, { cpuSeconds: 2, at: 2000 }), 50);
    assert.equal(cpuPercent(null, { cpuSeconds: 2, at: 2000 }), null);
});

test('test players are recognisable: ids start with lt_ and tokens hash to what the store holds', () => {
    assert.match(idOf(0), /^lt_\d{7}$/);
    assert.notEqual(idOf(1), idOf(2));
    assert.equal(sha256(tokenOf(3)), sha256('lt-token-3'));
});

test('the tool runs end to end against its own server, and refuses bad arguments', () => {
    const run = (...args) => spawnSync(process.execPath, ['tools/loadtest/run.mjs', ...args], { encoding: 'utf8', timeout: 60000 });
    const ok = run('--steps', '5', '--seconds', '2', '--think', '0.5', '--seed', '20', '--pad-kb', '0', '--p95', '5000');
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /Server up \(json store, 20 players/);
    assert.match(ok.stdout, /Highest step inside the budget: 5 players/);
    assert.equal(run('--steps', 'x').status, 2);
    assert.equal(run('--store', 'mongo').status, 2);
    assert.equal(run('--store', 'postgres', '--database-url', '').status, 2, 'postgres needs a database url');
    assert.equal(run('--without', 'nope').status, 2, 'only real operations can be left out');
    const noBoard = run('--steps', '3', '--seconds', '1', '--think', '0.3', '--seed', '10', '--pad-kb', '0', '--p95', '5000', '--without', 'leaderboard');
    assert.equal(noBoard.status, 0, noBoard.stdout + noBoard.stderr);
    assert.match(noBoard.stdout, /Left out of the mix: leaderboard/);
    assert.equal(run('--help').status, 0);
});
