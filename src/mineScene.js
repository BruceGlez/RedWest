import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { obstacles, gameState } from './state.js';
import { markObstacleGridDirty } from './physics.js';
import { toonVertexColorMaterial } from './assets.js';
import { createMineDark, glowMaterial, GLOW_RENDER_ORDER } from './placeDark.js';
import { createTorchLayer, createLantern, torchHoles } from './placeTorch.js';
import { floorLayout, bounds, distance, gridPoints, wallCircles, propCircles, setActiveFloor } from './mineMap.js';
import { assetUrl, DEMO } from './demo.js';

const mineModelLoader = new GLTFLoader();
const mineModelCache = new Map();
const mineLoadedModels = new Map();
const mineGeometryCache = new Map();

export const MINE_MODELS = {
    cart: 'models/mine_cart.glb',
    arch: 'models/mine_arch.glb',
    rails: 'models/mine_rails.glb',
    chest: 'models/mine_chest.glb',
    mushroom: 'models/mine_mushroom.glb',
    lantern: 'models/mine_lantern.glb',
    torch: 'models/wall_torch.glb'
};

function extractMineGeometry(name, gltf) {
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
    return mergeGeometries(parts, false);
}

export function loadMineModel(name) {
    if(DEMO) return Promise.resolve(null);
    const file = MINE_MODELS[name];
    if(!file) return Promise.resolve(null);
    if(mineLoadedModels.has(name)) return Promise.resolve(mineLoadedModels.get(name));
    if(mineModelCache.has(name)) return mineModelCache.get(name);
    const p = mineModelLoader.loadAsync(assetUrl(file)).then(gltf => {
        mineLoadedModels.set(name, gltf);
        const geom = extractMineGeometry(name, gltf);
        if(geom) mineGeometryCache.set(name, geom);
        return gltf;
    }).catch(() => {
        mineModelCache.delete(name);
        return null;
    });
    mineModelCache.set(name, p);
    return p;
}

export function loadedMineModel(name) {
    return mineLoadedModels.get(name) || null;
}
for(const name of Object.keys(MINE_MODELS)) loadMineModel(name);

// Draws one floor of the Hollow Claim (src/mineMap.js has the shape of the cave and every rule). It is all built from simple shapes
// in code, like the rest of the game, in five draw calls or so: the cave floor, the rock walls, the props (pillars, timber arches,
// crates, carts, rails), the lantern glow, and the lift and the shaft, which change. The art pass (MINE_PLAN.md, slice 4) can replace
// any of these builders without touching the rules.
//
// The walls rise as they go back from the cave: low at the edge (so the marshal is never hidden behind them from the camera, which
// stands to the south and high) and tall in the rock behind. Past the last block the ground is plain dark rock, seen as the roof.

const ROCK_NEAR = 0x746a5e, ROCK_FAR = 0x2a231e, FLOOR = 0x82765f, TIMBER = 0x6b4a2f, TIMBER_DARK = 0x45301f, IRON = 0x34343a, STONE = 0x5b5249;
const LANTERN = 0xffc260;

const seededRandom = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hashOf = text => { let h = 2166136261; for(const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// Every static shape carries a colour per vertex (position, normal and colour only, so they all merge into one geometry).
function paint(geometry, hex, shade = 1) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    const color = new THREE.Color(hex).multiplyScalar(shade);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for(let i = 0; i < g.attributes.position.count; i++) color.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
}

// A box at (x, y, z), turned about the vertical by `yaw`: a direction (cos a, sin a) on the ground is yaw = -a.
function boxAt(w, h, d, hex, x, y, z, yaw = 0, shade = 1) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(yaw);
    g.translate(x, y, z);
    return paint(g, hex, shade);
}

// A shape given as a local geometry, turned about the vertical and stood at (x, z).
function placed(geometry, hex, x, y, z, yaw = 0, shade = 1) {
    geometry.rotateY(yaw);
    geometry.translate(x, y, z);
    return paint(geometry, hex, shade);
}

