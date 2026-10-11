import test from 'node:test';
import assert from 'node:assert/strict';
import { trayModel } from '../src/elementTray.js';
import { createElements, give } from '../src/stages/section1/elements.js';

test('tray: nothing to show until something is held or hiding', () => {
    assert.equal(trayModel(createElements(), { hidden: false, cooldown: 0, left: 0 }), null);
});

test('tray: two slots with counts and the selected one marked', () => {
    const el = createElements();
    give(el, 'dynamite', 2); give(el, 'whiskey', 1);
    const m = trayModel(el, { hidden: false, cooldown: 0 });
    assert.deepEqual(m.slots.map(s => [s.id, s.count, s.selected]), [['dynamite', 2, true], ['whiskey', 1, false]]);
    assert.equal(m.ready, true);
});

test('tray: the pip counts hidden seconds, then the cooldown', () => {
    const el = createElements();
    assert.equal(trayModel(el, { hidden: true, left: 4.2 }).pip, 'HIDDEN 5s');
    assert.equal(trayModel(el, { hidden: false, cooldown: 2.1 }).pip, 'HIDE READY IN 3s');
    el.cooldown = 0.3;
    give(el, 'dynamite', 1);
    assert.equal(trayModel(el, {}).ready, false);
});
