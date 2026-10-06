import test from 'node:test';
import assert from 'node:assert/strict';
import { DIM_RING, LANTERN_RADIUS, TORCH_RADIUS, MIN_TORCH_GAP, CARRY_LIMIT, MATCH_LIMIT, OIL_CAPACITY, MAX_HOLES, LIGHT_ITEMS, SHOP_MARKUP, priceOf,
    createLightKit, normalizeLightKit, buyLight, spendKit, createLightRun, lanternLit, burnLantern, placeTorch, putOutTorch, relightTorch, burnTorches,
    lightSource, isLit, usedKit, torchesFor, isLightItem, nearestLitTorch, nearestOutTorch, THIN_AIR_FROM_FLOOR, OIL_MIN_PRICE, TORCH_FAIL_MIN_SECONDS, TORCH_FAIL_SPREAD_SECONDS, torchFailChance, torchFailAfter } from '../src/mineLight.js';
import { createProfile, normalizeProfile, CURRENCIES } from '../src/profile.js';
import { applyMineRun, createMineProgress, normalizeMineProgress } from '../src/mineProgress.js';
import { floorLayout, roadLength } from '../src/mineMap.js';
import { PRODUCTS } from '../src/products.js';

const rich = dollars => { const p = createProfile(); p.balances.dollars = dollars; return p; };

test('light is bought with Bounty Dollars only: every price is a dollar price, and buying never touches nuggets or a real-money product', () => {
    for(const [id, item] of Object.entries(LIGHT_ITEMS)) {
        assert.ok(Number.isInteger(item.dollars) && item.dollars > 0, `${id}: a price in dollars`);
        assert.ok(!('nuggets' in item) && !('currency' in item) && !('product' in item), `${id}: no other currency`);
        for(const shop of Object.keys(SHOP_MARKUP)) assert.ok(priceOf(id, shop) >= item.dollars, `${id}: the ${shop} never charges less than the list price`);
    }
    assert.ok(!('light' in CURRENCIES) && !('oil' in CURRENCIES) && !('torches' in CURRENCIES));
    assert.ok(!/torch|lantern|oil|match/i.test(JSON.stringify(PRODUCTS)), 'no real-money product sells light');
    const profile = rich(1000);
    profile.balances.nuggets = 500;
    for(const id of Object.keys(LIGHT_ITEMS).filter(id => id !== 'oil')) buyLight(profile, id); // (the lantern comes full, so there is no oil to buy yet)
    profile.mine.light.oil = 0;
    buyLight(profile, 'oil');
    assert.equal(profile.balances.nuggets, 500, 'nuggets are never spent on light');
    // With plenty of nuggets and no dollars, nothing can be bought.
    const broke = createProfile();
    broke.balances.nuggets = 99999;
    for(const id of Object.keys(LIGHT_ITEMS)) assert.throws(() => buyLight(broke, id), error => error.code === 'funds' || error.code === 'no_lantern');
    assert.deepEqual(broke.mine.light, createLightKit());
});

test('buying: the lantern once, oil to fill it, torches and matches up to what he can carry; a refused buy changes nothing', () => {
    const p = rich(500);
    assert.throws(() => buyLight(p, 'oil'), error => error.code === 'no_lantern', 'no oil without a lantern');
    assert.deepEqual(buyLight(p, 'lantern'), { id: 'lantern', price: LIGHT_ITEMS.lantern.dollars });
    assert.deepEqual([p.mine.light.lantern, p.mine.light.oil, p.balances.dollars], [true, OIL_CAPACITY, 500 - LIGHT_ITEMS.lantern.dollars], 'the lantern comes full');
    assert.throws(() => buyLight(p, 'lantern'), error => error.code === 'owned');
    assert.throws(() => buyLight(p, 'oil'), error => error.code === 'full');
    p.mine.light.oil = 100;
    const before = p.balances.dollars;
    const topUp = priceOf('oil', 'grimsby', p.mine.light); // (by what the lantern is missing)
    buyLight(p, 'oil');
    assert.deepEqual([p.mine.light.oil, p.balances.dollars], [OIL_CAPACITY, before - topUp]);
    buyLight(p, 'torches'); buyLight(p, 'torches');
    assert.equal(p.mine.light.torches, CARRY_LIMIT, 'two stacks fill the carry limit');
    const kept = p.balances.dollars;
    assert.throws(() => buyLight(p, 'torches'), error => error.code === 'full');
    assert.equal(p.balances.dollars, kept, 'a refused buy costs nothing');
    buyLight(p, 'matches');
    assert.equal(p.mine.light.matches, 5);
    assert.throws(() => buyLight(p, 'rope'), error => error.code === 'unknown_item');
    const poor = rich(LIGHT_ITEMS.torches.dollars - 1);
    assert.throws(() => buyLight(poor, 'torches'), error => error.code === 'funds');
    assert.deepEqual([poor.balances.dollars, poor.mine.light.torches], [LIGHT_ITEMS.torches.dollars - 1, 0]);
    assert.ok(priceOf('torches', 'store') >= priceOf('torches', 'grimsby'));
});

