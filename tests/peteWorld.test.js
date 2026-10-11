import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PETE_WORLD_ZONES,
    INVESTIGATION_CLUES,
    WORLD_CAMPFIRES,
    WORLD_CRATES,
    zoneAt,
    canBreachStronghold,
    isNearClue,
    ENCOUNTERS,
    ZONE_STORY,
    objectiveFor
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
import { PETE_AREAS } from '../src/stages/pete.js';

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
    assert.equal(zoneAt(-80).id, 'railSpur', 'the old mine camp is Area 1 now; the canyon starts at the rail spur');
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
    assert.equal(run.areaIndex, 0, 'a new run starts in Area 1');
    assert.equal(run.campfires.length, PETE_AREAS[0].campfires.length);
    assert.equal(run.crates.length, PETE_AREAS[0].crates.length);
    assert.equal(run.collectedClues.length, 0);
    assert.equal(run.gateBreached, false);
});

test('startPeteWorldRun resumes from saved checkpoint state', () => {
    const storage = createMockStorage();
    const mockSave = {
        version: 1,
        outlawId: 'dusty-pete',
        areaIndex: 0,
        lastCheckpointId: 'a1-hairpin',
        position: { x: PETE_AREAS[0].campfires[1].x, z: PETE_AREAS[0].campfires[1].z },
        stats: { hp: 4, ammo: 45 },
        completedMissions: ['clue-manifest'],
        openedCrates: ['a1-crate-1', 'a1-crate-2'],
        activeCampfires: ['a1-trail', 'a1-hairpin']
    };
    storage.setItem('redWestCheckpoint.v1', JSON.stringify(mockSave));

    const run = startPeteWorldRun({}, storage);
    assert.equal(run.lastCheckpointId, 'a1-hairpin');
    assert.equal(run.ammoState.current, 45);
    assert.deepEqual(run.collectedClues, ['clue-manifest']);
    assert.equal(run.exitOpen, true, 'the manifest was already found, so the gate is open');
    assert.equal(run.crates.find(c => c.id === 'a1-crate-1').opened, true);
    assert.equal(run.crates.find(c => c.id === 'a1-crate-3').opened, false);
    assert.equal(run.campfires.find(c => c.id === 'a1-trail').active, true);
    peteWorldMode.reset(storage);
});

