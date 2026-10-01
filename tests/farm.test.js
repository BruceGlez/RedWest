import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, EGG, GOODS, PLOT_COUNT, createFarm, normalizeFarm, farmOpen, plotState, eggsReady, minutesToNextEgg, plant, harvest, collectEggs, sell, farmAction, minutesText } from '../src/farm.js';
import { createProfile, normalizeProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { JAIL_BOUNTY_SHARE, normalizeTown } from '../src/town.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const later = minutes => new Date(T0.getTime() + minutes * 60000);
const calloways = OUTLAWS.findIndex(o => o.id === 'calloway-gang');
function openProfile() {
    const profile = createProfile(T0);
    profile.stats.stageStars[calloways] = 1;
    return profile;
}

test('the farm is shut until the Calloways are beaten, and every action says so', () => {
    const profile = createProfile(T0);
    assert.equal(farmOpen(profile), false);
    for(const body of [{ action: 'plant', plot: 0, crop: 'wheat' }, { action: 'harvest', plot: 0 }, { action: 'eggs' }, { action: 'sell', good: 'all' }]) {
        assert.throws(() => farmAction(profile, body, T0), { code: 'locked' });
    }
    profile.stats.stageStars[calloways] = 6; // stars without the "beaten" bit do not open it
    assert.equal(farmOpen(profile), false);
    profile.stats.stageStars[calloways] = 1;
    assert.equal(farmOpen(profile), true);
});

test('a new farm has six empty plots and an empty barn', () => {
    const farm = createFarm(T0);
    assert.equal(farm.plots.length, PLOT_COUNT);
    for(const plot of farm.plots) assert.deepEqual(plot, { crop: null, plantedAt: null });
    assert.deepEqual(Object.keys(farm.store).sort(), GOODS.map(g => g.id).sort());
    assert.ok(Object.values(farm.store).every(n => n === 0));
});

test('a crop grows in real time and is ready after its minutes, not before', () => {
    const profile = openProfile();
    plant(profile, 2, 'wheat', T0);
    const wheat = CROPS.find(c => c.id === 'wheat');
    const farm = profile.town.farm;
    assert.equal(plotState(farm, 2, later(wheat.minutes - 1)).state, 'growing');
    assert.ok(Math.abs(plotState(farm, 2, later(5)).minutesLeft - (wheat.minutes - 5)) < 1e-9);
    assert.equal(plotState(farm, 2, later(wheat.minutes)).state, 'ready');
    assert.equal(plotState(farm, 2, later(60 * 24)).state, 'ready', 'a ready crop waits and does not spoil');
    assert.equal(plotState(farm, 0, T0).state, 'empty');
});

test('harvesting puts the yield in the barn and empties the plot; early or empty harvests are refused', () => {
    const profile = openProfile();
    assert.throws(() => harvest(profile, 0, T0), { code: 'plot_empty' });
    plant(profile, 0, 'corn', T0);
    assert.throws(() => harvest(profile, 0, later(10)), { code: 'not_ready' });
    const corn = CROPS.find(c => c.id === 'corn');
    assert.deepEqual(harvest(profile, 0, later(corn.minutes)), { good: 'corn', amount: corn.yield });
    assert.equal(profile.town.farm.store.corn, corn.yield);
    assert.equal(plotState(profile.town.farm, 0, later(corn.minutes)).state, 'empty');
});

test('a plot can only be planted when empty, with a real crop on a real plot', () => {
    const profile = openProfile();
    plant(profile, 1, 'wheat', T0);
    assert.throws(() => plant(profile, 1, 'corn', T0), { code: 'plot_busy' });
    assert.throws(() => plant(profile, 9, 'wheat', T0), { code: 'no_plot' });
    assert.throws(() => plant(profile, -1, 'wheat', T0), { code: 'no_plot' });
    assert.throws(() => plant(profile, 'x', 'wheat', T0), { code: 'no_plot' });
    assert.throws(() => plant(profile, 3, 'gold', T0), { code: 'no_crop' });
});

test('a clock moved backwards gives no head start', () => {
    const profile = openProfile();
    plant(profile, 0, 'pumpkin', later(60)); // planted "in the future" by a clock that was wound forward
    const pumpkin = CROPS.find(c => c.id === 'pumpkin');
    const state = plotState(profile.town.farm, 0, T0);
    assert.equal(state.state, 'growing');
    assert.ok(state.fraction === 0 && state.minutesLeft >= pumpkin.minutes);
    assert.throws(() => harvest(profile, 0, T0), { code: 'not_ready' });
});

test('the coop lays an egg every half hour up to a full basket, and keeps the part of an egg already laid', () => {
    const profile = openProfile();
    const farm = profile.town.farm;
    farm.coopAt = T0.toISOString();
    assert.equal(eggsReady(farm, later(29)), 0);
    assert.throws(() => collectEggs(profile, later(29)), { code: 'no_eggs' });
    assert.equal(eggsReady(farm, later(95)), 3);
    assert.ok(Math.abs(minutesToNextEgg(farm, later(95)) - 25) < 1e-9);
    assert.deepEqual(collectEggs(profile, later(95)), { good: 'egg', amount: 3 });
    assert.equal(eggsReady(farm, later(95)), 0);
    assert.equal(eggsReady(farm, later(125)), 1, 'the 5 minutes toward the next egg were kept');
    assert.equal(eggsReady(farm, later(60 * 100)), EGG.cap, 'the basket is capped');
    assert.equal(minutesToNextEgg(farm, later(60 * 100)), 0);
    collectEggs(profile, later(60 * 100));
    assert.equal(eggsReady(farm, later(60 * 100)), 0, 'a full basket restarts the clock');
});

test('the stand pays a fixed price, once per item, and the barn empties', () => {
    const profile = openProfile();
    profile.town.farm.store = { wheat: 4, corn: 3, pumpkin: 1, egg: 5 };
    assert.deepEqual(sell(profile, 'corn'), { dollars: 3 * CROPS.find(c => c.id === 'corn').price });
    assert.equal(profile.town.farm.store.corn, 0);
    assert.throws(() => sell(profile, 'corn'), { code: 'nothing_to_sell' });
    const before = profile.balances.dollars;
    const paid = sell(profile, 'all').dollars;
    assert.equal(paid, 4 * 2 + 1 * 12 + 5 * EGG.price);
    assert.equal(profile.balances.dollars, before + paid);
    assert.ok(Object.values(profile.town.farm.store).every(n => n === 0));
    assert.throws(() => sell(profile, 'gold'), { code: 'no_good' });
});

test('an unknown action is refused', () => {
    assert.throws(() => farmAction(openProfile(), { action: 'burn' }, T0), { code: 'bad_action' });
    assert.throws(() => farmAction(openProfile(), undefined, T0), { code: 'bad_action' });
});

test('saved data is cleaned: unknown crops, bad dates, negative or huge counts', () => {
    const farm = normalizeFarm({
        plots: [{ crop: 'gold', plantedAt: T0.toISOString() }, { crop: 'wheat', plantedAt: 'never' }, { crop: 'corn', plantedAt: T0.toISOString() }],
        store: { wheat: -5, corn: 12.9, pumpkin: 'x', egg: 1e9 }, coopAt: 'soon'
    }, T0);
    assert.equal(farm.plots.length, PLOT_COUNT);
    assert.equal(farm.plots[0].crop, null);
    assert.equal(farm.plots[1].crop, null);
    assert.equal(farm.plots[2].crop, 'corn');
    assert.deepEqual(farm.store, { wheat: 0, corn: 12, pumpkin: 0, egg: 9999 });
    assert.equal(farm.coopAt, T0.toISOString());
    assert.deepEqual(normalizeFarm(null, T0), createFarm(T0));
});

test('the farm is saved with the town and survives a round trip through a profile', () => {
    const profile = openProfile();
    plant(profile, 4, 'corn', T0);
    const again = normalizeProfile(JSON.parse(JSON.stringify(profile)), later(1));
    assert.equal(again.town.farm.plots[4].crop, 'corn');
    assert.deepEqual(normalizeTown({ levels: {} }, T0).farm, createFarm(T0));
});

test('the farm stays a side income: a tended plot never beats the jail, and a whole farm stays well under it', () => {
    const jailTopPerHour = OUTLAWS.reduce((sum, o) => sum + o.bounty, 0) * JAIL_BOUNTY_SHARE; // $108 with all ten beaten
    let best = 0;
    for(const c of CROPS) best = Math.max(best, (c.price * c.yield) / (c.minutes / 60));
    assert.ok(best * PLOT_COUNT < jailTopPerHour, `six tended plots (${best * PLOT_COUNT}/h) stay under the jail (${jailTopPerHour}/h)`);
    // One visit a day: the best a day's check-in can bank, a pumpkin on every plot plus a full basket.
    const pumpkin = CROPS.find(c => c.id === 'pumpkin');
    const perVisit = PLOT_COUNT * pumpkin.price * pumpkin.yield + EGG.cap * EGG.price;
    assert.ok(perVisit <= 400, `${perVisit} a visit`);
});

test('time reads as minutes and hours', () => {
    assert.equal(minutesText(0.2), '1m');
    assert.equal(minutesText(12.3), '13m');
    assert.equal(minutesText(60), '1h');
    assert.equal(minutesText(95), '1h 35m');
});
