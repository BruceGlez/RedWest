import * as THREE from 'three';
import { particles } from './state.js'; // Direct access to state
import { playSound } from './audio.js';
import { IMPACTS } from './combatMath.js';

// Every particle in the game (hit bursts, dust, sparks, splinters, shell casings, muzzle flashes, explosions) is
// one entry in `particles` and one slot of a single InstancedMesh: one draw call however many are alive. Each
// frame the live ones are packed into the first slots. Each particle has a position, a velocity, a size and a colour.
const CAPACITY = 220;
const CUBE = new THREE.BoxGeometry(1, 1, 1);
let mesh = null;
let host = null;
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const scale = new THREE.Vector3();
const color = new THREE.Color();

function ensureMesh(scene) {
    if(mesh && host === scene) return;
    if(mesh) mesh.removeFromParent();
    mesh = new THREE.InstancedMesh(CUBE, new THREE.MeshBasicMaterial({ color: 0xffffff }), CAPACITY);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.setColorAt(0, color.set(0xffffff)); // allocates the colour buffer up front, so no shader is rebuilt later
    scene.add(mesh);
    host = scene;
}

// One particle. Returns false when the system is full (the burst is simply smaller then).
export function spawnParticle(scene, position, velocity, { size = 0.5, colorHex = 0xffffff, life = 1, gravity = 20, spin = 0, drag = 0 } = {}) {
    if(particles.length >= CAPACITY) return false;
    ensureMesh(scene);
    particles.push({
        position: position.clone(), velocity: velocity.clone(), size, colorHex, life, maxLife: life, gravity, spin, drag,
        angle: Math.random() * 6, grow: 1
    });
    return true;
}

export function clearParticles() {
    particles.length = 0;
    if(mesh) mesh.count = 0;
}

export function getParticlePoolStats() {
    return { active: particles.length, pooled: CAPACITY - particles.length };
}

const range = ([low, high]) => low + Math.random() * (high - low);

// A burst of one kind of impact (IMPACTS in combatMath.js) at a point. Silent: the caller plays the sound.
// `direction` (optional, a unit vector) throws the bits that way, like a bullet's spray, instead of all around.
export function createImpact(scene, position, kind, direction = null) {
    const spec = IMPACTS[kind] ?? IMPACTS.dust;
    for(let i = 0; i < spec.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = spec.speed * (0.4 + Math.random() * 0.8);
        const velocity = new THREE.Vector3(Math.cos(angle) * speed, spec.lift * (0.5 + Math.random()), Math.sin(angle) * speed);
        if(direction) velocity.addScaledVector(direction, spec.speed * 0.6);
        const at = position.clone();
        at.y = Math.max(at.y, 0.6) + 0.6;
        spawnParticle(scene, at, velocity, {
            size: range(spec.size), colorHex: spec.colors[Math.floor(Math.random() * spec.colors.length)],
            life: spec.life * (0.7 + Math.random() * 0.5), gravity: spec.gravity, spin: (Math.random() - 0.5) * 12
        });
    }
}

// The old burst: eight boxes of one colour, with the boom. Used for explosions and bigger moments.
export function createExplosion(scene, pos, colorHex) {
    playSound('boom');
    for(let i = 0; i < 8; i++) {
        const at = pos.clone();
        at.y += 1.5;
        spawnParticle(scene, at, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 10, (Math.random() - 0.5) * 10), { size: 0.5, colorHex, life: 1.0, gravity: 20 });
    }
}

// The flash at a gun's muzzle: a bright block that lasts a few frames, and a couple of sparks thrown forward.
export function createMuzzleFlash(scene, position, direction, { size, life }) {
    spawnParticle(scene, position, new THREE.Vector3(), { size, colorHex: 0xfff2b0, life, gravity: 0, spin: 4 });
    spawnParticle(scene, position, new THREE.Vector3(), { size: size * 0.55, colorHex: 0xffa030, life: life * 1.6, gravity: 0, spin: -6 });
    for(let i = 0; i < 2; i++) {
        const spread = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3);
        spawnParticle(scene, position, direction.clone().multiplyScalar(14 + Math.random() * 8).add(spread), { size: 0.22, colorHex: 0xffd070, life: 0.22, gravity: 4 });
    }
}

// A spent brass casing, thrown out to the side and up, landing with a bounce.
export function createShellCasing(scene, position, sideways) {
    const velocity = sideways.clone().multiplyScalar(5 + Math.random() * 2).setY(6 + Math.random() * 2);
    spawnParticle(scene, position, velocity, { size: 0.2, colorHex: 0xffd54f, life: 0.9, gravity: 28, spin: 20 });
}

export function updateParticles(dt) {
    for(let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if(p.life <= 0) { particles.splice(i, 1); continue; }
        p.position.addScaledVector(p.velocity, dt);
        p.velocity.y -= p.gravity * dt;
        p.angle += p.spin * dt;
        if(p.position.y < 0.1 && p.velocity.y < 0) {
            // The ground: bits bounce once, softly, then rest and fade with their life.
            p.position.y = 0.1;
            p.velocity.y = Math.abs(p.velocity.y) * 0.3;
            p.velocity.x *= 0.5;
            p.velocity.z *= 0.5;
            p.spin = 0;
        }
    }
    if(!mesh) return;
    let n = 0;
    for(const p of particles) {
        // They shrink over the last third of their life, so nothing pops away.
        const k = Math.min(1, (p.life / p.maxLife) * 3);
        scale.setScalar(p.size * (0.4 + 0.6 * k));
        quaternion.setFromEuler(euler.set(p.angle, p.angle * 0.7, 0));
        mesh.setMatrixAt(n, matrix.compose(p.position, quaternion, scale));
        mesh.setColorAt(n, color.setHex(p.colorHex));
        n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
}
