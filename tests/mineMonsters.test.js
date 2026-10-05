import test from 'node:test';
import assert from 'node:assert/strict';
import { MINE_MONSTERS, MINE_LADDER, BASE_ROSTER, monsterDef, isMineMonster, monsterCost, newOn, mineRoster, mineWave, mineHpBonus, nodeBudget, planNode, WAKE_DISTANCE, LEAVE_DISTANCE } from '../src/mineMonsters.js';
import { floorLayout, isOpen } from '../src/mineMap.js';
import { ENEMY_TYPES } from '../src/enemyTypes.js';

// The behaviours src/enemySystem.js knows how to run.
const BEHAVIORS = ['chase', 'shooter', 'zigzag', 'sniper', 'lobber', 'charger', 'rider', 'scattergun', 'knives', 'volley', 'phantom'];

test('every floor below the first brings exactly one new monster, and the ladder never repeats one', () => {
    assert.deepEqual(newOn(1), [], 'the first floor is the Wanted Road\'s three first enemies');
    const seen = new Set(BASE_ROSTER);
    for(let floor = 2; floor <= MINE_LADDER.length; floor++) {
        const fresh = newOn(floor);
        assert.equal(fresh.length, 1, `floor ${floor} brings one new monster`);
        assert.ok(monsterDef(fresh[0]), `${fresh[0]} is a real monster`);
        assert.ok(!seen.has(fresh[0]), `${fresh[0]} is new`);
        seen.add(fresh[0]);
        assert.equal(mineRoster(floor).length, mineRoster(floor - 1).length + 1, `floor ${floor} adds one to the roster`);
    }
    assert.equal(mineRoster(MINE_LADDER.length + 20).length, mineRoster(MINE_LADDER.length).length, 'past the ladder there is nothing left to add');
    assert.deepEqual(newOn(MINE_LADDER.length + 5), []);
});

test('the monsters of the mine are all on the ladder, and the ladder mixes them with the Wanted Road\'s', () => {
    const onLadder = MINE_LADDER.flat();
    for(const id of Object.keys(MINE_MONSTERS)) assert.ok(onLadder.includes(id), `${id} is on the ladder`);
    for(const id of onLadder) assert.ok(ENEMY_TYPES[id] || MINE_MONSTERS[id], `${id} exists`);
    assert.ok(onLadder.some(id => ENEMY_TYPES[id]) && onLadder.some(isMineMonster), 'both kinds');
    assert.ok(isMineMonster('bat') && !isMineMonster('bandit'));
    assert.equal(Object.keys(MINE_MONSTERS).length, 10);
    for(const id of Object.keys(MINE_MONSTERS)) assert.ok(!(id in ENEMY_TYPES), `${id} stays out of the Bounty Book's list`);
    // Strange things come early: one of the mine's own by the second floor, and another within three floors of each.
    assert.ok(isMineMonster(newOn(2)[0]));
});

// The looks src/enemySystem.js can build today (MINE_MESHES and NEW_TYPE_MESHES). A monster without its own model borrows one with `look`.
const LOOKS = ['bat', 'crawler', 'stonekin', 'wraith', 'rattler', 'rifleman', 'dynamiter', 'brute', 'rider', 'duelist', 'ghost', 'knifer', 'trooper'];

test('the monsters below the old ladder arrive one per floor, from their own floor, and borrow a look the game can draw', () => {
    const deep = ['slagadder', 'slaglobber', 'sentry', 'hollowhide', 'choir', 'ghoul'];
    deep.forEach((id, i) => {
        const floor = 15 + i;
        assert.deepEqual(newOn(floor), [id], `${id} is new on floor ${floor}`);
        assert.ok(isMineMonster(id) && !(id in ENEMY_TYPES));
        assert.ok(!mineRoster(floor - 1).includes(id), `${id} is not met before floor ${floor}`);
        assert.ok(mineRoster(floor).includes(id) && mineRoster(30).includes(id));
        const def = MINE_MONSTERS[id];
        assert.ok(LOOKS.includes(def.look), `${id}: look ${def.look} exists`);
        assert.equal(def.behavior, (ENEMY_TYPES[def.look] ?? MINE_MONSTERS[def.look]).behavior, `${id}: behaves as the look it borrows`);
        assert.ok(mineWave(floor).weights[id] > def.weight * 2, `${id} is sent more often on its own floor`);
        assert.equal(Object.values(mineWave(floor - 1).weights).length + 1, Object.values(mineWave(floor).weights).length);
    });
});

