import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, mat, sign } from './townScene.js';
import { FLAP_Z, SEAT_SPOTS, SPOTS } from './saloonKitchenLayout.js';

// Copper Bit's first interior pass. This is deliberately box-built and original: it proves the room,
// camera and walking space before the later character/prop pass. Every gameplay position comes from
// saloonKitchenLayout; this file only chooses how the placeholder objects at those positions look.

const ROOM = { minX: -12, maxX: 12, minZ: -10, maxZ: 10 };
const FLAP_HALF_WIDTH = 1.5;

const P = {
    floor: 0x563b2a, seam: 0x38271d, wall: 0x7a3d2b, panel: 0x4b2d22, trim: 0x2b1c17,
    counter: 0x6b4328, counterTop: 0x34231c, iron: 0x292a2d, steel: 0x62656a,
    brass: 0xc59a43, stove: 0x35363a, oven: 0x47484c, barrel: 0x744927, hoop: 0x2d2e31,
    crate: 0x8b5b31, shelf: 0x5d3924, stool: 0x70452b, cushion: 0x8b2d31,
    paper: 0xe7d6af, glow: 0xffad45, coat: 0x263a43, apron: 0xd9cfb8,
    customerA: 0x8b3f32, customerB: 0x385b48, customerC: 0x4d4978, skin: 0xd6a276
};

const collisionBox = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });

// The two counter halves are the only hard obstruction in this placeholder. Stations remain reachable
// from every side until the town lane publishes their final footprints; the counter still enforces the
// layout contract's single kitchen/dining route through FLAP.
export function kitchenWalkMap() {
    const leftWidth = ROOM.maxX - FLAP_HALF_WIDTH;
    const halfWidth = leftWidth / 2;
    return {
        areas: [{ ...ROOM }],
        boxes: [
            collisionBox(-(FLAP_HALF_WIDTH + halfWidth), FLAP_Z, halfWidth, 0.65),
            collisionBox(FLAP_HALF_WIDTH + halfWidth, FLAP_Z, halfWidth, 0.65)
        ],
        doors: Object.values(SPOTS).map(spot => ({
            id: spot.id,
            label: spot.name.toUpperCase(),
            verb: spot.id === 'DOOR' ? 'LEAVE' : 'GO',
            x: spot.x,
            z: spot.z
        }))
    };
}

function room(group) {
    const width = ROOM.maxX - ROOM.minX;
    const depth = ROOM.maxZ - ROOM.minZ;
    group.add(box(width, 0.25, depth, P.floor, 0, -0.13, 0));
    for(let x = ROOM.minX + 1; x < ROOM.maxX; x += 1.25) group.add(box(0.045, 0.02, depth, P.seam, x, 0.02, 0));

    // Cut-away walls: full height at the kitchen and sides, a low sill at the camera edge.
    group.add(box(width + 0.6, 7.5, 0.5, P.wall, 0, 3.75, ROOM.minZ - 0.25));
    group.add(box(width + 0.65, 2.1, 0.58, P.panel, 0, 1.05, ROOM.minZ - 0.22));
    group.add(box(width + 0.7, 0.2, 0.65, P.trim, 0, 2.18, ROOM.minZ - 0.2));
    for(const side of [-1, 1]) {
        const x = side * (ROOM.maxX + 0.25);
        group.add(box(0.5, 7.5, depth + 0.5, P.wall, x, 3.75, 0));
        group.add(box(0.58, 2.1, depth + 0.55, P.panel, x - side * 0.03, 1.05, 0));
        group.add(box(0.65, 0.2, depth + 0.6, P.trim, x - side * 0.05, 2.18, 0));
    }

    const doorHalf = 1.3;
    const frontHalf = (ROOM.maxX - doorHalf) / 2;
    for(const side of [-1, 1]) {
        const x = side * (doorHalf + frontHalf);
        group.add(box(frontHalf * 2, 0.8, 0.5, P.panel, x, 0.4, ROOM.maxZ + 0.25));
        group.add(box(0.35, 4.3, 0.5, P.trim, side * (doorHalf + 0.18), 2.15, ROOM.maxZ + 0.25));
    }
    group.add(box(doorHalf * 2 + 0.7, 0.4, 0.5, P.trim, 0, 4.25, ROOM.maxZ + 0.25));
}

