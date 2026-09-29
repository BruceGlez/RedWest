import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, normalizeProfile, applyRun } from '../src/profile.js';
import { BUILDINGS, TOWN_EFFECTS, JAIL_BOUNTY_SHARE, jailRate, jailCapacity, jailStored, collectJail, upgradeBuilding, upgradeCost, hoursUntilFull } from '../src/town.js';
import { WEAPONS } from '../src/weapons.js';
import { OUTLAWS } from '../src/outlaws.js';
import { getJob } from '../src/jobs.js';

const T0 = new Date(Date.UTC(2026, 8, 29, 8));
const later = hours => new Date(T0.getTime() + hours * 3600000);
function profileWithBeaten(count) {
    const profile = createProfile(T0);
    for(let i = 0; i < count; i++) profile.stats.stageStars[i] = 1;
    return profile;
}

test('buildings only ever change income, never combat', () => {
    const combatStats = new Set(WEAPONS.flatMap(weapon => Object.keys(weapon.stats)));
    for(const building of BUILDINGS) {
        for(const level of building.levels) {
            for(const key of Object.keys(level.effects)) {
                assert.ok(TOWN_EFFECTS.includes(key), `${building.id}: ${key} is not an income effect`);
                assert.ok(!combatStats.has(key), `${building.id}: ${key} is a combat stat`);
            }
            assert.ok(level.cost >= 0 && Number.isInteger(level.cost));
        }
    }
});

test('the jail pays a share of each beaten outlaw\'s bounty per hour, up to its storage', () => {
    assert.equal(jailRate(profileWithBeaten(0)), 0);
    const one = profileWithBeaten(1);
    assert.equal(jailRate(one), Math.round(OUTLAWS[0].bounty * JAIL_BOUNTY_SHARE));
    assert.equal(jailStored(one, later(3)), 3 * jailRate(one));
    assert.equal(jailCapacity(one), 8 * jailRate(one));
    assert.equal(jailStored(one, later(30)), jailCapacity(one), 'capped at 8 hours');
    assert.equal(hoursUntilFull(one, later(6)), 2);
    const all = profileWithBeaten(OUTLAWS.length);
    assert.equal(jailRate(all), Math.round(OUTLAWS.reduce((sum, o) => sum + o.bounty, 0) * JAIL_BOUNTY_SHARE));
    assert.ok(jailCapacity(all) <= 600, 'a full jail is worth about two good runs, not a day of play');
});

test('collecting pays once and a clock moved backwards pays nothing', () => {
    const p = profileWithBeaten(2);
    const rate = jailRate(p);
    assert.equal(collectJail(p, later(2)), 2 * rate);
    assert.equal(p.balances.dollars, 2 * rate);
    assert.equal(collectJail(p, later(2)), 0, 'nothing twice');
    assert.equal(jailStored(p, later(1)), 0, 'clock set back: nothing');
    // Set forward, collect, set back: the next collect waits for real time to catch up.
    collectJail(p, later(20));
    assert.equal(jailStored(p, later(3)), 0);
});

test('upgrades cost dollars, finish at once, and keep what the jail had stored', () => {
    const p = profileWithBeaten(1);
    assert.equal(upgradeCost(p, 'jail'), 300);
    assert.throws(() => upgradeBuilding(p, 'jail', later(1)), { code: 'funds' });
    p.balances.dollars = 1000;
    const stored = jailStored(p, later(4));
    assert.equal(upgradeBuilding(p, 'jail', later(4)), 2);
    assert.equal(p.balances.dollars, 1000 - 300 + stored, 'stored income collected before the upgrade');
    assert.equal(jailRate(p), Math.round(OUTLAWS[0].bounty * JAIL_BOUNTY_SHARE * 1.1));
    assert.throws(() => upgradeBuilding(p, 'saloon'), { code: 'unknown_building' });
    assert.throws(() => upgradeBuilding(p, 'gunsmith'), { code: 'max_level' });
    p.balances.dollars = 100000;
    while(upgradeCost(p, 'jail') !== null) upgradeBuilding(p, 'jail', later(5));
    assert.equal(p.town.levels.jail, 5);
    assert.equal(jailCapacity(p), jailRate(p) * 12);
});

test('the sheriff raises daily job rewards', () => {
    const p = createProfile(T0);
    p.balances.dollars = 500;
    upgradeBuilding(p, 'sheriff', T0);
    const job = getJob('runs'); // "Finish 3 runs": any run counts
    p.jobs.list = [{ id: 'runs', progress: job.goal - 1, done: false }];
    const result = applyRun(p, { score: 0, kills: {}, bounty: 'none' }, T0);
    const line = result.lines.find(l => l.label === `Job: ${job.text}`);
    assert.equal(line.dollars, Math.round(job.reward * 1.15));
});

test('saved towns are checked on load', () => {
    const p = normalizeProfile({ town: { levels: { jail: 99, sheriff: -3, nope: 4 }, jailCollectedAt: 'garbage' } }, T0);
    assert.equal(p.town.levels.jail, 5, 'capped at the top level');
    assert.equal(p.town.levels.sheriff, 1);
    assert.equal(p.town.levels.nope, undefined);
    assert.equal(p.town.jailCollectedAt, T0.toISOString());
});
