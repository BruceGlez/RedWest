import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderTime } from '../src/reminders.js';

// Local times (reminders follow the player's own clock).
const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute);

test('a reminder comes when the jail is full', () => {
    assert.deepEqual(reminderTime({ fullAt: at(29, 15), now: at(29, 10) }), at(29, 15));
});

test('never at night: late or early reminders move to 9 am', () => {
    assert.deepEqual(reminderTime({ fullAt: at(29, 23, 30), now: at(29, 15) }), at(30, 9));
    assert.deepEqual(reminderTime({ fullAt: at(30, 4), now: at(29, 20) }), at(30, 9));
    assert.deepEqual(reminderTime({ fullAt: at(29, 21), now: at(29, 12) }), at(30, 9));
});

test('at most one a day', () => {
    // The last reminder went out this morning; the jail fills again this afternoon: wait until tomorrow.
    assert.deepEqual(reminderTime({ fullAt: at(29, 16), lastAt: at(29, 9), now: at(29, 12) }), at(30, 9));
    // A planned reminder that was replaced (still in the future) does not count.
    assert.deepEqual(reminderTime({ fullAt: at(29, 16), lastAt: at(29, 18), now: at(29, 12) }), at(29, 16));
});

test('never in the past', () => {
    const now = at(29, 12);
    assert.ok(reminderTime({ fullAt: at(29, 8), now }).getTime() > now.getTime());
});
