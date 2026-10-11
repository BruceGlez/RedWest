// The look of Pete's Area 1, "The Claims Road" (src/stages/peteArea1.js): a dirt road you can follow, cliffs that stand where the
// walkable ground ends, the camps and shacks of each place, and the Company gate. It reads the layout and never invents it
// (AGENTS.md, "Art and function"): every prop sits on the road data. Static scenery is merged into a few meshes to stay in budget.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, box, cylinder, dodecahedron, paint, sharedVertexMaterial } from './placePeteWorld.js';
import { AREA1_ROAD, AREA1_PLACES, AREA1_EXIT } from './stages/peteArea1.js';
import { pointAlong } from './stages/roadMask.js';

const heading = p => Math.atan2(p.tx, p.tz);

// A strip of beaten earth along the road, so the way on is always visible from the camera.
function roadRibbon(samples, halfWidth, y, hex) {
    const pos = [], index = [];
    for(let i = 0; i < samples.length; i++) {
        const s = samples[i];
        pos.push(s.x + s.tz * halfWidth, y, s.z - s.tx * halfWidth, s.x - s.tz * halfWidth, y, s.z + s.tx * halfWidth);
        if(i > 0) { const a = (i - 1) * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return paint(g, hex);
}

function hash(c, r) { return (((c * 73856093) ^ (r * 19349663)) >>> 0) % 1000; }

function shack(parts, x, z, ry, w = 6, d = 5) {
    const h = 3.4;
    const wall = box(w, h, d, COLORS.woodDark, 0, h / 2, 0);
    const roof = box(w + 1.2, 0.5, d + 1.2, COLORS.wood, 0, h + 0.3, 0, 0.18, 0, 0);
    const door = box(1.4, 2.4, 0.2, 0x2a1a10, 0, 1.2, d / 2 + 0.05);
    for(const g of [wall, roof, door]) { g.rotateY(ry); g.translate(x, 0, z); parts.push(g); }
}

function tent(parts, x, z, ry) {
    const g = box(4, 2.6, 4.5, 0xc9b48a, 0, 1.3, 0, 0, 0, 0);
    const cap = box(4.4, 0.4, 4.9, 0x9c8760, 0, 2.7, 0);
    for(const p of [g, cap]) { p.rotateY(ry); p.translate(x, 0, z); parts.push(p); }
}

function cactus(parts, x, z, scale) {
    parts.push(cylinder(0.45 * scale, 0.5 * scale, 3.6 * scale, 6, 0x4f8a43, x, 1.8 * scale, z));
    parts.push(cylinder(0.3 * scale, 0.3 * scale, 1.4 * scale, 6, 0x4f8a43, x + 0.9 * scale, 2.2 * scale, z));
}

export function createAreaEnvironment(walk) {
    const group = new THREE.Group();
    group.name = 'pete-area1-environment';
    const mask = walk.mask;
    const material = sharedVertexMaterial();

    // The road.
    const dirt = [roadRibbon(AREA1_ROAD.samples, 4.5, 0.05, 0xb07a45)];
    for(const p of AREA1_PLACES) {
        const disc = new THREE.CircleGeometry(Math.min(p.r * 0.55, 13), 14).rotateX(-Math.PI / 2).translate(p.x, 0.045, p.z);
        dirt.push(paint(disc, 0xa56f3e));
    }
    group.add(new THREE.Mesh(mergeGeometries(dirt, false), material));

    // Cliffs stand where the walkable ground ends: the same grid that stops the marshal draws the wall.
    const cliffs = [];
    mask.forEachWallCell((x, z, nx, nz, c, r) => {
        const h = hash(c, r);
        if(h % 3 !== 0) return;
        const len = Math.hypot(nx, nz) || 1;
        const ax = -nx / len, az = -nz / len;           // away from the road
        const height = 3 + (h % 7) * 0.6; // low enough that the camera, which looks down from the south, still sees the road behind a wall
        const w = 7 + (h % 4);
        const px = x + ax * 3, pz = z + az * 3;
        const ry = (h % 31) * 0.1;
        cliffs.push(box(w, height, w, COLORS.cliffBase, px, height / 2, pz, 0, ry, 0));
        cliffs.push(box(w * 0.7, 0.8, w * 0.7, COLORS.cliffRim, px, height + 0.1, pz, 0, ry, 0));
        if(h % 4 === 0) cliffs.push(box(w * 0.8, height * 0.7, w * 0.8, COLORS.cliffLight, px + ax * 6, height * 0.35, pz + az * 6, 0, ry + 0.4, 0));
        if(h % 5 === 1) cliffs.push(dodecahedron(2.6, COLORS.cliffDark, px - ax * 3, 1.8, pz - az * 3, 0.2, ry, 0.1));
    });
    // Beyond the gate: a rock face, so nobody sees the road that is not there yet.
    const gate = AREA1_EXIT;
    const back = { x: gate.x + gate.tx * 9, z: gate.z + gate.tz * 9 };
    cliffs.push(box(70, 15, 8, COLORS.cliffDark, back.x, 7.5, back.z, 0, heading(gate), 0));
    cliffs.push(box(50, 2, 6, COLORS.cliffRim, back.x, 16, back.z, 0, heading(gate), 0));
    group.add(new THREE.Mesh(mergeGeometries(cliffs, false), material));

    // The places.
    const props = [];
    const at = (f, off) => pointAlong(AREA1_ROAD, f, off);
    // Trailhead: a signpost and a hitching post.
    for(const [f, off] of [[0.004, -9], [0.009, 9]]) { const p = at(f, off); props.push(box(0.4, 3.2, 0.4, COLORS.woodDark, p.x, 1.6, p.z)); props.push(box(2.4, 0.9, 0.2, COLORS.wood, p.x, 3, p.z, 0, heading(p), 0)); }
    // Claims: shacks, and sluice boxes lying where they were smashed.
    for(const [f, off, ry] of [[0.115, -19, 0.2], [0.135, 20, 3.3], [0.16, -20, -0.3], [0.178, 19, 2.9]]) { const p = at(f, off); shack(props, p.x, p.z, heading(p) + ry); }
    for(const [f, off] of [[0.12, 9], [0.145, -8], [0.17, 8]]) { const p = at(f, off); props.push(box(7, 0.5, 1.6, COLORS.wood, p.x, 0.5, p.z, 0.1, heading(p) + 0.6, 0.12)); }
    // Flume bridge: a plank deck over the dry flume, with rails.
    { const p = at(0.29, 0), ry = heading(p);
        props.push(box(11, 0.5, 40, COLORS.wood, p.x, 0.55, p.z, 0, ry, 0));
        props.push(box(14, 0.2, 44, 0x3a2416, p.x, 0.08, p.z, 0, ry, 0));
        for(const side of [-5.2, 5.2]) props.push(box(0.4, 1.3, 40, COLORS.woodDark, p.x - p.tz * side, 1.2, p.z + p.tx * side, 0, ry, 0)); }
    // Hairpin: tents and a rock stack.
    for(const [f, off, ry] of [[0.395, 17, 0.4], [0.41, -18, 2.1]]) { const p = at(f, off); tent(props, p.x, p.z, heading(p) + ry); }
    // Miners' camp: the foreman's cabin beside the nook, and tents.
    { const p = at(0.52, -19); shack(props, p.x, p.z, heading(p) + Math.PI, 7, 6); }
    for(const [f, off, ry] of [[0.49, 17, 0.2], [0.54, 18, -0.4]]) { const p = at(f, off); tent(props, p.x, p.z, heading(p) + ry); }
    // Boulder Pass: a timber arch across the road, and boulders.
    { const p = at(0.65, 0), ry = heading(p);
        for(const side of [-11, 11]) props.push(box(0.9, 7, 0.9, COLORS.woodDark, p.x - p.tz * side, 3.5, p.z + p.tx * side));
        props.push(box(0.7, 0.9, 24, COLORS.wood, p.x, 7, p.z, 0, ry, 0).rotateY(0)); }
    for(const [f, off] of [[0.64, -10], [0.66, 11], [0.672, -9]]) { const p = at(f, off); props.push(dodecahedron(2.4, COLORS.cliffLight, p.x, 1.4, p.z, 0.3, 0.5, 0.1)); }
    // The Company gate: palisade either side.
    for(let i = -4; i <= 4; i++) {
        if(Math.abs(i) < 2) continue;
        const px = gate.x - gate.tz * i * 3.4 - gate.tx * 0.5, pz = gate.z + gate.tx * i * 3.4 - gate.tz * 0.5;
        props.push(box(1.1, 6 + (i % 2), 1.1, COLORS.woodDark, px, 3, pz));
    }
    // Desert plants on the open ground.
    for(let i = 0; i < 130; i++) {
        const s = AREA1_ROAD.samples[(i * 37) % AREA1_ROAD.samples.length];
        const off = ((i % 2) ? 1 : -1) * (7 + (i * 13) % 6);
        const x = s.x - s.tz * off, z = s.z + s.tx * off;
        if(walk(x, z)) cactus(props, x, z, 0.7 + (i % 5) * 0.12);
    }
    group.add(new THREE.Mesh(mergeGeometries(props, false), material));

    return { group };
}

// The Company gate across the end of the road. Closed until the payroll manifest is found; it opens for the marshal.
export function createAreaGate() {
    const group = new THREE.Group();
    group.name = 'pete-area1-gate';
    const g = AREA1_EXIT;
    group.position.set(g.x, 0, g.z);
    group.rotation.y = heading(g);
    const fixed = [
        box(1.4, 8, 1.4, COLORS.woodDark, -7, 4, 0), box(1.4, 8, 1.4, COLORS.woodDark, 7, 4, 0),
        box(15.4, 1.2, 1.6, COLORS.wood, 0, 8.4, 0), box(2.2, 1.6, 0.4, 0xb33a2a, 0, 7, 0.9)
    ];
    group.add(new THREE.Mesh(mergeGeometries(fixed, false), sharedVertexMaterial()));
    const left = new THREE.Mesh(box(6.4, 5.4, 0.5, COLORS.wood, -3.3, 2.9, 0), sharedVertexMaterial());
    const right = new THREE.Mesh(box(6.4, 5.4, 0.5, COLORS.wood, 3.3, 2.9, 0), sharedVertexMaterial());
    group.add(left, right);
    return {
        group,
        setBreached(open) {
            left.position.x = open ? -7.5 : 0; right.position.x = open ? 7.5 : 0;
            left.rotation.y = open ? -Math.PI * 0.42 : 0; right.rotation.y = open ? Math.PI * 0.42 : 0;
        },
        update() {}
    };
}
