import test from 'node:test';
import assert from 'node:assert/strict';
import { eventForWeek, eventEndsAt, recordEventScore, EVENT_COSMETICS, TWISTS, TIER_DOLLARS, ALL_COSMETICS_OWNED_DOLLARS } from '../src/events.js';
import { createProfile, normalizeProfile, applyRun, buyItem, weekKey, boardValue, MAX_DOLLARS_PER_RUN } from '../src/profile.js';
import { OUTLAWS } from '../src/outlaws.js';

const NOW = new Date(Date.UTC(2026, 8, 30, 12)); // a Wednesday
const WEEK = weekKey(NOW);

test('the event is the same for everyone in a week and changes between weeks', () => {
    const a = eventForWeek(WEEK);
    assert.deepEqual(eventForWeek(WEEK), a);
    assert.ok(a.outlaw >= 0 && a.outlaw < OUTLAWS.length);
    assert.ok(TWISTS.includes(a.twist));
    assert.deepEqual([...a.targets].sort((x, y) => x - y), a.targets, 'targets rise');
    const weeks = Array.from({ length: 12 }, (_, i) => eventForWeek(`2026-W${String(i + 1).padStart(2, '0')}`));
    assert.ok(new Set(weeks.map(e => `${e.outlaw}:${e.twist.id}`)).size > 4, 'events vary');
});

test('the event ends at the next Monday, midnight UTC', () => {
    assert.equal(eventEndsAt(NOW).toISOString(), '2026-10-05T00:00:00.000Z');
    assert.equal(eventEndsAt(new Date('2026-10-05T00:00:00Z')).toISOString(), '2026-10-12T00:00:00.000Z');
});

test('prizes come from your own best score, once per target, with a collectible at the top', () => {
    const profile = createProfile(NOW);
    const event = { targets: [500, 1200, 2200] };
    assert.deepEqual(recordEventScore(profile, event, 400), []);
    assert.deepEqual(recordEventScore(profile, event, 1300).map(r => r.dollars), [TIER_DOLLARS[0], TIER_DOLLARS[1]]);
    assert.deepEqual(recordEventScore(profile, event, 900), [], 'a worse run changes nothing');
    const top = recordEventScore(profile, event, 5000);
    assert.equal(top[0].item.id, EVENT_COSMETICS[0].id);
    assert.ok(profile.owned.includes(EVENT_COSMETICS[0].id));
    assert.deepEqual(recordEventScore(profile, event, 9999), [], 'each target pays once a week');
    // Collectibles come in order; with all of them owned the top target pays dollars instead.
    profile.owned.push(...EVENT_COSMETICS.map(item => item.id));
    profile.event = { week: 'next', best: 0, tiers: 0 };
    const last = recordEventScore(profile, event, 5000).at(-1);
    assert.equal(last.item, undefined);
    assert.equal(last.dollars, TIER_DOLLARS[2] + ALL_COSMETICS_OWNED_DOLLARS);
});

test('event prizes can never be bought', () => {
    const profile = createProfile(NOW);
    profile.balances = { dollars: 1e9, nuggets: 1e9 };
    for(const item of EVENT_COSMETICS) {
        assert.equal(item.currency, 'dollars');
        assert.throws(() => buyItem(profile, item.id), { code: 'earned' });
    }
});

test('an event run pays its prizes on top of the run cap and skips the Wanted Road records', () => {
    const event = eventForWeek(WEEK);
    const profile = createProfile(NOW);
    const top = event.targets.at(-1);
    const seconds = Math.ceil(top / 90) + 60; // long enough to be a plausible score
    const result = applyRun(profile, { score: top, seconds, outlawIndex: event.outlaw, event: WEEK, bounty: 'banked', kills: {} }, NOW);
    const prizeDollars = TIER_DOLLARS.reduce((a, b) => a + b, 0);
    assert.equal(profile.event.tiers, 3);
    const runDollars = result.lines.filter(line => !line.label.startsWith('Most Wanted')).reduce((sum, line) => sum + (line.dollars || 0), 0);
    assert.equal(result.dollars, Math.min(MAX_DOLLARS_PER_RUN, runDollars) + prizeDollars, 'prizes are not cut by the run cap');
    assert.ok(result.lines.some(line => line.item === EVENT_COSMETICS[0].id));
    assert.equal(profile.stats.stageBest[event.outlaw], 0, 'no stage record');
    assert.equal(profile.stats.weekly.score, 0, 'not on the normal weekly board');
    assert.equal(boardValue(profile, 'event', NOW), top);

    // Last week's event, or the wrong outlaw, is just a normal run.
    const other = createProfile(NOW);
    applyRun(other, { score: top, seconds, outlawIndex: (event.outlaw + 1) % OUTLAWS.length, event: WEEK, kills: {} }, NOW);
    applyRun(other, { score: top, seconds, outlawIndex: event.outlaw, event: '2020-W01', kills: {} }, NOW);
    assert.equal(other.event.tiers, 0);
});

test('event progress resets with the week', () => {
    const profile = createProfile(NOW);
    profile.event = { week: WEEK, best: 900, tiers: 1 };
    assert.equal(normalizeProfile(structuredClone(profile), NOW).event.best, 900);
    const nextWeek = new Date(NOW.getTime() + 7 * 86400000);
    assert.deepEqual(normalizeProfile(structuredClone(profile), nextWeek).event, { week: weekKey(nextWeek), best: 0, tiers: 0, character: '' });
});
