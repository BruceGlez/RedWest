import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The hidden door in the cellar (MINE_PLAN.md, slice 5), made in code: a stone wall with a door in it that you cannot tell from the wall
// until you are close. Near it the door gives itself away a little: a faint line of light along the seam, a draught that stirs dust at its
// foot, and a cold breath of air. Once Deacon Graves is beaten (the town lane's rule) it swings open on a lit passage.
//
//   const door = createHiddenDoor();            // stands at the origin, in the wall plane, facing +z (into the cellar)
//   door.group.position.set(x, 0, z); door.group.rotation.y = yaw;   // the cellar layout says where (never invent it here)
//   door.update(timeInSeconds, distanceFromMarshal);                  // every frame: how much it gives itself away
//   door.setOpen(true);                                               // it swings (eased in `update`), `door.openAmount` is 0..1
//
// The cellar's layout and placeholder scene belong to the town lane; this is a part the scene hangs on a wall spot.

export const DOOR_WIDTH = 3.2, DOOR_HEIGHT = 4.6;
export const NOTICE_FAR = 13, NOTICE_NEAR = 4; // beyond NOTICE_FAR it is a plain wall; at NOTICE_NEAR it shows all it will

// How much the door gives itself away at `distance` (0 = a plain wall, 1 = all it shows). Smooth, never negative.
export function reveal(distance) {
    const t = Math.min(1, Math.max(0, (NOTICE_FAR - distance) / (NOTICE_FAR - NOTICE_NEAR)));
    return t * t * (3 - 2 * t);
}

function painted(geometry, hex, shade = 1) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    const c = new THREE.Color(hex).multiplyScalar(shade);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for(let i = 0; i < g.attributes.position.count; i++) c.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
}

const STONE = 0x6d645a;

export function createHiddenDoor() {
    const group = new THREE.Group();
    group.name = 'hidden-door';
    const W = DOOR_WIDTH, H = DOOR_HEIGHT;
    const lit = new THREE.MeshLambertMaterial({ vertexColors: true });

    // The wall: blocks of stone either side of and above the doorway, so the opening is real and the door swings in it. Stones of slightly
    // different shades, like the rest of the wall, so the door has no frame to give it away.
    const wall = [];
    const stone = (w, h, x, y, shade) => wall.push(painted(new THREE.BoxGeometry(w, h, 0.7).translate(x, y, 0), STONE, shade));
    stone(2.4, H + 1.4, -(W / 2 + 1.2), (H + 1.4) / 2, 1.0);
    stone(2.4, H + 1.4, W / 2 + 1.2, (H + 1.4) / 2, 0.94);
    stone(W, 1.4, 0, H + 0.7, 1.04);
    const wallMesh = new THREE.Mesh(mergeGeometries(wall, false), lit);
    wallMesh.castShadow = wallMesh.receiveShadow = true;

    // The way beyond: a dark passage with a warm light at its end, seen only once the door swings.
    const beyond = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.4).translate(0, H / 2, -1.2), new THREE.MeshBasicMaterial({ color: 0x0b0806 }));
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, H * 0.9).translate(0, H * 0.45, -0.95),
        new THREE.MeshBasicMaterial({ color: 0xffb454, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));

    // The door: a slab of the same stone colour, hinged on its left edge, with a few stones' worth of seams that only a close look sees.
    const hinge = new THREE.Group();
    hinge.position.set(-W / 2, 0, 0.05);
    const slab = new THREE.Mesh(mergeGeometries([
        painted(new THREE.BoxGeometry(W - 0.06, H - 0.04, 0.6).translate(W / 2, H / 2, 0), STONE, 0.97),
        painted(new THREE.BoxGeometry(0.22, 0.22, 0.12).translate(W - 0.6, 2.1, 0.34), 0x3d3a3a, 1) // an iron ring, the only tell that needs a close look
    ], false), lit);
    slab.castShadow = true;
    hinge.add(slab);

    // The tell: a thin line of light around the seam, and a cold draught that lifts dust at the foot of the door.
    const seamMaterial = new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const seam = new THREE.Mesh(mergeGeometries([
        new THREE.BoxGeometry(0.07, H, 0.05).translate(-W / 2, H / 2, 0.38),
        new THREE.BoxGeometry(0.07, H, 0.05).translate(W / 2, H / 2, 0.38),
        new THREE.BoxGeometry(W, 0.07, 0.05).translate(0, H, 0.38),
        new THREE.BoxGeometry(W, 0.09, 0.05).translate(0, 0.05, 0.38)
    ].map(g => g.toNonIndexed()), false), seamMaterial);

    const DUST = 28;
    const dustAt = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustAt, 3));
    for(let i = 0; i < DUST; i++) dustSeed[i] = (i * 0.6180339) % 1;
    const dustMaterial = new THREE.PointsMaterial({ color: 0xcdbfa6, size: 0.18, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;

    group.add(wallMesh, beyond, spill, hinge, seam, dust);

    const door = { group, hinge, seam, dust, spill, openAmount: 0, target: 0, shown: 0 };
    door.setOpen = (on = true) => { door.target = on ? 1 : 0; };
    door.update = (timeInSeconds, distance = Infinity, dt = 1 / 60) => {
        door.openAmount += (door.target - door.openAmount) * Math.min(1, dt * 2.2);
        if(Math.abs(door.target - door.openAmount) < 0.002) door.openAmount = door.target;
        const o = door.openAmount;
        hinge.rotation.y = -o * 1.75; // swings into the cellar, towards the room
        spill.material.opacity = o * 0.5;
        // It gives itself away only while it is shut; once open it needs no hint.
        const r = reveal(distance) * (1 - o);
        door.shown = r;
        seamMaterial.opacity = r * (0.55 + 0.2 * Math.sin(timeInSeconds * 3.1) + 0.1 * Math.sin(timeInSeconds * 8.3));
        dustMaterial.opacity = r * 0.7;
        for(let i = 0; i < DUST; i++) { // dust drifts out along the floor from under the door and curls up
            const phase = (timeInSeconds * 0.22 + dustSeed[i]) % 1;
            dustAt[i * 3] = (dustSeed[i] * 2 - 1) * (W / 2 - 0.2) + Math.sin(timeInSeconds * 1.3 + i) * 0.15;
            dustAt[i * 3 + 1] = 0.12 + phase * 0.9 * (0.4 + dustSeed[(i + 3) % DUST]);
            dustAt[i * 3 + 2] = 0.45 + phase * 1.8;
        }
        dustGeometry.attributes.position.needsUpdate = true;
    };
    door.dispose = () => {
        group.parent?.remove(group);
        group.traverse(o => { if(o.isMesh || o.isPoints) { o.geometry.dispose(); o.material.dispose(); } });
    };
    return door;
}
