import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, normalizeProfile, buyItem, equipItem, applyRun, creditNuggets, ownsItem, refreshJobs, MAX_DOLLARS_PER_RUN, EconomyError } from '../src/profile.js';
import { jobsForDay, getJob, JOB_POOL, JOBS_PER_DAY } from '../src/jobs.js';
import { COSMETICS, defaultLoadout, loadoutColors } from '../src/cosmetics.js';
import { PRODUCTS } from '../src/products.js';

const day = new Date(2026, 8, 28, 12);
const run = (extra = {}) => ({ score: 400, bounty: 'none', newStars: 0, peakHeat: 0, kills: {}, shotsHit: 0, loot: 0, ...extra });

test('a new profile starts broke with the free outfit equipped', () => {
    const p = createProfile(day);
    assert.deepEqual(p.balances, { dollars: 0, nuggets: 0 });
    assert.deepEqual(p.loadout, defaultLoadout());
    assert.equal(p.jobs.list.length, JOBS_PER_DAY);
});

test('runs pay Bounty Dollars for score, bounties and new stars', () => {
    const p = createProfile(day);
    const result = applyRun(p, run({ score: 400, bounty: 'banked', newStars: 2 }), day);
    assert.ok(result.lines.some(l => l.label === 'Run score' && l.dollars === 100));
    assert.ok(result.lines.some(l => l.label === 'Bounty collected' && l.dollars === 25));
    assert.ok(result.lines.some(l => l.label === 'New stars' && l.dollars === 80));
    assert.equal(p.balances.dollars, result.dollars);
});

test('a tampered run cannot mint unlimited dollars', () => {
    const p = createProfile(day);
    applyRun(p, run({ score: 1e9, newStars: 99 }), day);
    assert.ok(p.balances.dollars <= MAX_DOLLARS_PER_RUN);
});

test('buying spends the right currency, rejects duplicates and short funds', () => {
    const p = createProfile(day);
    assert.throws(() => buyItem(p, 'hat-black'), e => e instanceof EconomyError && e.code === 'funds');
    p.balances.dollars = 200;
    buyItem(p, 'hat-black');
    assert.equal(p.balances.dollars, 50);
    assert.ok(ownsItem(p, 'hat-black'));
    assert.throws(() => buyItem(p, 'hat-black'), e => e.code === 'owned');
    assert.throws(() => buyItem(p, 'hat-gold'), e => e.code === 'funds', 'nugget items need nuggets');
    p.balances.nuggets = 60;
    buyItem(p, 'hat-gold');
    assert.equal(p.balances.nuggets, 0);
});

test('only owned items can be equipped, and loadout maps to colours', () => {
    const p = createProfile(day);
    assert.throws(() => equipItem(p, 'coat-navy'), e => e.code === 'not_owned');
    p.balances.dollars = 500;
    buyItem(p, 'coat-navy');
    equipItem(p, 'coat-navy');
    assert.equal(p.loadout.coat, 'coat-navy');
    assert.equal(loadoutColors(p.loadout).coat, 0x283593);
});

test('daily jobs are deterministic per day, complete from run stats, and pay a nugget bonus once', () => {
    assert.deepEqual(jobsForDay('2026-09-28'), jobsForDay('2026-09-28'));
    const p = createProfile(day);
    // Force a known set of jobs.
    p.jobs.list = [{ id: 'bank', progress: 0, done: false }, { id: 'runs', progress: 0, done: false }, { id: 'heat-3', progress: 0, done: false }];
    const first = applyRun(p, run({ bounty: 'banked', peakHeat: 3 }), day);
    assert.deepEqual(first.jobsCompleted.sort(), ['bank', 'heat-3']);
    applyRun(p, run(), day);
    const third = applyRun(p, run(), day);
    assert.deepEqual(third.jobsCompleted, ['runs']);
    assert.equal(third.nuggets, 5);
    assert.equal(applyRun(p, run(), day).nuggets, 0, 'bonus is paid once a day');
    refreshJobs(p, new Date(2026, 8, 29, 9));
    assert.ok(p.jobs.list.every(j => !j.done), 'jobs reset the next day');
});

test('paid nuggets are credited once per transaction', () => {
    const p = createProfile(day);
    assert.equal(creditNuggets(p, 550, 'txn-1'), true);
    assert.equal(creditNuggets(p, 550, 'txn-1'), false);
    assert.equal(p.balances.nuggets, 550);
});

test('loading a profile drops unknown items and un-owned loadouts', () => {
    const p = normalizeProfile({ balances: { dollars: '120', nuggets: -5 }, owned: ['coat-navy', 'fake'], loadout: { hat: 'hat-gold', coat: 'coat-navy' } }, day);
    assert.deepEqual(p.balances, { dollars: 120, nuggets: 0 });
    assert.deepEqual(p.owned, ['coat-navy']);
    assert.equal(p.loadout.hat, defaultLoadout().hat, 'cannot equip a hat you do not own');
    assert.equal(p.loadout.coat, 'coat-navy');
});

test('catalog and job pool are well formed', () => {
    assert.equal(new Set(COSMETICS.map(c => c.id)).size, COSMETICS.length);
    for(const job of JOB_POOL) assert.ok(getJob(job.id) && job.goal > 0 && job.reward > 0);
    assert.equal(new Set(PRODUCTS.map(p => p.id)).size, PRODUCTS.length);
});
