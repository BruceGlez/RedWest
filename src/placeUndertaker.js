import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, sign, mat } from './townScene.js';
import { PARLOUR_AREA, PARLOUR_START, COUNTER, COFFINS, STAIRS, BENCH, STOVE, GRIMSBY, parlourMap } from './undertakerLayout.js';

// Mr. Grimsby's parlour as a place of its own: a whole new map the marshal walks around (src/undertakerLayout.js has where things
// stand). Drawn like the town and the farm, from boxes in code, with the same few parts the walking code needs (scene, walkMap,
// follow, overview, project, folk, talkTo), so src/townWalk.js walks it as it walks them. It is a cut-away room: the back and side
// walls are tall and the front wall is a low sill, so the camera, which stands to the south, sees everything. Candlelight and a cold
// window: the town is dusk and the farm is day; this is the room where nobody is in a hurry. The art pass replaces the boxes (MINE_PLAN.md).

const P = {
    floor: 0x5a4a38, seam: 0x40352a, wall: 0x2e3a35, panel: 0x3b2a20, trim: 0x241a14, rug: 0x6e2b2b, rugEdge: 0xb08a4a,
    pine: 0xb89462, oak: 0x6b4426, black: 0x1d1b1e, brass: 0xc8a050, cloth: 0xd8d0be, stone: 0x6b6258, stoneDark: 0x3f3a33, iron: 0x2b2b2e,
    window: 0x7d9bbd, flame: 0xffc060, coat: 0x3a3844, skin: 0xd6cbb6, jar: 0x7a8f6a, jar2: 0x9a6b4a, flower: 0xe8e4d8, leaf: 0x4f7a42
};

// The room's walls and floor: tall back and side walls with panelling, a low front sill with the door gap, planks on the floor.
function room(group) {
    const { minX, maxX, minZ, maxZ } = PARLOUR_AREA;
    const w = maxX - minX, d = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    group.add(box(w + 2, 0.3, d + 2, P.floor, cx, -0.15, cz));
    for(let x = minX + 2; x < maxX; x += 2) group.add(box(0.06, 0.02, d, P.seam, x, 0.02, cz)); // plank seams
    // Back wall, side walls: wallpaper above, panelling below.
    group.add(box(w + 2, 9, 0.6, P.wall, cx, 4.5, minZ - 0.3), box(w + 2, 3, 0.7, P.panel, cx, 1.5, minZ - 0.25), box(w + 2, 0.25, 0.8, P.trim, cx, 3.1, minZ - 0.2));
    for(const side of [-1, 1]) {
        const x = side < 0 ? minX - 0.3 : maxX + 0.3;
        group.add(box(0.6, 9, d + 1, P.wall, x, 4.5, cz), box(0.7, 3, d + 1, P.panel, x - side * 0.05, 1.5, cz), box(0.8, 0.25, d + 1, P.trim, x - side * 0.1, 3.1, cz));
    }
    // The front: a low sill either side of the door, and the door frame.
    const gap = 2.2;
    for(const side of [-1, 1]) group.add(box(maxX - gap, 1.0, 0.6, P.panel, side * (gap + (maxX - gap) / 2), 0.5, maxZ + 0.3), box(maxX - gap, 0.2, 0.7, P.trim, side * (gap + (maxX - gap) / 2), 1.05, maxZ + 0.3));
    for(const side of [-1, 1]) group.add(box(0.5, 4.2, 0.6, P.trim, side * (gap + 0.25), 2.1, maxZ + 0.3));
    group.add(box(gap * 2 + 1, 0.5, 0.6, P.trim, 0, 4.4, maxZ + 0.3));
    // The rug under the middle of the room.
    group.add(box(8.4, 0.04, 10.4, P.rugEdge, -1, 0.04, 2.6), box(7.6, 0.06, 9.6, P.rug, -1, 0.06, 2.6));
}

