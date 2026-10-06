// Thin air in the Hollow Claim (MINE_PLAN.md, "Thin air: the oxygen bar"). From THIN_AIR_FROM_FLOOR (15) the marshal has an oxygen bar as well as a lantern.
// The owner gave only that much: "from floor 15 the marshal has an oxygen bar". Everything below is the mine lane's DEFAULT, written down as options in
// MINE_PLAN.md for the owner to choose from, and it is behind a named setting (`OXYGEN_ENABLED`, off) until he does. Pure rules with no rendering, so the
// browser, the server and the tests can all use them; the bar itself is a HUD element (the ui lane's).
//
// House rules, checked by tests/mineAir.test.js:
// - **Nothing here is lethal** by default: an empty bar slows him a little and dims his lantern. It never takes a heart.
// - **Nothing here changes combat numbers**: not damage, not fire rate, not enemies. If oxygen is ever sold (a flask), it is Bounty Dollars only (src/mineLight.js's
//   rules), and the test says no price is in nuggets.
// - It only exists on the thin floors, and the way to refill it is always on the way down or back: at the lift, and beside a lit torch.
import { THIN_AIR_FROM_FLOOR } from './mineLight.js';

export { THIN_AIR_FROM_FLOOR };
export const OXYGEN_ENABLED = false;        // the named setting: off until the owner has chosen what the bar does (MINE_PLAN.md lists the options)
export const AIR_CAPACITY = 100;            // a full bar
export const AIR_ARRIVAL_FILL = 25;         // arriving on a thin floor (the lift) gives at least this much more, so a new floor is never started on empty
export const LIFT_AIR_RADIUS = 14;          // standing this near the lift refills the bar fast
export const LIFT_AIR_RATE = 12;            // units a second at the lift
export const TORCH_AIR_RADIUS = 10;         // standing this near a lit torch of his refills it slowly
export const TORCH_AIR_RATE = 3;            // units a second at a torch (so a torch every 40 units is a place to catch his breath, not a cure)
export const LOW_AIR = 25;                  // below this the bar warns and the effects begin
export const SLOW_AT_EMPTY = 0.85;          // the marshal's speed at empty (a factor); never below this, so nobody is stuck
export const LIGHT_AT_EMPTY = 0.6;          // the lantern's radius at empty (a factor); the dim ring is never shrunk

// How fast the bar drains on a floor, units a second: gentle on the first thin floor, worse deeper, capped so no floor is impossible.
export const drainPerSecond = floor => floor < THIN_AIR_FROM_FLOOR ? 0 : Math.min(2.0, 0.5 + 0.05 * (Math.floor(floor) - THIN_AIR_FROM_FLOOR));

export function createAir() {
    return { level: AIR_CAPACITY };
}

// The bar for a run arriving on `floor`: full on the way down from a safe floor, and never started nearly empty.
export function arriveAir(air, floor) {
    if(floor >= THIN_AIR_FROM_FLOOR) air.level = Math.min(AIR_CAPACITY, Math.max(air.level, 0) + AIR_ARRIVAL_FILL);
    else air.level = AIR_CAPACITY;
    return air;
}

// One step: `where` = { floor, nearLift, nearLitTorch }. The bar drains on a thin floor unless he is at the lift or beside a lit torch of his, where it
// refills (the lift wins). Never below 0 or above AIR_CAPACITY.
export function tickAir(air, dt, where) {
    if(!where || where.floor < THIN_AIR_FROM_FLOOR) { air.level = AIR_CAPACITY; return air; }
    const rate = where.nearLift ? LIFT_AIR_RATE : where.nearLitTorch ? TORCH_AIR_RATE : -drainPerSecond(where.floor);
    air.level = Math.max(0, Math.min(AIR_CAPACITY, air.level + rate * Math.max(0, dt)));
    return air;
}

export const airLow = air => air.level < LOW_AIR;
export const airEmpty = air => air.level <= 0;

// What low air does, as factors that grow worse from LOW_AIR down to empty: a slower marshal and a dimmer lantern. Never a lost heart, never a stuck marshal.
export function airEffects(air) {
    const t = Math.max(0, Math.min(1, 1 - air.level / LOW_AIR)); // 0 at LOW_AIR and above, 1 at empty
    return { speed: 1 - (1 - SLOW_AT_EMPTY) * t, light: 1 - (1 - LIGHT_AT_EMPTY) * t, warning: air.level < LOW_AIR, empty: air.level <= 0 };
}

// What a run on this floor would drain with nothing refilling it, in seconds from a full bar: for balance and for the tests.
export const secondsOfAir = floor => floor < THIN_AIR_FROM_FLOOR ? Infinity : AIR_CAPACITY / drainPerSecond(floor);
