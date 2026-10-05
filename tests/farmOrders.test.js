import test from 'node:test';
import assert from 'node:assert/strict';
import { visitBoard, ORDERS_PER_DAY, ORDER_BONUS, ORDER_COUNTS, crossingOpen, dayNumber, ordersForDay, openOrders, ordersWaiting, fillOrder, ordersAction, normalizeOrders, createOrders } from '../src/farmOrders.js';
import { GOODS, CROPS, EGG, FARM_LEVELS, PLOT_COUNT } from '../src/farm.js';
import { createProfile, normalizeProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { JAIL_BOUNTY_SHARE } from '../src/town.js';

const T0 = new Date('2026-10-01T08:00:00Z');
const later = hours => new Date(T0.getTime() + hours * 3600000);
const vane = OUTLAWS.findIndex(o => o.id === 'silas-vane');
const calloways = OUTLAWS.findIndex(o => o.id === 'calloway-gang');
function profileWith({ crossing = true, farm = true } = {}) {
    const p = createProfile(T0);
    if(crossing) p.stats.stageStars[vane] = 1;
    if(farm) p.stats.stageStars[calloways] = 1;
    return p;
}
const stock = (p, store) => Object.assign(p.town.farm.store, store);
const rich = { wheat: 99, corn: 99, pumpkin: 99, egg: 99 };

test('the Crossing is shut until Silas Vane is beaten, and every action says so', () => {
    const p = profileWith({ crossing: false });
    assert.equal(crossingOpen(p), false);
    assert.deepEqual(openOrders(p, T0), []);
    assert.throws(() => ordersAction(p, { action: 'fill', order: '1:0' }, T0), { code: 'locked' });
    assert.throws(() => ordersAction(p, { action: 'visit' }, T0), { code: 'locked' });
    p.stats.stageStars[vane] = 6; // stars without the "beaten" bit do not open it
    assert.equal(crossingOpen(p), false);
    p.stats.stageStars[vane] = 1;
    assert.equal(crossingOpen(p), true);
});

test('a day brings three orders, the same for everybody, that name only goods of open places', () => {
    const goods = GOODS;
    const day = dayNumber(T0);
    const orders = ordersForDay(day, goods);
    assert.equal(orders.length, ORDERS_PER_DAY);
    assert.deepEqual(ordersForDay(day, goods), orders, 'a day is repeatable');
    assert.notDeepEqual(ordersForDay(day + 1, goods), orders, 'the next day differs');
    for(const o of orders) {
        assert.ok(o.wants.length >= 1 && o.wants.length <= 2);
        assert.equal(new Set(o.wants.map(w => w.good)).size, o.wants.length, 'no good twice in one order');
        for(const w of o.wants) {
            assert.ok(GOODS.some(g => g.id === w.good));
            const [least, most] = ORDER_COUNTS[w.good];
            assert.ok(w.count >= least && w.count <= most);
        }
    }
    assert.deepEqual(ordersForDay(day, []), [], 'no open place, no wagon');
    const noFarm = profileWith({ farm: false });
    assert.deepEqual(openOrders(noFarm, T0), [], 'with the farm shut, there is nothing to order');
    assert.equal(openOrders(profileWith(), T0).filter(o => !o.waiting).length, ORDERS_PER_DAY);
    assert.equal(openOrders(profileWith(), T0).length, ORDERS_PER_DAY, 'a new player sees only today\'s three, nothing carried over');
    const p = profileWith();
    ordersAction(p, { action: 'visit' }, T0);
    assert.equal(openOrders(p, T0).length, ORDERS_PER_DAY, 'visiting the board the first day carries nothing over either');
    assert.equal(openOrders(p, later(24)).length, ORDERS_PER_DAY * 2, 'from the second day on, yesterday\'s three wait');
});

test('filling an order takes the goods from the barn and pays dollars; refusals change nothing', () => {
    const p = profileWith();
    const [order] = openOrders(p, T0);
    assert.throws(() => fillOrder(p, order.id, T0), { code: 'not_enough' });
    assert.equal(p.balances.dollars, createProfile(T0).balances.dollars);
    assert.throws(() => fillOrder(p, 'nope', T0), { code: 'no_order' });
    assert.throws(() => ordersAction(p, { action: 'burn' }, T0), { code: 'bad_action' });
    assert.throws(() => ordersAction(p, undefined, T0), { code: 'bad_action' });
    stock(p, rich);
    const before = p.balances.dollars;
    const result = ordersAction(p, { action: 'fill', order: order.id }, T0);
    assert.equal(result.dollars, order.pays);
    assert.equal(p.balances.dollars, before + order.pays);
    for(const w of order.wants) assert.equal(p.town.farm.store[w.good], 99 - w.count);
    assert.throws(() => fillOrder(p, order.id, T0), { code: 'no_order' }, 'an order is filled once');
    assert.ok(!openOrders(p, T0).some(o => o.id === order.id));
    assert.equal(ordersWaiting(p, T0), ORDERS_PER_DAY - 1, 'today\'s three, less the one filled');
    assert.equal(ordersWaiting(p, later(24)), ORDERS_PER_DAY * 2 - 1, 'the next day: three new and the two unfilled');
});

test('an unfilled order waits one more day, then is replaced', () => {
    const p = profileWith();
    stock(p, rich);
    visitBoard(p, T0);
    const first = openOrders(p, T0);
    const tomorrow = openOrders(p, later(24));
    assert.equal(tomorrow.length, ORDERS_PER_DAY * 2, 'three new and three waiting');
    assert.deepEqual(tomorrow.filter(o => o.waiting).map(o => o.id).sort(), first.map(o => o.id).sort());
    assert.ok(tomorrow.filter(o => o.waiting).every(o => o.day === dayNumber(T0)));
    fillOrder(p, first[0].id, later(24)); // a waiting order can still be filled on its second day
    const overmorrow = openOrders(p, later(48));
    assert.equal(overmorrow.length, ORDERS_PER_DAY * 2, 'three new, and day two\'s three waiting; day one\'s are gone');
    assert.ok(!overmorrow.some(o => o.day === dayNumber(T0)));
    assert.throws(() => fillOrder(p, first[1].id, later(48)), { code: 'no_order' });
});

test('a clock moved backwards brings no old order back and no filled order again', () => {
    const p = profileWith();
    stock(p, rich);
    const [order] = openOrders(p, later(24 * 5));
    fillOrder(p, order.id, later(24 * 5));
    assert.equal(p.town.orders.since, dayNumber(later(24 * 5)));
    const back = openOrders(p, T0); // the clock now says five days ago
    assert.ok(back.every(o => o.day >= dayNumber(later(24 * 5)) - 1));
    assert.ok(!back.some(o => o.id === order.id));
    assert.throws(() => fillOrder(p, `${dayNumber(T0)}:0`, T0), { code: 'no_order' });
});

test('saved data is cleaned, and orders survive a round trip through a profile', () => {
    const o = normalizeOrders({ day: 'x', filled: ['1:0', '99999999:1', 'bad', 5, '20000:9x'] }, T0);
    assert.equal(o.day, dayNumber(T0));
    assert.deepEqual(o.filled, [], 'filled orders of days long gone are dropped');
    assert.deepEqual(normalizeOrders(null, T0), createOrders(T0));
    const p = profileWith();
    stock(p, rich);
    const [order] = openOrders(p, T0);
    fillOrder(p, order.id, T0);
    const again = normalizeProfile(JSON.parse(JSON.stringify(p)), T0);
    assert.deepEqual(again.town.orders.filled, [order.id]);
    assert.equal(again.town.orders.since, dayNumber(T0));
    assert.ok(!openOrders(again, T0).some(x => x.id === order.id));
});

test('orders stay a side income: the bonus is small, and no day or order beats the jail', () => {
    const jailTopPerHour = OUTLAWS.reduce((sum, o) => sum + o.bounty, 0) * JAIL_BOUNTY_SHARE; // $108 with all ten beaten
    assert.ok(ORDER_BONUS > 1 && ORDER_BONUS <= FARM_LEVELS[FARM_LEVELS.length - 1].standBonus, 'no better than the top stand');
    // Six tended plots of the best crop, every order's premium on top (an order replaces the stand sale, it does not stack with it).
    let best = 0;
    for(const c of CROPS) best = Math.max(best, (c.price * c.yield) / (c.minutes / 60));
    assert.ok(best * PLOT_COUNT * ORDER_BONUS < jailTopPerHour, `${best * PLOT_COUNT * ORDER_BONUS}/h through orders stays under the jail`);
    // The most one day's wagon can ask is bounded by what a day of the orders list allows, and no order is a windfall.
    let worstOrder = 0;
    for(let day = 0; day < 2000; day++) {
        for(const o of ordersForDay(day, GOODS)) {
            worstOrder = Math.max(worstOrder, o.pays);
            const base = o.wants.reduce((s, w) => s + w.count * GOODS.find(g => g.id === w.good).price, 0);
            assert.ok(o.pays <= Math.round(base * ORDER_BONUS), 'an order never pays more than the bonus over the stand');
        }
    }
    assert.ok(worstOrder * ORDERS_PER_DAY <= 400, `a day's three biggest orders (${worstOrder * ORDERS_PER_DAY}) are no more than the farm's best day`);
    assert.ok(EGG.price > 0);
});

test('the Crossing never changes combat or other places: shut or open, the farm and the other outlaws are untouched', () => {
    const shut = profileWith({ crossing: false });
    const open = profileWith();
    assert.deepEqual(open.town.farm, shut.town.farm);
    stock(open, rich);
    const farmBefore = JSON.stringify(open.town.farm.plots);
    fillOrder(open, openOrders(open, T0)[0].id, T0);
    assert.equal(JSON.stringify(open.town.farm.plots), farmBefore, 'plots and the coop are not touched');
    assert.deepEqual(open.stats.stageStars, profileWith().stats.stageStars);
});
