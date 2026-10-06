import test from 'node:test';
import assert from 'node:assert/strict';
import { DIM_RING, LANTERN_RADIUS, TORCH_RADIUS, MIN_TORCH_GAP, CARRY_LIMIT, MATCH_LIMIT, OIL_CAPACITY, MAX_HOLES, LIGHT_ITEMS, SHOP_MARKUP, priceOf,
    createLightKit, normalizeLightKit, buyLight, spendKit, createLightRun, lanternLit, burnLantern, placeTorch, putOutTorch, relightTorch, burnTorches,
    lightSource, isLit, usedKit, torchesFor, TORCHES_BURN_OUT_FROM, TORCH_BURN_SECONDS } from '../src/mineLight.js';
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
    buyLight(p, 'oil');
    assert.deepEqual([p.mine.light.oil, p.balances.dollars], [OIL_CAPACITY, before - LIGHT_ITEMS.oil.dollars]);
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

test('torches are permanent down to floor 14 by default; from the floor of the setting they burn out after a time', () => {
    assert.equal(TORCHES_BURN_OUT_FROM, Infinity, 'default: permanent everywhere (OPEN: what happens from floor 15 is the owner\'s call)');
    const run = createLightRun({ lantern: false, oil: 0, torches: 2, matches: 0 });
    const torch = placeTorch(run, 0, 0, 20);
    burnTorches(run, 20, 1e6);
    assert.ok(torch.lit, 'with the default setting a torch never burns out');
    assert.ok(TORCH_BURN_SECONDS > 0);
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
