import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECES, POSTS, HILL_START, OIL_STAND, HILL_AREA, MAX_LIGHT, OIL_CAPACITY, DOLLARS_PER_LANTERN, FULL_NIGHT_BONUS, TOUCH_SECONDS, getPost, vigilOpen, createChapel, normalizeChapel,
    piecesBuilt, lightToNext, vigilNight, referenceRoute, vigilRoute, tonight, settleVigil, vigilAction } from '../src/vigil.js';
import { createProfile, normalizeProfile } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';
import { JAIL_BOUNTY_SHARE, normalizeTown, jailRate, jailStored } from '../src/town.js';
import { unlockedDistricts } from '../src/townDistricts.js';
import { dayNumber } from '../src/farmOrders.js';
import { MAX_DOLLARS_PER_RUN } from '../src/profile.js';

const T0 = new Date('2026-10-01T20:00:00Z');
const later = days => new Date(T0.getTime() + days * 86400000);
const index = id => OUTLAWS.findIndex(o => o.id === id);
const profileWith = ids => {
    const p = createProfile(T0);
    for(const id of ids) p.stats.stageStars[index(id)] = 1;
    return p;
};
const open = () => profileWith(['deacon-graves']);
const perfect = (p, now) => referenceRoute(tonight(p, now));

test('the hill is shut until Deacon Graves is beaten, and every action says so', () => {
    const p = createProfile(T0);
    assert.equal(vigilOpen(p), false);
    assert.throws(() => vigilAction(p, { action: 'light', order: ['p0'] }, T0), { code: 'locked' });
    p.stats.stageStars[index('deacon-graves')] = 6; // stars without the "beaten" bit do not open it
    assert.equal(vigilOpen(p), false);
    assert.equal(vigilOpen(profileWith(['dusty-pete', 'rattlesnake-rosa', 'calloway-gang', 'lucky-lou'])), false, 'no other outlaw opens it');
    assert.equal(vigilOpen(open()), true);
    assert.deepEqual(unlockedDistricts(open().stats.stageStars), ['chapel'], 'it opens only its own district');
    assert.throws(() => vigilAction(open(), { action: 'bell' }, T0), { code: 'bad_action' });
    assert.throws(() => vigilAction(open(), { action: 'light', order: 'p0' }, T0), { code: 'bad_order' });
    assert.throws(() => vigilAction(open(), undefined, T0), { code: 'bad_action' });
});

test('the posts stand on the hill, apart from each other and from the oil stand and the gate', () => {
    assert.equal(POSTS.length, 18);
    assert.equal(new Set(POSTS.map(p => p.id)).size, 18);
    const inside = (x, z) => x >= HILL_AREA.minX && x <= HILL_AREA.maxX && z >= HILL_AREA.minZ && z <= HILL_AREA.maxZ;
    assert.ok(inside(HILL_START[0], HILL_START[1]) && inside(OIL_STAND.x, OIL_STAND.z));
    for(const p of POSTS) {
        assert.ok(inside(p.x, p.z), `${p.id} is on the hill`);
        assert.ok(Math.hypot(p.x - HILL_START[0], p.z - HILL_START[1]) > 4, `${p.id} is not at the gate`);
        assert.ok(Math.hypot(p.x - OIL_STAND.x, p.z - OIL_STAND.z) > 3, `${p.id} is not on the oil stand`);
        for(const q of POSTS) if(p !== q) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 5, `${p.id} and ${q.id} are apart`);
    }
    assert.equal(getPost('p2').x, 8);
    assert.equal(getPost('nope'), null);
});

test('a night is the same for the same day and chapel, and changes with the day', () => {
    assert.deepEqual(vigilNight({ day: 500, pieces: 2 }), vigilNight({ day: 500, pieces: 2 }));
    const ids = night => night.lanterns.map(l => l.id).join();
    assert.notEqual(ids(vigilNight({ day: 500, pieces: 2 })), ids(vigilNight({ day: 501, pieces: 2 })));
    assert.notDeepEqual(vigilNight({ day: 500, pieces: 0 }), vigilNight({ day: 500, pieces: 3 }));
});

