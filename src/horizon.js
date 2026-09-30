import * as THREE from 'three';

// The skyline beyond the fog: a ring of mesas, peaks, hills or chimney stacks around the arena, one merged mesh (one
// draw call) that follows the player so it always stays far away. It is not fogged (the fog would swallow it) but
// coloured from the stage's own fog and light, so it reads as far-off haze. Rebuilt when the stage changes.
const RING = 190;
let mesh = null;

function seeded(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// One shape of a style, standing on the ground at the origin: returns a geometry with its base at y = 0.
function shape(style, rand, scale) {
    const w = 0.7 + rand() * 0.8;
    if(style === 'mesa') { const h = (22 + rand() * 24) * scale; return new THREE.CylinderGeometry(9 * w, 16 * w, h, 7).translate(0, h / 2, 0); }
    if(style === 'peaks') { const h = (26 + rand() * 30) * scale; return new THREE.ConeGeometry(14 * w, h, 6).translate(0, h / 2, 0); }
    if(style === 'stacks') { const h = (30 + rand() * 30) * scale; return new THREE.CylinderGeometry(2.2, 3.2, h, 8).translate(0, h / 2, 0); }
    if(style === 'flat') { const h = (3 + rand() * 4) * scale; return new THREE.CylinderGeometry(28 * w, 34 * w, h, 8).translate(0, h / 2, 0); }
    const h = (10 + rand() * 14) * scale; // hills
    return new THREE.ConeGeometry(30 * w, h, 7).translate(0, h / 2, 0);
}

// Builds (or rebuilds) the ring for a stage. `look` is an atmosphere from atmosphere.js.
export function setHorizon(scene, look) {
    mesh?.removeFromParent();
    mesh?.geometry.dispose();
    const { style, height, strength } = look.horizon;
    const rand = seeded(20260930);
    const haze = new THREE.Color(look.fog.color);
    // Far things are a little darker than the haze in front of them, and a little warmer toward the top.
    const base = haze.clone().lerp(new THREE.Color(look.sky[3]), 0.3).multiplyScalar(0.8);
    const top = base.clone().lerp(new THREE.Color(look.hemi.ground), strength * 0.6).multiplyScalar(0.82);
    const count = style === 'flat' ? 16 : style === 'stacks' ? 14 : 22;
    const parts = [];
    for(let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.25;
        const g = shape(style, rand, height).toNonIndexed();
        g.deleteAttribute('uv');
        g.rotateY(rand() * 6);
        g.translate(Math.cos(angle) * (RING + rand() * 20), -1, Math.sin(angle) * (RING + rand() * 20));
        const position = g.attributes.position;
        const colors = new Float32Array(position.count * 3);
        for(let v = 0; v < position.count; v++) {
            const k = Math.min(1, Math.max(0, (position.getY(v) + 1) / (60 * height)));
            const c = base.clone().lerp(top, Math.sqrt(k));
            colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.deleteAttribute('normal');
        parts.push(g);
    }
    const geometry = mergeAll(parts);
    mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    scene.add(mesh);
}

function mergeAll(parts) {
    const total = parts.reduce((sum, g) => sum + g.attributes.position.count, 0);
    const position = new Float32Array(total * 3);
    const color = new Float32Array(total * 3);
    let offset = 0;
    for(const g of parts) {
        position.set(g.attributes.position.array, offset * 3);
        color.set(g.attributes.color.array, offset * 3);
        offset += g.attributes.position.count;
        g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
    return merged;
}

// The ring stays centred on the player, so the skyline never gets closer.
export function updateHorizon(focus) {
    if(mesh) mesh.position.set(focus.x, 0, focus.z);
}
