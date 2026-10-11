// The look of Pete's Area 1, Section 1: the Blender build, exported as chunk files at game scale (public/models/pete-area1/,
// tools/blender/make_pete_section1.py, docs/design/pete-section1-gameplay.md). The scene reads the art and never invents it: the chunks hold the
// terrain, road, buildings and dressing as one mesh each, plus the parts the game animates as separate named nodes (lanterns, doors, a ladder,
// a lever and gate, breakable fences and barrels, the Headframe campfire). The layout's crates, pots and campfires are not in the chunks: the
// scene builder (src/placePeteWorld.js) places those from the stage data.
//
// createSection1Parts() gives the two hooks createPeteWorldScene reads from an area: buildEnvironment() and buildLandmarks(). Loading is
// asynchronous: the group is returned at once and the chunks appear as they arrive (the Trailhead's first).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from './demo.js';

export const SECTION1_BASE = 'models/pete-area1/';
export const SECTION1_CHUNK_FILES = ['chunk_section1_a.glb', 'chunk_section1_b.glb', 'chunk_section1_c.glb', 'chunk_section1_d.glb'];
export const SECTION1_FAR_FILE = 'chunk_section1_far_ring.glb';

// Names the game looks for (the contract with the Blender export; docs: tools/blender/pete_area1_section1_notes.md).
const SWAPPED_AWAY = new Set(['pot_shards', 'barrel_broken', 'fence_broken']);   // the broken variants wait until something breaks

// The game's own look: lit with the scene's lights, flat-shaded (the chunks carry no normals), colour from the vertices.
function restyle(root) {
    root.traverse(object => {
        if(!object.isMesh) return;
        const old = Array.isArray(object.material) ? object.material[0] : object.material;
        const glow = old?.name === 'M_cloth_glow';
        object.material = glow
            ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
            : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
        object.frustumCulled = true;
        object.castShadow = false;
        object.receiveShadow = false;
    });
}

// three.js makes repeated node names unique by adding _1, _2 ...; the game looks nodes up by the plain name.
const plain = name => name.replace(/_\d+$/, '');

// A root-level node's identity across the 20 m overlap between chunks: the same name at the same spot is the same object.
function nodeKey(node) { return `${plain(node.name)}@${node.position.x.toFixed(1)},${node.position.z.toFixed(1)}`; }

export function createSection1Parts({ loader = new GLTFLoader(), url = assetUrl, files = SECTION1_CHUNK_FILES, far = SECTION1_FAR_FILE } = {}) {
    const environment = new THREE.Group();
    environment.name = 'pete-section1-environment';
    const landmarks = new THREE.Group();
    landmarks.name = 'pete-section1-landmarks';
    const seen = new Set();
    const registry = { lanterns: [], flames: [], doors: [], ladders: [], levers: [], gates: [], fences: [], barrels: [], byName: new Map() };
    let loaded = 0;
    let disposed = false;
    const total = files.length + (far ? 1 : 0);
    const ready = new Promise(resolve => { registry.finish = resolve; });

    function register(node) {
        const key = nodeKey(node);
        if(seen.has(key) && node.name !== '') { node.visible = false; node.removeFromParent?.(); return false; }
        seen.add(key);
        registry.byName.set(node.name, [...(registry.byName.get(node.name) ?? []), node]);
        node.traverse(n => {
            if(SWAPPED_AWAY.has(plain(n.name))) n.visible = false;
            if(plain(n.name) === 'fire_flame') registry.flames.push(n);
            if(plain(n.name) === 'lantern') registry.lanterns.push({ node: n, seed: node.position.x * 0.31 + node.position.z * 0.17 + n.position.x });
        });
        const base = plain(node.name);
        if(base === 'door' || base === 'door_l' || base === 'door_r') registry.doors.push(node);
        else if(base === 'ladder') registry.ladders.push(node);
        else if(node.name.startsWith('prop_gate')) registry.gates.push(node);
        else if(node.name.startsWith('prop_fence')) registry.fences.push(node);
        else if(node.name.startsWith('prop_barrel')) registry.barrels.push(node);
        return true;
    }

    function adopt(scene, isFar) {
        if(disposed) return;
        restyle(scene);
        for(const child of [...scene.children]) {
            if(isFar || child.name.startsWith('chunk_section1')) { environment.add(child); continue; }
            if(register(child)) environment.add(child);
        }
        loaded++;
        if(loaded >= total) registry.finish(registry);
    }

    const start = file => new Promise(resolve => {
        loader.load(url(SECTION1_BASE + file), gltf => resolve(gltf.scene), undefined, error => { console.warn('Section 1 chunk failed', file, error); resolve(null); });
    });
    // The first chunk first, so the Trailhead is there when the marshal arrives; the rest, and the far ring, behind it.
    (async () => {
        for(const file of files) { const scene = await start(file); if(scene) adopt(scene, false); else loaded++; }
        if(far) { const scene = await start(far); if(scene) adopt(scene, true); else loaded++; }
        if(loaded >= total) registry.finish(registry);
    })();

    return {
        registry,
        ready,
        buildEnvironment: () => ({ group: environment }),
        buildLandmarks: () => ({
            group: landmarks,
            setBreached() {},
            update(t) {
                for(const { node, seed } of registry.lanterns) node.rotation.z = Math.sin(t * 1.7 + seed) * 0.07;
                registry.flames.forEach((f, i) => f.scale.set(1, 0.85 + 0.25 * Math.sin(t * 9 + i), 1));
            }
        }),
        dispose() {
            disposed = true;
            environment.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        }
    };
}
