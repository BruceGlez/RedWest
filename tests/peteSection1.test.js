import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSection1Area, createCollisionWalk, SECTION1_SCALE, SECTION1_ROAD, SECTION1_PLACES, section1PointAt } from '../src/stages/peteSection1.js';

const read = name => JSON.parse(readFileSync(new URL(`../public/models/pete-area1/${name}`, import.meta.url), 'utf8'));
const collision = read('pete_section1_collision.json');
const { markers } = read('pete_section1_markers.json');
const area = createSection1Area({ collision, markers });
const walk = area.createWalk();

test('the export is at game scale: 3 times the art, so the 6-unit marshal fits', () => {
    assert.equal(SECTION1_SCALE, 3);
    assert.equal(collision.scale, 3);
    assert.equal(collision.cell, 3);
    assert.ok(SECTION1_ROAD.length > 1200 && SECTION1_ROAD.length < 1400, `Section 1 road is ${SECTION1_ROAD.length.toFixed(0)} units`);
});

test('the walkable ground: open on the road, closed in the rock and the gully, open on the bridge deck', () => {
    for(const d of [10, 60, 140, 220, 300, 350, 372, 395, 410, 424]) {
        const p = section1PointAt(d);
        assert.equal(walk(p.x, p.z), true, `road centre at ${d} m is walkable`);
    }
    const bridge = section1PointAt(395, 0);
    const beside = section1PointAt(395, 14);       // in the gully, past the deck's 5.5 m half width
    assert.equal(walk(bridge.x, bridge.z), true);
    assert.equal(walk(beside.x, beside.z), false);
    const rock = section1PointAt(100, 80);          // the terrace wall far to the north
    assert.equal(walk(rock.x, rock.z), false);
    assert.equal(walk(0, 0), false, 'the far side of the map is rock');
});

test('buildings block, and a doorway lets you in', () => {
    const shacks = markers.filter(m => m.id === 'H03' || m.id === 'I15');
    assert.equal(shacks.length, 2);
    for(const m of shacks) assert.equal(walk(m.x, m.z), true, `${m.id} (${m.x}, ${m.z}) is reachable`);
    // a shack body is solid: the marker of slot S1 (the shack centre) is inside a wall box
    const slot = markers.find(m => m.id === 'SLOT_S1');
    assert.equal(walk(slot.x, slot.z), false, 'shack 1 is solid');
});

test('everything Section 1 puts in the world stands where somebody can reach it', () => {
    const stand = (name, o) => assert.ok(walk(o.x, o.z), `${name} at ${o.x.toFixed(1)}, ${o.z.toFixed(1)} is on walkable ground`);
    for(const o of [...area.campfires, ...area.crates, ...area.pots, ...area.bandits]) stand(o.id, o);
    for(const g of area.encounters) {
        stand(g.id, g);
        g.enemies.forEach((e, i) => stand(`${g.id}#${i}`, { x: g.x + e.dx, z: g.z + e.dz }));
    }
    for(const p of area.places) stand(p.id, p);
    stand('start', area.start);
    stand('exit', area.exit);
});

test('every hiding place and interactable can be reached: some walkable ground lies inside its radius', () => {
    // ladders (type climb) stand against the rock wall: the game reaches them from the open side, so they are left out here
    const wanted = new Set(['hide', 'loot', 'door', 'lever', 'lore', 'vantage', 'campfire', 'breakable', 'hazard']);
    const reachable = m => {
        if(walk(m.x, m.z)) return true;
        for(const f of [0.3, 0.55, 0.8, 1.0]) for(let a = 0; a < 16; a++) {
            if(walk(m.x + Math.cos(a * Math.PI / 8) * m.radius * f, m.z + Math.sin(a * Math.PI / 8) * m.radius * f)) return true;
        }
        return false;
    };
    const bad = markers.filter(m => wanted.has(m.type) && !reachable(m)).map(m => `${m.id} (${m.type}) at ${m.x}, ${m.z}, radius ${m.radius}`);
    assert.deepEqual(bad, [], 'markers must have ground to stand on inside their radius');
    // the ones the player stands ON are on the ground itself
    for(const id of ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10', 'H11', 'H12', 'H13', 'I15', 'I01', 'I26']) {
        const m = markers.find(x => x.id === id);
        assert.ok(m, `${id} exists`);
        assert.equal(walk(m.x, m.z), true, `${id} is standable (${m.x}, ${m.z})`);
    }
});

test('the area has the shape the run mode reads', () => {
    for(const key of ['id', 'name', 'mapSize', 'groundSize', 'start', 'createWalk', 'campfires', 'crates', 'pots', 'bandits', 'clues', 'encounters', 'places', 'story', 'zoneAt', 'progressAt', 'headingAt', 'exit', 'objective']) {
        assert.ok(area[key] !== undefined, `area.${key} exists`);
    }
    assert.equal(area.encounters.length, 2);
    assert.equal(area.encounters[0].id, 'a1-claims-guards');
    assert.ok(area.encounters[0].radius > 90, 'wake radius is scaled by 3');
    assert.ok(area.encounters[0].progress < area.encounters[1].progress, 'the Claims come before the bridge');
    assert.deepEqual(area.zoneAt(area.start.x, area.start.z).id, 'trailhead');
    const claims = SECTION1_PLACES.find(p => p.id === 'claims');
    assert.equal(area.zoneAt(claims.x, claims.z).id, 'claims');
    assert.ok(area.progressAt(area.exit.x, area.exit.z) > 0.95, 'the exit is at the end of the road');
    assert.ok(area.sceneParts() === null, 'no scene injected yet: the scene comes from the art loader');
});

test('the layout items keep their ids and are multiplied by the scale', () => {
    assert.ok(area.crates.some(c => c.id === 'a1-secret-1a'));
    assert.ok(area.pots.some(p => p.id === 'a1-pot-s1'));
    assert.ok(area.campfires.some(c => c.id === 'a1-headframe'), 'the second campfire comes from marker I26');
    assert.ok(Math.abs(area.crates.find(c => c.id === 'a1-crate-1').x) > 300, 'crate positions are in game units, not art metres');
    for(const m of markers) assert.ok(Math.abs(m.x) < 1000 && Math.abs(m.z) < 1000, `${m.id} is inside the map size`);
});

test('createCollisionWalk blocks outside the grid', () => {
    const w = createCollisionWalk(collision);
    assert.equal(w(1e6, 1e6), false);
    assert.equal(w(-1e6, -1e6), false);
});
