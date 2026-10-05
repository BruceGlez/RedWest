import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, TOWN_AREA, getDistrict, opensWith, unlockedDistricts, lockedHint, walkAreas, districtPlaces, placeName, districtAt, doorLabel, districtOf } from '../src/townDistricts.js';
import { OUTLAWS } from '../src/outlaws.js';
import { TOWN_LAYOUT } from '../src/townScene.js';

const inside = (a, x, z, m = 0) => x >= a.minX + m && x <= a.maxX - m && z >= a.minZ + m && z <= a.maxZ - m;
const overlapX = (a, b) => Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
const overlapZ = (a, b) => Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);

test('every district is opened by a real outlaw, and no two share one', () => {
    const ids = DISTRICTS.map(d => d.outlaw);
    assert.equal(new Set(ids).size, ids.length);
    for(const d of DISTRICTS) assert.ok(opensWith(d) >= 0, `${d.id} has an outlaw`);
    assert.equal(getDistrict('ranch').outlaw, 'calloway-gang');
    assert.equal(getDistrict('nope'), null);
});

test('a district opens with the first star on its outlaw, and only that', () => {
    const stars = OUTLAWS.map(() => 0);
    assert.deepEqual(unlockedDistricts(stars), []);
    stars[opensWith(getDistrict('foundry'))] = 1;
    assert.deepEqual(unlockedDistricts(stars), ['foundry']);
    stars[opensWith(getDistrict('ranch'))] = 6; // other stars without the "beaten" bit do not open it
    assert.deepEqual(unlockedDistricts(stars), ['foundry']);
    stars[opensWith(getDistrict('ranch'))] = 7;
    stars[opensWith(getDistrict('canal'))] = 1;
    assert.deepEqual(unlockedDistricts(stars).sort(), ['canal', 'foundry', 'ranch']);
    assert.deepEqual(unlockedDistricts(undefined), []);
});

test('the shut gate names the outlaw to beat', () => {
    assert.match(lockedHint(getDistrict('foundry')), /Beat IRON JACK HARLAN/);
});

test('each area joins the town with room to cross, and the areas do not overlap each other', () => {
    for(const d of DISTRICTS) {
        assert.ok(overlapX(d.area, TOWN_AREA) >= 3 && overlapZ(d.area, TOWN_AREA) >= 3, `${d.id} reaches at least 3 units into the town`);
    }
    for(const a of DISTRICTS) for(const b of DISTRICTS) {
        if(a !== b) assert.ok(!(overlapX(a.area, b.area) > 0 && overlapZ(a.area, b.area) > 0), `${a.id} and ${b.id} are apart`);
    }
});

test('each fence runs along the edge of its area and its sign can be read from inside the town', () => {
    for(const d of DISTRICTS) {
        const { from, to, read } = d.fence;
        assert.ok(inside(TOWN_AREA, read[0], read[1], 0.6), `${d.id}: the sign is read from the town`);
        for(const [x, z] of [from, to]) assert.ok(x >= d.area.minX - 4 && x <= d.area.maxX + 4 && z >= d.area.minZ - 4 && z <= d.area.maxZ + 4, `${d.id}: fence end near the area`);
    }
});

test("each place is inside its own district, clear of the buildings and of the prop's own box", () => {
    for(const d of DISTRICTS.filter(d => d.place)) {
        const { object, stand } = d.place;
        assert.ok(inside(d.area, stand[0], stand[1], 0.6), `${d.id}: the stand point is on its ground`);
        assert.ok(inside(d.area, object.x, object.z), `${d.id}: the prop is on its ground`);
        const clear = stand[0] < object.x - object.hx - 0.6 || stand[0] > object.x + object.hx + 0.6 || stand[1] < object.z - object.hz - 0.6 || stand[1] > object.z + object.hz + 0.6;
        assert.ok(clear, `${d.id}: the marshal fits at the stand point`);
        for(const b of TOWN_LAYOUT) assert.ok(Math.hypot(stand[0] - b.x, stand[1] - b.z) >= 3.5, `${d.id}: not inside ${b.id}`);
        assert.ok(d.card.text.length > 40 && d.card.text.length <= 260, `${d.id}: a card of a sensible length`);
    }
});