// Two tall windows and a sign on the back wall, a clock, and shelves of jars behind the counter.
function backWall(group) {
    const z = PARLOUR_AREA.minZ + 0.02;
    for(const x of [-1.5, 6]) {
        group.add(box(2.6, 3.8, 0.12, P.trim, x, 6.0, z), box(2.2, 3.4, 0.14, P.window, x, 6.0, z + 0.02, 0.55));
        group.add(box(0.12, 3.4, 0.16, P.trim, x, 6.0, z + 0.04), box(2.2, 0.12, 0.16, P.trim, x, 6.0, z + 0.04));
        group.add(box(0.8, 3.8, 0.2, 0x5b2a2a, x - 1.5, 6.0, z + 0.1), box(0.8, 3.8, 0.2, 0x5b2a2a, x + 1.5, 6.0, z + 0.1)); // curtains
    }
    const plaque = sign('GRIMSBY & SON', 6, '#1c1410', '#d8c28a');
    plaque.position.set(-9, 7.6, z + 0.05);
    group.add(plaque);
    // A clock between the windows.
    group.add(box(1.4, 1.4, 0.2, P.trim, 2.2, 6.4, z + 0.05), box(1.1, 1.1, 0.22, P.cloth, 2.2, 6.4, z + 0.06), box(0.07, 0.45, 0.24, P.trim, 2.2, 6.55, z + 0.08), box(0.35, 0.07, 0.24, P.trim, 2.35, 6.4, z + 0.08));
    // Shelves of jars and bottles behind the counter.
    for(const y of [3.9, 5.1]) {
        group.add(box(9, 0.18, 0.9, P.panel, -9, y, z + 0.5));
        for(let i = 0; i < 9; i++) group.add(box(0.5, 0.7, 0.5, i % 2 ? P.jar : P.jar2, -12.8 + i * 0.95, y + 0.45, z + 0.5));
    }
}

function counter(group) {
    const { x, z, hx, hz } = COUNTER;
    group.add(box(hx * 2, 2.4, hz * 2, P.oak, x, 1.2, z), box(hx * 2 + 0.5, 0.2, hz * 2 + 0.5, P.panel, x, 2.5, z));
    group.add(box(hx * 2 - 0.4, 1.9, 0.12, P.trim, x, 1.25, z + hz + 0.02)); // the front panel
    group.add(box(0.7, 0.12, 0.5, P.brass, x - 2.6, 2.66, z + 0.2), box(0.22, 0.28, 0.22, P.brass, x - 2.6, 2.84, z + 0.2)); // the bell
    group.add(box(1.1, 0.12, 0.8, P.cloth, x + 1.0, 2.66, z), box(1.15, 0.06, 0.85, P.trim, x + 1.0, 2.6, z)); // the ledger
    group.add(box(0.2, 0.5, 0.2, P.cloth, x + 3.2, 2.85, z), box(0.12, 0.2, 0.12, P.flame, x + 3.2, 3.2, z, 1.6)); // a candle
}

// Mr. Grimsby: long, thin and black-coated, behind the counter. One group so he can breathe.
function grimsby() {
    const g = new THREE.Group();
    g.add(box(1.0, 2.0, 0.6, P.coat, 0, 1.6, 0), box(0.8, 1.2, 0.5, P.coat, 0, 0.6, 0), box(0.3, 0.3, 0.1, P.cloth, 0, 2.3, 0.32), box(0.5, 0.12, 0.12, P.black, 0, 2.2, 0.35));
    g.add(box(0.28, 1.5, 0.28, P.coat, -0.65, 1.6, 0.05), box(0.28, 1.5, 0.28, P.coat, 0.65, 1.6, 0.05), box(0.22, 0.26, 0.22, P.skin, -0.65, 0.78, 0.1), box(0.22, 0.26, 0.22, P.skin, 0.65, 0.78, 0.1));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat(P.skin));
    head.scale.set(0.9, 1.25, 0.95);
    head.position.y = 3.05;
    g.add(head, box(0.9, 0.1, 0.9, P.black, 0, 3.4, 0), box(0.62, 0.7, 0.62, P.black, 0, 3.8, 0), box(0.1, 0.1, 0.1, P.black, -0.14, 3.02, 0.36), box(0.1, 0.1, 0.1, P.black, 0.14, 3.02, 0.36));
    g.position.set(GRIMSBY.x, 0, GRIMSBY.z);
    return g;
}

