import * as THREE from 'three';

// The marshal's dog (TOWN_PLAN.md, step C; Fate's pet, without any of its fighting). The Calloways keep one more dog than
// they can feed: once their farm is open, the kennel gives you one, and it follows you around the town. It is only a
// companion: nothing about it reaches a fight or the wallet, so it is kept on this device, not in the account.

const KEY = 'redWestCompanion.v1';

// { adopted: has the marshal taken the dog, following: is it out walking with him }
export function loadCompanion(storage = globalThis.localStorage) {
    try {
        const raw = JSON.parse(storage.getItem(KEY));
        const adopted = raw?.adopted === true;
        return { adopted, following: adopted && raw?.following !== false };
    } catch {
        return { adopted: false, following: false };
    }
}

export function saveCompanion(state, storage = globalThis.localStorage) {
    try { storage.setItem(KEY, JSON.stringify({ adopted: !!state.adopted, following: !!state.following })); } catch { /* private mode */ }
}

export const FOLLOW = { stop: 2.0, speed: 8.4, catchUp: 9, snapBack: 28 };

// One step of a dog following a target: trots to within `stop` of it, faster when far behind, and is put beside it
// if it somehow gets very far (the marshal was moved across the town).
export function followStep(dog, target, dt) {
    const dx = target.x - dog.x;
    const dz = target.z - dog.z;
    const distance = Math.hypot(dx, dz);
    if(distance > FOLLOW.snapBack) return { x: target.x - 1.2, z: target.z, heading: dog.heading ?? 0, moving: false };
    if(distance <= FOLLOW.stop) return { x: dog.x, z: dog.z, heading: Math.atan2(dx, dz), moving: false };
    const speed = distance > FOLLOW.catchUp ? FOLLOW.speed * 1.6 : FOLLOW.speed;
    const move = Math.min(distance - FOLLOW.stop, speed * dt);
    return { x: dog.x + (dx / distance) * move, z: dog.z + (dz / distance) * move, heading: Math.atan2(dx, dz), moving: true };
}

const tan = new THREE.MeshLambertMaterial({ color: 0xb58a52 });
const dark = new THREE.MeshLambertMaterial({ color: 0x5a3d2b });
const nose = new THREE.MeshLambertMaterial({ color: 0x1a1412 });

// A chunky dog from boxes, about 1.5 long. Faces +z. update(dt, moving) swings its legs and wags its tail.
export function createDog() {
    const root = new THREE.Group();
    const part = (w, h, d, material, x, y, z) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        root.add(mesh);
        return mesh;
    };
    part(0.62, 0.6, 1.25, tan, 0, 0.95, 0);
    const head = part(0.52, 0.5, 0.55, tan, 0, 1.3, 0.78);
    part(0.26, 0.2, 0.22, nose, 0, 1.22, 1.1);
    part(0.14, 0.3, 0.12, dark, -0.22, 1.66, 0.7);
    part(0.14, 0.3, 0.12, dark, 0.22, 1.66, 0.7);
    const tail = new THREE.Group();
    tail.position.set(0, 1.12, -0.62);
    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.6), dark);
    tailMesh.position.set(0, 0.12, -0.26);
    tailMesh.rotation.x = 0.5;
    tail.add(tailMesh);
    root.add(tail);
    const legs = [];
    for(const [x, z] of [[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.45], [0.22, -0.45]]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.65, z);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.65, 0.17), dark);
        mesh.position.y = -0.32;
        leg.add(mesh);
        root.add(leg);
        legs.push(leg);
    }
    let clock = 0;
    return {
        object: root,
        update(dt, moving) {
            clock += dt;
            const swing = moving ? Math.sin(clock * 16) * 0.7 : 0;
            legs.forEach((leg, i) => { leg.rotation.x = i === 0 || i === 3 ? swing : -swing; });
            tail.rotation.y = Math.sin(clock * (moving ? 18 : 7)) * 0.5;
            head.position.y = 1.3 + (moving ? Math.abs(Math.sin(clock * 16)) * 0.04 : 0);
        }
    };
}
