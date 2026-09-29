import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonFor, seasonEndsAt, tierReward, tierFor, normalizePass, payPassRewards, pointsForRun, PASS_COSMETICS, TIERS, POINTS_PER_TIER, SEASON_EPOCH } from '../src/pass.js';
import { createProfile, applyRun, grantProduct, buyItem } from '../src/profile.js';
import { getProduct } from '../src/products.js';

const NOW = new Date(Date.UTC(2026, 9, 5, 12)); // inside season 1

test('seasons last 30 days from the start date', () => {
    assert.equal(seasonFor(new Date(SEASON_EPOCH)), 1);
    assert.equal(seasonFor(NOW), 1);
    assert.equal(seasonEndsAt(1).toISOString(), '2026-10-29T00:00:00.000Z');
    assert.equal(seasonFor(new Date('2026-10-29T00:00:00Z')), 2);
});

test('the paid track holds looks and nuggets only, never dollars (dollars buy guns)', () => {
    for(const season of [1, 2, 3]) {
        for(let tier = 1; tier <= TIERS; tier++) {
            const reward = tierReward(season, tier, 'premium');
            assert.equal(reward.dollars, undefined, `season ${season} tier ${tier}`);
            assert.ok(reward.item || reward.nuggets > 0);
        }
    }
});

test('pass looks can never be bought', () => {
    const p = createProfile(NOW);
    p.balances = { dollars: 1e9, nuggets: 1e9 };
    for(const item of PASS_COSMETICS) assert.throws(() => buyItem(p, item.id), { code: 'earned' });
});

test('tiers pay as they are reached; buying the pass later pays the paid track back to tier 1', () => {
    const p = createProfile(NOW);
    p.pass.points = POINTS_PER_TIER * 12;
    const free = payPassRewards(p);
    assert.equal(free.length, 12);
    assert.ok(free.every(r => r.track === 'free'));
    assert.deepEqual(payPassRewards(p), [], 'nothing twice');
    const nuggetsBefore = p.balances.nuggets;
    grantProduct(p, getProduct('season_pass'), 'rc:pass-1', NOW);
    assert.equal(p.pass.premium, true);
    assert.equal(p.pass.premiumClaimed, 12, 'every reached tier paid at once');
    assert.ok(p.balances.nuggets > nuggetsBefore);
    assert.ok(p.owned.includes(tierReward(1, 1, 'premium').item));
});

test('runs, jobs and event targets earn points, and the result lists the tiers reached', () => {
    assert.equal(pointsForRun({ bounty: 'none' }), 20);
    assert.equal(pointsForRun({ bounty: 'banked', jobsCompleted: 2, eventTargets: 1 }), 20 + 10 + 60 + 50);
    const p = createProfile(NOW);
    p.pass.points = POINTS_PER_TIER - 5;
    const result = applyRun(p, { score: 100, seconds: 60, kills: {}, bounty: 'banked' }, NOW);
    assert.equal(tierFor(p.pass.points), 1);
    const line = result.lines.find(l => l.label === 'Pass tier 1');
    assert.ok(line, 'tier 1 shows on the result screen');
    assert.equal(line.dollars, tierReward(1, 1, 'free').dollars);
});

test('a new season starts fresh', () => {
    const p = createProfile(NOW);
    p.pass = { season: 1, points: 5000, premium: true, freeClaimed: 20, premiumClaimed: 20 };
    const next = normalizePass(p.pass, new Date('2026-11-02T00:00:00Z'));
    assert.deepEqual(next, { season: 2, points: 0, premium: false, freeClaimed: 0, premiumClaimed: 0 });
});
