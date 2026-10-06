import { EconomyError } from './economyError.js';
import { OUTLAWS } from './outlaws.js';
import { WALK_SPEED } from './townWalkLogic.js';
import { dayNumber } from './farmOrders.js';

// Hollow Hill's dusk vigil (PLACES.md, section 10): the rules and the saved state, with no rendering, like src/saloon.js, so the server and the offline
// wallet run the same code and tests/vigil.test.js can check them. This is the data contract; the place and the screens come after it.
//
// - Each evening the bell rings once and the hill goes dark. The player walks the hill and lights the lanterns on its paths and graves before the bell's
//   echo fades (a time limit that is the same for everybody on the same night). Which posts have a lantern, which need oil from the stand, and which
//   are out of reach until another is lit, come from the day (`vigilNight`): the route is the puzzle, so he plans a path rather than races.
// - The game is played on the client by walking; its report is only the ORDER he visited things in, `{ action: 'light', order: ['p3', 'oil', 'p7', ...] }`.
//   The server replays it (`vigilRoute`): it knows where every post stands and how fast the marshal walks, so a route that could not have been walked in the
//   time, or breaks a rule, is cut at the first bad step. Nobody can claim more than the night holds.
// - Each lantern lit adds one light to the chapel, which the Deacon rebuilds one piece at a time (a window, the pews, the bell tower, the roof). A piece, once
//   built, is built for good. Only the first vigil of a day counts (light and pay); later ones the same day are free practice. A missed night costs only the night.
// - A little pay for the lamplighter, in earned Bounty Dollars, far under what a Wanted Road run or the jail earns. Nothing here has a timer to pay off,
//   touches combat, or sells anything, and it reads only Deacon Graves's first star.

export const VIGIL_OUTLAW = 'deacon-graves';
export const DOLLARS_PER_LANTERN = 2;
export const FULL_NIGHT_BONUS = 10;
export const MAX_LIGHT = 400;
export const OIL_CAPACITY = 3;     // lanterns one fill of oil lights
export const OIL_AT_START = 0;     // he starts the hill with no oil in the can
export const TOUCH_SECONDS = 0.5;  // lighting a lantern or filling the can takes a moment
export const DETOUR = 1.3;         // the real way round the graves is never more than this over the straight line
export const SLACK = 1.25;         // the bell gives this much more than a good route needs

// The chapel's pieces, in the order the Deacon builds them, and the light each one needs in all.
export const PIECES = [
    { id: 'window', name: 'THE WINDOW', at: 30 },
    { id: 'pews', name: 'THE PEWS', at: 100 },
    { id: 'tower', name: 'THE BELL TOWER', at: 200 },
    { id: 'roof', name: 'THE ROOF', at: 330 }
];

// The hill: where the marshal comes in, the oil stand, and the eighteen posts a lantern may stand on (paths and graves). x to the right, z toward the viewer.
export const HILL_AREA = { minX: -30, maxX: 30, minZ: -24, maxZ: 20 };
export const HILL_START = [0, 16];
export const OIL_STAND = { x: -6, z: 9 };
export const POSTS = [
    ...[-20, -8, 8, 20].map((x, i) => ({ id: `p${i}`, x, z: 12 })),
    ...[-24, -12, 0, 12, 24].map((x, i) => ({ id: `p${4 + i}`, x, z: 4 })),
    ...[-20, -8, 8, 20].map((x, i) => ({ id: `p${9 + i}`, x, z: -4 })),
    ...[-14, 0, 14].map((x, i) => ({ id: `p${13 + i}`, x, z: -12 })),
    ...[-6, 6].map((x, i) => ({ id: `p${16 + i}`, x, z: -19 }))
];
const POST = new Map(POSTS.map(p => [p.id, p]));
export const getPost = id => POST.get(id) ?? null;
const at = id => (id === 'oil' ? [OIL_STAND.x, OIL_STAND.z] : [POST.get(id).x, POST.get(id).z]);

const VIGIL_INDEX = OUTLAWS.findIndex(o => o.id === VIGIL_OUTLAW);
export const vigilOpen = profile => ((profile.stats?.stageStars?.[VIGIL_INDEX]) & 1) !== 0;

// ---------- the chapel (saved as profile.town.chapel) ----------

// Saved state: the newest day seen (a clock moved back never gives a day's vigil twice), the light the chapel had when the day began (so the night
// does not change under him mid-day), the light now, and whether today's vigil has counted.
export const createChapel = (now = new Date()) => ({ day: dayNumber(now), base: 0, light: 0, counted: false });