// ---------- the cave floor and the rock around it ----------

function buildFloor(layout, rand) {
    const TILE = 3;
    const positions = [], normals = [], colors = [];
    const color = new THREE.Color();
    for(const [cx, cz] of gridPoints(layout, TILE, 4)) {
        const d = distance(layout, cx, cz);
        if(d > 2.5) continue;
        // Darker toward the walls (the light does not reach), a little different from tile to tile.
        const shade = (0.55 + 0.45 * Math.min(1, Math.max(0, -d / 8))) * (0.92 + rand() * 0.16);
        color.set(FLOOR).multiplyScalar(shade);
        const h = TILE / 2 + 0.08;
        const y = 0.04;
        for(const [px, pz] of [[-h, -h], [h, h], [h, -h], [-h, -h], [-h, h], [h, h]]) { // counter-clockwise seen from above, so the floor faces the camera
            positions.push(cx + px, y, cz + pz);
            normals.push(0, 1, 0);
            colors.push(color.r, color.g, color.b);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
}

// Blocks of rock on a grid, tall and tilted, rising with the distance from the cave. Merged into one mesh.
function buildRock(layout, rand) {
    const STEP = 4, REACH = 20;
    const parts = [];
    for(const [x, z] of gridPoints(layout, STEP, REACH + 3)) {
        const px = x + (rand() - 0.5) * 2.2, pz = z + (rand() - 0.5) * 2.2;
        const d = distance(layout, px, pz);
        if(d < -0.4 || d > REACH) continue;
        const height = Math.min(11, 1.3 + Math.max(d, 0) * 0.5 + rand() * 2.4);
        const width = 4.6 + rand() * 2.2;
        const g = new THREE.BoxGeometry(width, height, width * (0.85 + rand() * 0.35));
        g.rotateX((rand() - 0.5) * 0.18);
        g.rotateZ((rand() - 0.5) * 0.18);
        g.rotateY(rand() * Math.PI);
        g.translate(px, height / 2 - 0.3, pz);
        // The face is lit near the cave and falls away into the dark behind it; the top catches a little light.
        const geometry = g.toNonIndexed();
        geometry.deleteAttribute('uv');
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        const near = new THREE.Color(ROCK_NEAR), far = new THREE.Color(ROCK_FAR), c = new THREE.Color();
        const depth = Math.min(1, Math.max(0, d / REACH));
        const tint = 0.85 + rand() * 0.3;
        for(let i = 0; i < geometry.attributes.position.count; i++) {
            const k = Math.min(1, Math.max(0, (geometry.attributes.position.getY(i) + 0.3) / height));
            c.copy(far).lerp(near, (1 - depth) * (0.35 + 0.65 * k)).multiplyScalar(tint);
            c.toArray(colors, i * 3);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        parts.push(geometry);
    }
    return mergeGeometries(parts, false);
}

// ---------- what stands in the cave ----------

function pillarParts(layout, rand) {
    return layout.pillars.flatMap(([x, z, r]) => [
        placed(new THREE.CylinderGeometry(r * 0.62, r * 1.12, 6.2, 7), ROCK_NEAR, x, 3.1, z, rand() * 3, 0.9),
        placed(new THREE.CylinderGeometry(r * 1.25, r * 0.7, 0.9, 7), ROCK_NEAR, x, 6.4, z, rand() * 3, 0.78), // the capital under the roof
        placed(new THREE.DodecahedronGeometry(r * 0.55, 0), ROCK_FAR, x + r * 0.9, r * 0.25, z + r * 0.4, rand() * 3, 1.5) // rubble at the foot
    ]);
}

// A timber frame across a passage: two posts, a lintel, braces, and a lantern hung from the middle.
function archParts(layout, glow) {
    const archGeom = mineGeometryCache.get('arch');
    const parts = [];
    for(const [x, z, angle, half] of layout.arches) {
        const yaw = -angle;
        if(archGeom) {
            const g = archGeom.clone();
            g.scale(half / 1.14, 1.7, 1);
            g.rotateY(yaw);
            g.translate(x, 0, z);
            parts.push(g);
        } else {
            const ux = Math.cos(angle), uz = Math.sin(angle);
            for(const side of [-1, 1]) {
                const px = x + ux * half * side, pz = z + uz * half * side;
                parts.push(boxAt(0.8, 4.8, 0.8, TIMBER, px, 2.4, pz, yaw));
                parts.push(boxAt(0.5, 0.5, 1.3, TIMBER_DARK, px, 0.25, pz, yaw)); // the sill
                const bx = x + ux * (half - 1.1) * side, bz = z + uz * (half - 1.1) * side;
                parts.push(boxAt(0.35, 1.9, 0.35, TIMBER_DARK, bx, 4.15, bz, yaw)); // a short strut under the lintel
            }
            parts.push(boxAt(half * 2 + 1.8, 0.7, 0.9, TIMBER, x, 4.9, z, yaw));
            parts.push(boxAt(0.12, 0.9, 0.12, IRON, x, 4.0, z, yaw)); // the chain
        }
        glow.push(boxAt(0.5, 0.6, 0.5, LANTERN, x, 3.4, z, yaw));
        const lanternGeom = mineGeometryCache.get('lantern');
        if(lanternGeom) {
            const g = lanternGeom.clone();
            g.scale(1.3, 1.3, 1.3);
            g.rotateY(yaw);
            g.translate(x, 3.4, z);
            parts.push(g);
        }
    }
    return parts;
}

// Stacked crates and barrels, as a few of them stood up against a wall or a pillar.
function clusterParts(layout, rand, glow) {
    const parts = [];
    const mushGeom = mineGeometryCache.get('mushroom');
    for(const [x, z] of layout.clusters) {
        const yaw = rand() * 3;
        parts.push(boxAt(2.2, 2.0, 2.2, 0xa07a4c, x - 0.9, 1.0, z, yaw));
        parts.push(boxAt(2.2, 2.0, 2.2, 0x946e44, x + 1.2, 1.0, z + 0.4, yaw + 0.3));
        parts.push(boxAt(2.0, 1.8, 2.0, 0xa98150, x + 0.1, 2.9, z + 0.1, yaw + 0.15));
        parts.push(boxAt(2.3, 0.22, 0.22, TIMBER_DARK, x - 0.9, 2.05, z + 1.12, yaw)); // a band across the first crate
        parts.push(placed(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 8), TIMBER, x - 1.1, 0.8, z - 1.9, 0));
        parts.push(placed(new THREE.CylinderGeometry(0.8, 0.8, 0.14, 8), IRON, x - 1.1, 1.2, z - 1.9, 0));
        glow.push(boxAt(0.32, 0.4, 0.32, LANTERN, x + 0.1, 4.0, z + 0.1, yaw)); // a lantern left on top
        if(mushGeom) {
            const g = mushGeom.clone();
            g.scale(1.2, 1.2, 1.2);
            g.rotateY(rand() * 6.28);
            g.translate(x + 1.5, 0, z - 1.2);
            parts.push(g);
        }
    }
    return parts;
}

// An ore cart on the rails, facing along them, heaped with ore.
function cartParts(layout, rand) {
    const cartGeom = mineGeometryCache.get('cart');
    const parts = [];
    for(const [x, z, angle] of layout.carts) {
        const yaw = -angle;
        if(cartGeom) {
            const g = cartGeom.clone();
            g.scale(2.0, 1.5, 2.0);
            g.rotateY(yaw);
            g.translate(x, 0, z);
            parts.push(g);
        } else {
            const at = (lx, lz) => [x + Math.cos(angle) * lx - Math.sin(angle) * lz, z + Math.sin(angle) * lx + Math.cos(angle) * lz];
            parts.push(boxAt(3.2, 1.0, 1.9, IRON, x, 0.95, z, yaw));
            parts.push(boxAt(3.5, 0.2, 2.2, 0x4d4d56, x, 1.5, z, yaw)); // the rim
            for(const lx of [-1.0, 1.0]) for(const lz of [-1.0, 1.0]) {
                const [wx, wz] = at(lx, lz * 0.95);
                parts.push(placed(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 8).rotateX(Math.PI / 2), 0x222226, wx, 0.42, wz, yaw));
            }
            for(let i = 0; i < 3; i++) {
                const [ox, oz] = at((i - 1) * 0.9, (rand() - 0.5) * 0.6);
                parts.push(placed(new THREE.DodecahedronGeometry(0.6 + rand() * 0.25, 0), 0x5a5750, ox, 1.7, oz, rand() * 3, 0.9 + rand() * 0.3));
            }
        }
    }
    return parts;
}

// Rails: two bars on timber ties along each leg of the polyline.
function railParts(layout) {
    const railGeom = mineGeometryCache.get('rails');
    const parts = [];
    if(railGeom) {
        for(let i = 0; i < layout.rails.length - 1; i++) {
            const [x1, z1] = layout.rails[i], [x2, z2] = layout.rails[i + 1];
            const length = Math.hypot(x2 - x1, z2 - z1);
            const angle = Math.atan2(z2 - z1, x2 - x1);
            const yaw = -angle + Math.PI / 2;
            const ux = Math.cos(angle), uz = Math.sin(angle);
            const step = 2.0;
            const count = Math.max(1, Math.round(length / step));
            for(let s = 0; s < count; s++) {
                const t = (s + 0.5) / count * length;
                const g = railGeom.clone();
                g.rotateY(yaw);
                g.translate(x1 + ux * t, 0, z1 + uz * t);
                parts.push(g);
            }
        }
        return parts;
    }
    for(let i = 0; i < layout.rails.length - 1; i++) {
        const [x1, z1] = layout.rails[i], [x2, z2] = layout.rails[i + 1];
        const length = Math.hypot(x2 - x1, z2 - z1);
        const angle = Math.atan2(z2 - z1, x2 - x1);
        const yaw = -angle;
        const ux = Math.cos(angle), uz = Math.sin(angle);
        const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
        for(const side of [-0.7, 0.7]) parts.push(boxAt(length, 0.16, 0.18, IRON, mx - uz * side, 0.14, mz + ux * side, yaw));
        for(let t = 0.75; t < length; t += 1.6) {
            parts.push(boxAt(0.4, 0.1, 2.0, TIMBER_DARK, x1 + ux * t, 0.09, z1 + uz * t, yaw));
        }
    }
    return parts;
}

// ---------- the lift and the shaft ----------

function liftParts(glow) {
    const parts = [placed(new THREE.CylinderGeometry(4.6, 4.9, 0.34, 10), 0x7a5a3c, 0, 0.17, 0, 0.3)];
    for(let i = 0; i < 6; i++) {
        const x = -3.5 + i * 1.4;
        parts.push(boxAt(0.12, 0.05, 2 * Math.sqrt(4.5 * 4.5 - x * x), TIMBER_DARK, x, 0.36, 0, 0)); // plank seams, within the round deck
    }
    for(const [px, pz] of [[-5.6, -5.0], [5.6, -5.0], [-5.6, 5.0], [5.6, 5.0]]) {
        parts.push(boxAt(0.45, 2.6, 0.45, TIMBER_DARK, px, 1.3, pz));
        glow.push(boxAt(0.4, 0.5, 0.4, LANTERN, px, 2.85, pz));
    }
    // The hoist frame behind the platform, with the cable going up into the dark.
    parts.push(boxAt(0.7, 7.5, 0.7, TIMBER, -3.2, 3.75, -8), boxAt(0.7, 7.5, 0.7, TIMBER, 3.2, 3.75, -8), boxAt(7.6, 0.7, 0.9, TIMBER, 0, 7.4, -8));
    parts.push(boxAt(0.14, 6.6, 0.14, IRON, 0, 4.1, -8));
    return parts;
}

// A tall pale beam and a ring of light on the lift's deck, so the way up can be found from far away in the dark (the shaft's is gold, the
// lift's is a cold white: daylight from above). Drawn after the dark layer (src/placeDark.js).
function buildLiftBeacon() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 40, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 20;
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.9, 6.4, 24).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xbcd8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.14;
    for(const m of [beam, ring]) m.renderOrder = GLOW_RENDER_ORDER;
    group.add(beam, ring);
    return { group, beam, ring };
}

