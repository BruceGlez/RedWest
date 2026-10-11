import test from 'node:test';
import assert from 'node:assert/strict';
import { HIDE, createHidingState, stepHiding, speedScale, isHidden, resetHiding } from '../src/stages/section1/hiding.js';
import { buildInteractables, nearestInteractable, promptFor, LORE, MIN_REACH } from '../src/stages/section1/interactables.js';

const spot = { id: 'H1' };

test('E inside a hiding place hides the marshal and slows him', () => {
    const s = createHidingState();
    stepHiding(s, 0.016, { here: spot, pressed: true });
    assert.equal(isHidden(s), true);
    assert.equal(s.hideId, 'H1');
    assert.equal(speedScale(s), HIDE.SLOW);
    assert.equal(speedScale(createHidingState()), 1);
});

test('E outside a hiding place does nothing', () => {
    const s = createHidingState();
    stepHiding(s, 0.016, { here: null, pressed: true });
    assert.equal(isHidden(s), false);
});

test('hiding ends after MAX_SECONDS and then waits COOLDOWN', () => {
    const s = createHidingState();
    stepHiding(s, 0.1, { here: spot, pressed: true });
    for(let t = 0; t < HIDE.MAX_SECONDS + 0.5 && isHidden(s); t += 0.1) stepHiding(s, 0.1, { here: spot });
    assert.equal(isHidden(s), false);
    assert.equal(s.reason, 'time');
    stepHiding(s, 0.1, { here: spot, pressed: true });
    assert.equal(isHidden(s), false, 'cooldown blocks hiding again');
    stepHiding(s, HIDE.COOLDOWN, { here: spot });
    stepHiding(s, 0.1, { here: spot, pressed: true });
    assert.equal(isHidden(s), true);
});

test('leaving, firing and pressing E again all reveal him', () => {
    for(const [input, reason] of [[{ here: null }, 'left'], [{ here: spot, fired: true }, 'fired'], [{ here: spot, pressed: true }, 'toggle']]) {
        const s = createHidingState();
        stepHiding(s, 0.1, { here: spot, pressed: true });
        stepHiding(s, 0.1, input);
        assert.equal(isHidden(s), false);
        assert.equal(s.reason, reason);
    }
});

test('firing from hiding adds a short cooldown; reset clears it', () => {
    const s = createHidingState();
    stepHiding(s, 0.1, { here: spot, pressed: true });
    stepHiding(s, 0.1, { here: spot, fired: true });
    assert.ok(s.cooldown > 0);
    resetHiding(s);
    assert.equal(s.cooldown, 0);
});

const markers = [
    { id: 'D1', type: 'door', x: 0, z: 0, radius: 2 },
    { id: 'H1', type: 'hide', x: 3, z: 0, radius: 8 },
    { id: 'L1', type: 'lever', x: 100, z: 0, radius: 10 },
    { id: 'X', type: 'spawn', x: 0, z: 0, radius: 5 }
];

test('only usable marker types become interactables, with a minimum reach', () => {
    const list = buildInteractables(markers);
    assert.deepEqual(list.map(i => i.id), ['D1', 'H1', 'L1']);
    assert.equal(list[0].r, MIN_REACH);
});

test('the nearest in reach wins, a door beats a hiding place beside it', () => {
    const list = buildInteractables(markers);
    assert.equal(nearestInteractable(list, 1, 0).id, 'D1');
    assert.equal(nearestInteractable(list, 8, 0).id, 'H1');
    assert.equal(nearestInteractable(list, 50, 0), null);
    assert.equal(nearestInteractable(list, 1, 0, ['hide']).id, 'H1');
});

test('prompts follow the state', () => {
    const list = buildInteractables(markers);
    assert.equal(promptFor(list[0], { doors: {} }), 'E: OPEN DOOR');
    assert.equal(promptFor(list[0], { doors: { D1: { open: true } } }), 'E: CLOSE DOOR');
    assert.equal(promptFor(list[2], { leverPulled: true }), 'LEVER PULLED');
    assert.equal(promptFor(list[1], { hiding: { hidden: true, hideId: 'H1' } }), 'HIDDEN (E: STEP OUT)');
    assert.equal(promptFor(null), null);
});

test('lore cards fit the dialogue box', () => {
    for(const [id, card] of Object.entries(LORE)) for(const line of card.lines) assert.ok(line.length <= 200, id);
});