test('what he owns is saved in profile.mine.light, kept inside its limits, and old saves get an empty kit', () => {
    assert.deepEqual(createProfile().mine.light, { lantern: false, oil: 0, torches: 0, matches: 0 });
    const old = createProfile();
    delete old.mine.light;
    assert.deepEqual(normalizeProfile(old).mine.light, createLightKit());
    assert.deepEqual(normalizeLightKit({ lantern: true, oil: 1e9, torches: 99, matches: 1e6 }), { lantern: true, oil: OIL_CAPACITY, torches: CARRY_LIMIT, matches: MATCH_LIMIT });
    assert.deepEqual(normalizeLightKit({ lantern: false, oil: 500, torches: -3, matches: 'x' }), { lantern: false, oil: 0, torches: 0, matches: 0 }, 'no oil without a lantern');
    assert.deepEqual(normalizeLightKit({ lantern: 'yes' }), createLightKit(), 'only a real true is a lantern');
    assert.deepEqual(normalizeLightKit(null), createLightKit());
    const kit = { lantern: true, oil: 300, torches: 4, matches: 2 };
    assert.deepEqual(normalizeLightKit(normalizeLightKit(kit)), kit);
    assert.deepEqual(normalizeProfile({ mine: { deepest: 6, light: kit } }).mine.light, kit);
});

test('the lantern burns oil, and with none (or no lantern) he still sees his own feet', () => {
    const none = createLightRun(createLightKit());
    assert.ok(!lanternLit(none));
    assert.equal(lightSource(none, 1, { x: 0, z: 0 }).radius, DIM_RING, 'nothing bought: the dim ring is all there is');
    const run = createLightRun({ lantern: true, oil: 60, torches: 0, matches: 0 });
    assert.ok(lanternLit(run));
    assert.equal(lightSource(run, 1, { x: 0, z: 0 }).radius, LANTERN_RADIUS);
    burnLantern(run, 25);
    assert.equal(run.oil, 35);
    burnLantern(run, 100);
    assert.equal(run.oil, 0, 'never below nothing');
    assert.ok(!lanternLit(run));
    assert.equal(lightSource(run, 1, { x: 0, z: 0 }).radius, DIM_RING, 'out of oil: back to the dim ring, never to nothing');
    burnLantern(none, 50);
    assert.equal(none.oil, 0);
    assert.ok(DIM_RING > 0 && DIM_RING < LANTERN_RADIUS && LANTERN_RADIUS > TORCH_RADIUS * 0.5);
});

test('torches: placed one at a time where he stands, not on top of each other, and each lights its own place', () => {
    const run = createLightRun({ lantern: false, oil: 0, torches: 3, matches: 0 });
    const first = placeTorch(run, 10, 0, 2);
    assert.ok(first && first.lit && run.torches === 2);
    assert.equal(placeTorch(run, 10 + MIN_TORCH_GAP - 1, 0, 2), null, 'too close to the one he put down');
    assert.equal(run.torches, 2, 'a refused torch is not spent');
    assert.ok(placeTorch(run, 10 + MIN_TORCH_GAP + 1, 0, 2), 'far enough');
    assert.ok(placeTorch(run, 10, 0, 3), 'the same spot on another floor is another place');
    assert.equal(placeTorch(run, 500, 500, 2), null, 'none left');
    const here = lightSource(run, 2, { x: 0, z: 0 });
    assert.equal(here.holes.length, 2, 'only this floor\'s torches');
    assert.ok(here.holes.every(h => h.r === TORCH_RADIUS && h.k === 1));
    assert.ok(isLit(run, 2, { x: 0, z: 0 }, 10, 5), 'a place a torch lights is lit even far from the marshal');
    assert.ok(!isLit(run, 2, { x: 0, z: 0 }, 300, 300));
    assert.ok(isLit(run, 2, { x: 300, z: 300 }, 305, 300), 'and the place around the marshal is lit while the lantern burns... or the dim ring');
});

