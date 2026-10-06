import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLOW_RENDER_ORDER } from './placeDark.js';
import { TORCH_RADIUS, MAX_HOLES } from './mineLight.js';

// Torches and the lantern for the dark mine (MINE_PLAN.md, slice 5), made in code: boxes, cones, planes, additive glow. No real point lights
// (they are expensive); the glow is fake and the light that clears the dark comes from `torchHoles` (src/placeDark.js, `holes`).
//
//   const torches = createTorchLayer();   scene.add(torches.group);
//   torches.set([{ x, z, lit }, ...]);    // the mine lane's torches: lit ones burn, the others are charred stubs with a thread of smoke
//   torches.update(timeInSeconds);        // every frame (flicker, smoke)
//   torchHoles(list, marshal)             // the nearest lit torches as the dark layer's holes
//   const lantern = createLantern();      marshalGroup.add(lantern.group);  lantern.update(t); lantern.setLit(false)
//
// The whole layer is five instanced meshes however many torches there are (up to MAX_TORCHES).

export const MAX_TORCHES = 48;
export const TORCH_LIGHT_RADIUS = TORCH_RADIUS; // how far a lit torch clears the dark: the mine lane's number (src/mineLight.js)
const FLAME = 0xffa23a, FLAME_HOT = 0xffe39a, TIMBER = 0x5a3e27, IRON = 0x34343a, CHAR = 0x17110d;

function glowTexture(inner, outer) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    g.fillStyle = gradient;
    g.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function painted(geometry, hex) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    const c = new THREE.Color(hex);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for(let i = 0; i < g.attributes.position.count; i++) c.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
}

// The post of a standing torch: a timber stake, an iron cup and a cloth wrap. The head (flame or charred top) is a separate instance.
function stakeGeometry() {
    return mergeGeometries([
        painted(new THREE.BoxGeometry(0.2, 1.7, 0.2).translate(0, 0.85, 0), TIMBER),
        painted(new THREE.BoxGeometry(0.5, 0.16, 0.5).translate(0, 0.08, 0), IRON), // the foot
        painted(new THREE.CylinderGeometry(0.2, 0.13, 0.28, 6).translate(0, 1.68, 0), IRON), // the cup
        painted(new THREE.CylinderGeometry(0.17, 0.2, 0.18, 6).translate(0, 1.5, 0), 0x8a7458) // the wrap
    ], false);
}

export function createTorchLayer() {
    const group = new THREE.Group();
    group.name = 'mine-torches';
    const stakes = new THREE.InstancedMesh(stakeGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), MAX_TORCHES);
    const heads = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.45, 6).translate(0, 1.95, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), MAX_TORCHES);
    const flames = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,236,170,1)', 'rgba(255,120,20,0)'), color: FLAME, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAX_TORCHES);
    const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,170,70,0.55)', 'rgba(255,120,20,0)'), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAX_TORCHES);
    const smoke = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(150,150,150,0.8)', 'rgba(90,90,90,0)'), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAX_TORCHES * 3);
    for(const m of [stakes, heads, flames, halos, smoke]) { m.count = 0; m.frustumCulled = false; }
    for(const m of [heads, flames, halos, smoke]) m.renderOrder = GLOW_RENDER_ORDER; // lit torches show above the dark
    group.add(stakes, heads, flames, halos, smoke);

    let list = [];
    let camera = null;
    flames.onBeforeRender = (renderer, scene, cam) => { camera = cam; };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    const ONE = new THREE.Quaternion();
    const K = 1.6; // torches are a little taller than the marshal's shoulder, so they read from the camera's height

    const layer = {
        group, stakes, heads, flames, halos, smoke,
        set(next) {
            list = next.slice(0, MAX_TORCHES);
            stakes.count = heads.count = list.length;
            list.forEach((t, i) => {
                m4.compose(p.set(t.x, 0, t.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, (i * 2.4) % 6.28), s.set(K, K, K));
                stakes.setMatrixAt(i, m4);
                heads.setMatrixAt(i, m4);
                heads.setColorAt(i, c.setHex(t.lit ? FLAME_HOT : CHAR));
            });
            stakes.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
            if(heads.instanceColor) heads.instanceColor.needsUpdate = true;
            layer.update(0);
        },
        update(timeInSeconds) {
            const facing = camera ? camera.quaternion : ONE;
            let lit = 0, puffs = 0;
            list.forEach((t, i) => {
                if(t.lit) {
                    const f = 1 + Math.sin(timeInSeconds * 13 + i * 1.7) * 0.12 + Math.sin(timeInSeconds * 7.9 + i) * 0.1;
                    flames.setMatrixAt(lit, m4.compose(p.set(t.x, (2.15 + (f - 1) * 0.3) * K, t.z), facing, s.set(0.9 * f * K, 1.5 * f * K, 1)));
                    halos.setMatrixAt(lit, m4.compose(p.set(t.x, 2.0 * K, t.z), facing, s.set(5 * f * K, 5 * f * K, 1)));
                    lit++;
                } else if(puffs < MAX_TORCHES * 3 - 2) { // three puffs rise from a stub and fade
                    for(let k = 0; k < 3; k++) {
                        const phase = (timeInSeconds * 0.35 + k / 3 + i * 0.37) % 1;
                        smoke.setMatrixAt(puffs, m4.compose(p.set(t.x + Math.sin(phase * 6 + i) * 0.25, (2.0 + phase * 2.6) * K, t.z), facing, s.set((0.5 + phase * 0.9) * K, (0.5 + phase * 0.9) * K, 1)));
                        smoke.setColorAt(puffs, c.setScalar((1 - phase) * 0.55));
                        puffs++;
                    }
                }
            });
            flames.count = halos.count = lit;
            smoke.count = puffs;
            flames.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = smoke.instanceMatrix.needsUpdate = true;
            if(smoke.instanceColor) smoke.instanceColor.needsUpdate = true;
        },
        dispose() {
            group.parent?.remove(group);
            for(const m of [stakes, heads, flames, halos, smoke]) { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); m.dispose(); }
        }
    };
    return layer;
}

