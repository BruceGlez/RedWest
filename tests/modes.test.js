import test from 'node:test';
import assert from 'node:assert/strict';
import { registerMode, activeMode, registeredModes, clearModes, resetModes } from '../src/modes/registry.js';
import { arenaMode } from '../src/modes/arena.js';
import { arena } from '../src/arena.js';

test('with nothing registered the Wanted Road is the active mode', () => {
    clearModes();
    const mode = activeMode();
    assert.equal(mode.id, 'road');
    assert.equal(mode.hud.waveLabel, 'PURSUIT:');
    assert.equal(mode.hud.wave({ waveNumber: 3 }), 3);
    assert.equal(mode.hud.wave({ waveNumber: 99 }), 'BONUS');
    assert.equal(mode.practice, null);
    assert.equal(mode.usesEvent, true);
});

test('a registered mode wins while active and falls back to road defaults for missing hooks', () => {
    clearModes();
    let on = false;
    registerMode({ id: 'test', isActive: () => on, hud: { waveLabel: 'DEPTH:' }, practice: { note: 'x' } });
    assert.equal(activeMode().id, 'road');
    on = true;
    const mode = activeMode();
    assert.equal(mode.id, 'test');
    assert.equal(mode.hud.waveLabel, 'DEPTH:');
    assert.equal(typeof mode.hud.wave, 'function', 'hud.wave comes from the road');
    assert.equal(mode.begin !== undefined && mode.update !== undefined, true);
    assert.deepEqual(mode.practice, { note: 'x' });
    clearModes();
});

test('the latest registered active mode wins, and ids must be unique and valid', () => {
    clearModes();
    registerMode({ id: 'a', isActive: () => true });
    registerMode({ id: 'b', isActive: () => true });
    assert.equal(activeMode().id, 'b');
    assert.deepEqual(registeredModes().map(m => m.id), ['road', 'a', 'b']);
    assert.throws(() => registerMode({ id: 'a', isActive: () => true }), /already registered/);
    assert.throws(() => registerMode({ id: 'c' }), /needs an id/);
    clearModes();
});

test('resetModes calls every mode\'s reset', () => {
    clearModes();
    const seen = [];
    registerMode({ id: 'a', isActive: () => false, reset: () => seen.push('a') });
    registerMode({ id: 'b', isActive: () => false, reset: () => seen.push('b') });
    resetModes();
    assert.deepEqual(seen.sort(), ['a', 'b']);
    clearModes();
});

test('the arena mode: practice, no event, straight to the outlaw, gang optional, can be made invincible', () => {
    clearModes();
    registerMode(arenaMode);
    const saved = { ...arena };
    try {
        assert.equal(activeMode().id, 'road');
        arena.enabled = true; arena.outlaw = 4; arena.gang = false; arena.invincible = true;
        const mode = activeMode();
        assert.equal(mode.id, 'arena');
        assert.ok(mode.practice);
        assert.equal(mode.usesEvent, false);
        assert.equal(mode.runOutlaw({ event: { outlaw: 1 }, progress: { selected: 2 } }), 4);
        assert.equal(mode.reinforcements(), false);
        assert.equal(mode.invincible(), true);
        const calls = [];
        mode.begin({ beginWave: n => calls.push(['wave', n]) });
        mode.afterOutlawDown({ finishRun: r => calls.push(['finish', r]) });
        assert.deepEqual(calls[1], ['finish', 'arena-win']);
        assert.equal(calls[0][0], 'wave');
        assert.ok(calls[0][1] > 1);
    } finally {
        Object.assign(arena, saved);
        clearModes();
    }
});

test('the Wanted Road starts a run at pursuit 1 and opens the bounty choice when the outlaw falls', () => {
    clearModes();
    const mode = activeMode();
    const calls = [];
    const ctx = { beginWave: n => calls.push(['wave', n]), openBountyChoice: () => calls.push(['choice']), updateWaveFlow: dt => calls.push(['flow', dt]) };
    mode.begin(ctx); mode.afterOutlawDown(ctx); mode.update(ctx, 0.5);
    assert.deepEqual(calls, [['wave', 1], ['choice'], ['flow', 0.5]]);
    assert.equal(mode.runOutlaw({ event: { outlaw: 7 }, progress: { selected: 2 } }), 7);
    assert.equal(mode.runOutlaw({ event: null, progress: { selected: 2 } }), 2);
});
