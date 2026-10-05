import { EconomyError } from './economyError.js';
import { OUTLAWS } from './outlaws.js';
import { GOODS, farmOpen } from './farm.js';

// Vane's Crossing, the order board (PLACES.md, step H2). The rules are here with no rendering, like src/farm.js, so the
// server and the offline wallet can run the same code and tests/farmOrders.test.js can check them.
//
// - A wagon train brings three orders a day. The day's orders are the same for every player (they come from the date), so
//   they can be tested.
// - Orders name only goods from places that are open. Today that is the farm's goods; no open place means no wagon.
// - An order is filled from the barn and pays dollars a little over the stand's price (ORDER_BONUS). An order left unfilled
//   waits one more day, then is replaced.
// - Nothing is timed for pay and nothing is bought with real money. Nothing here touches combat. It opens with the first star
//   on Silas Vane and reads nothing else about him.

export const ORDER_OUTLAW = 'silas-vane';
export const ORDERS_PER_DAY = 3;
// A filled order pays this much over the stand price. It stays under the best stand price (a top level farm pays 1.2) so that a
// tended farm sold through orders is still under the jail's top rate: see tests/farmOrders.test.js.
export const ORDER_BONUS = 1.15;
// How many of a good one order may ask for: [least, most].
export const ORDER_COUNTS = { wheat: [4, 10], corn: [2, 6], pumpkin: [1, 3], egg: [4, 10] };

const DAY = 86400000;
const VANE_INDEX = OUTLAWS.findIndex(o => o.id === ORDER_OUTLAW);

export function crossingOpen(profile) {
    return ((profile.stats?.stageStars?.[VANE_INDEX]) & 1) !== 0;
}

// Whole days since the epoch, by the server's (UTC) clock.
export const dayNumber = (now = new Date()) => Math.floor(now.getTime() / DAY);

// The goods an order may ask for: the goods of every place that is open.
export const orderGoods = profile => farmOpen(profile) ? GOODS : [];

// A small repeatable random stream (mulberry32), so a day's orders depend only on the day and the open goods.
function stream(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// The three orders of one day: [{ id, day, slot, wants: [{ good, count }], pays }].
export function ordersForDay(day, goods) {
    if(!goods.length) return [];
    const next = stream(day * 7919 + 17);
    return Array.from({ length: ORDERS_PER_DAY }, (_, slot) => {
        const pool = goods.slice();
        const kinds = Math.min(pool.length, 1 + Math.floor(next() * 2)); // one or two goods
        const wants = [];
        for(let k = 0; k < kinds; k++) {
            const good = pool.splice(Math.floor(next() * pool.length), 1)[0];
            const [least, most] = ORDER_COUNTS[good.id] ?? [1, 3];
            wants.push({ good: good.id, count: least + Math.floor(next() * (most - least + 1)) });
        }
        const base = wants.reduce((sum, w) => sum + w.count * goods.find(g => g.id === w.good).price, 0);
        return { id: `${day}:${slot}`, day, slot, wants, pays: Math.round(base * ORDER_BONUS) };
    });
}

// Saved state: the newest day seen (a clock moved back never brings an old order back) and the orders filled.
export const createOrders = (now = new Date()) => ({ day: dayNumber(now), filled: [] });

export function normalizeOrders(raw, now = new Date()) {
    const orders = createOrders(now);
    if(!raw || typeof raw !== 'object') return orders;
    const day = Math.floor(Number(raw.day));
    if(Number.isFinite(day) && day > orders.day) orders.day = day;
    if(Array.isArray(raw.filled)) orders.filled = [...new Set(raw.filled.filter(id => /^\d+:\d$/.test(id) && (d => d >= orders.day - 1 && d <= orders.day)(Number(id.split(':')[0]))))];
    return orders;
}

const today = (profile, now) => Math.max(dayNumber(now), profile.town.orders?.day | 0);

// Orders on the board now: today's three and yesterday's that were not filled (up to six), newest first.
export function openOrders(profile, now = new Date()) {
    if(!crossingOpen(profile)) return [];
    const day = today(profile, now);
    const filled = new Set(profile.town.orders?.filled ?? []);
    const goods = orderGoods(profile);
    return [day, day - 1].flatMap(d => ordersForDay(d, goods).map(o => ({ ...o, waiting: d < day })))
        .filter(o => !filled.has(o.id));
}

// How many orders are waiting: the bounty board in the square points to the Crossing when this is more than none.
export const ordersWaiting = (profile, now = new Date()) => openOrders(profile, now).length;

// Fill one order from the barn. Returns { dollars }.
export function fillOrder(profile, id, now = new Date()) {
    if(!crossingOpen(profile)) throw new EconomyError('locked', 'The Crossing is shut until Silas Vane is beaten.');
    const order = openOrders(profile, now).find(o => o.id === id);
    if(!order) throw new EconomyError('no_order', 'That order is not on the board.');
    const store = profile.town.farm.store;
    if(order.wants.some(w => (store[w.good] | 0) < w.count)) throw new EconomyError('not_enough', 'The barn does not have enough for that order.');
    for(const w of order.wants) store[w.good] -= w.count;
    const orders = profile.town.orders = normalizeOrders({ day: today(profile, now), filled: [...(profile.town.orders?.filled ?? []), order.id] }, now);
    profile.balances.dollars += order.pays;
    return { dollars: order.pays, day: orders.day };
}

// One entry point for the wallets and the server: { action: 'fill', order: '20000:1' }.
export function ordersAction(profile, body, now = new Date()) {
    switch(body?.action) {
        case 'fill': return fillOrder(profile, String(body.order), now);
        default: throw new EconomyError('bad_action', 'That is not something the Crossing does.');
    }
}
