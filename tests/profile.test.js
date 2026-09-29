import test from 'node:test';
import { getShopItem } from '../src/cosmetics.js';
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
    p.balances.nuggets = getShopItem('hat-gold').price;
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

test('catalog and job pool are well formed', async () => {
    const { SHOP_ITEMS } = await import('../src/cosmetics.js');
    assert.equal(new Set(SHOP_ITEMS.map(c => c.id)).size, SHOP_ITEMS.length);
    for(const job of JOB_POOL) assert.ok(getJob(job.id) && job.goal > 0 && job.reward > 0);
    assert.equal(new Set(PRODUCTS.map(p => p.id)).size, PRODUCTS.length);
});

test('names: one per account, cleaned up, with a basic blocklist', async () => {
    const { validateName } = await import('../src/names.js');
    const { setName } = await import('../src/profile.js');
    assert.deepEqual(validateName('  el  paso kid!! '), { ok: true, name: 'EL PASO KID' });
    assert.equal(validateName('ab').ok, false);
    assert.equal(validateName('a'.repeat(20)).ok, false);
    assert.equal(validateName('sh1t head').ok, false, 'leetspeak does not dodge the list');
    const p = createProfile(day);
    assert.equal(setName(p, 'dusty'), 'DUSTY');
    assert.throws(() => setName(p, '??'), e => e.code === 'bad_name');
});

test('runs update account records; implausible scores never reach the boards', async () => {
    const { plausibleScore } = await import('../src/profile.js');
    const p = createProfile(day);
    applyRun(p, run({ score: 700, seconds: 150, outlawIndex: 2, bounty: 'banked' }), day);
    assert.equal(p.stats.stageBest[2], 0, 'a locked stage gives no record');
    p.stats.stageStars[1] = 1;
    applyRun(p, run({ score: 900, seconds: 150, outlawIndex: 2, bounty: 'banked', heatAtOutlaw: 3, kills: { bandit: 12 } }), day);
    assert.equal(p.stats.runs, 2);
    assert.equal(p.stats.kills, 12);
    assert.equal(p.stats.stageBest[2], 900);
    assert.equal(p.stats.stageStars[2], 3, 'defeat + hot bounty');
    assert.equal(p.stats.weekly.score, 900);
    const cheat = applyRun(p, run({ score: 999999, seconds: 30, outlawIndex: 2 }), day);
    assert.equal(cheat.ranked, false);
    assert.equal(p.stats.stageBest[2], 900);
    assert.equal(plausibleScore(500, 10), false, 'too short to count');

    const { importProgress } = await import('../src/profile.js');
    const q = createProfile(day);
    importProgress(q, { stars: [1, 3, 0, 0, 0, 0, 0, 0], best: [400, 650, 0, 0, 0, 0, 0, 0] });
    assert.deepEqual(q.stats.stageStars.slice(0, 3), [1, 3, 0]);
    assert.equal(q.stats.stageBest[1], 650);
    assert.equal(q.stats.bestScore, 650);
});

test('leaderboards rank named accounts, show my rank, and reset weekly', async () => {
    const { rankBoard, weekKey } = await import('../src/profile.js');
    const make = (name, weekly, stars) => {
        const p = createProfile(day);
        p.name = name;
        p.stats.weekly = { week: weekKey(day), score: weekly };
        p.stats.stageStars = stars;
        return p;
    };
    const accounts = [
        { id: 'a', profile: make('ANNIE', 800, [7, 1, 0, 0, 0, 0, 0, 0]) },
        { id: 'b', profile: make('BART', 1200, [1, 0, 0, 0, 0, 0, 0, 0]) },
        { id: 'c', profile: make('', 5000, [7, 7, 7, 0, 0, 0, 0, 0]) },
        { id: 'd', profile: make('DOC', 300, [7, 7, 0, 0, 0, 0, 0, 0]) }
    ];
    const weekly = rankBoard(accounts, 'weekly', 'd', 2, day);
    assert.deepEqual(weekly.entries.map(e => e.name), ['BART', 'ANNIE'], 'unnamed accounts are hidden');
    assert.deepEqual(weekly.me, { rank: 3, name: 'DOC', value: 300, me: true });
    assert.equal(rankBoard(accounts, 'stars', null, 50, day).entries[0].name, 'DOC');
    const nextWeek = new Date(day.getTime() + 8 * 86400000);
    assert.equal(rankBoard(accounts, 'weekly', null, 50, nextWeek).entries.length, 0);
    assert.throws(() => rankBoard(accounts, 'nope'), e => e.code === 'bad_board');
});

test('guns: one free per slot, sold only for earned dollars, and equippable', async () => {
    const { WEAPONS, WEAPON_SLOTS, weaponBars } = await import('../src/weapons.js');
    for(const slot of WEAPON_SLOTS) assert.equal(WEAPONS.filter(w => w.slot === slot && w.price === 0).length, 1);
    for(const gun of WEAPONS) {
        assert.equal(gun.currency, 'dollars', `${gun.id}: paid currency never buys power`);
        for(const value of Object.values(weaponBars(gun))) assert.ok(value >= 1 && value <= 5);
    }
    const p = createProfile(day);
    assert.equal(p.loadout.primary, 'gun-revolver');
    assert.equal(p.loadout.secondary, 'gun-shotgun');
    p.balances.dollars = 700;
    buyItem(p, 'gun-rifle');
    equipItem(p, 'gun-rifle');
    assert.equal(p.loadout.primary, 'gun-rifle');
    assert.equal(normalizeProfile(p, day).loadout.primary, 'gun-rifle');
    assert.equal(normalizeProfile({ loadout: { secondary: 'gun-buffalo' } }, day).loadout.secondary, 'gun-shotgun', 'unowned guns are not equipped');
});