// The shaft down: a pit with a stone curb, a ring of light on the floor and a tall beam of light that shows over the rock from far away.
// It is always open: the way down is never locked, it is only a walk away.
function buildShaft(layout, glow) {
    const [sx, sz] = layout.shaft;
    const group = new THREE.Group();
    group.position.set(sx, 0, sz);

    const pit = new THREE.Mesh(new THREE.CircleGeometry(3.3, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050403 }));
    pit.position.y = 0.07;
    const curbParts = [];
    for(let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        curbParts.push(boxAt(2.1, 0.7, 1.0, STONE, Math.cos(a) * 3.8, 0.35, Math.sin(a) * 3.8, -a + Math.PI / 2));
    }
    for(const [px, pz] of [[-6.3, 0], [6.3, 0], [0, -6.3], [0, 6.3]]) {
        curbParts.push(boxAt(0.4, 2.2, 0.4, TIMBER_DARK, px, 1.1, pz));
        glow.push(boxAt(0.4, 0.5, 0.4, LANTERN, sx + px, 2.45, sz + pz));
    }
    // A ladder down the shaft: two rails and rungs, going into the dark.
    for(const side of [-1, 1]) curbParts.push(boxAt(0.14, 0.14, 2.6, TIMBER, side * 0.5, 0.9, -1.6));
    for(let i = 0; i < 5; i++) curbParts.push(boxAt(1.2, 0.1, 0.1, TIMBER, 0, 0.9 - i * 0.02, -2.6 + i * 0.6));
    const curb = new THREE.Mesh(mergeGeometries(curbParts, false), toonVertexColorMaterial());
    curb.castShadow = curb.receiveShadow = true;

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.1, 46, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 23;
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 5.4, 24).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffc260, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.12;

    for(const m of [beam, ring]) m.renderOrder = GLOW_RENDER_ORDER;
    group.add(pit, curb, beam, ring);
    return { x: sx, z: sz, group, beam, ring };
}