// A coffin on show: a trestle, the box (tapered by a lid a little narrower), and brass handles.
function coffin(group, spot, index) {
    const { x, z, hx, hz } = spot;
    const wood = [P.pine, P.oak, P.black][index % 3];
    group.add(box(hx * 2 - 0.1, 0.9, 0.3, P.panel, x, 0.45, z - hz + 0.6), box(hx * 2 - 0.1, 0.9, 0.3, P.panel, x, 0.45, z + hz - 0.6)); // trestles
    group.add(box(hx * 2 - 0.2, 0.8, hz * 2 - 0.2, wood, x, 1.3, z), box(hx * 2 - 0.55, 0.22, hz * 2 - 0.55, wood, x, 1.8, z));
    group.add(box(0.4, 0.12, 0.14, P.brass, x - hx + 0.1, 1.45, z - 0.8), box(0.4, 0.12, 0.14, P.brass, x - hx + 0.1, 1.45, z + 0.8), box(0.4, 0.12, 0.14, P.brass, x + hx - 0.1, 1.45, z - 0.8), box(0.4, 0.12, 0.14, P.brass, x + hx - 0.1, 1.45, z + 0.8));
    group.add(box(0.5, 0.06, 0.6, P.flower, x, 1.94, z - hz * 0.4), box(0.3, 0.12, 0.3, P.leaf, x + 0.3, 1.96, z - hz * 0.2)); // a few flowers on the lid
}

