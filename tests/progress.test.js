import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, recordRun, isUnlocked, totalStars, starsForRun, loadProgress, saveProgress, STAR_DEFEATED, STAR_HOT_BOUNTY, STAR_ESCAPED } from '../src/progress.js';
import { OUTLAWS } from '../src/outlaws.js';

function memoryStorage() {
    const data = new Map();
    return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}

test('only the first outlaw is open on a new road', () => {
    const progress = createProgress();
    assert.equal(isUnlocked(progress, 0), true);
    assert.equal(isUnlocked(progress, 1), false);
    assert.equal(totalStars(progress), 0);
});

test('stars reflect how the run ended', () => {
    assert.equal(starsForRun({ status: 'none', heatAtOffer: 0 }), 0);
    assert.equal(starsForRun({ status: 'banked', heatAtOffer: 1 }), STAR_DEFEATED);
    assert.equal(starsForRun({ status: 'banked', heatAtOffer: 3 }), STAR_DEFEATED | STAR_HOT_BOUNTY);
    assert.equal(starsForRun({ status: 'escaped', heatAtOffer: 0 }), STAR_DEFEATED | STAR_ESCAPED);
    assert.equal(starsForRun({ status: 'forfeited', heatAtOffer: 4 }), STAR_DEFEATED);
});

test('defeating an outlaw unlocks and selects the next one; stars accumulate across runs', () => {
    const progress = createProgress();
    const first = recordRun(progress, 0, { status: 'banked', heatAtOffer: 0 }, 120);
    assert.deepEqual(first, { earned: STAR_DEFEATED, newStars: STAR_DEFEATED, unlockedNext: true });
    assert.equal(progress.selected, 1);
    const second = recordRun(progress, 0, { status: 'escaped', heatAtOffer: 2 }, 90);
    assert.equal(second.unlockedNext, false);
    assert.equal(second.newStars, STAR_HOT_BOUNTY | STAR_ESCAPED);
    assert.equal(totalStars(progress), 3);
    assert.equal(progress.best[0], 120);
});

test('a loss changes nothing but can still set a best score', () => {
    const progress = createProgress();
    const result = recordRun(progress, 0, { status: 'none', heatAtOffer: 0 }, 40);
    assert.equal(result.unlockedNext, false);
    assert.equal(progress.stars[0], 0);
    assert.equal(progress.best[0], 40);
});

test('progress saves, loads, and ignores tampered or corrupt data', () => {
    const storage = memoryStorage();
    const progress = createProgress();
    recordRun(progress, 0, { status: 'escaped', heatAtOffer: 3 }, 300);
    saveProgress(progress, storage);
    assert.deepEqual(loadProgress(storage), progress);
    storage.setItem('redWestProgress.v1', JSON.stringify({ selected: 5, stars: [15], best: ['x'] }));
    const loaded = loadProgress(storage);
    assert.equal(loaded.stars[0], 7);
    assert.equal(loaded.selected, 0, 'a locked stage cannot be selected');
    assert.equal(loaded.stars.length, OUTLAWS.length);
    storage.setItem('redWestProgress.v1', '{oops');
    assert.deepEqual(loadProgress(storage), createProgress());
});

test('the Bounty Book records first sightings once and totals kills across runs', async () => {
    const { markSeen, recordKills } = await import('../src/progress.js');
    const progress = createProgress();
    assert.equal(markSeen(progress, 'rattler'), true);
    assert.equal(markSeen(progress, 'rattler'), false);
    assert.equal(markSeen(progress, 'boss'), false, 'outlaws are tracked on the road, not here');
    recordKills(progress, { bandit: 3, wolf: 0, boss: 1, nonsense: 5 });
    recordKills(progress, { bandit: 2 });
    assert.deepEqual(progress.kills, { bandit: 5 });
    assert.equal(progress.seen.bandit, true);
    const storage = memoryStorage();
    saveProgress(progress, storage);
    assert.deepEqual(loadProgress(storage).kills, { bandit: 5 });
    assert.deepEqual(loadProgress(storage).seen, { rattler: true, bandit: true });
});