test('the deep monsters are priced like the ones whose behaviour they borrow, and every floor can still be filled', () => {
    for(const id of ['slagadder', 'slaglobber', 'sentry', 'hollowhide', 'choir', 'ghoul']) {
        const def = MINE_MONSTERS[id], base = ENEMY_TYPES[def.look] ?? MINE_MONSTERS[def.look];
        assert.ok(def.cost >= base.cost * 0.9 && def.cost <= base.cost * 1.4, `${id}: cost ${def.cost} near ${base.cost}`);
        assert.ok(def.hp >= base.hp && def.hp <= Math.max(base.hp * 1.6, base.hp + 1), `${id}: hp near the original`);
        assert.ok(def.speed <= base.speed * 1.2, `${id}: not much faster than the original`);
    }
    for(const floor of [15, 17, 20, 25]) {
        const layout = floorLayout(floor);
        for(let i = 1; i < layout.nodes.length; i++) {
            const plan = planNode(layout, i, floor, seeded(40 + i));
            assert.ok(plan.length <= 60, `floor ${floor} node ${i}: a sane crowd`);
            if(layout.nodes[i].kind === 'chamber' && layout.spawns.some(([x, z, n]) => n === i && Math.hypot(x, z) >= 20)) assert.ok(plan.length >= 1, `floor ${floor} node ${i}: something lives there`);
        }
    }
});

test('every monster has what the director and the spawner need', () => {
    for(const [id, def] of Object.entries(MINE_MONSTERS)) {
        assert.ok(def.name && def.blurb && def.tip, `${id}: words for the banner`);
        assert.ok(def.cost > 0 && def.weight > 0 && def.cap >= 1 && def.hp >= 1 && def.speed > 0, `${id}: numbers`);
        assert.ok(BEHAVIORS.includes(def.behavior), `${id}: a behaviour the game runs (${def.behavior})`);
        assert.equal(monsterCost(id), def.cost);
    }
    assert.equal(monsterCost('bandit'), ENEMY_TYPES.bandit.cost);
    assert.equal(monsterCost('nope'), 1);
    assert.equal(monsterDef('nope'), null);
});

test('the floors grow more dangerous with depth, and the newest monster comes most', () => {
    let lastCap = 0;
    for(let floor = 1; floor <= 30; floor++) {
        const wave = mineWave(floor);
        assert.ok(wave.threatCap >= lastCap && wave.threatCap <= 110, `floor ${floor}: threat grows and stops at 110`);
        lastCap = wave.threatCap;
        assert.deepEqual(Object.keys(wave.weights).sort(), mineRoster(floor).sort(), `floor ${floor}: a weight for everyone who can appear`);
        for(const id of mineRoster(floor)) assert.ok(wave.weights[id] > 0 && wave.caps[id] >= 1, `floor ${floor}: ${id} can spawn`);
        // The cheapest of them always fits in the room the cave keeps.
        assert.ok(Math.min(...mineRoster(floor).map(monsterCost)) < wave.threatCap);
    }
    assert.ok(mineWave(10).threatCap > mineWave(1).threatCap * 2);
    const fresh = mineWave(2).weights.bat, rattlerLater = mineWave(3).weights.rattler;
    assert.ok(fresh > MINE_MONSTERS.bat.weight * 2, 'the new monster is sent more often on its own floor');
    assert.ok(mineWave(3).weights.bat < fresh, 'and settles down after');
    assert.ok(rattlerLater > ENEMY_TYPES.rattler.weight * 2);
});

test('deep down, anything that takes more than one hit takes more', () => {
    assert.deepEqual([1, 5, 8].map(mineHpBonus), [0, 0, 0]);
    assert.deepEqual([9, 12].map(mineHpBonus), [1, 1]);
    assert.equal(mineHpBonus(13), 2);
    assert.ok(mineHpBonus(100) > mineHpBonus(20));
});