// The cellar stairs: an opening in the floor, steps going down into the dark, an iron rail around it and a lantern.
function stairs(group) {
    const { x, z, hx, hz } = STAIRS;
    group.add(box(hx * 2, 0.06, hz * 2, 0x050403, x, 0.05, z)); // the dark below
    // Steps: lit stone near the front, darker as they go down toward the back.
    for(let i = 0; i < 5; i++) {
        const shade = [0x6b6258, 0x544d44, 0x3f3a33, 0x2a2622, 0x16130f][i];
        group.add(box(hx * 2 - 0.9, 0.12, 0.75, shade, x, 0.12 - i * 0.02, z + hz - 0.95 - i * 0.78));
    }
    // The rail: posts at the corners and a bar along the front and the sides, with a gap at the front where the stairs begin.
    for(const [px, pz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) group.add(box(0.16, 1.4, 0.16, P.iron, x + px, 0.7, z + pz));
    group.add(box(0.1, 0.1, hz * 2, P.iron, x - hx, 1.35, z), box(0.1, 0.1, hz * 2, P.iron, x + hx, 1.35, z), box(hx * 2, 0.1, 0.1, P.iron, x, 1.35, z - hz));
    // An arch of stone over the way down, with a hanging lantern.
    group.add(box(0.7, 3.6, 0.7, P.stone, x - hx + 0.1, 1.8, z + hz + 0.3), box(0.7, 3.6, 0.7, P.stone, x + hx - 0.1, 1.8, z + hz + 0.3), box(hx * 2 + 0.9, 0.7, 0.9, P.stoneDark, x, 3.8, z + hz + 0.3));
    group.add(box(0.1, 0.8, 0.1, P.iron, x, 3.1, z + hz + 0.3), box(0.5, 0.6, 0.5, P.flame, x, 2.5, z + hz + 0.3, 1.6));
    const label = sign('CELLAR', 2.4, '#1c1410', '#d8c28a');
    label.position.set(x, 4.45, z + hz + 0.8);
    group.add(label);
}

function furniture(group) {
    // A waiting bench along the west wall, with cushions.
    group.add(box(BENCH.hx * 2, 0.9, BENCH.hz * 2, P.panel, BENCH.x, 0.45, BENCH.z), box(0.4, 1.6, BENCH.hz * 2, P.oak, BENCH.x - 0.7, 1.4, BENCH.z), box(BENCH.hx * 2 - 0.3, 0.2, BENCH.hz * 2 - 0.3, 0x5b2a2a, BENCH.x + 0.1, 1.0, BENCH.z));
    // A pot-bellied stove in the east corner, glowing through its door, with its pipe going up.
    group.add(box(STOVE.hx * 2, 1.8, STOVE.hz * 2, P.iron, STOVE.x, 0.9, STOVE.z), box(0.8, 0.6, 0.12, P.flame, STOVE.x - 0.3, 0.95, STOVE.z + STOVE.hz + 0.02, 1.6), box(0.4, 7, 0.4, P.iron, STOVE.x, 5.3, STOVE.z - 0.4));
    // Candle stands at the front corners and by the back wall.
    for(const [x, z] of [[-16.5, 9], [16.5, 9], [-16.8, -12.8], [-11.5, -12.8]]) {
        group.add(box(0.12, 3.4, 0.12, P.iron, x, 1.7, z), box(0.9, 0.1, 0.12, P.iron, x, 3.4, z));
        for(const dx of [-0.4, 0, 0.4]) group.add(box(0.1, 0.4, 0.1, P.cloth, x + dx, 3.65, z), box(0.08, 0.16, 0.08, P.flame, x + dx, 3.95, z, 1.8));
    }
    // A hanging lamp over the counter, and a wreath by the stairs.
    group.add(box(0.08, 2.4, 0.08, P.iron, -9, 8.0, -1.4), box(0.9, 0.7, 0.9, P.flame, -9, 6.5, -1.4, 1.2)); // in front of the counter, so Mr. Grimsby is not behind its glare
    group.add(box(1.4, 1.4, 0.16, P.leaf, 9.3, 5.2, PARLOUR_AREA.minZ + 0.1), box(0.4, 0.4, 0.2, P.flower, 9.3, 5.95, PARLOUR_AREA.minZ + 0.12));
}

export function createUndertakerScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120d0a);
    scene.fog = new THREE.Fog(0x120d0a, 60, 140);
    const camera = new THREE.PerspectiveCamera(36, 1, 1, 260);
    const view = { target: new THREE.Vector3(PARLOUR_START[0], 1.2, PARLOUR_START[1]), distance: 40, pitch: 1.0 };

    scene.add(new THREE.HemisphereLight(0xffe0b8, 0x4a3326, 1.35));
    const key = new THREE.DirectionalLight(0xffd9a0, 1.1);
    key.position.set(-14, 30, 26);
    scene.add(key);
    const counterLight = new THREE.PointLight(0xffb066, 90, 34, 1.6);
    counterLight.position.set(-9, 6.5, -4);
    scene.add(counterLight);
    const stairLight = new THREE.PointLight(0xffa860, 45, 22, 1.8);
    stairLight.position.set(STAIRS.x, 2.4, STAIRS.z + STAIRS.hz + 1);
    scene.add(stairLight);

    const scenery = new THREE.Group();
    room(scenery);
    backWall(scenery);
    counter(scenery);
    COFFINS.forEach((spot, i) => coffin(scenery, spot, i));
    stairs(scenery);
    furniture(scenery);
    scene.add(mergeByMaterial(scenery));

    const keeper = grimsby();
    scene.add(keeper);

    let viewSize = [window.innerWidth || 1280, window.innerHeight || 720];
    const projected = new THREE.Vector3();
    const yaw = 0;
    function placeCamera() {
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
        folk: [],
        talkTo() {},
        update(dt) {
            elapsed += dt;
            keeper.position.y = Math.sin(elapsed * 1.4) * 0.03; // breathing
            keeper.rotation.y = Math.sin(elapsed * 0.5) * 0.12; // a slow look about the room
            counterLight.intensity = 90 + Math.sin(elapsed * 7) * 5 + Math.sin(elapsed * 11) * 3; // the candles
        },
        resize(width, height) {
            viewSize = [width, height];
            camera.aspect = width / height;
            camera.fov = width < height ? 48 : 36;
            camera.updateProjectionMatrix();
            placeCamera();
        },
        walkMap() { return parlourMap(); },
        follow(x, z) {
            const upright = viewSize[0] < viewSize[1];
            view.pitch = upright ? 1.12 : 1.0;
            view.distance = upright ? 54 : 40;
            // The camera never leaves the room: it follows the marshal but stays over the floor, so the counter, the coffins and the
            // stairs are in view from the door.
            view.target.set(Math.max(-5, Math.min(5, x * 0.5)), 1.2, Math.max(-7, Math.min(2, z * 0.5 - 2)));
            placeCamera();
        },
        overview() { this.follow(0, 0); },
        project(x, y, z) {
            projected.set(x, y, z).project(camera);
            return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, visible: projected.z < 1 };
        }
    };
}