// A treasure chest: a box with a lid that lifts when it is opened, brass bands, and a gold glow while it is shut.
function buildChest(x, z, yaw) {
    const gltf = loadedMineModel('chest');
    if(gltf) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = yaw;
        const clone = gltf.scene.clone(true);
        const lidPivot = new THREE.Group();
        lidPivot.position.set(0, 0.74, -0.74);
        let glow = null;
        const baseMeshes = [], lidMeshes = [];
        clone.traverse(o => {
            if(o.isMesh) {
                o.castShadow = true;
                if(o.name.includes('Treasure_Glow')) glow = o;
                else if(o.name.includes('Lid')) lidMeshes.push(o);
                else baseMeshes.push(o);
            }
        });
        for(const m of baseMeshes) group.add(m);
        for(const m of lidMeshes) {
            m.position.y -= 0.74;
            m.position.z += 0.74;
            lidPivot.add(m);
        }
        if(!glow) {
            glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd060 }));
            glow.position.set(0, 1.9, 0);
        }
        group.add(lidPivot, glow);
        return { group, lidPivot, glow, open: false };
    }
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    const body = new THREE.Mesh(mergeGeometries([boxAt(2.4, 1.2, 1.6, 0x7a4f2a, 0, 0.6, 0), boxAt(2.5, 0.14, 1.7, 0xc8a050, 0, 0.35, 0), boxAt(2.5, 0.14, 1.7, 0xc8a050, 0, 1.0, 0)], false), toonVertexColorMaterial());
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1.2, -0.8);
    const lid = new THREE.Mesh(mergeGeometries([boxAt(2.4, 0.5, 1.6, 0x8a5a30, 0, 0.25, 0.8), boxAt(0.4, 0.5, 0.12, 0xc8a050, 0, 0.12, 1.64)], false), toonVertexColorMaterial());
    lidPivot.add(lid);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd060 }));
    glow.position.set(0, 1.9, 0);
    for(const m of [body, lid]) m.castShadow = true;
    group.add(body, lidPivot, glow);
    return { group, lidPivot, glow, open: false };
}