import { createSection1Runtime } from '../src/stages/section1/runtime.js';
import { createDialogue } from '../src/dialogue.js';

test('runtime: E at a door toggles it, the lever pulls once, lore opens the dialogue and E advances it', () => {
    const rt = createSection1Runtime([
        { id: 'D1', type: 'door', x: 0, z: 0, radius: 2 },
        { id: 'LV', type: 'lever', x: 100, z: 0, radius: 6 },
        { id: 'N1', type: 'lore', x: 200, z: 0, radius: 6 }
    ]);
    const dlg = createDialogue();
    const at = (x, pressed = false) => rt.step({ x, z: 0, dt: 0.016, pressed, dialogue: dlg });
    assert.equal(at(1).prompt, 'E: OPEN DOOR');
    at(1, true);
    assert.equal(rt.state.doors.D1.open, true);
    at(1, true);
    assert.equal(rt.state.doors.D1.open, false);
    at(100, true); at(100, true);
    assert.equal(rt.state.leverPulled, true);
    assert.equal(at(100).prompt, 'LEVER PULLED');
    at(200, true);                       // N1 has no card of its own: nothing opens
    assert.equal(dlg.isOpen(), false);
    rt.reset();
    assert.equal(rt.state.leverPulled, false);
});

test('runtime: hiding slows the marshal and a press with a door in reach opens the door instead', () => {
    const rt = createSection1Runtime([
        { id: 'H1', type: 'hide', x: 0, z: 0, radius: 8 },
        { id: 'D1', type: 'door', x: 40, z: 0, radius: 2 }
    ]);
    let r = rt.step({ x: 0, z: 0, dt: 0.016, pressed: true });
    assert.equal(r.speedMult, HIDE.SLOW);
    r = rt.step({ x: 0, z: 0, dt: 0.016, pressed: false, fired: true });
    assert.equal(r.speedMult, 1);
    assert.equal(r.revealed, true);
});

import { createAwareness, stepAwareness, dueMembers, alarmNear, GUARD, losesTrack } from '../src/stages/section1/guards.js';

const grp = (id, x = 0) => ({ id, x, z: 0, radius: 30, enemies: [{}, {}, {}] });

test('guards: sight makes a group suspicious, then alerted; leaving calms it', () => {
    const g = grp('a1-claims-guards'), a = createAwareness(g);
    assert.equal(stepAwareness(a, g, 0.1, { dist: 100 }), null);
    assert.equal(stepAwareness(a, g, 0.1, { dist: 20 }), 'suspicious');
    let ev = null;
    for(let t = 0; t < GUARD.SUSPICIOUS_SECONDS + 0.2 && ev !== 'alerted'; t += 0.1) ev = stepAwareness(a, g, 0.1, { dist: 20 });
    assert.equal(ev, 'alerted');
    const b = createAwareness(g);
    stepAwareness(b, g, 0.1, { dist: 20 });
    let calmed = null;
    for(let t = 0; t < 4 && !calmed; t += 0.1) calmed = stepAwareness(b, g, 0.1, { dist: 90 });
    assert.equal(calmed, 'calmed');
});

test('guards: a hidden marshal is not seen, a shot is heard, and the alarm speeds up neighbours', () => {
    const g = grp('a1-claims-guards'), a = createAwareness(g);
    for(let i = 0; i < 100; i++) stepAwareness(a, g, 0.1, { dist: 5, hidden: true });
    assert.equal(a.state, 'idle');
    assert.equal(stepAwareness(a, g, 0.1, { dist: 40, hidden: true, shot: true }), 'alerted');
    assert.equal(a.alarm, true);
    const n = grp('a1-flume-ambush', 100), b = createAwareness(n);
    assert.equal(alarmNear([a], [g, n], n), true);
    assert.equal(stepAwareness(b, n, 0.1, { dist: 50, alarmNear: true }), 'suspicious');
});

test('guards: the flank comes later, and hiding long enough loses them', () => {
    const g = grp('a1-flume-ambush'), a = createAwareness(g);
    assert.deepEqual(dueMembers(a, g), []);
    stepAwareness(a, g, 0.1, { dist: 10, shot: true });
    assert.deepEqual(dueMembers(a, g), [0, 1]);
    stepAwareness(a, g, GUARD.FLANK_DELAY + 0.1, {});
    assert.deepEqual(dueMembers(a, g), [0, 1, 2]);
    assert.equal(losesTrack(2.9), false);
    assert.equal(losesTrack(3), true);
});
