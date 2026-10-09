import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { obstacles } from './state.js';
import { markObstacleGridDirty } from './physics.js';
import { toonVertexColorMaterial } from './assets.js';
import { KIT_CAPACITY, DEFAULT_ATMOSPHERE } from './atmosphere.js';
import { windUniforms } from './wind.js';
import { assetUrl, DEMO } from './demo.js';

const propLoader = new GLTFLoader();
const propGeometryCache = new Map();
const propLoading = new Map();

export const PROP_MODELS = {
    rock: 'models/rock.glb',
    tree: 'models/tree.glb',
    crate: 'models/crate.glb',
    cactus: 'models/cactus.glb',
    barrel: 'models/barrel.glb',
    fence: 'models/fence.glb'
};

function extractModelGeometry(name, gltf) {
    const parts = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
        if(o.isMesh) {
            const geom = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
            geom.applyMatrix4(o.matrixWorld);
            const color = o.material?.color ? o.material.color : new THREE.Color(0xffffff);
            const count = geom.attributes.position.count;
            const colors = new Float32Array(count * 3);
            for(let i = 0; i < count; i++) color.toArray(colors, i * 3);
            geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            for(const key of Object.keys(geom.attributes)) {
                if(!['position', 'normal', 'color'].includes(key)) geom.deleteAttribute(key);
            }
            parts.push(geom);
        }
    });
    if(!parts.length) return null;
    const mergedGeom = mergeGeometries(parts, false);
    if(name === 'cactus' || name === 'tree') {
        mergedGeom.setAttribute('sway', new THREE.Float32BufferAttribute(new Float32Array(mergedGeom.attributes.position.count).fill(1), 1));
    }
    return mergedGeom;
}

export function loadPropGeometry(name) {
    if(DEMO) return Promise.resolve(null);
    const file = PROP_MODELS[name];
    if(!file) return Promise.resolve(null);
    if(propGeometryCache.has(name)) return Promise.resolve(propGeometryCache.get(name));
    if(propLoading.has(name)) return propLoading.get(name);
    const p = propLoader.loadAsync(assetUrl(file)).then(gltf => {
        const geom = extractModelGeometry(name, gltf);
        if(geom) propGeometryCache.set(name, geom);
        return geom;
    }).catch(() => {
        propLoading.delete(name);
        return null;
    });
    propLoading.set(name, p);
    return p;
}

// The arena's props (rocks, dead trees, crates, cacti, fences) are drawn as one InstancedMesh per kind:
// five draw calls for about 125 props, where each used to be a mesh (or several) of its own. Each prop is
// still an entry in `obstacles`, and its `mesh` is an empty marker in the scene at the prop's position, so
// collision (physics.js), destruction and respawn (bulletSystem.js) and the tests that clear the area
// around the player work as before: taking the marker out of the scene hides the instance and frees its
// slot. Per-instance colour, size and turn give the variety that separate meshes used to.

const COLORS = {
    stone: 0x888888, sandStone: 0xa0825f, deadWood: 0x4d3319, wood: 0x8b4513, crateBand: 0xb8662a, cactus: 0x43a047, iron: 0x2b2b2e, straw: 0xc9a84a, strawLight: 0xe0c266
};

function box(w, h, d, hex, x, y, z, rx = 0, ry = 0, rz = 0) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.rotateX(rx); geometry.rotateY(ry); geometry.rotateZ(rz);
    geometry.translate(x, y, z);
    return paint(geometry, hex);
}

// Every prop geometry carries a colour per vertex (the shared material multiplies it by the instance colour).
function paint(geometry, hex) {
    const count = geometry.attributes.position.count;
    const color = new THREE.Color(hex);
    const colors = new Float32Array(count * 3);
    for(let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    if(geometry.index) geometry = geometry.toNonIndexed();
    geometry.deleteAttribute('uv');
    return geometry;
}

// Marks a shape as one that sways in the wind: every vertex gets a sway weight of 1 (other shapes have none, so 0).
const swaying = geometry => {
    geometry.setAttribute('sway', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1), 1));
    return geometry;
};