function bar(group) {
    const segmentWidth = ROOM.maxX - FLAP_HALF_WIDTH;
    for(const side of [-1, 1]) {
        const x = side * (FLAP_HALF_WIDTH + segmentWidth / 2);
        group.add(
            box(segmentWidth, 2.0, 1.15, P.counter, x, 1.0, FLAP_Z),
            box(segmentWidth + 0.25, 0.18, 1.45, P.counterTop, x, 2.08, FLAP_Z)
        );
        for(let panel = 0; panel < Math.floor(segmentWidth / 2.3); panel++) {
            const px = x - segmentWidth / 2 + 1.2 + panel * 2.3;
            group.add(box(1.75, 1.35, 0.08, P.panel, px, 1.0, FLAP_Z + 0.62));
        }
    }
    // Brass flap posts and the order rail make the only crossing unmistakable.
    for(const side of [-1, 1]) group.add(box(0.14, 2.7, 0.14, P.brass, side * FLAP_HALF_WIDTH, 1.35, FLAP_Z));
    group.add(box(FLAP_HALF_WIDTH * 2, 0.13, 0.18, P.brass, SPOTS.FLAP.x, 3.0, SPOTS.FLAP.z));
    for(let i = 0; i < 4; i++) group.add(box(0.75, 0.5, 0.035, P.paper, -1.15 + i * 0.76, 2.7 - (i % 2) * 0.08, FLAP_Z + 0.12));
}

function kitchenFixtures(group) {
    const stove = SPOTS.STOVE;
    group.add(box(3.2, 2.2, 2.0, P.stove, stove.x, 1.1, stove.z));
    for(const dx of [-0.85, 0.85]) group.add(box(0.8, 0.12, 0.8, P.iron, stove.x + dx, 2.25, stove.z));
    group.add(box(0.55, 5.4, 0.55, P.iron, stove.x - 1.1, 5.0, ROOM.minZ + 0.6));

    const barrel = SPOTS.BARREL;
    const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.2, 12), mat(P.barrel));
    keg.position.set(barrel.x, 1.1, barrel.z);
    group.add(keg);
    for(const y of [0.35, 1.1, 1.85]) group.add(box(2.0, 0.13, 0.13, P.hoop, barrel.x, y, barrel.z + 0.9));
    group.add(box(0.12, 0.7, 0.12, P.brass, barrel.x + 0.65, 1.15, barrel.z + 1.0));

    const oven = SPOTS.OVEN;
    group.add(box(3.5, 3.0, 2.4, P.oven, oven.x, 1.5, oven.z));
    group.add(box(2.5, 1.5, 0.12, P.iron, oven.x, 1.45, oven.z + 1.23));
    group.add(box(1.9, 0.85, 0.08, P.glow, oven.x, 1.4, oven.z + 1.3, 0.6));
    group.add(box(2.8, 0.18, 0.15, P.brass, oven.x, 2.55, oven.z + 1.3));

    const crates = SPOTS.CRATES;
    for(const [dx, dz, y] of [[-0.7, 0, 0.65], [0.7, 0.15, 0.65], [0, -0.2, 1.85]]) {
        group.add(box(1.25, 1.2, 1.25, P.crate, crates.x + dx, y, crates.z + dz));
        group.add(box(1.35, 0.1, 0.12, P.trim, crates.x + dx, y, crates.z + dz + 0.64));
    }
}

function diningFixtures(group) {
    for(const seat of SEAT_SPOTS) {
        group.add(
            box(0.9, 0.2, 0.9, P.cushion, seat.x, 1.1, seat.z),
            box(0.18, 1.0, 0.18, P.stool, seat.x, 0.5, seat.z),
            box(1.6, 0.14, 1.3, P.counterTop, seat.x, 2.0, seat.z - 1.15)
        );
    }
    const shelf = SPOTS.SHELF;
    group.add(box(3.3, 4.4, 0.65, P.shelf, shelf.x, 2.2, shelf.z));
    for(const y of [0.7, 1.8, 2.9, 4.0]) group.add(box(3.5, 0.15, 1.0, P.counterTop, shelf.x, y, shelf.z + 0.15));
    group.add(box(0.8, 0.45, 0.55, P.brass, shelf.x - 0.9, 1.0, shelf.z + 0.55));
    group.add(box(0.9, 0.35, 0.6, P.apron, shelf.x + 0.75, 2.1, shelf.z + 0.55));

    // The street door is visually aligned with the layout's DOOR spot.
    for(const side of [-1, 1]) {
        const leaf = box(1.15, 2.4, 0.12, P.counter, SPOTS.DOOR.x + side * 0.62, 1.55, ROOM.maxZ + 0.05);
        leaf.rotation.z = side * 0.12;
        group.add(leaf);
    }
}

