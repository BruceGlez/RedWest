import test from 'node:test';
import assert from 'node:assert/strict';
import { HILL_WALK_AREA, CHAPEL, BLOCKS, hillMap, hillLabel, chapelLines } from '../src/hillLayout.js';
import { createHillPlace } from '../src/places/hill.js';
import { HILL_START, OIL_STAND, POSTS, PIECES, DOLLARS_PER_LANTERN, FULL_NIGHT_BONUS, vigilNight, referenceRoute, tonight, canStep, runState, STEP_WORDS } from '../src/vigil.js';
import { createProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { moveInTown, nearestDoor, PLAYER_RADIUS } from '../src/townWalkLogic.js';

const T0 = new Date('2026-10-01T20:00:00Z');
const withDeacon = () => {
    const p = createProfile(T0);
    p.stats.stageStars[OUTLAWS.findIndex(o => o.id === 'deacon-graves')] = 1;
    return p;
};
const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const standableIn = map => (x, z) => { const [px, pz] = moveInTown(map, x, z, 0, 0); return Math.hypot(px - x, pz - z) < 1e-9; };

test('with no night the hill is the chapel, the bell and the way out', () => {
    const map = hillMap();
    assert.deepEqual(map.areas, [HILL_WALK_AREA]);
    assert.equal(map.boxes.length, BLOCKS.length);
    assert.deepEqual(map.doors.map(d => d.id).sort(), ['bell', 'leave']);
});

test('every post, the oil stand and the bell can be stood at and walked to from the gate, for every kind of night', () => {
    const step = 1;
    for(let pieces = 0; pieces <= 4; pieces++) for(let day = 0; day < 25; day++) {
        const night = vigilNight({ day, pieces });
        const map = hillMap(night);
        const standable = standableIn(map);
        assert.ok(standable(...HILL_START) && inside(HILL_WALK_AREA, HILL_START[0], HILL_START[1], PLAYER_RADIUS));
        const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
        const seen = new Set([key(...HILL_START)]);
        const queue = [HILL_START];
        while(queue.length) {
            const [x, z] = queue.pop();
            for(const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
                const nx = x + dx, nz = z + dz;
                if(seen.has(key(nx, nz)) || !inside(HILL_WALK_AREA, nx, nz, PLAYER_RADIUS) || !standable(nx, nz)) continue;
                seen.add(key(nx, nz));
                queue.push([nx, nz]);
            }
        }
        assert.equal(map.doors.filter(d => d.id === 'oil').length, night.oil ? 1 : 0);
        assert.equal(map.doors.length, 2 + night.lanterns.length + (night.oil ? 1 : 0));
        for(const door of map.doors) {
            assert.ok(inside(HILL_WALK_AREA, door.x, door.z, PLAYER_RADIUS), `${door.id} is on the hill`);
            assert.ok(standable(door.x, door.z), `${door.id} is not inside a wall`);
            assert.equal(nearestDoor(map, door.x, door.z)?.id, door.id, `${door.id} is the nearest door at its own spot`);
            assert.ok(seen.has(key(door.x, door.z)), `${door.id} is reachable (day ${day}, ${pieces} pieces)`);
        }
        assert.notEqual(nearestDoor(map, ...HILL_START)?.id, 'bell', 'no prompt for the bell at the gate');
    }
});

test('the doors are where the rules say: the posts, the stand and the gate, so the server replays the same walk', () => {
    const night = vigilNight({ day: 3, pieces: 3 });
    const map = hillMap(night);
    for(const l of night.lanterns) {
        const post = POSTS.find(p => p.id === l.id);
        const door = map.doors.find(d => d.id === l.id);
        assert.deepEqual([door.x, door.z], [post.x, post.z]);
    }
    if(night.oil) assert.deepEqual([map.doors.find(d => d.id === 'oil').x, map.doors.find(d => d.id === 'oil').z], [OIL_STAND.x, OIL_STAND.z]);
    assert.ok(CHAPEL.z + CHAPEL.hz < Math.min(...POSTS.map(p => p.z)), 'the chapel stands behind the last row of posts');
});

test('a lit lantern is a LOOK, a dark one a LIGHT', () => {
    const night = vigilNight({ day: 3, pieces: 1 });
    const first = night.lanterns[0].id;
    assert.equal(hillMap(night, []).doors.find(d => d.id === first).verb, 'LIGHT');
    assert.equal(hillMap(night, [first]).doors.find(d => d.id === first).verb, 'LOOK');
});

test('the prompts say what a lantern needs and what is in the can', () => {
    const night = vigilNight({ day: 40, pieces: 2 });
    const gated = night.lanterns.find(l => l.needs);
    const dry = night.lanterns.find(l => l.dry && !l.needs);
    const free = night.lanterns.find(l => !l.dry && !l.needs);
    assert.equal(hillLabel({ id: 'bell' }), 'THE CHAPEL BELL');
    assert.equal(hillLabel({ id: 'leave' }), 'THE ROAD TO TOWN');
    assert.equal(hillLabel({ id: gated.id, label: 'LANTERN' }, night, []), 'A LANTERN OUT OF REACH');
    assert.equal(hillLabel({ id: dry.id }, night, []), 'A DRY LANTERN: NEEDS OIL');
    assert.equal(hillLabel({ id: free.id }, night, []), 'AN UNLIT LANTERN');
    assert.equal(hillLabel({ id: free.id }, night, [free.id]), 'THE LANTERN: LIT');
    assert.equal(hillLabel({ id: 'oil' }, night, []), 'THE OIL STAND: THE CAN LIGHTS 0');
    assert.equal(hillLabel({ id: 'oil' }, night, ['oil']), 'THE OIL STAND: THE CAN IS FULL');
    assert.equal(hillLabel({ id: 'p1', label: 'LANTERN' }, null, []), 'LANTERN');
});

test('the chapel card lines say what is built and how much light the next piece needs', () => {
    const lines = chapelLines(PIECES[0].at + 5);
    assert.deepEqual(lines.map(l => l.built), [true, false, false, false]);
    assert.equal(lines[0].text, 'THE WINDOW: BUILT');
    assert.equal(lines[1].text, `THE PEWS: ${PIECES[1].at - PIECES[0].at - 5} MORE LIGHT`);
});

// ---------- the place, played with a fake town screen ----------
function game(profile, wallet = null, log = []) {
    const state = { profile };
    const host = {
        profile: () => state.profile, openBuilding: id => log.push(['open', id]), closeCard: () => log.push(['close']), leave: () => log.push(['leave']), markVisited: id => log.push(['visited', id]),
        onProfile: p => { state.profile = p; log.push(['profile']); }, track: e => log.push(['track', e]), toast: (t, err) => log.push(['toast', t, !!err]),
        act: async work => work(), wallet
    };
    const place = createHillPlace(host);
    return { place, state, log, host };
}
const toasts = log => log.filter(e => e[0] === 'toast');
const settleLater = () => new Promise(resolve => setImmediate(resolve));

test('the hill cannot be entered until Deacon Graves has a star, and only its own gate leads in', () => {
    assert.equal(game(createProfile(T0)).place.canEnter(), false);
    assert.equal(game(null).place.canEnter(), false);
    const { place } = game(withDeacon());
    assert.equal(place.canEnter(), true);
    assert.equal(place.entrance('enter-chapel'), true);
    assert.equal(place.entrance('enter-copper'), false);
    assert.equal(place.click({ hasAttribute: () => false }), false);
});

test('a step the rules refuse is told in words and changes nothing; one they allow lights the lantern', () => {
    const p = withDeacon();
    const { place, log } = game(p);
    place.prepare();
    const night = tonight(p, new Date());
    const gated = night.lanterns.find(l => l.needs);
    const dry = night.lanterns.find(l => l.dry && !l.needs);
    const free = night.lanterns.find(l => !l.dry && !l.needs);
    place.use(gated.id);
    assert.deepEqual(toasts(log).at(-1), ['toast', STEP_WORDS.out_of_reach, true]);
    if(dry) { place.use(dry.id); assert.deepEqual(toasts(log).at(-1), ['toast', STEP_WORDS.no_oil, true]); }
    place.use(free.id);
    assert.match(toasts(log).at(-1)[1], new RegExp(`^Lit\\. 1 of ${night.lanterns.length}`));
    place.use(free.id);
    assert.equal(toasts(log).at(-1)[1], 'That one is already lit.');
    assert.match(place.card('bell'), /Lit 1 of/);
    assert.match(place.card('bell'), /data-vigil-end/);
});

test('walking the best route lights the whole hill, sends it to the wallet, and the chapel and the dollars move', async () => {
    const p = withDeacon();
    const calls = [];
    const wallet = { vigil: async body => { calls.push(body); const { vigilAction } = await import('../src/vigil.js'); const copy = structuredClone(state.profile); const result = vigilAction(copy, body, new Date()); return { result, profile: copy }; } };
    const { place, state, log } = game(p, wallet);
    place.prepare();
    const night = tonight(p, new Date());
    for(const id of referenceRoute(night)) place.use(id);
    await settleLater();
    assert.equal(calls.length, 1, 'sent once, when the last lantern was lit');
    assert.deepEqual(calls[0], { action: 'light', order: referenceRoute(night) });
    const done = toasts(log).at(-1)[1];
    assert.match(done, new RegExp(`^Lit ${night.lanterns.length} of ${night.lanterns.length}\\.`));
    assert.match(done, /for the lamplighter/);
    assert.equal(state.profile.balances.dollars, night.lanterns.length * DOLLARS_PER_LANTERN + FULL_NIGHT_BONUS);
    assert.equal(state.profile.town.chapel.light, night.lanterns.length);
    assert.match(place.card('bell'), /has counted/, 'a second walk the same day is practice');
    assert.ok(!place.card('bell').includes('data-vigil-end'), 'and a new night starts dark');
});

test('END THE VIGIL sends what was lit so far, pays for it with no bonus, and leaving does the same', async () => {
    const p = withDeacon();
    const calls = [];
    const wallet = { vigil: async body => { calls.push(body); const { vigilAction } = await import('../src/vigil.js'); const copy = structuredClone(state.profile); return { result: vigilAction(copy, body, new Date()), profile: copy }; } };
    const { place, state, log } = game(p, wallet);
    place.prepare();
    const night = tonight(p, new Date());
    const free = night.lanterns.find(l => !l.dry && !l.needs);
    place.use(free.id);
    assert.equal(place.click({ hasAttribute: a => a === 'data-vigil-end' }), true);
    await settleLater();
    assert.deepEqual(calls, [{ action: 'light', order: [free.id] }]);
    assert.equal(state.profile.balances.dollars, DOLLARS_PER_LANTERN);
    // Another night's walk: leaving with something lit sends it first; practice pays nothing.
    place.prepare();
    place.use(free.id);
    place.use('leave');
    await settleLater();
    await settleLater();
    assert.equal(calls.length, 2);
    assert.equal(state.profile.balances.dollars, DOLLARS_PER_LANTERN, 'practice paid nothing');
    assert.deepEqual(log.at(-1), ['leave']);
    // Leaving with nothing lit sends nothing.
    const before = calls.length;
    place.prepare();
    place.use('leave');
    await settleLater();
    assert.equal(calls.length, before);
});

test('a wallet that refuses is told as an error, and the hill is dark again', async () => {
    const p = withDeacon();
    const wallet = { vigil: async () => { throw new Error('Could not reach the Red West server.'); } };
    const { place, log } = game(p, wallet);
    place.prepare();
    const free = tonight(p, new Date()).lanterns.find(l => !l.dry && !l.needs);
    place.use(free.id);
    place.click({ hasAttribute: a => a === 'data-vigil-end' });
    await settleLater();
    assert.deepEqual(toasts(log).at(-1), ['toast', 'Could not reach the Red West server.', true]);
    assert.ok(!place.card('bell').includes('data-vigil-end'));
});

test('the bell card says what tonight holds and how the chapel stands', () => {
    const p = withDeacon();
    p.town.chapel.light = PIECES[0].at + 10;
    p.town.chapel.base = p.town.chapel.light;
    const { place } = game(p);
    place.prepare();
    const html = place.card('bell');
    assert.match(html, /THE CHAPEL BELL/);
    assert.match(html, /THE WINDOW: BUILT/);
    assert.match(html, /THE PEWS: \d+ MORE LIGHT/);
    assert.match(html, /Tonight: \d+ lanterns/);
    assert.match(html, /bell rings once at dusk/);
    assert.equal(place.card('nowhere'), '');
    assert.equal(game(null).place.card('bell'), '');
});
