import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, EGG, GOODS, FARM_LEVELS, PLOT_COUNT, farmLevel, createFarm, normalizeFarm, farmOpen, plotState, eggsReady, minutesToNextEgg, plant, harvest, collectEggs, sell, farmAction, minutesText } from '../src/farm.js';
import { createProfile, normalizeProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { JAIL_BOUNTY_SHARE, normalizeTown, jailStored, jailRate } from '../src/town.js';
import { unlockedDistricts } from '../src/townDistricts.js';

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
    best *= FARM_LEVELS[FARM_LEVELS.length - 1].standBonus; // even at the top level
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

test('the farm levels up with the Calloways\' stars: shut at none, then one level for each star', () => {
    const profile = createProfile(T0);
    assert.equal(farmLevel(profile), 0, 'shut');
    for(const [mask, level] of [[1, 1], [3, 2], [5, 2], [7, 3], [6, 0]]) {
        profile.stats.stageStars[calloways] = mask;
        assert.equal(farmLevel(profile), level, `stars ${mask}`);
    }
});

test('a higher level gives a bigger egg basket and a better price at the stand, and nothing grows faster', () => {
    const at = stars => { const p = createProfile(T0); p.stats.stageStars[calloways] = stars; p.town.farm.coopAt = T0.toISOString(); return p; };
    for(const [stars, cap] of [[1, 8], [3, 10], [7, 12]]) {
        const p = at(stars);
        assert.equal(eggsReady(p.town.farm, later(60 * 100), farmLevel(p)), cap);
        assert.deepEqual(collectEggs(p, later(60 * 100)), { good: 'egg', amount: cap });
    }
    for(const [stars, paid] of [[1, 20], [3, 22], [7, 24]]) {
        const p = at(stars);
        p.town.farm.store.wheat = 10;
        assert.equal(sell(p, 'all').dollars, paid, `ten wheat at level ${farmLevel(p)}`);
    }
    const wheat = CROPS.find(c => c.id === 'wheat');
    for(const stars of [1, 3, 7]) { // the time a crop takes never depends on the level
        const p = at(stars);
        plant(p, 0, 'wheat', T0);
        assert.equal(plotState(p.town.farm, 0, later(wheat.minutes - 1)).state, 'growing');
        assert.equal(plotState(p.town.farm, 0, later(wheat.minutes)).state, 'ready');
    }
});

test('a shut place never changes another, and another never changes it', () => {
    // 1. Only the Calloways open the farm: every other outlaw beaten, and the farm stays shut.
    const others = OUTLAWS.map((_, i) => i).filter(i => i !== calloways);
    const shut = createProfile(T0);
    for(const i of others) shut.stats.stageStars[i] = 7;
    assert.equal(farmOpen(shut), false);
    assert.equal(farmLevel(shut), 0);
    assert.throws(() => plant(shut, 0, 'wheat', T0), { code: 'locked' });

    // 2. With the Calloways beaten, the farm does exactly the same whichever other outlaws are beaten.
    const play = stars => {
        const p = createProfile(T0);
        p.stats.stageStars = stars.slice();
        const out = [];
        out.push(plant(p, 0, 'corn', T0), plant(p, 1, 'wheat', T0));
        p.town.farm.coopAt = T0.toISOString();
        out.push(harvest(p, 1, later(25)), collectEggs(p, later(95)), sell(p, 'all'));
        return { out, farm: p.town.farm, dollars: p.balances.dollars, level: farmLevel(p) };
    };
    const alone = OUTLAWS.map(() => 0); alone[calloways] = 1;
    const withAll = OUTLAWS.map(() => 7); withAll[calloways] = 1;
    assert.deepEqual(play(alone), play(withAll), 'the other outlaws change nothing on the farm');

    // 3. And the farm changes nothing outside itself: no stars, no jail, no buildings, no other district.
    const p = openProfile();
    const before = JSON.stringify({ stars: p.stats.stageStars, levels: p.town.levels, jail: p.town.jailCollectedAt, jailRate: jailRate(p), jailStored: jailStored(p, later(600)), districts: unlockedDistricts(p.stats.stageStars) });
    plant(p, 0, 'wheat', T0); harvest(p, 0, later(30)); collectEggs(p, later(300)); sell(p, 'all');
    const after = JSON.stringify({ stars: p.stats.stageStars, levels: p.town.levels, jail: p.town.jailCollectedAt, jailRate: jailRate(p), jailStored: jailStored(p, later(600)), districts: unlockedDistricts(p.stats.stageStars) });
    assert.equal(after, before);

    // 4. Opening the farm opens only the farm's own district.
    const stars = OUTLAWS.map(() => 0);
    assert.deepEqual(unlockedDistricts(stars), []);
    stars[calloways] = 1;
    assert.deepEqual(unlockedDistricts(stars), ['ranch']);
});
