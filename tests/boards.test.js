import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, normalizeProfile, applyRun, rankBoard, weekKey } from '../src/profile.js';
import { eventForWeek, eventTitle, EVENT_TITLES } from '../src/events.js';

// Leaderboard extras: each best run remembers who played it, and the MOST WANTED board gives top ranks a title.
const NOW = new Date(Date.UTC(2026, 8, 30, 12));
const WEEK = weekKey(NOW);
const run = (score, extra = {}) => ({ score, seconds: 200, outlawIndex: 0, bounty: 'banked', heatAtOutlaw: 2, kills: {}, ...extra });

test('a best run records the character the server had equipped, and only a better run replaces it', () => {
    const profile = createProfile(NOW);
    profile.name = 'ANNIE';
    profile.loadout.character = 'char-drifter';
    applyRun(profile, run(900), NOW);
    assert.equal(profile.stats.weekly.character, 'char-drifter');
    assert.equal(profile.stats.stageChar[0], 'char-drifter');

    profile.loadout.character = 'char-marshal';
    applyRun(profile, run(500, { character: 'char-dusty-pete' }), NOW); // what the client claims is ignored
    assert.equal(profile.stats.weekly.character, 'char-drifter', 'a worse run keeps the record and its character');
    applyRun(profile, run(1500), NOW);
    assert.equal(profile.stats.weekly.character, 'char-marshal');
    assert.equal(profile.stats.stageChar[0], 'char-marshal');

    const board = rankBoard([{ id: 'a', profile }], 'weekly', 'a', 50, NOW);
    assert.equal(board.entries[0].character, 'char-marshal');
    assert.equal(rankBoard([{ id: 'a', profile }], 'stage-0', null, 50, NOW).entries[0].character, 'char-marshal');
    assert.equal(rankBoard([{ id: 'a', profile }], 'stars', null, 50, NOW).entries[0].character, '', 'stars are not one run');

    // Saved and loaded again; unknown ids are dropped.
    const again = normalizeProfile(structuredClone(profile), NOW);
    assert.equal(again.stats.weekly.character, 'char-marshal');
    assert.equal(normalizeProfile({ stats: { stageChar: ['char-nobody'], weekly: { week: WEEK, score: 5, character: '<b>' } } }, NOW).stats.stageChar[0], '');
    assert.equal(normalizeProfile({ stats: { weekly: { week: WEEK, score: 5, character: '<b>' } } }, NOW).stats.weekly.character, '');
    assert.equal(normalizeProfile({ stats: { weekly: { week: 'old', score: 5, character: 'char-marshal' } } }, NOW).stats.weekly.character, '', 'resets with the week');
});

test('MOST WANTED ranks come with a title and nothing else', () => {
    assert.equal(eventTitle(1), 'PUBLIC ENEMY NO. 1');
    assert.equal(eventTitle(2), 'DESPERADO');
    assert.equal(eventTitle(3), 'DESPERADO');
    assert.equal(eventTitle(10), 'GUNSLINGER');
    assert.equal(eventTitle(11), '');
    assert.equal(eventTitle(0), '');
    for(const entry of EVENT_TITLES) assert.deepEqual(Object.keys(entry).sort(), ['title', 'upTo'], 'a title carries no reward');

    const event = eventForWeek(WEEK);
    const accounts = Array.from({ length: 12 }, (_, i) => {
        const profile = createProfile(NOW);
        profile.name = `RIDER ${String.fromCharCode(65 + i)}`;
        profile.loadout.character = i % 2 ? 'char-drifter' : 'char-marshal';
        // Every stage is open so the event outlaw can be fought.
        profile.stats.stageStars = profile.stats.stageStars.map(() => 7);
        applyRun(profile, run(2000 - i * 100, { outlawIndex: event.outlaw, event: WEEK }), NOW);
        return { id: `u${i}`, profile };
    });
    const board = rankBoard(accounts, 'event', 'u11', 50, NOW);
    assert.deepEqual(board.entries.map(e => e.title ?? ''), [
        'PUBLIC ENEMY NO. 1', 'DESPERADO', 'DESPERADO', ...Array(7).fill('GUNSLINGER'), '', ''
    ]);
    assert.equal(board.entries[0].character, 'char-marshal');
    assert.equal(board.entries[1].character, 'char-drifter');
    assert.equal(rankBoard(accounts, 'weekly', null, 50, NOW).entries.some(e => e.title), false, 'titles are for the event board only');
});
