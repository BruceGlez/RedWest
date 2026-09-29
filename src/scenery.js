import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { obstacles } from './state.js';
import { markObstacleGridDirty } from './physics.js';
import { toonVertexColorMaterial } from './assets.js';

// The arena's props (rocks, dead trees, crates, cacti, fences) are drawn as one InstancedMesh per kind:
// five draw calls for about 125 props, where each used to be a mesh (or several) of its own. Each prop is
// still an entry in `obstacles`, and its `mesh` is an empty marker in the scene at the prop's position, so
// collision (physics.js), destruction and respawn (bulletSystem.js) and the tests that clear the area
// around the player work as before: taking the marker out of the scene hides the instance and frees its
// slot. Per-instance colour, size and turn give the variety that separate meshes used to.

const COLORS = {
    stone: 0x888888, sandStone: 0xa0825f, deadWood: 0x4d3319, wood: 0x8b4513, crateBand: 0xb8662a, cactus: 0x43a047
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

const merged = parts => mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)), false);

// One shape per kind, with room for the map's count plus a few (unused slots are still drawn, at zero size).
// Sizes are in world units at instance scale 1.
const SHAPES = {
    rock: { capacity: 68, geometry: () => paint(new THREE.DodecahedronGeometry(1, 0), 0xffffff) },
    // A dead trunk with three bare branches; each tree turns and stretches a little.
    tree: {
        capacity: 18,
        geometry: () => merged([
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
        ])
    },
    crate: {
        capacity: 18,
        geometry: () => merged([
            box(3.5, 3.5, 3.5, COLORS.wood, 0, 1.75, 0),
            box(3.7, 0.35, 0.2, COLORS.crateBand, 0, 1.75, 1.75, 0, 0, Math.PI / 4),
            box(3.7, 0.35, 0.2, COLORS.crateBand, 0, 1.75, 1.75, 0, 0, -Math.PI / 4)
        ])
    },
    cactus: {
        capacity: 24,
        geometry: () => merged([
            box(2, 6, 2, COLORS.cactus, 0, 3, 0),
            box(3, 1, 1, COLORS.cactus, 1, 4, 0),
            box(1, 2, 1, COLORS.cactus, 2, 5, 0)
        ])
    },
    fence: {
        capacity: 18,
        geometry: () => merged([
            box(0.4, 2.5, 0.4, COLORS.wood, -1.5, 1.25, 0),
            box(0.4, 2.5, 0.4, COLORS.wood, 1.5, 1.25, 0),
            box(3.4, 0.2, 0.1, COLORS.wood, 0, 1.8, 0, 0, 0, 0.03),
            box(3.4, 0.2, 0.1, COLORS.wood, 0, 1.0, 0, 0, 0, -0.03)
        ])
    }
};

let current = null; // { scene, kinds: { rock: kind, ... } }
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), euler: new THREE.Euler(), color: new THREE.Color() };
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const material = toonVertexColorMaterial();

// The stage's tint over every prop (white leaves them alone); see atmosphere.js.
export function setSceneryTint(hex) {
    material.color.setHex(hex);
}

function kindsFor(scene) {
    if(current?.scene === scene) return current.kinds;
    const kinds = {};
    for(const [name, shape] of Object.entries(SHAPES)) {
        const mesh = new THREE.InstancedMesh(shape.geometry(), material, shape.capacity);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // instances come and go all over the 240-wide map
        mesh.userData.scenery = name;
        for(let i = 0; i < shape.capacity; i++) { mesh.setMatrixAt(i, HIDDEN); mesh.setColorAt(i, scratch.color.set(0xffffff)); }
        scene.add(mesh);
        kinds[name] = { mesh, free: Array.from({ length: shape.capacity }, (_, i) => shape.capacity - 1 - i) };
    }
    current = { scene, kinds };
    return kinds;
}

// Puts one prop in the scene and into obstacles. Returns false when the kind is full (nothing is added).
function place(scene, name, { x, z, y = 0, yaw = 0, tilt = 0, sx = 1, sy = 1, sz = 1, color = 0xffffff, radius, type }) {
    const kind = kindsFor(scene)[name];
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

    const marker = new THREE.Object3D();
    marker.position.set(x, 0, z);
    marker.matrixAutoUpdate = false;
    marker.updateMatrix();
    marker.addEventListener('removed', () => {
        kind.mesh.setMatrixAt(index, HIDDEN);
        kind.mesh.instanceMatrix.needsUpdate = true;
        kind.free.push(index);
    });
    scene.add(marker);
    obstacles.push({ mesh: marker, x, z, radius, destructible: true, type });
    markObstacleGridDirty();
    return true;
}

export function createRock(scene, x, z) {
    const size = 0.5 + Math.random();
    const yaw = Math.random() * 3;
    place(scene, 'rock', {
        x, z, y: size * 0.3, yaw, tilt: Math.random() * 3, sx: size, sy: size * (0.8 + Math.random() * 0.3), sz: size,
        color: Math.random() > 0.5 ? COLORS.stone : COLORS.sandStone, radius: size * 0.5, type: 'rock'
    });
}

export function createDeadTree(scene, x, z) {
    place(scene, 'tree', {
        x, z, yaw: Math.random() * Math.PI * 2, tilt: (Math.random() - 0.5) * 0.25,
        sx: 0.9 + Math.random() * 0.3, sy: 0.8 + Math.random() * 0.4, sz: 0.9 + Math.random() * 0.3, radius: 1.0, type: 'tree'
    });
}

export function createCrate(scene, x, z) {
    place(scene, 'crate', { x, z, yaw: (Math.random() - 0.5) * 0.3, radius: 3.5 * 0.7, type: 'crate' });
}

export function createCactus(scene, x, z) {
    const size = 0.85 + Math.random() * 0.4;
    place(scene, 'cactus', { x, z, yaw: Math.random() * Math.PI * 2, sx: size, sy: size, sz: size, radius: 1.5, type: 'cactus' });
}

export function createFence(scene, x, z, angle) {
    place(scene, 'fence', { x, z, yaw: angle, radius: 1.5, type: 'fence' });
}