function seeded(seed) { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; }

test('each chamber holds a fixed amount of danger: more when bigger, more when guarded, little by the lift', () => {
    for(const floor of [1, 3, 6]) {
        const layout = floorLayout(floor);
        const budgets = layout.nodes.map((n, i) => nodeBudget(layout, i, floor));
        assert.ok(budgets.every(b => b > 0 && b < 400), `floor ${floor}: sane budgets`);
        const landing = budgets[0] / (layout.nodes[0].r / 30) ** 2;
        const normal = budgets[layout.nodes.findIndex((n, i) => i > 0 && n.kind === 'chamber')] / (layout.nodes.find((n, i) => i > 0 && n.kind === 'chamber').r / 30) ** 2;
        assert.ok(landing < normal * 0.5, `floor ${floor}: the chamber you land in is quiet`);
        const alcove = layout.nodes.findIndex(n => n.kind === 'alcove'), room = layout.nodes.findIndex(n => n.kind === 'room');
        if(alcove >= 0 && room >= 0) assert.ok(budgets[room] / layout.nodes[room].r ** 2 > budgets[alcove] / layout.nodes[alcove].r ** 2, `floor ${floor}: a treasure room is guarded harder than an alcove`);
    }
    assert.ok(nodeBudget(floorLayout(8), 2, 8) > nodeBudget(floorLayout(1), 2, 1), 'deeper chambers hold more');
});

test('a chamber\'s monsters are of the floor\'s kinds, spend about its budget, and stand in its open ground', () => {
    for(const floor of [1, 2, 5, 9]) {
        const layout = floorLayout(floor);
        const roster = new Set(mineRoster(floor));
        const wave = mineWave(floor);
        for(let i = 0; i < layout.nodes.length; i++) {
            const plan = planNode(layout, i, floor, seeded(1000 + i));
            const spent = plan.reduce((sum, m) => sum + monsterCost(m.type), 0);
            assert.ok(spent <= nodeBudget(layout, i, floor) + 1e-9, `floor ${floor} node ${i}: within its budget`);
            assert.ok(plan.length <= 60);
            const counts = {};
            for(const m of plan) {
                assert.ok(roster.has(m.type), `${m.type} is one of floor ${floor}'s kinds`);
                counts[m.type] = (counts[m.type] || 0) + 1;
                assert.ok(isOpen(layout, m.x, m.z, 2), `floor ${floor} node ${i}: in open ground`);
                assert.ok(Math.hypot(m.x, m.z) >= 15, `floor ${floor} node ${i}: never on the lift's doorstep (placed 20 off, scattered by up to 4)`);
            }
            for(const [id, n] of Object.entries(counts)) assert.ok(n <= wave.caps[id], `floor ${floor} node ${i}: no more ${id} than the cap`);
        }
        const main = planNode(layout, 1, floor, seeded(5));
        assert.ok(main.length >= 5, `floor ${floor}: a chamber is a real fight (${main.length})`);
        assert.deepEqual(planNode(layout, 1, floor, seeded(5)), main, 'the same dice make the same chamber');
        assert.notDeepEqual(planNode(layout, 1, floor, seeded(6)), main, 'other dice make another');
    }
    assert.ok(planNode(floorLayout(2), 0, 2, seeded(3)).length < planNode(floorLayout(2), 1, 2, seeded(3)).length, 'the landing has fewer than the next chamber');
    assert.deepEqual(planNode({ nodes: [{ r: 30, kind: 'chamber' }], spawns: [] }, 0, 1), [], 'a chamber with no mouths holds nobody');
});

test('they come when the marshal is near, and go back to sleep only when he is far', () => {
    assert.ok(WAKE_DISTANCE > 20 && WAKE_DISTANCE < LEAVE_DISTANCE, 'a chamber fills well before he is in it and empties only once he is much farther');
    assert.ok(LEAVE_DISTANCE - WAKE_DISTANCE >= 40, 'room to stand at the edge without it flickering');
});