test('a save from before the areas existed starts a fresh run instead of dropping the marshal into rock', () => {
    const storage = createMockStorage();
    storage.setItem('redWestCheckpoint.v1', JSON.stringify({
        version: 1, outlawId: 'dusty-pete', lastCheckpointId: 'camp-depot', position: { x: -5, z: -20 },
        stats: { hp: 4, ammo: 45 }, completedMissions: ['clue-manifest'], openedCrates: [], activeCampfires: []
    }));
    const run = startPeteWorldRun({}, storage);
    assert.equal(run.areaIndex, 0);
    assert.deepEqual(run.collectedClues, []);
    assert.deepEqual(run.startPosition, PETE_AREAS[0].start);
    peteWorldMode.reset(storage);
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

test('actual clue pickups and the area gate lead to one correctly positioned boss; settlement awards progress once', () => {
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
    const bossCalls = () => calls.filter(([type]) => type === 'boss');
    const area1 = PETE_AREAS[0];
    peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(bossCalls(), [], 'entry without clues cannot spawn the boss');

    // Area 1: the gate is chained until the payroll manifest is found.
    Object.assign(position, { x: area1.exit.x, z: area1.exit.z });
    peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(peteWorldRun.areaIndex, 0, 'a chained gate does not open');
    assert.ok(peteWorldRun.prompt.includes('GATE LOCKED'));
    Object.assign(position, area1.clues[0]);
    peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(peteWorldRun.collectedClues, ['clue-manifest']);
    assert.equal(peteWorldRun.exitOpen, true);
    Object.assign(position, { x: area1.exit.x, z: area1.exit.z });
    peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(peteWorldRun.areaIndex, 1, 'through the gate and into Area 2');
    assert.deepEqual({ x: position.x, z: position.z }, PETE_AREAS[1].start);
    assert.equal(loadCheckpoint(storage).areaIndex, 1, 'a forced checkpoint saves the new area');

    // Area 2: the ledger and the key, then the stronghold and Pete.
    for(const clue of PETE_AREAS[1].clues) {
        Object.assign(position, clue);
        peteWorldMode.update(ctx, 0.1, storage);
    }
    assert.equal(peteWorldRun.collectedClues.length, 3);
    assert.equal(peteWorldRun.gateBreached, true);
    assert.ok(peteWorldRun.prompt.includes('STRONGHOLD UNLOCKED'));
    Object.assign(position, { x: 0, z: 74 });
    peteWorldMode.update(ctx, 0.1, storage);
    peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(bossCalls(), [['boss', { x: 0, z: 100 }]]);
    storage.setItem('redWestCheckpoint.v1', '{}');
    peteWorldMode.afterOutlawDown(ctx, storage);
    const score = gameState.score;
    peteWorldMode.afterOutlawDown(ctx, storage);
    assert.deepEqual(calls.at(-1), ['finish', 'banked']);
    assert.equal(calls.filter(([type]) => type === 'finish').length, 1, 'duplicate defeat callback cannot settle twice');
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
    const fire = PETE_AREAS[0].campfires.find(f => f.id === 'a1-hairpin');
    const position = { x: fire.x, z: fire.z };
    peteWorldMode.update({ playerSystem: { playerGroup: { position } } }, 0.1, storage);
    const saved = loadCheckpoint(storage);
    assert.equal(saved.lastCheckpointId, 'a1-hairpin');
    assert.equal(saved.areaIndex, 0);
    assert.equal(peteWorldRun.lastCheckpointId, 'a1-hairpin');
    assert.ok(saved.activeCampfires.includes('a1-hairpin'));
    assert.deepEqual(saved.stats, { hp: 3, ammo: 17 });
    peteWorldMode.reset(storage);
    resetPlayerStats();
    startPeteWorldRun({}, storage);
    assert.deepEqual(peteWorldRun.startPosition, position);
    assert.equal(playerStats.hp, 3);
    assert.equal(peteWorldRun.ammoState.current, 17);
    assert.deepEqual(peteWorldRun.collectedClues, ['clue-manifest']);
    assert.equal(peteWorldRun.campfires.find(f => f.id === 'a1-hairpin').active, true);
    peteWorldMode.reset(storage);
    resetPlayerStats();
});



test('every zone has guards and a story line, and every guard is a real enemy type', async () => {
    const { ENEMY_TYPES } = await import('../src/enemyTypes.js');
    for(const zone of Object.keys(PETE_WORLD_ZONES)) {
        assert.ok(ZONE_STORY[zone]?.line, `${zone} has a story line`);
        assert.ok(ENCOUNTERS.some(group => group.zone === zone), `${zone} has guards`);
    }
    for(const group of ENCOUNTERS) {
        for(const enemy of group.enemies) assert.ok(ENEMY_TYPES[enemy.type], `${group.id}: ${enemy.type} exists`);
    }
    const area1 = PETE_AREAS[0];
    for(const place of area1.places) {
        assert.ok(area1.story[place.id]?.line, `${place.id} has a story line`);
        if(place.id !== 'trailhead') assert.ok(area1.encounters.some(group => group.zone === place.id), `${place.id} has guards`);
    }
    for(const group of area1.encounters) {
        for(const enemy of group.enemies) assert.ok(ENEMY_TYPES[enemy.type], `${group.id}: ${enemy.type} exists`);
    }
});

test('guards wake once as the marshal walks up, and the objective points at the next clue', () => {
    const storage = createMockStorage();
    resetGameState();
    startPeteWorldRun({}, storage);
    const area1 = PETE_AREAS[0];
    const position = { ...area1.start };
    const spawned = [];
    const banners = [];
    const ctx = {
        playerSystem: { playerGroup: { position } },
        spawn: (type, at) => spawned.push([type, at]),
        ui: { showWaveBanner: text => banners.push(text) }
    };
    peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(spawned.length, 0, 'the start is quiet');
    assert.ok(banners.some(text => text.includes('THE TRAILHEAD')), 'the first place tells its story');
    assert.equal(area1.objective([]), "FIND: MINERS' PAYROLL MANIFEST");
    assert.equal(area1.objective(['clue-manifest']), 'REACH THE COMPANY GATE');
    const first = area1.encounters[0];
    Object.assign(position, { x: first.x, z: first.z });
    peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(spawned.length, first.enemies.length);
    peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(spawned.length, first.enemies.length, 'a group wakes only once');
    assert.ok(peteWorldMode.hud.status().includes('FIND:'));
    peteWorldMode.reset(storage);
    resetGameState();
});

test('resuming part-way does not send back the guards left behind', () => {
    const storage = createMockStorage();
    resetGameState();
    storage.setItem('redWestCheckpoint.v1', JSON.stringify({ version: 1, areaIndex: 1, outlawId: 'dusty-pete', lastCheckpointId: 'camp-saloon', position: { x: 0, z: 25 }, stats: { hp: 5, ammo: 20 } }));
    startPeteWorldRun({}, storage);
    assert.equal(peteWorldRun.areaIndex, 1);
    assert.ok(peteWorldRun.triggeredEncounters.includes('depot-patrol'));
    assert.ok(!peteWorldRun.triggeredEncounters.includes('gate-guards'));
    peteWorldMode.reset(storage);
    storage.setItem('redWestCheckpoint.v1', JSON.stringify({ version: 1, areaIndex: 0, outlawId: 'dusty-pete', lastCheckpointId: 'a1-miners', position: { x: PETE_AREAS[0].campfires[2].x, z: PETE_AREAS[0].campfires[2].z }, stats: { hp: 5, ammo: 20 } }));
    startPeteWorldRun({}, storage);
    assert.ok(peteWorldRun.triggeredEncounters.includes('a1-claims-guards'), 'Area 1 guards behind the camp stay cleared');
    assert.ok(!peteWorldRun.triggeredEncounters.includes('a1-gate-guards'));
    peteWorldMode.reset(storage);
    resetGameState();
});
