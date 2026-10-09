import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createServer } from 'node:net';
import { createStats, summarize, player, processUsage, cpuPercent, waitForHealth, sha256, tokenOf, idOf, OPERATIONS } from './lib.mjs';

// Red West load test: how many players one server can carry before it feels slow.
//
//   node tools/loadtest/run.mjs [--steps 100,300,1000,3000] [--seconds 20] [--think 8] [--seed 5000] [--pad-kb 4]
//                               [--p95 300] [--errors 0.005] [--without leaderboard,collect] [--store json|postgres] [--database-url URL]
//
// It seeds a throwaway store with --seed test players (ids starting lt_), starts its OWN server on a free port as a child process, and for
// each step runs that many virtual players, each acting about every --think seconds (the mix is in lib.mjs: reads, saves, the leaderboard,
// refused buys). It prints one row per step and says which is the highest step that stayed inside the budget (p95 under --p95 ms and errors
// under --errors). It never touches your real data: the JSON store is a temp file, and with Postgres it refuses a database that holds any
// player not starting with lt_, and removes only the lt_ players when it is done.
// Run it on the machine you care about (the VPS): the load generator and the server share its CPU, so the numbers are on the cautious side.

const args = process.argv.slice(2);
const value = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
if(args.includes('--help')) {
    console.log(readUsage());
    process.exit(0);
}
function readUsage() {
    return `Usage: node tools/loadtest/run.mjs [--steps 100,300,1000,3000] [--seconds 20] [--think 8] [--seed 5000] [--pad-kb 4]
                                   [--p95 300] [--errors 0.005] [--without leaderboard] [--store json|postgres] [--database-url URL]
  --steps         virtual players per step (each step runs --seconds)
  --think         seconds between one player's actions, on average (8 = a busy player)
  --seed          test players in the store (the size of the "database"); at least the largest step
  --pad-kb        extra bytes per player, to look like a played profile (a fresh one is under 2 KB)
  --without       leave operations out of the mix, to see what is slow: profile, collect, leaderboard, mine-run, mine-buy, orders, farm
  --store         json (default, a temp file) or postgres (needs --database-url or DATABASE_URL; the database must hold no real players)`;
}
const steps = String(value('steps', '100,300,1000,3000')).split(',').map(Number).filter(n => n > 0);
const seconds = Number(value('seconds', 20));
const think = Number(value('think', 8));
const seedCount = Math.max(Number(value('seed', 5000)), ...steps);
const padKb = Number(value('pad-kb', 4));
const p95Budget = Number(value('p95', 300));
const errorBudget = Number(value('errors', 0.005));
const without = String(value('without', '')).split(',').filter(Boolean);
const operations = OPERATIONS.filter(op => !without.includes(op.name));
const storeKind = value('store', 'json');
const databaseUrl = value('database-url', process.env.DATABASE_URL);
if(!steps.length || !(seconds > 0) || !(think > 0)) { console.error(readUsage()); process.exit(2); }
if(!operations.length || without.some(name => !OPERATIONS.some(op => op.name === name))) { console.error(`--without takes names from: ${OPERATIONS.map(op => op.name).join(', ')} (and not all of them).`); process.exit(2); }
if(storeKind !== 'json' && storeKind !== 'postgres') { console.error('--store must be json or postgres'); process.exit(2); }
if(storeKind === 'postgres' && !databaseUrl) { console.error('--store postgres needs --database-url (a database that holds no real players).'); process.exit(2); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const moduleUrl = (...parts) => pathToFileURL(join(root, ...parts)).href;
const { createProfile, weekKey } = await import(moduleUrl('src', 'profile.js'));
const dir = mkdtempSync(join(tmpdir(), 'rw-loadtest-'));
let child = null, pgStore = null;

const freePort = () => new Promise(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
// A seeded player has a name and a score on the weekly board and the first stage, like a player who has played, so the leaderboard has real work to do.
function makeUser(i) {
    const now = new Date();
    const profile = createProfile(now);
    profile.name = `RIDER ${i}`;
    const score = 100 + ((i * 7919) % 9000);
    profile.stats.weekly = { week: weekKey(now), score, character: 'char-marshal' };
    profile.stats.stageBest[0] = score;
    profile.stats.stageStars[0] = 1 + (i % 7);
    return { tokenHash: sha256(tokenOf(i)), profile, lastRunAt: 0, createdAt: now.toISOString(), pad: padKb > 0 ? 'x'.repeat(padKb * 1024) : undefined };
}

async function cleanup() {
    child?.kill('SIGTERM');
    if(pgStore) { await pgStore.pool.query(`delete from users where id like 'lt\\_%'`).catch(() => {}); await pgStore.close().catch(() => {}); }
    rmSync(dir, { recursive: true, force: true });
}
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

try {
    const env = { ...process.env, NODE_ENV: 'production', TRUST_PROXY: '1', ALLOWED_ORIGIN: '*' };
    delete env.DATABASE_URL; delete env.STORE;
    if(storeKind === 'postgres') {
        const { createPgStore } = await import(moduleUrl('server', 'pgStore.js'));
        pgStore = await createPgStore({ connectionString: databaseUrl, max: 4 });
        const { rows } = await pgStore.pool.query(`select count(*)::int as n from users where id not like 'lt\\_%'`);
        if(rows[0].n > 0) throw new Error(`Refusing to run: that database holds ${rows[0].n} players that are not load-test players. Use an empty throwaway database.`);
        await pgStore.pool.query(`delete from users where id like 'lt\\_%'`);
        console.log(`Seeding ${seedCount} players into Postgres...`);
        for(let i = 0; i < seedCount; i++) await pgStore.putUser(idOf(i), makeUser(i));
        env.STORE = 'postgres'; env.DATABASE_URL = databaseUrl;
    } else {
        const { createFileStore } = await import(moduleUrl('server', 'store.js'));
        const file = join(dir, 'redwest.json');
        console.log(`Seeding ${seedCount} players into a temp JSON file...`);
        const store = createFileStore(file);
        for(let i = 0; i < seedCount; i++) store.putUser(idOf(i), makeUser(i));
        store.save();
        env.DATA_FILE = file;
    }
    const port = await freePort();
    env.PORT = String(port);
    child = spawn(process.execPath, [join(root, 'server', 'index.js')], { env, stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('exit', code => { if(code) console.error(`The server exited with code ${code}.`); });
    const base = `http://127.0.0.1:${port}`;
    await waitForHealth(base);
    console.log(`Server up (${storeKind} store, ${seedCount} players, ~${padKb} KB padding each). Budget: p95 <= ${p95Budget} ms, errors <= ${(errorBudget * 100).toFixed(1)}%. Each step runs ${seconds}s, one action per player about every ${think}s.${without.length ? ` Left out of the mix: ${without.join(', ')}.` : ''}\n`);

    const rows = [];
    const header = ['players', 'req/s', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms', 'errors', 'srv cpu%', 'srv MB', 'slowest', 'verdict'];
    console.log(header.map((h, i) => i === 9 ? h.padEnd(20) : h.padStart(9)).join(' '));
    for(const count of steps) {
        const stats = createStats();
        const stopAt = Date.now() + seconds * 1000;
        const before = processUsage(child.pid);
        const players = Array.from({ length: count }, (_, i) => player({ base, token: tokenOf(i), think, until: () => Date.now() >= stopAt, stats, operations }));
        await Promise.all(players);
        const after = processUsage(child.pid);
        const s = summarize(stats, { p95Budget, errorBudget, seconds });
        const f = (n, d = 0) => (n == null ? '-' : n.toFixed(d));
        console.log([
            String(count).padStart(9), f(s.rps).padStart(9), f(s.p50).padStart(9), f(s.p95).padStart(9), f(s.p99).padStart(9), f(s.max).padStart(9),
            `${s.errors}`.padStart(9), f(cpuPercent(before, after)).padStart(9), f(after?.rssMb).padStart(9),
            `${s.slowest?.name ?? '-'} ${f(s.slowest?.p95)}`.padEnd(20), s.pass ? 'ok' : 'OVER BUDGET'
        ].join(' '));
        if(s.errors) console.log(`          statuses: ${JSON.stringify(s.statuses)}${s.networkErrors ? `, ${s.networkErrors} network errors or timeouts` : ''}`);
        rows.push({ count, ...s });
        await sleep(1000);
    }
    const passing = rows.filter(r => r.pass).map(r => r.count);
    const best = rows.filter(r => r.pass).pop();
    console.log(best
        ? `\nHighest step inside the budget: ${best.count} players online at once (about ${best.rps.toFixed(0)} requests a second). Between that and the next step is where it starts to feel slow.`
        : `\nNo step stayed inside the budget. Try smaller steps (--steps 20,50,100) or a longer --think.`);
    process.exitCode = passing.length === rows.length ? 0 : 1;
} catch(error) {
    console.error(error.message);
    process.exitCode = 2;
} finally {
    await cleanup();
}
