import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, roof, sign, lamp, mat } from './townScene.js';
import { CHANNEL_AREA, WATER, WAREHOUSE, SLUICE, BUCKETS, channelMap } from './channelLayout.js';

// PLACEHOLDER SCENE (cross-lane on purpose, see AGENTS.md "Art and function"): Morgan's Channel as plain boxes, so the place works at once.
// Every look change after this merges is the art lane's. Where things stand comes from src/channelLayout.js. Same few parts as the farm's
// scene (scene, walkMap, follow, overview, project, folk, talkTo) so src/townWalk.js walks it as it walks the town.

const CH_C = { dust: 0xa88a5e, water: 0x3f7f9a, bank: 0x7a6346, plank: 0x7a6a55, green: 0x6fbf5a };

export function createChannelScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8c8d0);
    scene.fog = new THREE.Fog(0xd0d4c0, 70, 160);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(0, 1.2, 14), distance: 40, pitch: 0.98 };

    scene.add(new THREE.HemisphereLight(0xdde8ee, 0x6b5a3a, 2.3));
    const sun = new THREE.DirectionalLight(0xffe2a8, 3.0);
    sun.position.set(-30, 45, 40);
    scene.add(sun);

    const scenery = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(CH_C.dust));
    ground.rotation.x = -Math.PI / 2;
    scenery.add(ground);
    scenery.add(box(6, 0.05, 20, C.street, 0, 0.03, 14), box(6, 0.05, 20, C.street, 0, 0.03, -12));
    // The channel: two stretches of water with the footbridge between them, and a darker bank along both sides.
    for(const w of WATER) scenery.add(box(w.hx * 2, 0.12, w.hz * 2, CH_C.water, w.x, 0.06, w.z), box(w.hx * 2, 0.3, 0.5, CH_C.bank, w.x, 0.15, w.z - w.hz - 0.25), box(w.hx * 2, 0.3, 0.5, CH_C.bank, w.x, 0.15, w.z + w.hz + 0.25));
    scenery.add(box(5, 0.3, 4.6, CH_C.plank, 0, 0.35, -0.75));
    for(const x of [-2.4, 2.4]) scenery.add(box(0.15, 0.9, 4.6, C.timberDark, x, 0.9, -0.75));
    // The warehouse on the far bank.
    const house = new THREE.Group();
    house.add(box(10, 5, 6, C.timber, 0, 2.5, 0), roof(10, 6, 2.2, C.timberDark, 5), box(3, 3.4, 0.2, C.trim, 0, 1.7, 3.05), box(3.4, 0.25, 0.3, C.timberDark, 0, 3.6, 3.1));
    const houseSign = sign('WAREHOUSE', 4.4);
    houseSign.position.set(0, 4.2, 3.12);
    house.add(houseSign);
    house.position.set(WAREHOUSE.x, 0, WAREHOUSE.z);
    scenery.add(house);
    // The sluice: two posts and a gate across a short side cut.
    const sluice = new THREE.Group();
    sluice.add(box(0.4, 2.6, 0.4, C.timberDark, -1.2, 1.3, 0), box(0.4, 2.6, 0.4, C.timberDark, 1.2, 1.3, 0), box(2.4, 1.4, 0.2, C.iron, 0, 1.3, 0), box(2.8, 0.2, 0.5, C.timberDark, 0, 2.7, 0));
    sluice.position.set(SLUICE.x, 0, SLUICE.z);
    scenery.add(sluice, box(2.4, 0.1, 3.4, CH_C.water, SLUICE.x, 0.05, SLUICE.z - 2.6));
    // The fire crew's buckets: a rack with a row of buckets.
    scenery.add(box(3.2, 0.2, 0.3, C.timberDark, BUCKETS.x, 1.2, BUCKETS.z), box(0.2, 1.2, 0.2, C.timberDark, BUCKETS.x - 1.4, 0.6, BUCKETS.z), box(0.2, 1.2, 0.2, C.timberDark, BUCKETS.x + 1.4, 0.6, BUCKETS.z));
    for(let i = 0; i < 4; i++) scenery.add(box(0.5, 0.5, 0.5, C.iron, BUCKETS.x - 1.1 + i * 0.75, 0.9, BUCKETS.z + 0.15));
    // A row of fishing posts along the south bank (only for looking at).
    for(let x = -22; x <= -8; x += 3.5) scenery.add(box(0.2, 1.8, 0.2, C.timberDark, x, 0.9, 3.6), box(1.2, 0.1, 0.1, C.timber, x + 0.5, 1.7, 3.6));
    // The edge: a rail fence round the area, and the way home at the south with a lantern arch.
    const A = CHANNEL_AREA;
    for(let x = A.minX; x <= A.maxX; x += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, x, 0.7, A.minZ + 0.3));
    for(let z = A.minZ; z <= A.maxZ; z += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, A.minX + 0.3, 0.7, z), box(0.2, 1.4, 0.2, C.timberDark, A.maxX - 0.3, 0.7, z));
    scenery.add(box(A.maxX - A.minX, 0.12, 0.12, C.timber, 0, 1.1, A.minZ + 0.3), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.minX + 0.3, 1.1, 0), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.maxX - 0.3, 1.1, 0));
    for(const side of [-1, 1]) scenery.add(box(0.4, 4.6, 0.4, C.timberDark, side * 3.4, 2.3, 23.2));
    scenery.add(box(7.2, 0.35, 0.35, C.timberDark, 0, 4.5, 23.2), lamp(-4.4, 22.6), lamp(4.4, 22.6), lamp(-3, -2), lamp(3, -2));
    const archSign = sign("MORGAN'S CHANNEL", 5);
    archSign.position.set(0, 5.5, 23.3);
    scenery.add(archSign);
    scene.add(mergeByMaterial(scenery));

    // A green lantern over the sluice while the channel is watering the farm.
    const lantern = box(0.5, 0.5, 0.5, CH_C.green, SLUICE.x, 4.2, SLUICE.z, 1.5);
    lantern.rotation.set(0.6, 0.8, 0);
    lantern.visible = false;
    scene.add(lantern);

    let viewSize = [window.innerWidth, window.innerHeight];
    const projected = new THREE.Vector3();
    function placeCamera() {
        const yaw = 0.52;
        scene.fog.near = view.distance + 15;
        scene.fog.far = view.distance + 90;
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
        setWatering(on) { lantern.visible = !!on; },
        update(dt) {
            elapsed += dt;
            lantern.rotation.y = 0.8 + elapsed * 0.8;
        },
        resize(width, height) {
            viewSize = [width, height];
            camera.aspect = width / height;
            camera.fov = width < height ? 50 : 38;
            camera.updateProjectionMatrix();
            placeCamera();
        },
        walkMap() { return channelMap(); },
        follow(x, z) {
            const upright = viewSize[0] < viewSize[1];
            view.pitch = upright ? 1.1 : 0.98;
            view.distance = upright ? 54 : 40;
            view.target.set(x, 1.2, z);
            placeCamera();
        },
        overview() { this.follow(0, 8); },
        project(x, y, z) {
            projected.set(x, y, z).project(camera);
            return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, visible: projected.z < 1 };
        }
    };
}
