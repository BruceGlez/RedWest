import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, ARENA_MODES, bossBeaten, arenaRoster, beginTownFight, endTownFight } from '../src/arena.js';
import { OUTLAWS } from '../src/outlaws.js';

const stars = beaten => OUTLAWS.map((_, i) => (beaten.includes(i) ? 7 : 0));
const reset = () => { arena.enabled = false; arena.fromTown = false; arena.outlaw = 0; };

test('boss fights are one of the Arena\'s options, in a list that can grow', () => {
    assert.ok(Array.isArray(ARENA_MODES) && ARENA_MODES.length >= 1);
    assert.ok(ARENA_MODES.some(mode => mode.id === 'bosses' && mode.name === 'BOSS FIGHTS'));
    for(const mode of ARENA_MODES) assert.ok(mode.id && mode.name && mode.blurb);
    assert.equal(new Set(ARENA_MODES.map(m => m.id)).size, ARENA_MODES.length);
});

test('a boss is beaten once the first star is earned, whatever other stars there are', () => {
    assert.equal(bossBeaten({ stars: [1] }, 0), true);
    assert.equal(bossBeaten({ stars: [7] }, 0), true);
    assert.equal(bossBeaten({ stars: [6] }, 0), false, 'the second and third stars without the first do not count');
    assert.equal(bossBeaten({ stars: [0, 3] }, 0), false);
    assert.equal(bossBeaten({ stars: [0, 3] }, 1), true);
    assert.equal(bossBeaten(null, 0), false);
    assert.equal(bossBeaten({}, 4), false);
});

test('the roster lists all ten outlaws in road order, unlocked only as they are beaten', () => {
    const none = arenaRoster({ stars: stars([]) }, OUTLAWS);
    assert.equal(none.length, OUTLAWS.length);
    assert.deepEqual(none.map(r => r.index), OUTLAWS.map((_, i) => i));
    assert.ok(none.every(r => !r.unlocked), 'nothing beaten, nothing unlocked');
    const some = arenaRoster({ stars: stars([0, 1, 4]) }, OUTLAWS);
    assert.deepEqual(some.filter(r => r.unlocked).map(r => r.outlaw.id), ['dusty-pete', 'rattlesnake-rosa', 'iron-jack']);
    assert.ok(arenaRoster({ stars: stars([]) }, OUTLAWS, { unlockAll: true }).every(r => r.unlocked), '?arena=all opens every boss');
});

test('a fight can only be started against a boss that has been beaten, and ends with the run', () => {
    reset();
    assert.equal(beginTownFight(3, { stars: stars([0]) }), false, 'a boss not yet beaten cannot be fought');
    assert.equal(arena.enabled, false, 'and nothing changed');
    assert.equal(beginTownFight(0, { stars: stars([0]) }), true);
    assert.deepEqual([arena.enabled, arena.fromTown, arena.outlaw], [true, true, 0]);
    assert.equal(endTownFight(), true, 'back at the home screen');
    assert.deepEqual([arena.enabled, arena.fromTown], [false, false], 'a town fight is not an Arena run any more');
    assert.equal(endTownFight(), false, 'nothing to end twice');
});

test('opening the game with ?arena is not a town fight, so a finished run does not end it', () => {
    reset();
    arena.enabled = true; // as ?arena does at load
    assert.equal(endTownFight(), false);
    assert.equal(arena.enabled, true);
    reset();
});