const merged = parts => mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)), false);

// One shape per kind. Room for each kind is KIT_CAPACITY in atmosphere.js (the largest map any stage asks for, plus
// respawns; unused slots are still drawn, at zero size). A kind is only built when a stage uses it, so a stage pays
// draw calls only for the props it has. Sizes are in world units at instance scale 1.
const SHAPES = {
    rock: { geometry: () => paint(new THREE.DodecahedronGeometry(1, 0), 0xffffff) },
    // A dead trunk with three bare branches; each tree turns and stretches a little.
    tree: {
        geometry: () => swaying(merged([
            box(0.6, 5, 0.6, COLORS.deadWood, 0, 2.5, 0),
            // Branches leave the trunk at three heights, leaning out about 65 degrees.
            ...[[0.45, 0.5, 1.5], [0.7, 2.6, 2.0], [0.88, 4.7, 1.4]].map(([height, angle, length]) => {
                const branch = new THREE.BoxGeometry(0.3, length, 0.3);
                branch.translate(0, length / 2, 0);
                branch.rotateZ(-1.15);
                branch.rotateY(angle);
                branch.translate(0, 5 * height, 0);
                return paint(branch, COLORS.deadWood);
            })
        ]))
    },
    crate: {
        geometry: () => merged([
            box(3.5, 3.5, 3.5, COLORS.wood, 0, 1.75, 0),
            box(3.7, 0.35, 0.2, COLORS.crateBand, 0, 1.75, 1.75, 0, 0, Math.PI / 4),
            box(3.7, 0.35, 0.2, COLORS.crateBand, 0, 1.75, 1.75, 0, 0, -Math.PI / 4)
        ])
    },
    cactus: {
        geometry: () => swaying(merged([
            box(2, 6, 2, COLORS.cactus, 0, 3, 0),
            box(3, 1, 1, COLORS.cactus, 1, 4, 0),
            box(1, 2, 1, COLORS.cactus, 2, 5, 0)
        ]))
    },
    fence: {
        geometry: () => merged([
            box(0.4, 2.5, 0.4, COLORS.wood, -1.5, 1.25, 0),
            box(0.4, 2.5, 0.4, COLORS.wood, 1.5, 1.25, 0),
            box(3.4, 0.2, 0.1, COLORS.wood, 0, 1.8, 0, 0, 0, 0.03),
            box(3.4, 0.2, 0.1, COLORS.wood, 0, 1.0, 0, 0, 0, -0.03)
        ])
    },
    // A cask, banded in iron.
    barrel: {
        geometry: () => merged([
            paint(new THREE.CylinderGeometry(0.85, 0.85, 1.8, 8).translate(0, 0.9, 0), COLORS.wood),
            paint(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 8).translate(0, 0.45, 0), COLORS.iron),
            paint(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 8).translate(0, 1.4, 0), COLORS.iron)
        ])
    },
    // A grave marker: a slab with a small cap.
    tombstone: {
        geometry: () => merged([
            box(1.3, 2.0, 0.45, 0xffffff, 0, 1.0, 0),
            box(1.0, 0.3, 0.45, 0xffffff, 0, 2.15, 0),
            box(2.0, 0.25, 1.2, 0xffffff, 0, 0.12, 0.2)
        ])
    },
    // A haystack: straw drum under a cone.
    haystack: {
        geometry: () => merged([
            paint(new THREE.CylinderGeometry(1.9, 2.1, 1.7, 10).translate(0, 0.85, 0), COLORS.straw),
            paint(new THREE.ConeGeometry(1.9, 1.6, 10).translate(0, 2.5, 0), COLORS.strawLight)
        ])
    },
    // A rock pillar cut by wind, the mesa's skyline.
    spire: {
        geometry: () => merged([
            paint(new THREE.CylinderGeometry(1.3, 2.4, 9, 6).translate(0, 4.5, 0), 0xffffff),
            paint(new THREE.CylinderGeometry(1.7, 1.4, 1.4, 6).translate(0, 9.4, 0), 0xffffff)
        ])
    },
    // A length of wall: a false front, a ruin or a rampart. Uneven top from a second block.
    wall: {
        geometry: () => merged([
            box(4.2, 3.2, 0.9, 0xffffff, 0, 1.6, 0),
            box(1.6, 0.9, 0.9, 0xffffff, -1.2, 3.65, 0),
            box(0.7, 0.5, 1.1, 0xffffff, 1.5, 3.45, 0)
        ])
    }
};

