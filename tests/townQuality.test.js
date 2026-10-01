import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, QUALITY, CHOICES, nextChoice, createGovernor, loadQuality, saveQuality, startLevel, GRACE_SECONDS, SLOW_SECONDS, HITCH } from '../src/townQuality.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
// Feed a governor `seconds` of frames at `fps`; returns the levels it stepped down to, in order.
const feed = (governor, seconds, fps) => {
    const steps = [];
    for(let t = 0; t < seconds; t += 1 / fps) {
        const stepped = governor.observe(1 / fps);
        if(stepped) steps.push(stepped);
    }
    return steps;
};

test('three levels, from the full look to shading only', () => {
    assert.deepEqual(LEVELS, ['high', 'medium', 'low']);
    assert.equal(QUALITY.high.post && QUALITY.medium.post, true);
    assert.equal(QUALITY.low.post, false, 'low has no post-processing at all');
    assert.ok(QUALITY.medium.bloomScale < QUALITY.high.bloomScale, 'medium bloom is cheaper');
    assert.ok(QUALITY.medium.samples < QUALITY.high.samples);
    assert.ok(QUALITY.medium.pixelRatioCap < Infinity);
});

test('the button goes round auto, high, medium, low and back', () => {
    assert.deepEqual(CHOICES, ['auto', 'high', 'medium', 'low']);
    let choice = 'auto';
    const seen = [];
    for(let i = 0; i < 5; i++) { choice = nextChoice(choice); seen.push(choice); }
    assert.deepEqual(seen, ['high', 'medium', 'low', 'auto', 'high']);
    assert.equal(nextChoice('nonsense'), 'auto');
});

test('a device that holds a good frame rate stays where it is', () => {
    const governor = createGovernor();
    assert.deepEqual(feed(governor, 60, 60), []);
    assert.deepEqual(feed(governor, 60, 45), [], '45 frames a second is fine');
    assert.equal(governor.level, 'high');
});

test('a slow device steps down a level at a time, never below low, and each level gets its own grace', () => {
    const governor = createGovernor();
    const steps = feed(governor, 40, 20);
    assert.deepEqual(steps, ['medium', 'low']);
    assert.equal(governor.level, 'low');
    assert.deepEqual(feed(governor, 20, 5), [], 'nothing under low');
    // The first step cannot come before the grace and the slow time are used up.
    const fresh = createGovernor();
    assert.deepEqual(feed(fresh, GRACE_SECONDS + SLOW_SECONDS - 0.5, 20), []);
});

test('a short slow spell is forgiven, and a hitch or a tab switch is not slowness', () => {
    const governor = createGovernor();
    feed(governor, 3, 60);
    assert.deepEqual(feed(governor, 1, 15), [], 'a second of slow frames is not two');
    feed(governor, 5, 60);
    assert.deepEqual(feed(governor, 1, 15), []);
    for(let i = 0; i < 20; i++) assert.equal(governor.observe(HITCH + 1), null, 'a very long frame is ignored');
    assert.equal(governor.level, 'high');
});

test('the start of a level is not judged: the first slow frames are shader compiles', () => {
    const governor = createGovernor();
    assert.deepEqual(feed(governor, GRACE_SECONDS - 0.2, 8), []);
});

test('by hand it never steps down by itself, and setting a level starts the watch again', () => {
    const governor = createGovernor({ level: 'medium', auto: false });
    assert.deepEqual(feed(governor, 60, 10), []);
    assert.equal(governor.level, 'medium');
    governor.auto = true;
    governor.set('high');
    assert.equal(governor.level, 'high');
    assert.deepEqual(feed(governor, 20, 10), ['medium', 'low']);
    governor.set('rubbish');
    assert.equal(governor.level, 'high');
});

test('the choice and the best level the device managed are remembered, and junk is ignored', () => {
    const storage = memory();
    assert.deepEqual(loadQuality(storage), { choice: 'auto', floor: 'high' });
    saveQuality({ choice: 'auto', floor: 'medium' }, storage);
    assert.deepEqual(loadQuality(storage), { choice: 'auto', floor: 'medium' });
    saveQuality({ choice: 'low', floor: 'high' }, storage);
    assert.deepEqual(loadQuality(storage), { choice: 'low', floor: 'high' });
    assert.deepEqual(loadQuality({ getItem: () => '{"choice":"ultra","floor":"x"}' }), { choice: 'auto', floor: 'high' });
    assert.deepEqual(loadQuality({ getItem: () => '{nope' }), { choice: 'auto', floor: 'high' });
    assert.deepEqual(loadQuality(null), { choice: 'auto', floor: 'high' });
    assert.doesNotThrow(() => saveQuality({ choice: 'auto', floor: 'high' }, { setItem() { throw new Error('private mode'); } }));
});

test('auto starts from the remembered floor; a hand-picked level stays; the URL wins for a page load', () => {
    assert.deepEqual(startLevel({ choice: 'auto', floor: 'medium' }), { choice: 'auto', level: 'medium', auto: true });
    assert.deepEqual(startLevel({ choice: 'low', floor: 'high' }), { choice: 'low', level: 'low', auto: false });
    assert.deepEqual(startLevel({ choice: 'low', floor: 'high' }, 'high'), { choice: 'high', level: 'high', auto: false });
    assert.deepEqual(startLevel({ choice: 'high', floor: 'medium' }, 'auto'), { choice: 'auto', level: 'medium', auto: true });
    assert.deepEqual(startLevel({ choice: 'auto', floor: 'high' }, 'ultra'), { choice: 'auto', level: 'high', auto: true }, 'unknown URL values are ignored');
});
