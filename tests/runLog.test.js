import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRunRecord, formatRunLog, loadRunLog, appendRunRecord, clearRunLog, RUN_LOG_COLUMNS } from '../src/runLog.js';
import { createHeatState } from '../src/heat.js';
import { createBountyState, offerBounty, rideOn, forfeitBounty } from '../src/bounty.js';

function memoryStorage() {
    const data = new Map();
    return {
        getItem: key => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key)
    };
}

function finishedState() {
    const heat = createHeatState();
    heat.peak = 3;
    const bounty = createBountyState();
    offerBounty(bounty, 2);
    rideOn(bounty, 120);
    return {
        score: forfeitBounty(bounty, 200),
        runTime: 187.6,
        heat,
        bounty,
        runStats: { waveReached: 4, shotsFired: 40, shotsHit: 30, enemiesKilled: 22, damageTaken: 5 }
    };
}

test('a run record captures the Heat and bounty decisions the gate asks about', () => {
    const record = buildRunRecord(finishedState(), 'died', 2, new Date('2026-09-25T12:00:00Z'));
    assert.deepEqual(record, {
        endedAt: '2026-09-25T12:00:00.000Z', sessionRun: 2, result: 'died', pursuitReached: 'bonus',
        peakHeat: 3, bountyChoice: 'ride on', heatAtOutlaw: 2, bountyAmount: 100, score: 120,
        seconds: 188, shotsFired: 40, accuracy: 75, kills: 22, damageTaken: 5
    });
});

test('a run that ends before the outlaw leaves the bounty columns empty', () => {
    const state = { ...finishedState(), bounty: createBountyState() };
    state.runStats = { ...state.runStats, waveReached: 2 };
    const record = buildRunRecord(state, 'died', 1);
    assert.equal(record.pursuitReached, 2);
    assert.equal(record.bountyChoice, '');
    assert.equal(record.bountyAmount, '');
});

test('the log formats as tab-separated rows with a header', () => {
    const record = buildRunRecord(finishedState(), 'died', 1);
    const lines = formatRunLog([record, record]).split('\n');
    assert.equal(lines.length, 3);
    assert.equal(lines[0], RUN_LOG_COLUMNS.join('\t'));
    assert.equal(lines[1].split('\t').length, RUN_LOG_COLUMNS.length);
});

test('records persist, append in order, and clear', () => {
    const storage = memoryStorage();
    assert.deepEqual(loadRunLog(storage), []);
    appendRunRecord({ sessionRun: 1 }, storage);
    appendRunRecord({ sessionRun: 2 }, storage);
    assert.deepEqual(loadRunLog(storage).map(r => r.sessionRun), [1, 2]);
    clearRunLog(storage);
    assert.deepEqual(loadRunLog(storage), []);
});

test('a corrupt log reads as empty instead of breaking the game', () => {
    const storage = memoryStorage();
    storage.setItem('redWestRunLog.v1', '{not json');
    assert.deepEqual(loadRunLog(storage), []);
});