// ---------- a whole floor ----------

let current = null; // { floor, layout, group, shaft, chests, markers }
const DEFAULT_MAP_SIZE = gameState.MAP_SIZE; // how far the marshal may walk in the open arena; a cave sets its own, larger, limit

const kindOfType = { wall: 'wall', pillar: 'spire', post: 'fence', cluster: 'crate', cart: 'crate', chest: 'crate' }; // for the impact sparks (src/combatMath.js)

function solidMarkers(layout) {
    const markers = [];
    for(const c of [...wallCircles(layout), ...propCircles(layout)]) {
        // Never destroyed and never respawned (destructible: false); the marker is only what the physics and the bullets look at.
        const mesh = new THREE.Object3D();
        mesh.position.set(c.x, 0, c.z);
        mesh.userData.mine = true;
        const entry = { mesh, x: c.x, z: c.z, radius: c.r, destructible: false, type: kindOfType[c.kind] ?? 'wall' };
        markers.push(entry);
    }
    return markers;
}

// Builds floor `floor` (a no-op when it is already the floor on show). The marshal always starts on the lift at (0, 0).
export function showMineFloor(scene, floor) {
    if(current?.floor === floor) return current;
    clearMineFloor(scene);
    const layout = floorLayout(floor);
    const rand = seededRandom(hashOf(layout.id));
    const group = new THREE.Group();
    group.name = 'mine-floor';
    const glow = []; // lanterns that hang in the cave: dark like everything else until the marshal's light reaches them
    const beacon = []; // the lift's and the shaft's lanterns: they stay lit, drawn above the dark

    const solid = (geometry, { cast = false, receive = true } = {}) => {
        const mesh = new THREE.Mesh(geometry, toonVertexColorMaterial());
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
        group.add(mesh);
        return mesh;
    };
    // The rock mass under everything: a dark plane far larger than the cave, so a big cave never runs off the arena's ground.
    const reach = bounds(layout, 300);
    const mass = new THREE.Mesh(new THREE.PlaneGeometry(reach.maxX - reach.minX, reach.maxZ - reach.minZ).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x17120e }));
    mass.position.set((reach.minX + reach.maxX) / 2, -0.1, (reach.minZ + reach.maxZ) / 2);
    group.add(mass);
    solid(buildFloor(layout, rand));
    solid(buildRock(layout, rand), { cast: true });
    const props = [...pillarParts(layout, rand), ...archParts(layout, glow), ...clusterParts(layout, rand, glow), ...cartParts(layout, rand), ...railParts(layout), ...liftParts(beacon)];
    solid(mergeGeometries(props, false), { cast: true });

    const shaft = buildShaft(layout, beacon);
    group.add(shaft.group);
    const lift = buildLiftBeacon();
    group.add(lift.group);
    const chests = layout.chests.map(([x, z], i) => {
        const chest = buildChest(x, z, (i * 2.1) % 6.28);
        group.add(chest.group);
        return chest;
    });
    // The lantern glow is one unlit mesh, so it stays bright whatever the light does.
    group.add(new THREE.Mesh(mergeGeometries(glow, false), new THREE.MeshBasicMaterial({ vertexColors: true })));
    const beacons = new THREE.Mesh(mergeGeometries(beacon, false), glowMaterial({ vertexColors: true }));
    beacons.renderOrder = GLOW_RENDER_ORDER;
    group.add(beacons);
    // The dark: black outside the marshal's light, with the lift and the shaft always a little lit (never a lost player).
    const dark = createMineDark(scene, [[0, 0, 11, 0.85], [shaft.x, shaft.z, 11, 0.85]]);
    group.add(dark.mesh);
    const torches = createTorchLayer();
    group.add(torches.group);
    const marshal = scene.children.find(o => o.userData?.muzzle) ?? null;
    const lantern = createLantern();
    lantern.group.position.set(-0.6, 1.2, 0.7); // in his hand
    lantern.group.scale.setScalar(1.6);
    marshal?.add(lantern.group);

    scene.add(group);
    const markers = solidMarkers(layout);
    obstacles.push(...markers);
    markObstacleGridDirty();
    setActiveFloor(layout);
    const b = bounds(layout, 0);
    gameState.MAP_SIZE = Math.ceil(Math.max(-b.minX, b.maxX, -b.minZ, b.maxZ)) + 40; // the marshal can walk the whole cave
    current = { floor, layout, group, shaft, lift, chests, markers, dark, torches, torchList: [], lantern, marshal };
    return current;
}

