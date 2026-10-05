import test from 'node:test';
import assert from 'node:assert/strict';
import { MINE_MONSTERS, MINE_LADDER, BASE_ROSTER, monsterDef, isMineMonster, monsterCost, newOn, mineRoster, mineWave, mineHpBonus } from '../src/mineMonsters.js';
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
    assert.equal(Object.keys(MINE_MONSTERS).length, 4);
    for(const id of Object.keys(MINE_MONSTERS)) assert.ok(!(id in ENEMY_TYPES), `${id} stays out of the Bounty Book's list`);
    // Strange things come early: one of the mine's own by the second floor, and another within three floors of each.
    assert.ok(isMineMonster(newOn(2)[0]));
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

test('the pursuit grows with depth: more danger, kept topped up faster, and the newest monster comes most', () => {
    let lastCap = 0, lastInterval = Infinity;
    for(let floor = 1; floor <= 30; floor++) {
        const wave = mineWave(floor);
        assert.ok(wave.threatCap >= lastCap && wave.threatCap <= 110, `floor ${floor}: threat grows and stops at 110`);
        assert.ok(wave.interval <= lastInterval && wave.interval >= 0.55, `floor ${floor}: topped up faster, never faster than 0.55 s`);
        lastCap = wave.threatCap;
        lastInterval = wave.interval;
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