test('a torch that goes out stops lighting, and a match lights it again', () => {
    const run = createLightRun({ lantern: false, oil: 0, torches: 2, matches: 1 });
    const torch = placeTorch(run, 0, 0, 1);
    putOutTorch(torch);
    assert.equal(lightSource(run, 1, { x: 50, z: 0 }).holes.length, 0, 'out: it lights nothing');
    assert.ok(relightTorch(run, torch) && torch.lit && run.matches === 0);
    assert.ok(!relightTorch(run, torch), 'already lit: no match spent');
    putOutTorch(torch);
    assert.ok(!relightTorch(run, torch) && !torch.lit, 'no matches: it stays out, and nothing breaks');
});

test('torches are permanent down to floor 14; from floor 15 a few go out by themselves, more with depth but never all, the same way every time', () => {
    for(let floor = 1; floor <= 14; floor++) assert.equal(torchFailChance(floor), 0, `floor ${floor}: no failures`);
    assert.ok(Math.abs(torchFailChance(15) - 0.10) < 1e-9, 'about 10% on the first thin floor');
    assert.ok(torchFailChance(25) > torchFailChance(15) && torchFailChance(25) < torchFailChance(40) + 1e-9);
    assert.equal(torchFailChance(100), 0.5, 'never more than half');
    assert.equal(THIN_AIR_FROM_FLOOR, 15);
    // Safe floors: a torch never burns out.
    const safe = createLightRun({ lantern: false, oil: 0, torches: 4, matches: 0 });
    const kept = placeTorch(safe, 0, 0, 14);
    assert.deepEqual(burnTorches(safe, 14, 1e6), []);
    assert.ok(kept.lit && kept.failAfter === Infinity);
    // The first torch of a thin floor never fails; of many, only some do, and never all.
    for(const floor of [15, 20, 30, 60]) {
        const run = createLightRun({ lantern: false, oil: 0, torches: 0, matches: 0 });
        run.torches = 99; // (a run carries ten; this one has plenty, to see many torches)
        const torches = [];
        for(let i = 0; i < 60; i++) torches.push(placeTorch(run, i * 100, 0, floor));
        assert.equal(torches[0].failAfter, Infinity, `floor ${floor}: the first torch never fails`);
        const failing = torches.filter(t => Number.isFinite(t.failAfter));
        assert.ok(failing.length < torches.length, `floor ${floor}: never all of them`);
        assert.ok(failing.length <= torches.length * 0.75, `floor ${floor}: a few, not most (${failing.length} of ${torches.length})`);
        for(const t of failing) assert.ok(t.failAfter >= TORCH_FAIL_MIN_SECONDS && t.failAfter <= TORCH_FAIL_MIN_SECONDS + TORCH_FAIL_SPREAD_SECONDS);
        // The air puts them out once they have burned their time, and says which.
        const gone = burnTorches(run, floor, 1e6);
        assert.equal(gone.length, failing.length);
        assert.ok(gone.every(t => !t.lit) && torches.filter(t => !Number.isFinite(t.failAfter)).every(t => t.lit), 'only the chosen ones');
        assert.deepEqual(burnTorches(run, floor, 1e6), [], 'a torch is put out once');
    }
    // Deeper means more of them (counted over many torches), and the same floor goes the same way every time.
    const count = floor => { let n = 0; for(let i = 1; i <= 400; i++) if(Number.isFinite(torchFailAfter(floor, i))) n++; return n; };
    assert.ok(count(30) > count(16) && count(16) > 0, `more failures deeper (${count(16)} then ${count(30)})`);
    assert.equal(torchFailAfter(22, 7), torchFailAfter(22, 7));
    assert.deepEqual([torchFailAfter(15, 0), torchFailAfter(14, 5)], [Infinity, Infinity]);
    // Time passes only on the floor being played, and a dead torch is relit with a match like any other (and may fail again, at a time of its own).
    const run = createLightRun({ lantern: false, oil: 0, torches: 0, matches: 5 });
    run.torches = 999;
    const doomed = (() => { for(let i = 0; i < 200; i++) { const t = placeTorch(run, i * 100, 0, 22); if(Number.isFinite(t.failAfter)) return t; } })();
    assert.deepEqual(burnTorches(run, 21, 1e6), [], 'not on another floor');
    assert.ok(doomed.lit);
    assert.ok(burnTorches(run, 22, 1e6).includes(doomed) && !doomed.lit);
    assert.ok(relightTorch(run, doomed) && doomed.lit && doomed.burned === 0 && doomed.relights === 1);
});