// The marshal's own lit torches nearest to him (at most `limit`), as holes in the dark layer: [{ x, z, r, k }].
export function torchHoles(list, marshal, limit = MAX_HOLES, radius = TORCH_LIGHT_RADIUS) {
    return list
        .filter(t => t.lit)
        .map(t => ({ t, d: Math.hypot(t.x - marshal.x, t.z - marshal.z) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, limit)
        .map(({ t }) => ({ x: t.x, z: t.z, r: radius, k: 0.9 }));
}

// The lantern in the marshal's hand: an iron frame, a glass box with a bright core, a ring and a handle, and a halo that swings a little.
export function createLantern() {
    const group = new THREE.Group();
    group.name = 'marshal-lantern';
    const body = new THREE.Mesh(mergeGeometries([
        painted(new THREE.BoxGeometry(0.34, 0.06, 0.34).translate(0, -0.2, 0), IRON),
        painted(new THREE.BoxGeometry(0.3, 0.06, 0.3).translate(0, 0.2, 0), IRON),
        painted(new THREE.ConeGeometry(0.22, 0.14, 4).translate(0, 0.3, 0), IRON),
        painted(new THREE.TorusGeometry(0.1, 0.018, 4, 8).translate(0, 0.42, 0), IRON),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => painted(new THREE.BoxGeometry(0.035, 0.4, 0.035).translate(x * 0.14, 0, z * 0.14), IRON))
    ], false), new THREE.MeshLambertMaterial({ vertexColors: true }));
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), new THREE.MeshBasicMaterial({ color: FLAME_HOT }));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,190,90,0.6)', 'rgba(255,140,30,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.renderOrder = GLOW_RENDER_ORDER;
    group.add(body, core, halo);
    let lit = true, seen = null;
    halo.onBeforeRender = (renderer, scene, cam) => { seen = cam; };
    const wq = new THREE.Quaternion();
    const lantern = {
        group,
        get lit() { return lit; },
        setLit(on) { lit = !!on; core.visible = halo.visible = lit; },
        // Flickers, faces the camera and swings with the marshal's steps when `speed` (0..1) is given.
        update(timeInSeconds, speed = 0) {
            group.rotation.z = Math.sin(timeInSeconds * 5) * 0.08 * (0.3 + speed);
            if(!lit) return;
            const f = 1 + Math.sin(timeInSeconds * 14) * 0.08 + Math.sin(timeInSeconds * 9.1) * 0.06;
            halo.scale.setScalar(f);
            if(seen) halo.quaternion.copy(group.getWorldQuaternion(wq)).invert().multiply(seen.quaternion);
        }
    };
    return lantern;
}