test('every night can be won: a good route lights every lantern inside the bell\'s limit, whatever the day and the chapel', () => {
    for(let pieces = 0; pieces <= PIECES.length; pieces++) {
        for(let day = 0; day < 120; day++) {
            const night = vigilNight({ day, pieces });
            assert.ok(night.lanterns.length >= 6 && night.lanterns.length <= POSTS.length);
            const route = vigilRoute(night, referenceRoute(night));
            assert.equal(route.lit.length, night.lanterns.length, `day ${day}, ${pieces} pieces: all lit`);
            assert.equal(route.stoppedBy, null);
            assert.ok(route.seconds <= night.limit, `${route.seconds}s inside ${night.limit}s`);
            assert.ok(night.limit >= 40 && night.limit < 150, `a limit of ${night.limit}s`);
            assert.ok(night.limit - route.seconds > 3, 'and with a little room');
        }
    }
});

test('later nights hold more lanterns, more that are gated and more that need oil, and no gate is a knot', () => {
    const avg = (pieces, pick) => { let sum = 0; for(let day = 0; day < 60; day++) sum += pick(vigilNight({ day, pieces })); return sum / 60; };
    assert.ok(avg(4, n => n.lanterns.length) > avg(2, n => n.lanterns.length) && avg(2, n => n.lanterns.length) > avg(0, n => n.lanterns.length));
    assert.ok(avg(4, n => n.lanterns.filter(l => l.needs).length) > avg(0, n => n.lanterns.filter(l => l.needs).length));
    assert.ok(avg(4, n => n.lanterns.filter(l => l.dry).length) > avg(0, n => n.lanterns.filter(l => l.dry).length));
    for(let day = 0; day < 80; day++) for(let pieces = 0; pieces <= 4; pieces++) {
        const night = vigilNight({ day, pieces });
        const position = new Map(night.lanterns.map((l, i) => [l.id, i]));
        for(const l of night.lanterns) if(l.needs) assert.ok(position.get(l.needs) < position.get(l.id), 'a lantern waits only on one nearer the gate');
        assert.equal(night.oil, night.lanterns.some(l => l.dry));
    }
});

test('a route is cut at the first step that is not allowed, and what came before still counts', () => {
    const night = vigilNight({ day: 40, pieces: 2 });
    const free = night.lanterns.find(l => !l.needs && !l.dry);
    const gated = night.lanterns.find(l => l.needs);
    const dry = night.lanterns.find(l => l.dry && !l.needs);
    assert.deepEqual(vigilRoute(night, [free.id]).lit, [free.id]);
    assert.equal(vigilRoute(night, ['nope']).stoppedBy, 'unknown');
    assert.equal(vigilRoute(night, [free.id, 'zz']).lit.length, 1);
    assert.equal(vigilRoute(night, [free.id, free.id]).stoppedBy, 'twice');
    assert.equal(vigilRoute(night, [gated.id]).stoppedBy, 'out_of_reach');
    assert.equal(vigilRoute(night, [dry.id]).stoppedBy, 'no_oil', 'a dry lantern needs the can filled first');
    assert.deepEqual(vigilRoute(night, ['oil', dry.id]).lit, [dry.id]);
    assert.equal(vigilRoute(night, [null, 7, {}]).stoppedBy, 'unknown');
    assert.deepEqual(vigilRoute(night, 'p0').lit, []);
    assert.deepEqual(vigilRoute(night, []).lit, []);
});

test('the can holds three fills, then it is empty again', () => {
    for(let day = 0; day < 200; day++) {
        const night = vigilNight({ day, pieces: 4 });
        const dry = night.lanterns.filter(l => l.dry && !l.needs);
        if(dry.length < OIL_CAPACITY + 1) continue;
        const route = vigilRoute(night, ['oil', ...dry.slice(0, OIL_CAPACITY + 1).map(l => l.id)]);
        assert.equal(route.lit.length, OIL_CAPACITY);
        assert.equal(route.stoppedBy, 'no_oil');
        assert.equal(vigilRoute(night, ['oil', ...dry.slice(0, OIL_CAPACITY).map(l => l.id), 'oil', dry[OIL_CAPACITY].id]).lit.length, OIL_CAPACITY + 1);
        return;
    }
    assert.fail('no night with enough dry lanterns to check');
});

