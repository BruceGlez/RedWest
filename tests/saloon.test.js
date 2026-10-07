import test from 'node:test';
import assert from 'node:assert/strict';
import { PAID_SHIFTS_PER_DAY, NIGHTS, DISHES, TIP_RATES, FARM_TIP_BONUS, crowd, menu, saloonOpen, createSaloon, normalizeSaloon, nightsOpen, paidShiftsLeft, starsFor, starNeeds, shiftPay, settleShift, saloonAction,
    SHIFT_PAY_CEILING, UPGRADES, getDish, MAX_REGULAR_VISITS, MAX_REGULARS, getUpgrade, buyUpgrade } from '../src/saloon.js';
import { dayNumber } from '../src/farmOrders.js';
import { createProfile, normalizeProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { JAIL_BOUNTY_SHARE, normalizeTown, jailRate, jailStored } from '../src/town.js';
import { unlockedDistricts } from '../src/townDistricts.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const later = hours => new Date(T0.getTime() + hours * 3600000);
const index = id => OUTLAWS.findIndex(o => o.id === id);
function profileWith({ pete = true, farm = false } = {}) {
    const p = createProfile(T0);
    if(pete) p.stats.stageStars[index('dusty-pete')] = 1;
    if(farm) p.stats.stageStars[index('calloway-gang')] = 1;
    return p;
}
const plates = (night, farm, tip = 0, count = crowd(night)) => Array.from({ length: count }, (_, i) => ({ dish: menu(night, farm)[i % menu(night, farm).length].id, tip }));

test('Copper Bit is shut until Dusty Pete is beaten, and every action says so', () => {
    const p = profileWith({ pete: false });
    assert.equal(saloonOpen(p), false);
    assert.throws(() => saloonAction(p, { action: 'shift', night: 1, served: plates(1, false) }, T0), { code: 'locked' });
    p.stats.stageStars[index('dusty-pete')] = 6; // stars without the "beaten" bit do not open it
    assert.equal(saloonOpen(p), false);
    p.stats.stageStars[index('dusty-pete')] = 1;
    assert.equal(saloonOpen(p), true);
    assert.throws(() => saloonAction(p, { action: 'sing' }, T0), { code: 'bad_action' });
    assert.throws(() => saloonAction(p, undefined, T0), { code: 'bad_action' });
});

test('it opens with Dusty Pete alone, and reads no other outlaw', () => {
    assert.equal(saloonOpen(profileWith({ pete: false, farm: true })), false);
    const p = profileWith({ pete: true });
    p.stats.stageStars = p.stats.stageStars.map((s, i) => (i === index('dusty-pete') ? 1 : 7));
    p.stats.stageStars[index('calloway-gang')] = 0;
    assert.equal(settleShift(p, { night: 1, served: plates(1, false) }, T0).served, crowd(1));
    assert.deepEqual(unlockedDistricts(profileWith().stats.stageStars), ['copper'], 'it opens only its own district');
});

test('the menu grows with the nights, and the farm adds dishes without being needed', () => {
    assert.deepEqual(menu(1, false).map(d => d.id), ['sarsaparilla', 'beans']);
    assert.deepEqual(menu(2, false).map(d => d.id), ['sarsaparilla', 'beans', 'cornbread']);
    assert.deepEqual(menu(4, false).map(d => d.id), ['sarsaparilla', 'beans', 'cornbread']);
    assert.deepEqual(menu(5, false).map(d => d.id), ['sarsaparilla', 'beans', 'cornbread', 'stew'], 'night 5 brings a farm-free dish');
    assert.deepEqual(menu(10, false).map(d => d.id), ['sarsaparilla', 'beans', 'cornbread', 'stew'], 'without the farm the menu stops at the saloon\'s own dishes');
    assert.deepEqual(getDish('stew'), { id: 'stew', name: 'STEW', station: 'stove', price: 6, from: 5, farm: false });
    assert.ok(getDish('stew').price < getDish('pie').price && getDish('stew').price > getDish('cornbread').price, 'between cornbread and the pie');
    assert.deepEqual(menu(10, true).map(d => d.id), DISHES.map(d => d.id));
    assert.ok(menu(3, true).some(d => d.id === 'eggs') && !menu(4, true).some(d => d.id === 'pie') && menu(5, true).some(d => d.id === 'pie'));
    assert.ok(crowd(1) < crowd(5) && crowd(1) === 5 && crowd(10) === 14 && crowd(7) === 11 && crowd(0) === 5 && crowd(99) === 14);
});

test('a shift pays prices and tips, never for a dish that is not on the menu or a crowd that did not come', () => {
    assert.deepEqual(shiftPay(1, [{ dish: 'beans', tip: 0 }, { dish: 'sarsaparilla', tip: 0 }], false), { served: 2, dollars: 5 });
    assert.deepEqual(shiftPay(1, [{ dish: 'beans', tip: 2 }], false), { served: 1, dollars: 5 }, 'a perfect tip adds half: 3 + 1.5, rounded');
    assert.equal(shiftPay(1, [{ dish: 'pie', tip: 0 }, { dish: 'cornbread', tip: 0 }, { dish: 'nonsense' }, null], true).served, 0, 'dishes that are not on that night\'s menu are dropped');
    assert.equal(shiftPay(1, plates(1, false, 0, 50), false).served, crowd(1), 'no more than the crowd');
    assert.equal(shiftPay(1, 'lots', false).served, 0);
    assert.equal(shiftPay(1, [{ dish: 'beans', tip: 99 }], false).dollars, shiftPay(1, [{ dish: 'beans', tip: 2 }], false).dollars, 'a tip tier is capped');
    assert.equal(shiftPay(5, [{ dish: 'pie', tip: 0 }], false).served, 0, 'no pie without the farm');
    assert.ok(shiftPay(5, [{ dish: 'pie', tip: 2 }], true).dollars > shiftPay(5, [{ dish: 'pie', tip: 2 }], false).dollars);
});

test('stars come from how much of the crowd was served', () => {
    const n = crowd(7); // eleven customers
    assert.equal(n, 11);
    assert.deepEqual([11, 9, 8, 6, 5, 0].map(served => starsFor(7, served)), [3, 2, 1, 1, 0, 0]);
    for(let night = 1; night <= NIGHTS; night++) {
        const needs = starNeeds(night);
        assert.deepEqual(needs.map(need => starsFor(night, need)), [1, 2, 3], `night ${night}: the star bar's notches are the real thresholds`);
        assert.deepEqual(needs.map(need => starsFor(night, need - 1)), [0, 1, 2], `night ${night}: one short of a notch is the star before`);
    }
});

test('a night opens with a star on the one before it', () => {
    const p = profileWith();
    assert.equal(nightsOpen(p), 1);
    assert.throws(() => settleShift(p, { night: 2, served: plates(2, false) }, T0), { code: 'night_shut' });
    assert.throws(() => settleShift(p, { night: 0 }, T0), { code: 'no_night' });
    assert.throws(() => settleShift(p, { night: NIGHTS + 1 }, T0), { code: 'no_night' });
    assert.throws(() => settleShift(p, { night: 1.5 }, T0), { code: 'no_night' });
    settleShift(p, { night: 1, served: plates(1, false) }, T0);
    assert.equal(p.town.saloon.nights[0], 3);
    assert.equal(nightsOpen(p), 2);
    assert.equal(settleShift(p, { night: 2, served: plates(2, false, 2) }, T0).stars, 3);
    p.town.saloon.nights = Array(NIGHTS).fill(1);
    assert.equal(nightsOpen(p), NIGHTS);
    settleShift(p, { night: 1, served: [] }, later(30)); // a worse run never takes stars away
    assert.equal(p.town.saloon.nights[0], 1);
});

test('only the first three shifts of a day pay; later ones are free practice that still earns stars', () => {
    const p = profileWith();
    const before = p.balances.dollars;
    const results = [0, 1, 2, 3, 4].map(() => settleShift(p, { night: 1, served: plates(1, false) }, T0));
    assert.deepEqual(results.map(r => r.paid), [true, true, true, false, false]);
    assert.deepEqual(results.map(r => r.paidLeft), [2, 1, 0, 0, 0]);
    const one = results[0].dollars;
    assert.ok(one > 0);
    assert.deepEqual(results.map(r => r.dollars), [one, one, one, 0, 0]);
    assert.equal(p.balances.dollars, before + 3 * one);
    assert.equal(results[4].stars, 3, 'a practice shift still earns its stars');
    assert.equal(paidShiftsLeft(p, T0), 0);
    assert.equal(paidShiftsLeft(p, later(24)), PAID_SHIFTS_PER_DAY, 'the next day (by the server clock) has all three again');
    assert.equal(settleShift(p, { night: 1, served: plates(1, false) }, later(24)).paid, true);
    assert.equal(p.town.saloon.paid, 1);
});

test('a clock moved back never brings a day\'s paid shifts back', () => {
    const p = profileWith();
    for(let i = 0; i < PAID_SHIFTS_PER_DAY; i++) settleShift(p, { night: 1, served: plates(1, false) }, later(48));
    assert.equal(paidShiftsLeft(p, T0), 0, 'two days ago says the same');
    assert.equal(settleShift(p, { night: 1, served: plates(1, false) }, T0).paid, false);
    assert.equal(p.town.saloon.day, dayNumber(later(48)));
});

test('the farm is a bonus and the saloon works alone: the same shift pays more with the farm open, and never needs it', () => {
    const alone = profileWith();
    const farmed = profileWith({ farm: true });
    const served = [{ dish: 'beans', tip: 2 }, { dish: 'cornbread', tip: 2 }];
    alone.town.saloon.nights[0] = 1;
    farmed.town.saloon.nights[0] = 1;
    const a = settleShift(alone, { night: 2, served }, T0);
    const f = settleShift(farmed, { night: 2, served }, T0);
    assert.ok(a.dollars > 0 && f.dollars >= a.dollars);
    assert.equal(a.paid && f.paid, true);
    assert.equal(TIP_RATES.length, 3);
    assert.equal(FARM_TIP_BONUS, 1.2);
});

test('the saloon stays a side income: the most a day can bank is far under the jail and no more than a farm check-in', () => {
    const jailDay = OUTLAWS.reduce((sum, o) => sum + o.bounty, 0) * JAIL_BOUNTY_SHARE * 24; // the jail's top rate over a day
    let bestShift = 0;
    for(let night = 1; night <= NIGHTS; night++) {
        for(const farm of [false, true]) bestShift = Math.max(bestShift, shiftPay(night, plates(night, farm, 2), farm).dollars);
    }
    const priciest = Math.max(...DISHES.map(d => d.price));
    const bound = crowd(NIGHTS) * priciest * (1 + 0.5 * FARM_TIP_BONUS);
    assert.ok(bestShift <= bound, `${bestShift} stays inside the bound ${bound}`);
    assert.ok(bestShift * PAID_SHIFTS_PER_DAY <= 400, `${bestShift * PAID_SHIFTS_PER_DAY} a day is no more than the farm's 400 a check-in`);
    assert.ok(bestShift * PAID_SHIFTS_PER_DAY < jailDay / 5, 'and a small part of a day of the jail');
});

test('the saloon changes nothing outside itself: no stars, jail, buildings or other district', () => {
    const p = profileWith({ farm: true });
    const snap = () => JSON.stringify({ stars: p.stats.stageStars, levels: p.town.levels, jail: p.town.jailCollectedAt, rate: jailRate(p), stored: jailStored(p, later(10)), farm: p.town.farm, orders: p.town.orders, districts: unlockedDistricts(p.stats.stageStars) });
    const before = snap();
    settleShift(p, { night: 1, served: plates(1, true, 2) }, T0);
    assert.equal(snap(), before);
});

test('saved state survives rubbish and old saves', () => {
    assert.deepEqual(normalizeSaloon(null, T0), createSaloon(T0));
    assert.deepEqual(normalizeSaloon('x', T0), createSaloon(T0));
    const messy = normalizeSaloon({ day: dayNumber(T0), paid: 99, nights: [9, -1, 'x', 2.7, null] }, T0);
    assert.equal(messy.paid, PAID_SHIFTS_PER_DAY);
    assert.deepEqual(messy.nights.slice(0, 5), [3, 0, 0, 2, 0]);
    assert.equal(messy.nights.length, NIGHTS);
    assert.equal(normalizeSaloon({ day: dayNumber(T0) - 3, paid: 2, nights: [] }, T0).paid, 0, 'an old day\'s paid shifts do not carry over');
    assert.equal(normalizeTown({ levels: {} }, T0).saloon.paid, 0, 'an old save gets an empty saloon');
    const p = createProfile(T0);
    p.town.saloon.nights[0] = 2;
    assert.equal(normalizeProfile(JSON.parse(JSON.stringify(p))).town.saloon.nights[0], 2, 'and it is saved with the profile');
});

test('one shift never pays more than the ceiling, so three paid shifts stay under the farm\'s 400 and a small part of the jail', () => {
    const jailDay = OUTLAWS.reduce((sum, o) => sum + o.bounty, 0) * JAIL_BOUNTY_SHARE * 24;
    assert.equal(SHIFT_PAY_CEILING, 130);
    assert.ok(SHIFT_PAY_CEILING * PAID_SHIFTS_PER_DAY < 400);
    assert.ok(SHIFT_PAY_CEILING * PAID_SHIFTS_PER_DAY < jailDay / 5);
    const huge = Array.from({ length: 5000 }, () => ({ dish: 'pie', tip: 2 }));
    assert.equal(shiftPay(10, huge, true).dollars <= SHIFT_PAY_CEILING, true);
    assert.equal(shiftPay(1, [{ dish: 'beans', tip: 0 }], false).dollars, 3, 'a small shift is not touched by the ceiling');
});

test('the shelf sells one level at a time for earned dollars and nothing else', () => {
    const p = profileWith();
    p.balances.dollars = 100;
    assert.deepEqual(saloonAction(p, { action: 'upgrade', id: 'stove' }, T0), { id: 'stove', level: 1, price: 30 });
    assert.equal(p.balances.dollars, 70);
    assert.equal(p.town.saloon.upgrades.stove, 1);
    assert.throws(() => saloonAction(p, { action: 'upgrade', id: 'stove' }, T0), { code: 'funds' }, 'level 2 costs 90');
    assert.equal(p.balances.dollars, 70, 'a refused purchase takes nothing');
    p.balances.dollars = 1000;
    saloonAction(p, { action: 'upgrade', id: 'stove' }, T0);
    assert.throws(() => saloonAction(p, { action: 'upgrade', id: 'stove' }, T0), { code: 'owned' }, 'no level past the last');
    assert.equal(p.balances.dollars, 1000 - 90);
    for(const id of ['constructor', '__proto__', 'toString', '', null, 7, undefined]) assert.throws(() => saloonAction(p, { action: 'upgrade', id }, T0), { code: 'unknown_upgrade' }, String(id));
    assert.equal(getUpgrade('constructor'), null);
    assert.throws(() => saloonAction(profileWith({ pete: false }), { action: 'upgrade', id: 'stool' }, T0), { code: 'locked' });
    const total = UPGRADES.reduce((sum, u) => sum + u.levels.reduce((a, b) => a + b, 0), 0);
    assert.equal(total, 440, 'the whole shelf is 440 dollars (the design doc, P6)');
    const q = profileWith();
    q.balances.dollars = total;
    for(const u of UPGRADES) for(let i = 0; i < u.levels.length; i++) buyUpgrade(q, { id: u.id }, T0);
    assert.equal(q.balances.dollars, 0);
    assert.deepEqual(Object.values(q.town.saloon.upgrades), UPGRADES.map(u => u.levels.length));
});

test('upgrades and regulars touch nothing outside the saloon, and do not change what a shift pays', () => {
    const p = profileWith({ farm: true });
    p.balances.dollars = 500;
    const snap = () => JSON.stringify({ stars: p.stats.stageStars, levels: p.town.levels, jail: p.town.jailCollectedAt, rate: jailRate(p), stored: jailStored(p, later(10)), farm: p.town.farm, orders: p.town.orders, chapel: p.town.chapel, districts: unlockedDistricts(p.stats.stageStars) });
    const before = snap();
    const pay = shiftPay(5, plates(5, true, 2), true);
    for(const u of UPGRADES) buyUpgrade(p, { id: u.id }, T0);
    assert.equal(snap(), before);
    assert.deepEqual(shiftPay(5, plates(5, true, 2), true), pay, 'dish prices, tips and the pay do not move with upgrades');
});

test('saved upgrades and regulars survive rubbish, old saves and a new day', () => {
    assert.deepEqual(createSaloon(T0).upgrades, { stove: 0, stool: 0, oven: 0, taps: 0, cushions: 0 });
    assert.deepEqual(createSaloon(T0).regulars, {});
    const messy = normalizeSaloon({ day: dayNumber(T0), upgrades: { stove: 9, stool: -2, oven: 'x', taps: 1.9, cushions: null, bogus: 5 }, regulars: { 'tall-tom': 99, '__proto__': 2, 'Bad Name': 1, ghost: 0, rose: 'x', ada: 2 } }, T0);
    assert.deepEqual(messy.upgrades, { stove: 2, stool: 0, oven: 0, taps: 1, cushions: 0 });
    assert.deepEqual(messy.regulars, { 'tall-tom': MAX_REGULAR_VISITS, ada: 2 });
    assert.equal(Object.getPrototypeOf(messy.regulars), Object.prototype);
    const many = normalizeSaloon({ regulars: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`r${i}`, 1])) }, T0);
    assert.equal(Object.keys(many.regulars).length, MAX_REGULARS);
    const tomorrow = normalizeSaloon({ day: dayNumber(T0) - 1, paid: 3, upgrades: { stove: 1 }, regulars: { ada: 3 } }, T0);
    assert.equal(tomorrow.paid, 0);
    assert.equal(tomorrow.upgrades.stove, 1, 'what you bought stays bought');
    assert.equal(tomorrow.regulars.ada, 3);
    assert.equal(normalizeTown({ levels: {} }, T0).saloon.upgrades.stove, 0, 'an old save has an empty shelf');
    const p = createProfile(T0);
    p.balances.dollars = 50;
    p.stats.stageStars[index('dusty-pete')] = 1;
    buyUpgrade(p, { id: 'taps' }, T0);
    assert.equal(normalizeProfile(JSON.parse(JSON.stringify(p))).town.saloon.upgrades.taps, 1, 'and it is saved with the profile');
});

test('a shift keeps what was bought on the shelf', () => {
    const p = profileWith();
    p.balances.dollars = 40;
    buyUpgrade(p, { id: 'oven' }, T0);
    settleShift(p, { night: 1, served: plates(1, false) }, T0);
    assert.equal(p.town.saloon.upgrades.oven, 1);
});
