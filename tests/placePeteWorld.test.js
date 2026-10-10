import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeteWorldScene } from '../src/placePeteWorld.js';
import { WORLD_CAMPFIRES, WORLD_CRATES, INVESTIGATION_CLUES } from '../src/peteWorldMap.js';

test('createPeteWorldScene instantiates all canyon landmark groups and props', () => {
    const scene = createPeteWorldScene();
    assert.ok(scene.group);
    assert.equal(scene.campfires.length, WORLD_CAMPFIRES.length);
    assert.equal(scene.crates.length, WORLD_CRATES.length);
    assert.equal(scene.clues.length, INVESTIGATION_CLUES.length);
    assert.ok(scene.gate);
});

test('scene update synchronizes campfire active state and flame visibility', () => {
    const scene = createPeteWorldScene();
    const fireMesh = scene.campfires.find(f => f.id === 'camp-mine');
    assert.equal(fireMesh.active, false);
    assert.equal(fireMesh.flameMesh.visible, false);

    // Update with lit campfire
    scene.update({
        campfires: [{ id: 'camp-mine', active: true }],
        crates: [],
        collectedClues: [],
        gateBreached: false
    }, 1.0);

    assert.equal(fireMesh.active, true);
    assert.equal(fireMesh.flameMesh.visible, true);
    assert.equal(fireMesh.glowMesh.visible, true);
});

test('scene update synchronizes crate opened status with lid angle', () => {
    const scene = createPeteWorldScene();
    const crateMesh = scene.crates.find(c => c.id === 'crate-a1');
    assert.equal(crateMesh.opened, false);
    assert.equal(crateMesh.lidGroup.rotation.x, 0);

    scene.update({
        campfires: [],
        crates: [{ id: 'crate-a1', opened: true }],
        collectedClues: [],
        gateBreached: false
    }, 1.0);

    assert.equal(crateMesh.opened, true);
    assert.notEqual(crateMesh.lidGroup.rotation.x, 0);
});

test('scene update hides collected clues and opens stronghold gate on breach', () => {
    const scene = createPeteWorldScene();
    const clueMesh = scene.clues.find(c => c.id === 'clue-manifest');
    assert.equal(clueMesh.collected, false);
    assert.equal(clueMesh.group.visible, true);

    scene.update({
        campfires: [],
        crates: [],
        collectedClues: ['clue-manifest'],
        gateBreached: true
    }, 1.0);

    assert.equal(clueMesh.collected, true);
    assert.equal(clueMesh.group.visible, false);
    assert.notEqual(scene.gate.leftDoor.position.x, 0);
});

test('scene dispose runs safely without errors', () => {
    const scene = createPeteWorldScene();
    assert.doesNotThrow(() => scene.dispose());
});

test('scene instantiates canyon cliffs, flora environment, smoke puffs, and swinging lanterns', () => {
    const scene = createPeteWorldScene();
    assert.ok(scene.environment);
    assert.ok(scene.environment.cliffsMesh);
    assert.ok(scene.environment.floraMesh);

    // Check campfire smoke puffs
    const fireMesh = scene.campfires[0];
    assert.ok(fireMesh.smokePuffs.length > 0);
    assert.equal(fireMesh.smokePuffs[0].mesh.visible, false);

    // Lit campfire updates smoke puffs
    scene.update({
        campfires: [{ id: fireMesh.id, active: true }],
        crates: [],
        collectedClues: [],
        gateBreached: false
    }, 1.5);

    assert.equal(fireMesh.smokePuffs[0].mesh.visible, true);
    assert.ok(fireMesh.smokePuffs[0].mesh.position.y > 0.5);

    // Check swinging lanterns
    assert.ok(scene.gate.lanterns.length > 0);
    const initialRot = scene.gate.lanterns[0].group.rotation.z;
    scene.update({ campfires: [], crates: [], collectedClues: [], gateBreached: false }, 3.5);
    const updatedRot = scene.gate.lanterns[0].group.rotation.z;
    assert.notEqual(initialRot, updatedRot);
});