export function normalizeChapel(raw, now = new Date()) {
    const chapel = createChapel(now);
    if(!raw || typeof raw !== 'object') return chapel;
    const whole = v => Math.max(0, Math.floor(Number(v)) || 0);
    chapel.light = Math.min(MAX_LIGHT, whole(raw.light));
    chapel.base = Math.min(chapel.light, whole(raw.base));
    const day = Math.floor(Number(raw.day));
    if(Number.isFinite(day) && day > chapel.day) chapel.day = day;
    if(Number.isFinite(day) && day === chapel.day) chapel.counted = raw.counted === true;
    else chapel.base = chapel.light; // an old day: tonight starts from what is built now
    return chapel;
}

// Which pieces the light so far has built, in order.
export const piecesBuilt = light => PIECES.filter(p => light >= p.at).map(p => p.id);
export const lightToNext = light => { const next = PIECES.find(p => light < p.at); return next ? { piece: next.id, name: next.name, need: next.at - light } : null; };

const today = (profile, now) => Math.max(dayNumber(now), profile.town.chapel?.day | 0);
// The state the day starts from, without changing anything: a new day starts from the light now.
function startOfDay(profile, now) {
    const chapel = profile.town.chapel ?? createChapel(now);
    const day = today(profile, now);
    return chapel.day < day ? { day, base: chapel.light, light: chapel.light, counted: false } : { day, base: chapel.base, light: chapel.light, counted: chapel.counted };
}

// ---------- tonight's hill ----------