test('oil is sold by what the lantern is missing, with a small minimum, and a full flask costs the list price', () => {
    const full = LIGHT_ITEMS.oil.dollars;
    assert.equal(priceOf('oil'), full, 'no kit named: the full flask');
    assert.equal(priceOf('oil', 'grimsby', { oil: 0 }), full);
    assert.equal(priceOf('oil', 'grimsby', { oil: OIL_CAPACITY / 2 }), Math.ceil(full / 2));
    assert.equal(priceOf('oil', 'grimsby', { oil: OIL_CAPACITY - 60 }), OIL_MIN_PRICE, 'a minute missing costs the minimum, not a flask');
    assert.ok(priceOf('oil', 'store', { oil: 0 }) >= priceOf('oil', 'grimsby', { oil: 0 }));
    const p = rich(500);
    buyLight(p, 'lantern');
    p.mine.light.oil = OIL_CAPACITY - 60;
    const before = p.balances.dollars;
    assert.equal(buyLight(p, 'oil').price, OIL_MIN_PRICE);
    assert.deepEqual([p.balances.dollars, p.mine.light.oil], [before - OIL_MIN_PRICE, OIL_CAPACITY], 'the top-up fills the lantern');
    assert.throws(() => buyLight(p, 'oil'), error => error.code === 'full');
    // Never cheaper by buying twice: two half-top-ups cost at least one whole one.
    const q = rich(500);
    buyLight(q, 'lantern');
    q.mine.light.oil = 0;
    q.mine.light.oil = OIL_CAPACITY / 2; // (a half tank)
    const half = priceOf('oil', 'grimsby', q.mine.light);
    assert.ok(half * 2 >= full - 1, 'the price is in proportion to the oil, not a bargain');
});

test('the dark layer is told the radius and at most MAX_HOLES torches, the nearest first', () => {
    const run = createLightRun({ lantern: true, oil: 100, torches: CARRY_LIMIT, matches: 0 });
    for(let i = 0; i < CARRY_LIMIT; i++) placeTorch(run, i * (MIN_TORCH_GAP + 2), 0, 1);
    for(let i = 0; i < 5; i++) run.placed.push({ x: -1000 - i, z: 0, floor: 1, lit: true, burned: 0 }); // (more than the layer can show)
    const { radius, holes } = lightSource(run, 1, { x: 3 * (MIN_TORCH_GAP + 2), z: 0 });
    assert.equal(radius, LANTERN_RADIUS);
    assert.ok(holes.length <= MAX_HOLES && holes.length === MAX_HOLES);
    assert.ok(holes[0].x === 3 * (MIN_TORCH_GAP + 2), 'nearest first');
    assert.deepEqual(Object.keys(holes[0]).sort(), ['k', 'r', 'x', 'z'], 'the shape src/placeDark.js reads');
    assert.deepEqual(Object.keys(lightSource(run, 1)).sort(), ['holes', 'radius']);
});

test('a run reports what it used, the server takes that from the kit, and the mine still pays no money and gives no stars', () => {
    const profile = rich(0);
    profile.mine.light = { lantern: true, oil: 500, torches: 6, matches: 3 };
    const run = createLightRun(profile.mine.light);
    burnLantern(run, 220.4);
    placeTorch(run, 0, 0, 1); placeTorch(run, 40, 0, 1);
    const torch = placeTorch(run, 80, 0, 1);
    putOutTorch(torch);
    relightTorch(run, torch);
    const used = usedKit(run);
    assert.deepEqual(used, { oil: 221, torches: 3, matches: 1 });
    const before = JSON.stringify({ ...profile, mine: null });
    applyMineRun(profile.mine, { startFloor: 1, depth: 3, ore: 0, outcome: 'fell', seconds: 200, used });
    assert.deepEqual(profile.mine.light, { lantern: true, oil: 279, torches: 3, matches: 2 }, 'used up, whatever happened to the marshal');
    assert.equal(JSON.stringify({ ...profile, mine: null }), before, 'no dollars, no stars, nothing outside profile.mine');
    // Cheating down cannot make light grow, and a made-up use never goes below nothing.
    const mine = normalizeMineProgress({ light: { lantern: true, oil: 10, torches: 1, matches: 0 } });
    applyMineRun(mine, { startFloor: 1, depth: 1, ore: 0, outcome: 'up', seconds: 10, used: { oil: 1e9, torches: 99, matches: -5 } });
    assert.deepEqual(mine.light, { lantern: true, oil: 0, torches: 0, matches: 0 });
    applyMineRun(mine, { startFloor: 1, depth: 1, ore: 0, outcome: 'up', seconds: 10 });
    assert.deepEqual(mine.light, { lantern: true, oil: 0, torches: 0, matches: 0 }, 'a summary with no `used` spends nothing');
    assert.deepEqual(spendKit({ lantern: true, oil: 5, torches: 2, matches: 1 }, null), { lantern: true, oil: 5, torches: 2, matches: 1 });
});

