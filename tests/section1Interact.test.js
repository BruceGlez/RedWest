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

import { ELEMENTS, createElements, give, cycle, throwSelected, step as stepEl, slowAt, comboHint, holding, inFire } from '../src/stages/section1/elements.js';
import { createBreakables, shoot, blastAt, step as stepBr, takeStack, BREAK } from '../src/stages/section1/breakables.js';

const run = (fn, seconds, dt = 0.1) => { const out = []; for(let t = 0; t < seconds; t += dt) out.push(...fn(dt)); return out; };

test('elements: two slots with limits, swap, and found-only', () => {
    const el = createElements();
    assert.equal(give(el, 'dynamite', 5), 2);
    assert.equal(give(el, 'dynamite', 1), 0);
    assert.equal(give(el, 'whiskey', 1), 1);
    assert.deepEqual(holding(el), ['dynamite', 'whiskey']);
    assert.equal(cycle(el), 'whiskey');
});

test('elements: dynamite blasts after its fuse for 2 damage in 24 units', () => {
    const el = createElements();
    give(el, 'dynamite', 1);
    const t = throwSelected(el, 0, 0, 0, 1);
    assert.equal(t.ok, true);
    assert.equal(t.z, ELEMENTS.THROW_RANGE);
    assert.equal(el.slots.dynamite, 0);
    assert.equal(throwSelected(el, 0, 0, 0, 1).ok, false, 'nothing left');
    const ev = run(d => stepEl(el, d), 1.0);
    assert.equal(ev.length, 0, 'still fusing');
    const blast = run(d => stepEl(el, d), 1).find(e => e.kind === 'blast');
    assert.deepEqual([blast.radius, blast.damage], [24, 2]);
});

test('elements: whiskey leaves a slowing puddle for 12 s', () => {
    const el = createElements();
    give(el, 'whiskey', 1);
    const t = throwSelected(el, 0, 0, 1, 0);
    assert.equal(slowAt(el, t.x, t.z), 0.6);
    assert.equal(slowAt(el, t.x + 100, t.z), 1);
    run(d => stepEl(el, d), 12.5);
    assert.equal(slowAt(el, t.x, t.z), 1);
});

test('elements: dynamite into a whiskey puddle makes a 28 unit fire pool that burns 1 a second for 6 s', () => {
    const el = createElements();
    give(el, 'whiskey', 1); give(el, 'dynamite', 1);
    assert.equal(comboHint(el), 'WHISKEY AND DYNAMITE MAKE A FIRE POOL');
    assert.equal(comboHint(el), null, 'only once');
    const w = throwSelected(el, 0, 0, 0, 1);
    el.cooldown = 0;
    cycle(el);
    throwSelected(el, 0, 0, 0, 1);
    const ev = run(d => stepEl(el, d), 2);
    assert.ok(ev.some(e => e.kind === 'combo'));
    assert.equal(inFire(el, w.x, w.z + 20), true);
    const burns = run(d => stepEl(el, d), 6.5).filter(e => e.kind === 'burn');
    assert.ok(burns.length >= 5 && burns.length <= 6, `${burns.length} ticks`);
    assert.equal(burns[0].damage, 1);
    assert.equal(inFire(el, w.x, w.z), false, 'it burns out');
});

const mk = [
    { id: 'I23', type: 'breakable', x: 0, z: 0, radius: 4 },
    { id: 'I23b', type: 'breakable', x: 10, z: 0, radius: 4 },
    { id: 'I14_1', type: 'breakable', x: 200, z: 0, radius: 5 },
    { id: 'DYNAMITE', type: 'hazard', x: 400, z: 0, radius: 9 }
];

test('breakables: a shot blows a whiskey barrel, which gives whiskey and chains to the next barrel', () => {
    const b = createBreakables(mk);
    assert.deepEqual(shoot(b, 100, 100), []);
    const first = shoot(b, 0.5, 0, { x: 5, z: 0 });
    assert.ok(first.some(e => e.kind === 'blast' && e.radius === BREAK.BARREL_RADIUS && e.damage === 1));
    assert.ok(first.some(e => e.kind === 'puddle'));
    assert.ok(first.some(e => e.kind === 'give' && e.element === 'whiskey'));
    const later = run(d => stepBr(b, d), 1);
    assert.ok(later.some(e => e.kind === 'break' && e.id === 'I23b'), 'the second barrel went 0.6 s later');
});