export function clearMineFloor(scene) {
    if(!current) { setActiveFloor(null); return; }
    scene.remove(current.group);
    current.lantern.group.parent?.remove(current.lantern.group);
    current.lantern.group.traverse(o => { if(o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
    current.group.traverse(o => {
        if(!o.isMesh) return;
        o.geometry.dispose();
        o.material.dispose();
    });
    const gone = new Set(current.markers);
    for(let i = obstacles.length - 1; i >= 0; i--) if(gone.has(obstacles[i])) obstacles.splice(i, 1);
    markObstacleGridDirty();
    setActiveFloor(null);
    gameState.MAP_SIZE = DEFAULT_MAP_SIZE;
    current = null;
}

export const mineFloorOnShow = () => current;

// The torches on show: [{ x, z, lit }]. The mine lane's rules decide where they stand and which are lit; lit ones burn and clear the dark, the
// others are charred stubs that smoke (what a light eater leaves). The marshal's lantern: `setMineLantern(false)` puts it out.
export function setMineTorches(list) {
    if(!current) return;
    current.torchList = list;
    current.torches.set(list);
}
export const setMineLantern = lit => current?.lantern.setLit(lit);

// Opens chest `index` (the lid lifts, the glow goes out).
export function openMineChest(index) {
    const chest = current?.chests[index];
    if(!chest || chest.open) return false;
    chest.open = true;
    chest.lidPivot.rotation.x = -1.1;
    chest.glow.visible = false;
    return true;
}

// The shaft's beam and ring breathe.
export function updateMineScene(timeInSeconds) {
    const shaft = current?.shaft;
    if(!shaft) return;
    if(current.marshal) current.dark.extraHoles = torchHoles(current.torchList, current.marshal.position);
    current.dark.update(timeInSeconds);
    current.torches.update(timeInSeconds);
    current.lantern.update(timeInSeconds);
    current.lift.beam.material.opacity = 0.13 + (0.5 + 0.5 * Math.sin(timeInSeconds * 1.9 + 1)) * 0.08;
    const pulse = 0.5 + 0.5 * Math.sin(timeInSeconds * 2.4);
    shaft.beam.material.opacity = 0.16 + pulse * 0.1;
    shaft.ring.material.opacity = 0.28 + pulse * 0.22;
    for(const chest of current.chests) if(!chest.open) chest.glow.rotation.y = timeInSeconds * 1.5;
}
