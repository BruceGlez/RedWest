import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PETE_AREAS, installSection1, uninstallSection1, section1Installed, areaIndexForSave } from '../src/stages/pete.js';
import { loadSection1Area, section1Enabled, preloadSection1, resetSection1Preload, SECTION1_SWITCH_KEY } from '../src/stages/section1Preload.js';
import { peteWorldRun, startPeteWorldRun, endPeteWorldRun, peteWorldMode } from '../src/modes/peteWorld.js';
import { enemies, resetGameState } from '../src/state.js';
import { loadCheckpoint } from '../src/checkpoints.js';

const fetchJson = path => Promise.resolve(JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8')));
const storageFor = () => {
    const store = new Map();
    return { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
};

test('the switch: off by default, ?section1=1 turns it on and remembers, ?section1=0 turns it off', () => {
    const storage = storageFor();
    assert.equal(section1Enabled('', storage), false);
    assert.equal(section1Enabled('?section1=1', storage), true);
    assert.equal(storage.getItem(SECTION1_SWITCH_KEY), '1');
    assert.equal(section1Enabled('', storage), true, 'remembered');
    assert.equal(section1Enabled('?section1=0', storage), false);
    assert.equal(section1Enabled('', storage), false);
});

test('installing Section 1 makes the chapter Section 1, the old road from the bridge, then the canyon', async () => {
    assert.equal(PETE_AREAS.length, 2);
    assert.equal(section1Installed(), false);
    installSection1(await loadSection1Area(fetchJson));
    assert.deepEqual(PETE_AREAS.map(a => [a.index, a.id]), [[0, 'claims-road-1'], [1, 'claims-road-2'], [2, 'canyon-stronghold']]);
    assert.equal(PETE_AREAS[0].exit.next, 1);
    assert.equal(PETE_AREAS[1].exit.next, 2, 'the manifest gate now leads to the canyon');
    assert.ok(PETE_AREAS[1].encounters.every(g => g.progress > 0.33), 'the guards left behind in Section 1 are not in the second part');
    assert.ok(PETE_AREAS[1].walk === undefined && PETE_AREAS[1].createWalk()(PETE_AREAS[1].start.x, PETE_AREAS[1].start.z), 'the handoff start is on the old road');
    uninstallSection1();
    assert.equal(PETE_AREAS.length, 2);
    assert.equal(PETE_AREAS[0].index, 0);
});

test('a saved run finds its area by name, and an old save by its old index', async () => {
    installSection1(await loadSection1Area(fetchJson));
    assert.equal(areaIndexForSave({ areaId: 'claims-road-2', areaIndex: 1 }), 1);
    assert.equal(areaIndexForSave({ areaIndex: 0 }), 0, 'an old first-area save is Section 1');
    assert.equal(areaIndexForSave({ areaIndex: 1 }), 2, 'an old second-area save is the canyon');
    assert.equal(areaIndexForSave({ areaId: 'nowhere', areaIndex: 7 }), -1);
    uninstallSection1();
    assert.equal(areaIndexForSave({ areaIndex: 1 }), 1, 'without Section 1 the old indices mean what they always did');
});

test('preloadSection1 installs the area when on, and leaves the old Area 1 when off or when the data cannot load', async () => {
    resetSection1Preload();
    assert.equal(await preloadSection1({ enabled: false }), false);
    assert.equal(section1Installed(), false);
    resetSection1Preload();
    assert.equal(await preloadSection1({ enabled: true, fetchJson: () => Promise.reject(new Error('offline')) }), false);
    assert.equal(section1Installed(), false, 'a failed load keeps the original area');
    resetSection1Preload();
    assert.equal(await preloadSection1({ enabled: true, fetchJson }), true);
    assert.equal(section1Installed(), true);
    uninstallSection1();
    resetSection1Preload();
});

test('a Section 1 run: guards wake as the marshal walks up, the bridge exit waits for the ambush to be beaten, then the road goes on', async () => {
    installSection1(await loadSection1Area(fetchJson));
    const storage = storageFor();
    resetGameState();
    enemies.length = 0;
    startPeteWorldRun({}, storage);
    const section = PETE_AREAS[0];
    assert.equal(peteWorldRun.area.id, 'claims-road-1');
    assert.equal(peteWorldRun.areaId, 'claims-road-1');
    assert.deepEqual(peteWorldRun.startPosition, section.start);
    assert.equal(peteWorldRun.walk(section.start.x, section.start.z), true, 'the marshal starts on walkable ground');
    assert.ok(!peteWorldMode.hud.status().includes('CLUES'), 'Section 1 has no clue counter');

    const position = { x: section.start.x, z: section.start.z };
    const spawned = [];
    const banners = [];
    const ctx = { playerSystem: { playerGroup: { position } }, spawn: (type, at) => spawned.push([type, at]), ui: { showWaveBanner: text => banners.push(text) } };
    peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(spawned, [], 'nobody wakes at the Trailhead');

    const claims = section.encounters.find(g => g.id === 'a1-claims-guards');
    Object.assign(position, { x: claims.x, z: claims.z });
    peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(spawned, [], 'they have only noticed him: suspicious first');
    for(let i = 0; i < 20; i++) peteWorldMode.update(ctx, 0.1, storage);
    assert.deepEqual(spawned.map(s => s[0]).sort(), ['bandit', 'bandit', 'wolf']);
    assert.ok(banners.some(b => b.includes('Company guards')));

    // the bridge: walking onto the exit before the ambush is beaten does nothing
    const flume = section.encounters.find(g => g.id === 'a1-flume-ambush');
    Object.assign(position, { x: section.exit.x, z: section.exit.z });
    peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(peteWorldRun.areaIndex, 0);
    assert.ok(peteWorldRun.prompt.includes('GATE LOCKED'));

    // wake the ambush, keep someone alive near it: still not beaten
    Object.assign(position, { x: flume.x, z: flume.z });
    for(let i = 0; i < 20; i++) peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(spawned.filter(s => s[0] === 'gunslinger').length, 0, 'the flank is not there yet');
    for(let i = 0; i < 70; i++) peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(spawned.filter(s => s[0] === 'gunslinger').length, 1, 'the flank arrives later');
    for(let i = 0; i < 4; i++) peteWorldMode.cameraBias(position, 1);        // the stage clock runs on
    enemies.push({ position: { x: flume.x + 5, z: flume.z + 5 } });
    Object.assign(position, { x: section.exit.x, z: section.exit.z });
    peteWorldMode.update(ctx, 0.1, storage);
    assert.equal(peteWorldRun.areaIndex, 0, 'an enemy is still standing');
    assert.deepEqual(peteWorldRun.clearedEncounters, []);

    // beaten: the way on opens and the road goes on, with a forced checkpoint that names the new area
    enemies.length = 0;
    peteWorldMode.update(ctx, 0.1, storage);
    assert.ok(peteWorldRun.clearedEncounters.includes('a1-flume-ambush'));
    assert.equal(peteWorldRun.areaIndex, 1);
    assert.equal(peteWorldRun.areaId, 'claims-road-2');
    assert.deepEqual({ x: position.x, z: position.z }, PETE_AREAS[1].start);
    const saved = loadCheckpoint(storage);
    assert.equal(saved.areaIndex, 1);
    assert.equal(saved.areaId, 'claims-road-2');
    assert.ok(banners.some(b => b.includes('THE ROAD GOES ON')));

    // a new run resumes in the old road, found by name
    endPeteWorldRun(false, storage);
    startPeteWorldRun({}, storage);
    assert.equal(peteWorldRun.areaId, 'claims-road-2');

    peteWorldMode.reset(storage);
    resetGameState();
    enemies.length = 0;
    uninstallSection1();
});
