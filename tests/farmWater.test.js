import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, FARM_LEVELS, PLOT_COUNT, farmWatered, plotState, plant, harvest, minutesText } from '../src/farm.js';
import { channelOpen, growMinutes, WATER_FACTOR } from '../src/farmWater.js';
import { ORDER_BONUS } from '../src/farmOrders.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { JAIL_BOUNTY_SHARE, jailRate } from '../src/town.js';
import { unlockedDistricts } from '../src/townDistricts.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const later = minutes => new Date(T0.getTime() + minutes * 60000);
const index = id => OUTLAWS.findIndex(o => o.id === id);
const profileWith = ids => {
    const p = createProfile(T0);
    for(const id of ids) p.stats.stageStars[index(id)] = 1;
    return p;
};
const wheat = CROPS.find(c => c.id === 'wheat');

test('the Channel opens with Mad Mesa Morgan alone, and waters the farm only while both are open', () => {
    assert.equal(channelOpen(profileWith([])), false);
    assert.equal(channelOpen(profileWith(['calloway-gang', 'iron-jack'])), false, 'no other outlaw opens it');
    assert.equal(channelOpen(profileWith(['mesa-morgan'])), true);
    assert.equal(farmWatered(profileWith(['mesa-morgan'])), false, 'no farm, nothing to water');
    assert.equal(farmWatered(profileWith(['calloway-gang'])), false, 'no Channel, no water');
    assert.equal(farmWatered(profileWith(['calloway-gang', 'mesa-morgan'])), true);
    assert.equal(unlockedDistricts(profileWith(['mesa-morgan']).stats.stageStars).join(), 'canal', 'it opens only its own district');
});

test('watered crops grow 10% sooner and not a minute sooner than that', () => {
    assert.equal(WATER_FACTOR, 0.9);
    assert.equal(growMinutes(wheat, false), 20);
    assert.ok(Math.abs(growMinutes(wheat, true) - 18) < 1e-9);
    const p = profileWith(['calloway-gang', 'mesa-morgan']);
    plant(p, 0, 'wheat', T0);
    assert.throws(() => harvest(p, 0, later(17)), { code: 'not_ready' });
    assert.deepEqual(harvest(p, 0, later(18)), { good: 'wheat', amount: 2 });
    // The same crop on a farm with no Channel still takes the full time.
    const dry = profileWith(['calloway-gang']);
    plant(dry, 0, 'wheat', T0);
    assert.throws(() => harvest(dry, 0, later(19)), { code: 'not_ready' });
    assert.deepEqual(harvest(dry, 0, later(20)), { good: 'wheat', amount: 2 });
    plant(dry, 1, 'wheat', T0);
    assert.equal(plotState(dry.town.farm, 1, later(10)).minutesLeft, 10);
    assert.ok(Math.abs(plotState(dry.town.farm, 1, later(10), true).minutesLeft - 8) < 1e-9, 'the same plot, watered, has 8 left');
    assert.equal(minutesText(growMinutes(CROPS.find(c => c.id === 'corn'), true)), '1h 21m');
});

test('a clock moved back still gains nothing from the water', () => {
    const p = profileWith(['calloway-gang', 'mesa-morgan']);
    plant(p, 0, 'corn', later(60));
    const state = plotState(p.town.farm, 0, T0, true); // planted "in the future"
    assert.equal(state.state, 'growing');
    assert.ok(state.minutesLeft <= growMinutes(CROPS.find(c => c.id === 'corn'), true) + 1e-9);
});

test('a link is only a bonus: shutting the Channel puts the farm back to exactly what it does alone', () => {
    const play = ids => {
        const p = profileWith(ids);
        plant(p, 0, 'corn', T0);
        return { crop: p.town.farm.plots[0], early: plotState(p.town.farm, 0, later(85), farmWatered(p)).state, late: plotState(p.town.farm, 0, later(95), farmWatered(p)).state };
    };
    assert.deepEqual(play(['calloway-gang']), play(['calloway-gang', 'iron-jack', 'lucky-lou']), 'other outlaws change nothing');
    assert.equal(play(['calloway-gang']).early, 'growing');
    assert.equal(play(['calloway-gang', 'mesa-morgan']).early, 'ready', '85 minutes is enough for watered corn (81m) and not for dry corn (90m)');
});

test('water is still a side income: a watered, tended farm stays under the jail even through orders at the top level', () => {
    const jailTopPerHour = OUTLAWS.reduce((sum, o) => sum + o.bounty, 0) * JAIL_BOUNTY_SHARE; // $108 with all ten beaten
    let best = 0;
    for(const c of CROPS) best = Math.max(best, (c.price * c.yield) / (growMinutes(c, true) / 60));
    const top = FARM_LEVELS[FARM_LEVELS.length - 1].standBonus;
    assert.ok(best * PLOT_COUNT * top < jailTopPerHour, `${best * PLOT_COUNT * top}/h at the stand`);
    assert.ok(best * PLOT_COUNT * ORDER_BONUS < jailTopPerHour, `${best * PLOT_COUNT * ORDER_BONUS}/h through orders`);
});

test('the Channel changes nothing outside itself: no stars, jail, buildings or other district', () => {
    const p = profileWith(['calloway-gang', 'mesa-morgan']);
    const snap = () => JSON.stringify({ stars: p.stats.stageStars, levels: p.town.levels, jail: p.town.jailCollectedAt, rate: jailRate(p), districts: unlockedDistricts(p.stats.stageStars) });
    const before = snap();
    plant(p, 0, 'wheat', T0); harvest(p, 0, later(18));
    assert.equal(snap(), before);
});