let current = null; // { scene, kinds: { rock: kind, ... } }, built lazily, one kind at a time
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), euler: new THREE.Euler(), color: new THREE.Color() };
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const material = toonVertexColorMaterial();
// Cacti and dead trees lean with the wind, more toward the top (position.y), out of step by where each stands.
material.onBeforeCompile = shader => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        float lean = sin(uTime * 1.3 + instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17) + 0.4 * sin(uTime * 3.1 + instanceMatrix[3].z * 0.5);
        transformed.x += lean * uWind * 0.03 * sway * position.y;
        transformed.z += lean * uWind * 0.012 * sway * position.y;`);
};
let palette = DEFAULT_ATMOSPHERE.palette; // the stage's colour multipliers per kind (atmosphere.js)

// The stage's tint over every prop (white leaves them alone), and its colours per kind; see atmosphere.js.
export function setSceneryTint(hex, colors = DEFAULT_ATMOSPHERE.palette) {
    material.color.setHex(hex);
    palette = colors;
}

function kindFor(scene, name) {
    const capacity = KIT_CAPACITY[name];
    if(current?.scene !== scene) current = { scene, kinds: {} };
    if(current.kinds[name]) return current.kinds[name];
    const initialGeom = propGeometryCache.get(name) ? propGeometryCache.get(name).clone() : SHAPES[name].geometry();
    const mesh = new THREE.InstancedMesh(initialGeom, material, capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // instances come and go all over the 240-wide map
    mesh.userData.scenery = name;
    for(let i = 0; i < capacity; i++) { mesh.setMatrixAt(i, HIDDEN); mesh.setColorAt(i, scratch.color.set(0xffffff)); }
    scene.add(mesh);
    const entry = { mesh, free: Array.from({ length: capacity }, (_, i) => capacity - 1 - i) };
    current.kinds[name] = entry;

    if(!propGeometryCache.has(name) && PROP_MODELS[name]) {
        loadPropGeometry(name).then(geom => {
            if(!geom) return;
            if(current?.kinds[name] === entry && entry.mesh) {
                entry.mesh.geometry.dispose();
                entry.mesh.geometry = geom.clone();
                entry.mesh.instanceMatrix.needsUpdate = true;
            }
        });
    }

    return entry;
}
for(const kind of Object.keys(PROP_MODELS)) loadPropGeometry(kind);

// Takes every prop out of the scene (a stage change builds a new map). Each marker frees its own instance.
export function clearScenery(scene) {
    for(const obstacle of obstacles) scene.remove(obstacle.mesh);
    obstacles.length = 0;
    markObstacleGridDirty();
}

// Puts one prop in the scene and into obstacles. Returns false when the kind is full (nothing is added).
function place(scene, name, { x, z, y = 0, yaw = 0, tilt = 0, sx = 1, sy = 1, sz = 1, color = 0xffffff, radius, type }) {
    const kind = kindFor(scene, name);
    const capacity = KIT_CAPACITY[name];
    const index = kind.free.pop();
    if(index === undefined) return false;
    const { matrix, position, quaternion, scale, euler } = scratch;
    position.set(x, y, z);
    quaternion.setFromEuler(euler.set(tilt, yaw, 0, 'YXZ'));
    scale.set(sx, sy, sz);
    kind.mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    kind.mesh.setColorAt(index, scratch.color.set(color));
    kind.mesh.instanceMatrix.needsUpdate = true;
    kind.mesh.instanceColor.needsUpdate = true;
    kind.mesh.visible = true;

    const marker = new THREE.Object3D();
    marker.position.set(x, 0, z);
    marker.matrixAutoUpdate = false;
    marker.updateMatrix();
    marker.addEventListener('removed', () => {
        kind.mesh.setMatrixAt(index, HIDDEN);
        kind.mesh.instanceMatrix.needsUpdate = true;
        kind.free.push(index);
        if(kind.free.length === capacity) kind.mesh.visible = false; // a kind with no props left draws nothing
    });
    scene.add(marker);
    obstacles.push({ mesh: marker, x, z, radius, destructible: true, type });
    markObstacleGridDirty();
    return true;
}

const pick = list => list[Math.floor(Math.random() * list.length)];

export function createRock(scene, x, z) {
    const size = 0.5 + Math.random();
    const yaw = Math.random() * 3;
    place(scene, 'rock', {
        x, z, y: size * 0.3, yaw, tilt: Math.random() * 3, sx: size, sy: size * (0.8 + Math.random() * 0.3), sz: size,
        color: pick(palette.rock), radius: size * 0.5, type: 'rock'
    });
}

export function createDeadTree(scene, x, z) {
    place(scene, 'tree', {
        x, z, yaw: Math.random() * Math.PI * 2, tilt: (Math.random() - 0.5) * 0.25, color: palette.tree,
        sx: 0.9 + Math.random() * 0.3, sy: 0.8 + Math.random() * 0.4, sz: 0.9 + Math.random() * 0.3, radius: 1.0, type: 'tree'
    });
}

export function createCrate(scene, x, z) {
    place(scene, 'crate', { x, z, yaw: (Math.random() - 0.5) * 0.3, color: palette.crate, radius: 3.5 * 0.7, type: 'crate' });
}

export function createCactus(scene, x, z) {
    const size = 0.85 + Math.random() * 0.4;
    place(scene, 'cactus', { x, z, yaw: Math.random() * Math.PI * 2, color: palette.cactus, sx: size, sy: size, sz: size, radius: 1.5, type: 'cactus' });
}

export function createFence(scene, x, z, angle) {
    place(scene, 'fence', { x, z, yaw: angle, color: palette.fence, radius: 1.5, type: 'fence' });
}

export function createBarrel(scene, x, z) {
    const size = 0.9 + Math.random() * 0.3;
    place(scene, 'barrel', { x, z, yaw: Math.random() * 6, color: palette.crate, sx: size, sy: size, sz: size, radius: 1.1 * size, type: 'barrel' });
}

export function createTombstone(scene, x, z) {
    const size = 0.8 + Math.random() * 0.5;
    place(scene, 'tombstone', { x, z, yaw: (Math.random() - 0.5) * 0.5, tilt: (Math.random() - 0.5) * 0.15, color: pick(palette.rock), sx: size, sy: size, sz: size, radius: 1.0 * size, type: 'tombstone' });
}

export function createHaystack(scene, x, z) {
    const size = 0.8 + Math.random() * 0.5;
    place(scene, 'haystack', { x, z, yaw: Math.random() * 6, sx: size, sy: size, sz: size, radius: 2 * size, type: 'haystack' });
}

export function createSpire(scene, x, z) {
    const size = 0.7 + Math.random() * 0.7;
    place(scene, 'spire', { x, z, yaw: Math.random() * 6, color: pick(palette.rock), sx: size, sy: size * (0.7 + Math.random() * 0.8), sz: size, radius: 2.2 * size, type: 'spire' });
}

export function createWall(scene, x, z, angle = Math.random() * Math.PI) {
    place(scene, 'wall', { x, z, yaw: angle, color: pick(palette.rock), radius: 2, type: 'wall' });
}
