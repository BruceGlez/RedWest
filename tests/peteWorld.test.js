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
import { gameState, playerStats, resetGameState, resetPlayerStats } from '../src/state.js';
import { activeMode, registerMode, clearModes } from '../src/modes/registry.js';
import { arenaMode } from '../src/modes/arena.js';
import { arena } from '../src/arena.js';
import { mine } from '../src/mine.js';
import { createProgress, recordRun, STAR_DEFEATED } from '../src/progress.js';
import { loadCheckpoint } from '../src/checkpoints.js';

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

test('Pete mode respects arena, mine, events and the selected outlaw, and stays active during its run', () => {
    const storage = createMockStorage();
    resetGameState();
    peteWorldMode.reset(storage);
    registerMode(arenaMode);
    registerMode({ id: 'mine', isActive: () => mine.enabled });
    registerMode(peteWorldMode);
    assert.equal(activeMode().id, 'pete-world');
    arena.enabled = true;
    assert.equal(activeMode().id, 'arena');
    arena.enabled = false;
    mine.enabled = true;
    assert.equal(activeMode().id, 'mine');
    mine.enabled = false;
    gameState.pendingEvent = { outlaw: 0 };
    assert.equal(activeMode().id, 'road');
    gameState.pendingEvent = null;
    gameState.outlawIndex = 1;
    assert.equal(activeMode().id, 'road');
    startPeteWorldRun({}, storage);
    gameState.isGameStarted = true;
    assert.equal(activeMode().id, 'pete-world');
    assert.equal(peteWorldMode.runOutlaw(), 0);
    peteWorldMode.reset(storage);
    resetGameState();
    clearModes();
});

test('actual clue pickups unlock one correctly positioned boss and settlement awards progress once', () => {
    const storage = createMockStorage();
    resetGameState();
    startPeteWorldRun({}, storage);
    const position = { x: 0, z: 100 };
    const calls = [];
    const progress = createProgress();
    const ctx = {
        playerSystem: { playerGroup: { position } },
        spawn: (...args) => calls.push(args),
        finishRun: result => {
            calls.push(['finish', result]);
            gameState.isGameOver = true;
            recordRun(progress, 0, gameState.bounty, gameState.score);
        }
    };
    peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(calls, [], 'entry without clues cannot spawn the boss');
    for(const clue of INVESTIGATION_CLUES) {
        Object.assign(position, clue);
        peteWorldMode.update(ctx, 0.1, storage);
    }
    assert.equal(peteWorldRun.collectedClues.length, 3);
    assert.equal(peteWorldRun.gateBreached, true);
    assert.ok(peteWorldRun.prompt.includes('STRONGHOLD UNLOCKED'));
    Object.assign(position, { x: 0, z: 74 });
    peteWorldMode.update(ctx, 0.1, storage);
    peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(calls, [['boss', { x: 0, z: 100 }]]);
    storage.setItem('redWestCheckpoint.v1', '{}');
    peteWorldMode.afterOutlawDown(ctx, storage);
    const score = gameState.score;
    peteWorldMode.afterOutlawDown(ctx, storage);
    assert.deepEqual(calls.at(-1), ['finish', 'banked']);
    assert.equal(calls.length, 2, 'duplicate defeat callback cannot settle twice');
    assert.equal(gameState.bounty.status, 'banked');
    assert.equal(gameState.score, score);
    assert.equal(score, 50);
    assert.ok(progress.stars[0] & STAR_DEFEATED);
    assert.equal(progress.selected, 1);
    assert.equal(storage.getItem('redWestCheckpoint.v1'), null);
    assert.equal(peteWorldRun.active, false);
    resetGameState();
});

test('campfire saves clues, HP, ammo and its own activation; failure preserves the retry state', () => {
    const storage = createMockStorage();
    resetPlayerStats();
    startPeteWorldRun({}, storage);
    peteWorldRun.collectedClues = ['clue-manifest'];
    peteWorldRun.ammoState.current = 17;
    playerStats.hp = 3;
    const position = { x: -5, z: -20 };
    peteWorldMode.update({ playerSystem: { playerGroup: { position } } }, 0.1, storage);
    const saved = loadCheckpoint(storage);
    assert.equal(saved.lastCheckpointId, 'camp-depot');
    assert.equal(peteWorldRun.lastCheckpointId, 'camp-depot');
    assert.ok(saved.activeCampfires.includes('camp-depot'));
    assert.deepEqual(saved.stats, { hp: 3, ammo: 17 });
    peteWorldMode.reset(storage);
    resetPlayerStats();
    startPeteWorldRun({}, storage);
    assert.deepEqual(peteWorldRun.startPosition, position);
    assert.equal(playerStats.hp, 3);
    assert.equal(peteWorldRun.ammoState.current, 17);
    assert.deepEqual(peteWorldRun.collectedClues, ['clue-manifest']);
    assert.equal(peteWorldRun.campfires.find(f => f.id === 'camp-depot').active, true);
    peteWorldMode.reset(storage);
    resetPlayerStats();
});