// A small repeatable random stream (mulberry32), so a night depends only on the day and how much of the chapel stands.
function stream(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const seconds = (a, b) => (distance(a, b) * DETOUR) / WALK_SPEED + TOUCH_SECONDS;

// A night: { day, pieces, lanterns: [{ id, needs: id | null, dry: boolean }], limit, oil: boolean }. `pieces` is how many of the chapel's pieces stand: more
// of the chapel means more lanterns, more gated ones and more that need oil. The limit is what a good route needs, with SLACK, so every night can be won.
export function vigilNight({ seed = 0, day = 0, pieces = 0 } = {}) {
    const stage = Math.max(0, Math.min(PIECES.length, Math.floor(pieces)));
    const next = stream(Math.floor(seed) * 104729 + Math.floor(day) * 7919 + stage * 31 + 5);
    const count = Math.min(POSTS.length, 6 + stage * 2 + Math.floor(next() * 3));
    const chosen = POSTS.map(p => ({ p, k: next() })).sort((a, b) => a.k - b.k).slice(0, count).map(x => x.p);
    chosen.sort((a, b) => distance(HILL_START, [a.x, a.z]) - distance(HILL_START, [b.x, b.z])); // nearest the gate first
    const gated = Math.min(count - 2, 1 + stage); // a lantern that opens only once another is lit; never the first two
    const dryCount = Math.min(count - 2, 2 + stage * 2);
    const lanterns = chosen.map(p => ({ id: p.id, needs: null, dry: false }));
    const later = lanterns.slice(2).map((l, i) => i + 2).sort(() => next() - 0.5);
    for(const i of later.slice(0, gated)) lanterns[i].needs = lanterns[Math.floor(next() * i)].id; // always one nearer the gate: no knots
    for(const i of lanterns.map((l, k) => k).sort(() => next() - 0.5).slice(0, dryCount)) lanterns[i].dry = true;
    const night = { day: Math.floor(day), pieces: stage, lanterns, oil: lanterns.some(l => l.dry), limit: 0 };
    night.limit = Math.max(40, Math.ceil(referenceSeconds(night) * SLACK));
    return night;
}

// A good route for a night: always go to the nearest lantern he may light, filling the can when it is empty and a dry one is wanted. Returns the order.
export function referenceRoute(night) {
    const left = new Map(night.lanterns.map(l => [l.id, l]));
    const lit = new Set();
    const order = [];
    let here = HILL_START, oil = OIL_AT_START;
    while(left.size) {
        const open = [...left.values()].filter(l => !l.needs || lit.has(l.needs));
        const wet = open.filter(l => !l.dry || oil > 0);
        let target;
        if(wet.length) target = wet.sort((a, b) => distance(here, at(a.id)) - distance(here, at(b.id)))[0].id;
        else { target = 'oil'; oil = OIL_CAPACITY; }
        order.push(target);
        if(target !== 'oil') { const l = left.get(target); if(l.dry) oil--; lit.add(target); left.delete(target); }
        here = at(target);
    }
    return order;
}
function referenceSeconds(night) {
    let here = HILL_START, total = 0;
    for(const id of referenceRoute(night)) { total += seconds(here, at(id)); here = at(id); }
    return total;
}

// Replay a route (a list of lantern ids and 'oil'): the lanterns lit and the seconds it took. It stops at the first step that is not allowed (an unknown
// post, one lit twice, one that is out of reach, a dry lantern with no oil) or would go past the bell's limit; what came before still counts.
export function vigilRoute(night, order) {
    const byId = new Map(night.lanterns.map(l => [l.id, l]));
    const lit = [];
    const done = new Set();
    let here = HILL_START, time = 0, oil = OIL_AT_START, stoppedBy = null, steps = 0;
    for(const id of Array.isArray(order) ? order.slice(0, POSTS.length * 3) : []) {
        if(id !== 'oil' && (typeof id !== 'string' || !byId.has(id))) { stoppedBy = 'unknown'; break; }
        const lantern = byId.get(id);
        if(lantern && done.has(id)) { stoppedBy = 'twice'; break; }
        if(lantern?.needs && !done.has(lantern.needs)) { stoppedBy = 'out_of_reach'; break; }
        if(lantern?.dry && oil <= 0) { stoppedBy = 'no_oil'; break; }
        const took = seconds(here, at(id));
        if(time + took > night.limit) { stoppedBy = 'bell'; break; }
        time += took;
        here = at(id);
        if(id === 'oil') oil = OIL_CAPACITY;
        else { if(lantern.dry) oil--; done.add(id); lit.push(id); }
        steps++;
    }
    return { lit, seconds: Math.round(time * 10) / 10, stoppedBy, steps, oil };
}

// What the walk can say when a step is refused, and what is left of the bell: the screen plays the vigil one step at a time with these, and the server
// replays the whole route with `vigilRoute`, so the two always agree.
export const STEP_WORDS = {
    unknown: 'There is no lantern there.',
    twice: 'That one is already lit.',
    out_of_reach: 'Out of reach. Light the lantern nearer the gate first.',
    no_oil: 'The can is empty. Fill it at the oil stand.',
    bell: 'The bell would fade before you got there.'
};
// Can this step follow the steps so far? { ok, why, seconds, left }: `left` is the seconds of the bell's walking that remain after it.
export function canStep(night, order, id) {
    const before = vigilRoute(night, order);
    const after = vigilRoute(night, [...order, id]);
    const ok = after.stoppedBy === null && (after.lit.length > before.lit.length || (id === 'oil' && after.seconds > before.seconds));
    return { ok, why: ok ? '' : STEP_WORDS[after.stoppedBy] ?? STEP_WORDS.unknown, seconds: ok ? after.seconds : before.seconds, left: Math.max(0, night.limit - (ok ? after.seconds : before.seconds)) };
}
// The state after some steps (for the prompts): { lit: [ids], oil: how many lanterns the can still lights, seconds, left }.
export function runState(night, order) {
    const route = vigilRoute(night, order);
    return { lit: route.lit, oil: route.oil, seconds: route.seconds, left: Math.max(0, night.limit - route.seconds) };
}

// Tonight's hill for a player: the same for everybody with the same part of the chapel built.
export function tonight(profile, now = new Date()) {
    const state = startOfDay(profile, now);
    return vigilNight({ seed: 0, day: state.day, pieces: piecesBuilt(state.base).length });
}

// Settle one vigil: { action: 'light', order: [...] }. Returns { lit, full, counted, dollars, light, built, seconds, stoppedBy }.
export function settleVigil(profile, body, now = new Date()) {
    if(!vigilOpen(profile)) throw new EconomyError('locked', 'The hill is shut until Deacon Graves is beaten.');
    if(!Array.isArray(body?.order)) throw new EconomyError('bad_order', 'That is not a route.');
    const state = startOfDay(profile, now);
    const night = vigilNight({ seed: 0, day: state.day, pieces: piecesBuilt(state.base).length });
    const route = vigilRoute(night, body.order);
    const chapel = profile.town.chapel = { day: state.day, base: state.base, light: state.light, counted: state.counted };
    const full = route.lit.length === night.lanterns.length;
    const before = piecesBuilt(chapel.light);
    let dollars = 0;
    const counted = !chapel.counted && route.lit.length > 0;
    if(counted) {
        chapel.counted = true;
        chapel.light = Math.min(MAX_LIGHT, chapel.light + route.lit.length);
        dollars = route.lit.length * DOLLARS_PER_LANTERN + (full ? FULL_NIGHT_BONUS : 0);
        profile.balances.dollars += dollars;
    }
    const built = piecesBuilt(chapel.light).filter(id => !before.includes(id));
    return { lit: route.lit.length, of: night.lanterns.length, full, counted, dollars, light: chapel.light, built, seconds: route.seconds, stoppedBy: route.stoppedBy };
}

// One entry point for the wallets and the server.
export function vigilAction(profile, body, now = new Date()) {
    switch(body?.action) {
        case 'light': return settleVigil(profile, body, now);
        default: throw new EconomyError('bad_action', 'That is not something the vigil does.');
    }
}
