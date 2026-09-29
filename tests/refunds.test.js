import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, grantProduct, revokePurchase, applyRun, buyItem, equipItem } from '../src/profile.js';
import { getProduct } from '../src/products.js';
import { POINTS_PER_TIER, tierReward } from '../src/pass.js';

const NOW = new Date(Date.UTC(2026, 9, 5, 12));

test('a refunded nugget pack takes its nuggets back, and spent ones become a debt', () => {
    const p = createProfile(NOW);
    grantProduct(p, getProduct('nuggets_100'), 'rc:a', NOW);
    buyItem(p, 'hat-gold'); // spends all 100
    assert.equal(revokePurchase(p, 'rc:a', NOW), true);
    assert.equal(p.balances.nuggets, 0, 'never negative');
    assert.equal(p.nuggetDebt, 100);
    assert.equal(revokePurchase(p, 'rc:a', NOW), false, 'a refund is applied once');
    assert.equal(revokePurchase(p, 'rc:unknown', NOW), false);
    // The next nuggets pay the debt first.
    grantProduct(p, getProduct('nuggets_550'), 'rc:b', NOW);
    assert.equal(p.balances.nuggets, 450);
    assert.equal(p.nuggetDebt, 0);
});

test("a refunded Deputy's Kit removes its looks (and unequips them) and can be bought again", () => {
    const p = createProfile(NOW);
    grantProduct(p, getProduct('starter_pack'), 'rc:kit', NOW);
    equipItem(p, 'hat-deputy');
    revokePurchase(p, 'rc:kit', NOW);
    assert.ok(!p.owned.includes('hat-deputy'));
    assert.notEqual(p.loadout.hat, 'hat-deputy');
    assert.deepEqual(p.bought, []);
    assert.equal(p.balances.nuggets, 0);
});

test('a refunded pass closes the paid track and takes back everything it paid this season', () => {
    const p = createProfile(NOW);
    p.pass.points = POINTS_PER_TIER * 4;
    grantProduct(p, getProduct('season_pass'), 'rc:pass', NOW);
    // More tiers reached after buying also paid the paid track.
    p.pass.points += POINTS_PER_TIER * 2;
    applyRun(p, { score: 0, kills: {}, bounty: 'none' }, NOW);
    assert.equal(p.pass.premiumClaimed, 6);
    let paidNuggets = 0;
    for(let t = 1; t <= 6; t++) paidNuggets += tierReward(p.pass.season, t, 'premium').nuggets || 0;
    const before = p.balances.nuggets;
    revokePurchase(p, 'rc:pass', NOW);
    assert.equal(p.pass.premium, false);
    assert.equal(p.balances.nuggets, Math.max(0, before - paidNuggets));
    assert.ok(!p.owned.includes(tierReward(p.pass.season, 1, 'premium').item));
});
