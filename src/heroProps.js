import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { obstacles } from './state.js';
import { markObstacleGridDirty } from './physics.js';
import { toonVertexColorMaterial } from './assets.js';

// One landmark per home ground (STORY_BIBLE.md section 5): Pete's broken piano, the well at Whisper Wash, the bell tower
// at Hollow Hill... Each is a single merged mesh (one draw call) that stands still at a fixed spot a walk from the start,
// and blocks the way like a rock (it cannot be shot apart). Colours are baked in, so they do not follow the stage tint.
const material = toonVertexColorMaterial();

function part(geometry, hex, x, y, z, ry = 0, rz = 0) {
    geometry.rotateZ(rz);
    geometry.rotateY(ry);
    geometry.translate(x, y, z);
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    const color = new THREE.Color(hex);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for(let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
}
const B = (w, h, d, hex, x, y, z, ry, rz) => part(new THREE.BoxGeometry(w, h, d), hex, x, y, z, ry, rz);
const C = (rt, rb, h, hex, x, y, z, seg = 10) => part(new THREE.CylinderGeometry(rt, rb, h, seg), hex, x, y, z);
const K = (r, h, hex, x, y, z, seg = 10) => part(new THREE.ConeGeometry(r, h, seg), hex, x, y, z);

// Each landmark: its parts, and the circles it blocks ({ x, z, r } relative to where it stands).
export const HEROES = {
    // Copper Bit: the Tin Cup's piano, dragged into the street and left, lid hanging open, with a lantern post beside it.
    piano: {
        blocks: [{ x: 0, z: 0, r: 2.2 }],
        parts: () => [
            B(3.6, 1.8, 1.6, 0x3b2418, 0, 1.4, 0), B(3.6, 0.15, 0.7, 0xf2ead8, 0, 2.35, 0.95), B(3.4, 0.12, 1.5, 0x2a1810, 0, 3.0, -0.5, 0, 0.7),
            B(0.25, 1.1, 0.25, 0x2a1810, -1.6, 0.55, 0.6), B(0.25, 1.1, 0.25, 0x2a1810, 1.6, 0.55, 0.6), B(0.25, 1.1, 0.25, 0x2a1810, 1.6, 0.55, -0.6),
            C(0.12, 0.12, 5, 0x2b2b2e, 3.4, 2.5, 0.4, 6), B(0.7, 0.7, 0.7, 0xffcc55, 3.4, 5.1, 0.4)
        ]
    },
    // Whisper Wash: a dry stone well with its bucket still on the rope.
    well: {
        blocks: [{ x: 0, z: 0, r: 2.0 }],
        parts: () => [
            C(1.8, 2.0, 1.4, 0x8a8a84, 0, 0.7, 0, 12), C(1.2, 1.2, 0.2, 0x1a1512, 0, 1.42, 0, 12),
            B(0.3, 3.4, 0.3, 0x5a3c22, -1.7, 1.7, 0), B(0.3, 3.4, 0.3, 0x5a3c22, 1.7, 1.7, 0), B(4.2, 0.3, 0.4, 0x5a3c22, 0, 3.5, 0),
            B(0.6, 0.7, 0.6, 0x6e4a2a, 0.9, 1.8, 0.9)
        ]
    },
    // Hollow Hill Chapel: a burnt-out gable wall and the bell tower that Deacon Graves still holds.
    tower: {
        blocks: [{ x: 0, z: 0, r: 2.4 }, { x: -5, z: 0, r: 1.6 }],
        parts: () => [
            B(3.2, 11, 3.2, 0x5a5560, 0, 5.5, 0), K(2.6, 3, 0x2e2a30, 0, 12.5, 0, 4), C(0.9, 0.7, 1.4, 0xd4a83a, 0, 9.4, 0, 8),
            B(5, 4.5, 0.6, 0x4e4a54, -5, 2.25, 0), B(1.6, 1.6, 0.6, 0x4e4a54, -3.6, 5.2, 0), B(0.5, 0.5, 0.5, 0x1e1a1e, -5, 3.2, 0.2)
        ]
    },
    // Twin Forks: the Calloways' barn and silo (the bank with the new hole is up the road).
    barn: {
        blocks: [{ x: -2, z: 0, r: 3.6 }, { x: 2.5, z: 0, r: 3.0 }, { x: 7, z: 0, r: 2.2 }],
        parts: () => [
            B(9, 5.5, 7, 0xa23a2c, 0, 2.75, 0), B(9.4, 0.5, 2.6, 0x5a3a26, 0, 6.2, -1.7, 0, 0.6), B(9.4, 0.5, 2.6, 0x5a3a26, 0, 6.2, 1.7, 0, -0.6),
            B(2.6, 3.2, 0.2, 0xf4ecd8, 0, 1.6, 3.55), C(2.1, 2.1, 8, 0xc9c2b4, 7, 4, 0, 12), K(2.3, 2, 0x8a3a2c, 7, 9, 0, 12)
        ]
    },
    // Slagtown: the foundry chimney with its furnace mouth still glowing.
    furnace: {
        blocks: [{ x: 0, z: 0, r: 3.2 }],
        parts: () => [
            B(6, 3.6, 5, 0x3a3634, 0, 1.8, 0), C(1.4, 2.0, 12, 0x4a4340, 0, 9, 0, 10), C(1.5, 1.4, 0.6, 0x2a2624, 0, 15.2, 0, 10),
            B(2.2, 1.4, 0.3, 0xff7a2a, 0, 1.6, 2.6), B(3.2, 0.5, 0.3, 0x2a2624, 0, 2.6, 2.55), B(0.5, 6, 0.5, 0x2a2624, 3.6, 3, 1.2)
        ]
    },
    // Redstone Mesa: the rope bridge over the dry channel Morgan shows the marshal.
    bridge: {
        blocks: [{ x: -6, z: 0, r: 1.3 }, { x: 6, z: 0, r: 1.3 }],
        parts: () => [
            B(14, 0.3, 2.6, 0x8a6236, 0, 1.4, 0), B(0.4, 4, 0.4, 0x5a3c22, -6.4, 2, 1.3), B(0.4, 4, 0.4, 0x5a3c22, -6.4, 2, -1.3),
            B(0.4, 4, 0.4, 0x5a3c22, 6.4, 2, 1.3), B(0.4, 4, 0.4, 0x5a3c22, 6.4, 2, -1.3), B(13.6, 0.12, 0.12, 0xd8c9a0, 0, 3.4, 1.3), B(13.6, 0.12, 0.12, 0xd8c9a0, 0, 3.4, -1.3),
            B(2.4, 1.2, 2.6, 0x9a4a2a, -8.6, 0.6, 0), B(2.4, 1.2, 2.6, 0x9a4a2a, 8.6, 0.6, 0)
        ]
    },
    // Vane's Crossing: the clock tower whose hands stopped at high noon.
    clock: {
        blocks: [{ x: 0, z: 0, r: 2.3 }],
        parts: () => [
            B(3.6, 10, 3.6, 0x8a6a48, 0, 5, 0), K(3, 3, 0x5a3c22, 0, 11.5, 0, 4), C(1.5, 1.5, 0.4, 0xf4efe0, 0, 8.4, 1.9, 16),
            B(0.18, 1.2, 0.1, 0x1a1512, 0, 8.9, 2.15), B(0.14, 0.9, 0.1, 0x1a1512, 0.05, 8.85, 2.16), B(4, 1.2, 4, 0x6a4c30, 0, 0.6, 0)
        ]
    },
    // Tres Rios: an arch of the old ranch house, the last thing standing in the fog.
    arch: {
        blocks: [{ x: -3, z: 0, r: 1.3 }, { x: 3, z: 0, r: 1.3 }],
        parts: () => [
            B(1.8, 8, 1.6, 0x9aa49a, -3, 4, 0), B(1.8, 8, 1.6, 0x9aa49a, 3, 4, 0), B(8.4, 1.6, 1.6, 0x9aa49a, 0, 8.6, 0),
            B(2.6, 1.4, 1.4, 0x7f8a80, -2.6, 9.9, 0), B(0.7, 3, 0.7, 0x7f8a80, 5.6, 1.5, 0.4), B(1.4, 1.2, 1.2, 0x7f8a80, -5.8, 0.6, -0.6)
        ]
    },
    // The Silver Belle: her paddlewheel, half sunk in the deck, with the brass lamp on its post.
    paddlewheel: {
        blocks: [{ x: 0, z: 0, r: 3.4 }],
        parts: () => {
            const spokes = [];
            for(let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                spokes.push(B(0.35, 4.4, 1.6, 0x8a2a2a, 0, 0, 0, 0, a), B(0.3, 0.3, 1.8, 0xb98a3a, Math.sin(a) * 2, Math.cos(a) * 2, 0));
            }
            return [...spokes.map(g => g.translate(0, 4.2, 0)), C(0.4, 0.4, 2.2, 0xb98a3a, 0, 4.2, 0, 8).rotateX(Math.PI / 2), B(6.4, 1, 0.5, 0x3a1e1e, 0, 0.5, 1.3)];
        }
    },
    // Fort Pell: the flagpole on the rampart, and a watchtower beside it.
    flag: {
        blocks: [{ x: 0, z: 0, r: 1.2 }, { x: 5, z: 0, r: 2.0 }],
        parts: () => [
            C(0.18, 0.28, 13, 0xd8d8dc, 0, 6.5, 0, 6), B(3.4, 2.2, 0.1, 0xb02a2a, 1.8, 11.5, 0), B(3.4, 0.7, 0.12, 0xf4f0e6, 1.8, 11.9, 0),
            B(4, 6, 4, 0x8a929c, 5, 3, 0), B(4.6, 0.6, 4.6, 0x6a727c, 5, 6.3, 0), B(0.5, 1, 4.6, 0x6a727c, 5, 7, 0)
        ]
    }
};

let hero = null; // { mesh }

// Stands one landmark at (x, z), turned by `rotation`, and blocks its circles. Taking its markers out of the scene
// (a stage change, a restart) takes the mesh away too.
export function createHero(scene, id, x, z, rotation = 0) {
    const def = HEROES[id];
    if(!def) return;
    const geometry = mergeGeometries(def.parts().map(g => (g.index ? g.toNonIndexed() : g)), false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    hero = mesh;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    def.blocks.forEach((circle, i) => {
        const marker = new THREE.Object3D();
        const bx = x + circle.x * cos + circle.z * sin;
        const bz = z - circle.x * sin + circle.z * cos;
        marker.position.set(bx, 0, bz);
        marker.matrixAutoUpdate = false;
        marker.updateMatrix();
        if(i === 0) marker.addEventListener('removed', () => { mesh.removeFromParent(); geometry.dispose(); });
        scene.add(marker);
        obstacles.push({ mesh: marker, x: bx, z: bz, radius: circle.r, destructible: false, type: 'landmark' });
    });
    markObstacleGridDirty();
}