test('breakables: no whiskey is given from out of reach, and a fence breaks quietly', () => {
    const b = createBreakables(mk);
    assert.ok(!shoot(b, 0, 0, { x: 100, z: 0 }).some(e => e.kind === 'give'));
    const f = shoot(b, 200, 0);
    assert.deepEqual(f.map(e => e.kind), ['break']);
});

test('breakables: a chain stops after 3 barrels', () => {
    const row = [0, 1, 2, 3, 4, 5].map(i => ({ id: `I23${'abcdef'[i]}`, type: 'breakable', x: i * 10, z: 0, radius: 4 }));
    const b = createBreakables(row);
    shoot(b, 0, 0);
    run(d => stepBr(b, d), 10);
    assert.equal(b.items.filter(i => i.broken).length, 1 + BREAK.CHAIN_MAX);
});

test('breakables: the dynamite stack can be taken once, then it cannot blow; a shot at a full stack blows 2 damage in 24', () => {
    const b = createBreakables(mk);
    assert.equal(takeStack(b), 2);
    assert.equal(takeStack(b), 0);
    assert.deepEqual(shoot(b, 400, 0), []);
    const c = createBreakables(mk);
    const ev = shoot(c, 400, 0);
    const blast = ev.find(e => e.kind === 'blast');
    assert.deepEqual([blast.radius, blast.damage], [24, 2]);
});

test('breakables: a dynamite blast sets off barrels inside it', () => {
    const b = createBreakables(mk);
    blastAt(b, 5, 0, 24, 'dynamite');
    const ev = run(d => stepBr(b, d), 2);
    assert.equal(ev.filter(e => e.kind === 'break').length, 2);
});

test('runtime: E at the stack gives dynamite, F throws, V swaps', () => {
    const rt = createSection1Runtime([{ id: 'DYNAMITE', type: 'hazard', x: 0, z: 0, radius: 9 }]);
    assert.equal(rt.step({ x: 0, z: 0, dt: 0.1 }).prompt, 'E: TAKE DYNAMITE');
    rt.step({ x: 0, z: 0, dt: 0.1, pressed: true });
    assert.equal(rt.elements.slots.dynamite, 2);
    assert.equal(rt.step({ x: 0, z: 0, dt: 0.1 }).prompt, null);
    const ev = rt.tick({ dt: 0.1, x: 0, z: 0, throwPressed: true, facing: { x: 0, z: 1 } });
    assert.ok(ev.some(e => e.kind === 'throw'));
    assert.equal(rt.elements.slots.dynamite, 1);
    assert.match(rt.summary(), /DYNAMITE 1/);
});

import * as cc from '../src/stages/chaseCamera.js';
const { CHASE } = cc;

test('chase camera: W walks where the camera looks, whatever the orbit', () => {
    const c = cc.setChase(true, { enabled: false, yaw: 0, height: 0, idle: 0 });
    let w = cc.rotateToWorld(0, -1, c);
    assert.ok(Math.abs(w.x) < 1e-9 && Math.abs(w.z + 1) < 1e-9, 'at yaw 0 W is north, as the old camera');
    c.yaw = Math.PI / 2;                              // camera swung to the east side, looking west
    const off = cc.chaseOffset(c), fwd = cc.chaseForward(c);
    assert.ok(off.x > 20 && Math.abs(off.z) < 1e-6);
    w = cc.rotateToWorld(0, -1, c);
    assert.ok(Math.abs(w.x - fwd.x) < 1e-9 && Math.abs(w.z - fwd.z) < 1e-9, 'W is the camera forward');
    c.enabled = false;
    assert.deepEqual(cc.rotateToWorld(3, 4, c), { x: 3, z: 4 }, 'off: nothing turns');
});

test('chase camera: Z and X swing it, a drag lifts it within limits, sideways walking follows after a pause', () => {
    const c = cc.setChase(true, { enabled: false, yaw: 0, height: 0, idle: 0 });
    cc.stepChase(c, 0.5, { orbit: 1 });
    assert.ok(c.yaw > 0.9);
    const yaw = c.yaw;
    cc.stepChase(c, 0.1, { lateral: 1 });
    assert.equal(c.yaw, yaw, 'no recentring right after manual input');
    for(let i = 0; i < 20; i++) cc.stepChase(c, 0.1, { lateral: 1 });
    assert.ok(c.yaw > yaw, 'then it follows him round');
    cc.stepChase(c, 0.1, { dragY: 100000 });
    assert.equal(c.height, CHASE.HEIGHT_MAX);
    cc.stepChase(c, 0.1, { dragY: -100000 });
    assert.equal(c.height, CHASE.HEIGHT_MIN);
});