function person(color, apron = false) {
    const figure = new THREE.Group();
    figure.add(box(0.9, 1.45, 0.58, color, 0, 1.35, 0), box(0.78, 0.85, 0.52, color, 0, 0.45, 0));
    if(apron) figure.add(box(0.72, 1.2, 0.08, P.apron, 0, 1.25, 0.34));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), mat(P.skin));
    head.position.y = 2.42;
    figure.add(head, box(1.0, 0.1, 0.85, P.trim, 0, 2.68, 0), box(0.62, 0.45, 0.62, P.trim, 0, 2.9, 0));
    return figure;
}

export function createSaloonInsideScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1210);
    scene.fog = new THREE.Fog(0x1b1210, 48, 100);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 180);

    scene.add(new THREE.HemisphereLight(0xffdfb0, 0x38251e, 1.65));
    const key = new THREE.DirectionalLight(0xffc078, 1.55);
    key.position.set(-12, 26, 24);
    scene.add(key);
    const stoveLight = new THREE.PointLight(0xff8738, 28, 18, 1.8);
    stoveLight.position.set(SPOTS.OVEN.x, 2.0, SPOTS.OVEN.z + 1.5);
    scene.add(stoveLight);

    const scenery = new THREE.Group();
    room(scenery);
    bar(scenery);
    kitchenFixtures(scenery);
    diningFixtures(scenery);
    const plaque = sign('COPPER BIT', 5.4, '#2b1c17', '#e6bd64');
    plaque.position.set(0, 5.7, ROOM.minZ + 0.04);
    scenery.add(plaque);
    scene.add(mergeByMaterial(scenery));

    const marshal = person(P.coat, true);
    marshal.position.set(SPOTS.FLAP.x, 0, SPOTS.FLAP.z - 2.2);
    scene.add(marshal);

    const customerColors = [P.customerA, P.customerB, P.customerC, P.customerA, P.customerB];
    const customers = SEAT_SPOTS.map((seat, index) => {
        const object = person(customerColors[index]);
        object.scale.setScalar(0.94 + index * 0.015);
        object.position.set(seat.x, 0, seat.z + 0.3);
        object.rotation.y = Math.PI;
        scene.add(object);
        return { object, spotId: seat.id, phase: index * 1.7 };
    });

    let viewport = [1280, 720];
    const projected = new THREE.Vector3();
    const view = { target: new THREE.Vector3(0, 1.2, 0), distance: 34, pitch: 0.98 };
    function placeCamera() {
        const portrait = viewport[0] < viewport[1];
        const yaw = 0;
        view.distance = portrait ? 43 : 34;
        view.pitch = portrait ? 1.08 : 0.98;
        camera.position.set(
            view.target.x + Math.sin(yaw) * Math.cos(view.pitch) * view.distance,
            view.target.y + Math.sin(view.pitch) * view.distance,
            view.target.z + Math.cos(yaw) * Math.cos(view.pitch) * view.distance
        );
        camera.lookAt(view.target);
    }
    placeCamera();

    let elapsed = 0;
    return {
        scene,
        camera,
        marshal,
        customers,
        folk: [],
        talkTo() {},
        update(dt) {
            elapsed += dt;
            marshal.position.y = Math.sin(elapsed * 1.8) * 0.025;
            customers.forEach(customer => {
                customer.object.position.y = Math.sin(elapsed * 1.35 + customer.phase) * 0.02;
            });
            stoveLight.intensity = 28 + Math.sin(elapsed * 8) * 2.5;
        },
        resize(width, height) {
            viewport = [width, height];
            camera.aspect = width / height;
            camera.fov = width < height ? 48 : 36;
            camera.updateProjectionMatrix();
            placeCamera();
        },
        walkMap() { return kitchenWalkMap(); },
        // The kitchen uses a fixed high camera: following the marshal would hide stations behind the bar.
        follow() { placeCamera(); },
        overview() { placeCamera(); },
        project(x, y, z) {
            projected.set(x, y, z).project(camera);
            return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, visible: projected.z < 1 };
        }
    };
}