test('walk areas and places grow with the open districts', () => {
    assert.deepEqual(walkAreas([]), [TOWN_AREA]);
    assert.equal(walkAreas(['fort', 'foundry']).length, 3);
    assert.equal(walkAreas(['ranch', 'canal', 'crossing', 'foundry']).length, 2, 'the farm, the Channel and the Crossing are places of their own, so they add no ground to the town');
    assert.deepEqual(districtPlaces([]), []);
    assert.deepEqual(districtPlaces(['ranch']), [], 'and no place in the town');
    assert.deepEqual(districtPlaces(['canal', 'crossing']), [], 'nor do the Channel and the Crossing');
    assert.deepEqual(districtPlaces(['foundry']).map(p => p.id), ['furnace']);
    assert.equal(districtPlaces(['foundry'])[0].district, 'foundry');
});

test('every outlaw has a district: ten of them, one for each', () => {
    assert.equal(DISTRICTS.length, OUTLAWS.length);
    assert.deepEqual(DISTRICTS.map(d => d.outlaw).sort(), OUTLAWS.map(o => o.id).sort());
    assert.deepEqual(DISTRICTS.map(d => d.id).sort(), ['belle', 'canal', 'chapel', 'copper', 'crossing', 'fort', 'foundry', 'ranch', 'tresrios', 'wash']);
});

test('the farm, the Crossing and the Channel are the places so far you step into; the others are ground in the town', () => {
    assert.deepEqual(DISTRICTS.filter(d => d.interior).map(d => d.id).sort(), ['canal', 'crossing', 'ranch']);
    assert.equal(getDistrict('crossing').place, null);
    assert.equal(getDistrict('canal').place, null);
    assert.equal(doorLabel('enter-canal'), "MORGAN'S CHANNEL");
    assert.equal(doorLabel('enter-crossing'), "VANE'S CROSSING");
    assert.equal(getDistrict('ranch').place, null);
    assert.equal(doorLabel('enter-ranch'), 'CALLOWAY FARM');
    assert.equal(districtOf('enter-ranch'), getDistrict('ranch'));
    assert.equal(doorLabel('enter-nope'), '');
});

test('every place has a prompt wording and is found from its id and from its gate', () => {
    for(const d of DISTRICTS) {
        if(d.place) {
            assert.ok(doorLabel(d.place.id).length > 3, `${d.id}: place wording`);
            assert.equal(districtOf(d.place.id), d);
        }
        assert.equal(districtOf(`gate-${d.id}`), d);
        assert.match(doorLabel(`gate-${d.id}`), /SHUT/);
    }
});

test('names read in a sentence', () => {
    assert.equal(placeName(getDistrict('foundry')), 'Foundry Yard');
    assert.equal(placeName(getDistrict('canal')), "Morgan's Channel");
    assert.equal(placeName(getDistrict('belle')), 'The Silver Belle');
    assert.equal(placeName(getDistrict('tresrios')), 'Tres Rios');
});

test('a point is in a district only beyond the town: the shared strip still counts as town', () => {
    const middle = d => [(d.area.minX + d.area.maxX) / 2, (d.area.minZ + d.area.maxZ) / 2];
    assert.equal(districtAt(0, 0), null);
    const ranch = getDistrict('ranch');
    assert.equal(districtAt(ranch.area.maxX - 1, middle(ranch)[1]), null, 'the strip the farm shares with the town');
    for(const id of ['ranch', 'foundry', 'crossing', 'fort', 'copper', 'wash', 'chapel']) assert.equal(districtAt(...middle(getDistrict(id)))?.id, id, `${id}: its middle is its own`);
    assert.equal(districtAt(500, 500), null);
});
