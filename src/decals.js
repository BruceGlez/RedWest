import * as THREE from 'three';

// Marks on the ground: footprints where the marshal has walked and scorch marks where dynamite went off. All of
// them are slots of one InstancedMesh (one draw call), flat on the ground, and each shrinks away over the last
// third of its life. Presentation only.
const CAPACITY = 160;
const FOOT_LIFE = 7;
const SCORCH_LIFE = 30;
const marks = []; // { x, z, angle, sx, sz, life, maxLife }
let mesh = null;
let host = null;
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const material = new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

function ensureMesh(scene) {
    if(mesh && host === scene) return;
    mesh?.removeFromParent();
    const geometry = new THREE.CircleGeometry(1, 12);
    geometry.rotateX(-Math.PI / 2); // lie flat, facing up
    mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = 1;
    scene.add(mesh);
    host = scene;
}

function add(scene, mark) {
    ensureMesh(scene);
    if(marks.length >= CAPACITY) marks.shift(); // the oldest goes first
    marks.push({ ...mark, maxLife: mark.life });
}

// A footprint at (x, z), pointing along `angle` (radians about Y), a little to the left or right of the walker's line.
export function addFootprint(scene, x, z, angle, left) {
    const side = left ? -0.35 : 0.35;
    add(scene, { x: x + Math.cos(angle) * side, z: z - Math.sin(angle) * side, angle, sx: 0.4, sz: 0.68, life: FOOT_LIFE });
}

export function addScorch(scene, x, z, radius = 3.5) {
    add(scene, { x, z, angle: Math.random() * 6, sx: radius, sz: radius * (0.85 + Math.random() * 0.3), life: SCORCH_LIFE });
}

// The stage's ground decides the colour (darker than the ground, so it reads on sand and on snow alike).
export function setDecalColor(hex) {
    material.color.setHex(hex);
}

export function clearDecals() {
    marks.length = 0;
    if(mesh) mesh.count = 0;
}

export function decalCount() {
    return marks.length;
}

export function updateDecals(dt) {
    if(!mesh) return;
    let n = 0;
    for(let i = marks.length - 1; i >= 0; i--) {
        const m = marks[i];
        m.life -= dt;
        if(m.life <= 0) marks.splice(i, 1);
    }
    for(const m of marks) {
        const k = Math.min(1, (m.life / m.maxLife) * 3);
        position.set(m.x, 0.04, m.z);
        quaternion.setFromEuler(euler.set(0, m.angle, 0));
        scale.set(m.sx * k, 1, m.sz * k);
        mesh.setMatrixAt(n++, matrix.compose(position, quaternion, scale));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
}
