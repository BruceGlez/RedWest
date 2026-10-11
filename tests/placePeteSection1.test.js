import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSection1Parts, SECTION1_CHUNK_FILES } from '../src/placePeteSection1.js';

// A loader that reads the exported files from disk, so the scene can be checked without a browser.
const fileLoader = {
    load(url, onLoad, _progress, onError) {
        const file = new URL(`../public/${url}`, import.meta.url);
        const buffer = readFileSync(file);
        const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        new GLTFLoader().parse(ab, '', onLoad, onError);
    }
};

test('the Section 1 chunks load, one chunk mesh each, in game scale', async () => {
    const parts = createSection1Parts({ loader: fileLoader });
    await parts.ready;
    const env = parts.buildEnvironment().group;
    const chunks = env.children.filter(c => c.name.startsWith('chunk_section1_') && !c.name.includes('far'));
    assert.equal(chunks.length, SECTION1_CHUNK_FILES.length);
    let tris = 0;
    for(const chunk of chunks) {
        assert.ok(chunk.isMesh, `${chunk.name} is one mesh`);
        assert.ok(chunk.material.vertexColors, 'colour comes from the vertices');
        tris += chunk.geometry.index.count / 3;
    }
    assert.ok(tris > 140000 && tris < 160000, `static triangles ${tris}`);
    env.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(env);
    assert.ok(box.max.x > 700 && box.min.x < -600, 'the world is at game scale (the art times 3)');
});

test('the animated parts are separate named nodes, with no duplicates from the chunk overlap', async () => {
    const parts = createSection1Parts({ loader: fileLoader });
    await parts.ready;
    const { registry } = parts;
    assert.ok(registry.lanterns.length >= 20, `${registry.lanterns.length} lanterns`);
    parts.buildEnvironment().group.updateWorldMatrix(true, true);
    const keys = registry.lanterns.map(l => { const w = l.node.getWorldPosition(new THREE.Vector3()); return `${w.x.toFixed(1)},${w.y.toFixed(1)},${w.z.toFixed(1)}`; });
    assert.equal(new Set(keys).size, keys.length, 'each lantern is in the scene once');
    assert.ok(registry.doors.length >= 3, 'the shack door and the two shed doors');
    assert.ok(registry.ladders.length >= 1);
    assert.ok(registry.flames.length >= 1, 'the Headframe campfire flame');
    for(const [name, nodes] of registry.byName) {
        for(const n of nodes) n.traverse(c => { if(['pot_shards', 'barrel_broken', 'fence_broken'].includes(c.name.replace(/_\d+$/, ''))) assert.equal(c.visible, false, `${c.name} waits hidden`); });
        assert.ok(nodes.length >= 1, name);
    }
});

test('landmarks animate the lanterns and flames without errors', async () => {
    const parts = createSection1Parts({ loader: fileLoader });
    await parts.ready;
    const landmarks = parts.buildLandmarks();
    landmarks.update(1.5);
    const sway = parts.registry.lanterns.map(l => l.node.rotation.z);
    assert.ok(sway.some(r => Math.abs(r) > 0.001), 'lanterns sway');
    landmarks.setBreached(true);
    parts.dispose();
});
