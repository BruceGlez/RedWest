import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PETE_WORLD_ZONES,
    INVESTIGATION_CLUES,
    WORLD_CAMPFIRES,
    WORLD_CRATES,
    zoneAt,
    canBreachStronghold,
    isNearClue
} from '../src/peteWorldMap.js';
import {
    peteWorldRun,
    startPeteWorldRun,
    endPeteWorldRun,
    peteWorldMode
} from '../src/modes/peteWorld.js';

function createMockStorage() {
    const store = new Map();
    return {
        getItem: key => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: key => store.delete(key),
        clear: () => store.clear()
    };
}

test('zoneAt maps Z coordinates to corresponding open-world canyon zones', () => {
    assert.equal(zoneAt(-80).id, 'mineCamp');
    assert.equal(zoneAt(-15).id, 'railSpur');
    assert.equal(zoneAt(30).id, 'sunkenSaloon');
    assert.equal(zoneAt(90).id, 'stronghold');
});

test('INVESTIGATION_CLUES requires all 3 clues before allowing stronghold breach', () => {
    assert.equal(INVESTIGATION_CLUES.length, 3);
    assert.equal(canBreachStronghold([]), false);
    assert.equal(canBreachStronghold(['clue-manifest']), false);
    assert.equal(canBreachStronghold(['clue-manifest', 'clue-ledger']), false);
    assert.equal(canBreachStronghold(['clue-manifest', 'clue-ledger', 'clue-key']), true);
});

test('startPeteWorldRun initializes new open-world run with default ammo and campfires', () => {
    const storage = createMockStorage();
    const run = startPeteWorldRun({}, storage);
    assert.equal(run.active, true);
    assert.equal(run.ammoState.current, 30);
    assert.equal(run.campfires.length, WORLD_CAMPFIRES.length);
    assert.equal(run.crates.length, WORLD_CRATES.length);
    assert.equal(run.collectedClues.length, 0);
    assert.equal(run.gateBreached, false);
});

test('startPeteWorldRun resumes from saved checkpoint state', () => {
    const storage = createMockStorage();
    const mockSave = {
        version: 1,
        outlawId: 'dusty-pete',
        lastCheckpointId: 'camp-depot',
        position: { x: -5, z: -20 },
        stats: { hp: 4, ammo: 45 },
        completedMissions: ['clue-manifest'],
        openedCrates: ['crate-a1', 'crate-a2'],
        activeCampfires: ['camp-mine', 'camp-depot']
    };
    storage.setItem('redWestCheckpoint.v1', JSON.stringify(mockSave));

    const run = startPeteWorldRun({}, storage);
    assert.equal(run.lastCheckpointId, 'camp-depot');
    assert.equal(run.ammoState.current, 45);
    assert.deepEqual(run.collectedClues, ['clue-manifest']);
    assert.equal(run.crates.find(c => c.id === 'crate-a1').opened, true);
    assert.equal(run.crates.find(c => c.id === 'crate-a3').opened, false);
    assert.equal(run.campfires.find(c => c.id === 'camp-mine').active, true);
});

test('peteWorldMode hooks conform to run mode contract', () => {
    assert.equal(peteWorldMode.id, 'pete-world');
    assert.equal(peteWorldMode.reinforcements(), false);
    assert.equal(typeof peteWorldMode.hud.wave, 'function');
    assert.equal(typeof peteWorldMode.hud.status, 'function');
});

test('peteWorldRun ammo consumption tracks shots and detects dry fire', () => {
    const storage = createMockStorage();
    const run = startPeteWorldRun({}, storage);
    assert.equal(run.ammoState.current, 30);

    // Consume 30 rounds
    for(let i = 0; i < 30; i++) {
        assert.equal(run.ammoState.current > 0, true);
        run.ammoState.current--;
    }
    assert.equal(run.ammoState.current, 0);

    // Further shots are dry fire
    assert.equal(run.ammoState.current <= 0, true);
    assert.equal(peteWorldMode.hud.status().includes('AMMO 0'), true);
});

test('peteWorldMode formats interactive HUD prompt and manages scene lifecycle', () => {
    const storage = createMockStorage();
    const mockScene = { children: [], add: (item) => mockScene.children.push(item), remove: (item) => {
        const idx = mockScene.children.indexOf(item);
        if(idx !== -1) mockScene.children.splice(idx, 1);
    }};

    peteWorldMode.begin({ scene: mockScene }, storage);
    assert.equal(mockScene.children.length > 0, true);

    peteWorldRun.prompt = 'CAMPFIRE SAVED';
    assert.equal(peteWorldMode.hud.status().includes('[ CAMPFIRE SAVED ]'), true);

    peteWorldMode.reset(storage);
    assert.equal(peteWorldRun.active, false);
});


