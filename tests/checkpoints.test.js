import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCampfire,
    isNearCampfire,
    activateCampfire,
    saveCheckpoint,
    loadCheckpoint,
    hasActiveCheckpoint,
    clearCheckpoint,
    CHECKPOINT_STORAGE_KEY
} from '../src/checkpoints.js';

function createMockStorage() {
    const store = new Map();
    return {
        getItem: key => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: key => store.delete(key),
        clear: () => store.clear()
    };
}

test('createCampfire initializes inactive campfire checkpoint', () => {
    const campfire = createCampfire('camp-1', 'Mine Entrance Fire', 'mine-camp', 10, -25);
    assert.equal(campfire.id, 'camp-1');
    assert.equal(campfire.name, 'Mine Entrance Fire');
    assert.equal(campfire.zone, 'mine-camp');
    assert.equal(campfire.active, false);
    assert.equal(campfire.litAt, null);
    assert.equal(isNearCampfire(campfire, 11, -25), true);
    assert.equal(isNearCampfire(campfire, 30, 0), false);
});

test('activateCampfire sets active state and saves run progress', () => {
    const storage = createMockStorage();
    const campfire = createCampfire('camp-1', 'Camp Alpha', 'zone-a', 5, 5);
    const runState = {
        outlawId: 'dusty-pete',
        hp: 4,
        ammoState: { current: 22 },
        completedMissions: ['mission-1'],
        openedCrates: ['crate-1'],
        activeCampfires: ['camp-1']
    };

    assert.equal(hasActiveCheckpoint(storage), false);
    const activated = activateCampfire(campfire, runState, storage);
    assert.equal(activated, true);
    assert.equal(campfire.active, true);
    assert.ok(campfire.litAt !== null);

    assert.equal(hasActiveCheckpoint(storage), true);
    const loaded = loadCheckpoint(storage);
    assert.equal(loaded.outlawId, 'dusty-pete');
    assert.equal(loaded.lastCheckpointId, 'camp-1');
    assert.equal(loaded.stats.hp, 4);
    assert.equal(loaded.stats.ammo, 22);
    assert.deepEqual(loaded.completedMissions, ['mission-1']);
    assert.deepEqual(loaded.openedCrates, ['crate-1']);
});

test('clearCheckpoint deletes saved run state', () => {
    const storage = createMockStorage();
    const runState = { outlawId: 'dusty-pete', hp: 5 };
    saveCheckpoint(runState, storage);
    assert.equal(hasActiveCheckpoint(storage), true);

    clearCheckpoint(storage);
    assert.equal(hasActiveCheckpoint(storage), false);
    assert.equal(loadCheckpoint(storage), null);
});