test('the floors need only a handful of torches: one every 40 units, and the carry limit covers the first floors', () => {
    assert.equal(torchesFor(0), 0);
    assert.equal(torchesFor(40), 1);
    assert.equal(torchesFor(41), 2);
    const need = floor => torchesFor(roadLength(floorLayout(floor)));
    assert.ok(need(1) <= 8, `floor 1 needs ${need(1)}`);
    assert.ok(need(5) <= CARRY_LIMIT + 5, `floor 5 needs ${need(5)}`);
    assert.ok(need(30) <= 40);
    assert.ok(CARRY_LIMIT >= need(1), 'a full pack marks the whole way back on the first floor');
});

test('a first descent is within reach: the starter kit costs about what a short Wanted Road run earns (the mine pays no money)', () => {
    const kit = priceOf('lantern') + priceOf('torches') + priceOf('matches');
    assert.ok(kit <= 120, `the first kit costs ${kit} dollars`);
    const refill = priceOf('oil') + priceOf('torches');
    assert.ok(refill <= 60, `a refill of oil and torches costs ${refill} dollars`);
});

test('a light eater finds the nearest lit torch of this floor within its reach; a stub is found by T, the nearest out torch', () => {
    const run = createLightRun({ lantern: false, oil: 0, torches: 5, matches: 2 });
    const a = placeTorch(run, 0, 0, 3), b = placeTorch(run, 30, 0, 3), c = placeTorch(run, 100, 0, 4);
    assert.equal(nearestLitTorch(run, 3, 25, 0), b, 'the nearest');
    assert.equal(nearestLitTorch(run, 3, 25, 0, 4), null, 'out of its reach');
    assert.equal(nearestLitTorch(run, 3, 99, 0), b, 'not the torch on another floor');
    assert.equal(nearestLitTorch(run, 4, 99, 0), c);
    putOutTorch(b);
    assert.equal(nearestLitTorch(run, 3, 25, 0), a, 'a torch that is out is not food');
    assert.equal(nearestOutTorch(run, 3, 28, 0), b, 'beside the stub');
    assert.equal(nearestOutTorch(run, 3, 28 + MIN_TORCH_GAP + 5, 0), null, 'too far from any stub');
    assert.equal(nearestOutTorch(run, 3, 0, 0), null, 'a lit torch is not a stub');
    assert.ok(relightTorch(run, b) && nearestOutTorch(run, 3, 28, 0) === null);
});

test('an id or a shop that is only a name on every object is not for sale, and a refused buy changes nothing', () => {
    const names = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'prototype', '', 'LANTERN', 'lantern ', null, undefined, 42, {}, ['lantern']];
    for(const name of names) {
        assert.equal(isLightItem(name), false, `${String(name)} is not an item`);
        const p = rich(500);
        const before = JSON.stringify(p);
        assert.throws(() => buyLight(p, name), error => error.code === 'unknown_item', `${String(name)} as an item`);
        assert.equal(JSON.stringify(p), before, 'nothing changed');
        if(name === undefined) continue; // (no shop named is Mr. Grimsby's, the default)
        const q = rich(500);
        const kept = JSON.stringify(q);
        assert.throws(() => buyLight(q, 'lantern', name), error => error.code === 'unknown_shop', `${String(name)} as a shop`);
        assert.equal(JSON.stringify(q), kept, 'nothing changed');
    }
    for(const id of Object.keys(LIGHT_ITEMS)) assert.ok(isLightItem(id));
    // The price of a real item in an unknown shop is the list price, never NaN.
    for(const shop of ['constructor', '__proto__', 'toString']) assert.equal(priceOf('lantern', shop), LIGHT_ITEMS.lantern.dollars);
    const p = rich(500);
    assert.ok(Number.isFinite(buyLight(p, 'lantern', 'store').price) && Number.isFinite(p.balances.dollars), 'a real buy still works');
});