test('nobody can walk faster than the marshal: a route that is too long for the bell is cut, and the limit is the server\'s', () => {
    const night = vigilNight({ day: 12, pieces: 4 });
    // A long, zig-zag order over the same lanterns, ignoring distance: it takes longer than the bell gives.
    const far = [...referenceRoute(night)].reverse();
    const route = vigilRoute(night, referenceRoute(night).concat(far));
    assert.ok(route.seconds <= night.limit);
    // Make the limit tiny: only what could be walked in that time counts.
    const tight = { ...night, limit: 12 };
    const cut = vigilRoute(tight, referenceRoute(night));
    assert.equal(cut.stoppedBy, 'bell');
    assert.ok(cut.lit.length < night.lanterns.length && cut.seconds <= 12);
    assert.ok(cut.seconds >= TOUCH_SECONDS, 'it counted the walk');
    assert.equal(vigilRoute(night, new Array(500).fill('p0')).lit.length <= 1, true, 'a huge list is bounded');
});

test('the first vigil of a day counts and pays; later ones the same day are free practice', () => {
    const p = open();
    const first = settleVigil(p, { action: 'light', order: perfect(p, T0) }, T0);
    assert.equal(first.full, true);
    assert.equal(first.counted, true);
    assert.equal(first.dollars, first.lit * DOLLARS_PER_LANTERN + FULL_NIGHT_BONUS);
    assert.equal(p.balances.dollars, first.dollars);
    assert.equal(p.town.chapel.light, first.lit);
    const again = settleVigil(p, { action: 'light', order: perfect(p, T0) }, T0);
    assert.equal(again.full, true, 'practice still shows how it went');
    assert.deepEqual([again.counted, again.dollars, p.town.chapel.light], [false, 0, first.lit], 'and gives nothing');
    assert.equal(p.balances.dollars, first.dollars);
    // The next day, a new vigil counts.
    const next = settleVigil(p, { action: 'light', order: perfect(p, later(1)) }, later(1));
    assert.equal(next.counted, true);
    assert.equal(p.town.chapel.light, first.lit + next.lit);
});

test('an empty or wholly refused route does not use up the day', () => {
    const p = open();
    const empty = settleVigil(p, { action: 'light', order: [] }, T0);
    assert.deepEqual([empty.lit, empty.counted, empty.dollars], [0, false, 0]);
    assert.equal(settleVigil(p, { action: 'light', order: ['nope'] }, T0).counted, false);
    assert.equal(settleVigil(p, { action: 'light', order: perfect(p, T0) }, T0).counted, true, 'the day was still there');
});

test('a part of the night pays for what was lit, and no bonus', () => {
    const p = open();
    const route = perfect(p, T0).slice(0, 3);
    const r = settleVigil(p, { action: 'light', order: route }, T0);
    const lanterns = route.filter(id => id !== 'oil').length;
    assert.deepEqual([r.lit, r.full, r.dollars], [lanterns, false, lanterns * DOLLARS_PER_LANTERN]);
});

test('the chapel is built piece by piece, for good, and tonight does not change under him mid-day', () => {
    assert.deepEqual(piecesBuilt(0), []);
    assert.deepEqual(piecesBuilt(PIECES[0].at - 1), []);
    assert.deepEqual(piecesBuilt(PIECES[0].at), ['window']);
    assert.deepEqual(piecesBuilt(MAX_LIGHT), PIECES.map(p => p.id));
    assert.deepEqual(lightToNext(0), { piece: 'window', name: 'THE WINDOW', need: 30 });
    assert.equal(lightToNext(MAX_LIGHT), null);
    const p = open();
    p.town.chapel = { day: dayNumber(T0), base: 0, light: PIECES[0].at - 2, counted: false };
    const before = tonight(p, T0);
    const r = settleVigil(p, { action: 'light', order: perfect(p, T0) }, T0);
    assert.deepEqual(r.built, ['window'], 'it was the lantern that finished the window');
    assert.deepEqual(tonight(p, T0), before, 'the same night until tomorrow');
    assert.ok(tonight(p, later(1)).lanterns.length >= before.lanterns.length, 'tomorrow the chapel stands a piece taller');
    assert.equal(piecesBuilt(p.town.chapel.light).includes('window'), true);
    // Built is built: the light never goes down.
    const back = normalizeProfile(JSON.parse(JSON.stringify(p)));
    assert.equal(back.town.chapel.light, p.town.chapel.light);
});

