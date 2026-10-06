import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

// Pieces of the load test (tools/loadtest/run.mjs), kept apart so tests/loadtest.test.js can check them.

export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const tokenOf = i => `lt-token-${i}`;
export const idOf = i => `lt_${String(i).padStart(7, '0')}`; // every test player starts with lt_, so cleanup never touches a real one

// The value at the p-th percentile (0 to 100) of a list of numbers; null for an empty list.
export function percentile(values, p) {
    if(!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

// What a virtual player does, with weights, the statuses that are the right answer (anything else counts as an error), and how to send it.
// profile and collect both write the player back (the server saves after each), so most of the mix is writes, as in the real game.
export const OPERATIONS = [
    { name: 'profile', weight: 45, method: 'GET', path: '/api/profile', ok: [200] },
    { name: 'collect', weight: 25, method: 'POST', path: '/api/town/collect', body: () => ({}), ok: [200] },
    { name: 'leaderboard', weight: 10, method: 'GET', path: '/api/leaderboard?board=weekly', ok: [200] },
    { name: 'mine-run', weight: 5, method: 'POST', path: '/api/mine/run', body: () => ({ startFloor: 1, depth: 2, ore: 5, outcome: 'up', seconds: 60 }), ok: [200, 429], minGapMs: 21000 },
    { name: 'mine-buy', weight: 5, method: 'POST', path: '/api/mine/buy', body: () => ({ id: 'lantern' }), ok: [400] },  // no money: refused, nothing written
    { name: 'orders', weight: 5, method: 'POST', path: '/api/town/orders', body: () => ({ action: 'visit' }), ok: [400] }, // shut: refused, nothing written
    { name: 'farm', weight: 5, method: 'POST', path: '/api/town/farm', body: () => ({ action: 'sell', good: 'all' }), ok: [400] } // nothing to sell
];

export function pickOperation(random = Math.random, operations = OPERATIONS) {
    const total = operations.reduce((sum, op) => sum + op.weight, 0);
    let roll = random() * total;
    for(const op of operations) { roll -= op.weight; if(roll < 0) return op; }
    return operations[operations.length - 1];
}

// One measurement window: latencies per operation and the statuses seen.
export function createStats() {
    return { startedAt: Date.now(), latencies: [], byOp: new Map(), statuses: new Map(), errors: 0, requests: 0, networkErrors: 0 };
}
export function record(stats, op, ms, status, expected) {
    stats.requests++;
    stats.latencies.push(ms);
    if(!stats.byOp.has(op)) stats.byOp.set(op, []);
    stats.byOp.get(op).push(ms);
    stats.statuses.set(status, (stats.statuses.get(status) ?? 0) + 1);
    if(!expected) stats.errors++;
}
// `seconds` is the length of the measuring window (the players stop starting requests when it ends, but the last sleeps run on a little longer).
export function summarize(stats, { p95Budget, errorBudget, seconds = (Date.now() - stats.startedAt) / 1000 }) {
    seconds = Math.max(0.001, seconds);
    const p95 = percentile(stats.latencies, 95);
    const errorRate = stats.requests ? stats.errors / stats.requests : 0;
    return {
        requests: stats.requests,
        rps: stats.requests / seconds,
        p50: percentile(stats.latencies, 50), p95, p99: percentile(stats.latencies, 99), max: percentile(stats.latencies, 100),
        errors: stats.errors, networkErrors: stats.networkErrors, errorRate,
        statuses: Object.fromEntries([...stats.statuses.entries()].sort((a, b) => a[0] - b[0])),
        slowest: [...stats.byOp.entries()].map(([name, list]) => ({ name, p95: percentile(list, 95), n: list.length })).sort((a, b) => b.p95 - a.p95)[0] ?? null,
        pass: stats.requests > 0 && p95 <= p95Budget && errorRate <= errorBudget
    };
}

// One virtual player: signs in with a seeded token and acts, then waits a think time, until `until()` says stop.
export async function player({ base, token, think, until, stats, random = Math.random, timeoutMs = 10000, operations = OPERATIONS }) {
    const lastAt = new Map();
    await sleep(random() * think * 1000); // spread the players out so they do not all act at once
    while(!until()) {
        let op = pickOperation(random, operations);
        if(op.minGapMs && Date.now() - (lastAt.get(op.name) ?? 0) < op.minGapMs) op = operations[0];
        lastAt.set(op.name, Date.now());
        const started = performance.now();
        try {
            const response = await fetch(base + op.path, {
                method: op.method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: op.body ? JSON.stringify(op.body()) : undefined,
                signal: AbortSignal.timeout(timeoutMs)
            });
            await response.arrayBuffer();
            record(stats, op.name, performance.now() - started, response.status, op.ok.includes(response.status));
        } catch {
            stats.networkErrors++;
            record(stats, op.name, performance.now() - started, 0, false);
        }
        await sleep(think * 1000 * (0.5 + random()));
    }
}

// How much of the server process this machine gave it, from /proc (Linux only; null elsewhere).
export function processUsage(pid) {
    try {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
        const ticks = Number(stat[11]) + Number(stat[12]); // utime + stime
        const status = readFileSync(`/proc/${pid}/status`, 'utf8');
        const rssKb = Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
        return { cpuSeconds: ticks / 100, rssMb: rssKb / 1024, at: Date.now() };
    } catch { return null; }
}
export function cpuPercent(before, after) {
    if(!before || !after || after.at <= before.at) return null;
    return ((after.cpuSeconds - before.cpuSeconds) / ((after.at - before.at) / 1000)) * 100;
}

export async function waitForHealth(base, tries = 100) {
    for(let i = 0; i < tries; i++) {
        try { const r = await fetch(`${base}/healthz`); if(r.ok) return true; } catch { /* not up yet */ }
        await sleep(100);
    }
    throw new Error(`The server did not answer ${base}/healthz.`);
}