test('light stops at the most the chapel can use', () => {
    const p = open();
    p.town.chapel = { day: dayNumber(T0), base: MAX_LIGHT - 1, light: MAX_LIGHT - 1, counted: false };
    settleVigil(p, { action: 'light', order: perfect(p, T0) }, T0);
    assert.equal(p.town.chapel.light, MAX_LIGHT);
});

test('a clock moved back never gives a day\'s vigil twice', () => {
    const p = open();
    settleVigil(p, { action: 'light', order: perfect(p, later(3)) }, later(3));
    const light = p.town.chapel.light;
    const r = settleVigil(p, { action: 'light', order: perfect(p, T0) }, T0); // "three days ago"
    assert.equal(r.counted, false);
    assert.equal(p.town.chapel.light, light);
    assert.equal(p.town.chapel.day, dayNumber(later(3)));
});

test('it is a small side income: a day pays far less than a Wanted Road run, and a month of perfect nights far less than the jail', () => {
    let best = 0;
    for(let pieces = 0; pieces <= 4; pieces++) for(let day = 0; day < 100; day++) {
        const night = vigilNight({ day, pieces });
        best = Math.max(best, night.lanterns.length * DOLLARS_PER_LANTERN + FULL_NIGHT_BONUS);
    }
    assert.ok(best <= 50, `${best} is the most a night pays`);
    assert.ok(best < MAX_DOLLARS_PER_RUN / 10, 'a tenth of one run');
    const jailDay = OUTLAWS.reduce((sum, o) => sum + o.bounty, 0) * JAIL_BOUNTY_SHARE * 24;
    assert.ok(best < jailDay / 20, 'and a small part of a day of the jail');
});

test('the vigil changes nothing outside itself: no stars, jail, buildings, other places or district', () => {
    const p = profileWith(['deacon-graves', 'calloway-gang', 'silas-vane', 'dusty-pete']);
    const snap = () => JSON.stringify({ stars: p.stats.stageStars, levels: p.town.levels, jail: p.town.jailCollectedAt, rate: jailRate(p), stored: jailStored(p, later(1)), farm: p.town.farm, orders: p.town.orders, saloon: p.town.saloon, mine: p.mine, nuggets: p.balances.nuggets, districts: unlockedDistricts(p.stats.stageStars) });
    const before = snap();
    settleVigil(p, { action: 'light', order: perfect(p, T0) }, T0);
    assert.equal(snap(), before);
});

test('saved state survives rubbish and old saves', () => {
    assert.deepEqual(normalizeChapel(null, T0), createChapel(T0));
    assert.deepEqual(normalizeChapel('x', T0), createChapel(T0));
    const messy = normalizeChapel({ day: dayNumber(T0), base: 999999, light: 'many', counted: 'yes' }, T0);
    assert.deepEqual(messy, { day: dayNumber(T0), base: 0, light: 0, counted: false });
    const big = normalizeChapel({ day: dayNumber(T0), base: 80, light: 9999, counted: true }, T0);
    assert.deepEqual([big.light, big.base, big.counted], [MAX_LIGHT, 80, true]);
    const old = normalizeChapel({ day: dayNumber(T0) - 5, base: 10, light: 40, counted: true }, T0);
    assert.deepEqual([old.counted, old.base, old.light], [false, 40, 40], 'a new day starts from what is built');
    assert.equal(normalizeTown({ levels: {} }, T0).chapel.light, 0, 'an old save gets an empty chapel');
    const p = createProfile(T0);
    p.town.chapel.light = 55;
    assert.equal(normalizeProfile(JSON.parse(JSON.stringify(p))).town.chapel.light, 55, 'and it is saved with the profile');
    assert.equal(OIL_CAPACITY, 3);
});
