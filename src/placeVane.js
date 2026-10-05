import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, roof, sign, lamp, mat } from './townScene.js';
import { VANE_AREA, WAGON, CLOCK, BOARD, FRONTS, vaneMap } from './vaneLayout.js';

// PLACEHOLDER SCENE (cross-lane on purpose, see AGENTS.md "Art and function"): Vane's Crossing as plain boxes, so the place works at once.
// Every look change after this merges is the art lane's. Where things stand comes from src/vaneLayout.js. Same few parts as the farm's
// scene (scene, walkMap, follow, overview, project, folk, talkTo) so src/townWalk.js walks it as it walks the town.

const VANE_C = { dust: 0x9b8159, plank: 0x7a6a55, plankDark: 0x6a5a48, canvas: 0xe3d8bd, crate: 0x8a6a42 };

export function createVaneScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc9b99a);
    scene.fog = new THREE.Fog(0xd8c8a4, 70, 160);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(0, 1.2, 14), distance: 40, pitch: 0.98 };

    scene.add(new THREE.HemisphereLight(0xe8dcc0, 0x6b5a3a, 2.3));
    const sun = new THREE.DirectionalLight(0xffe2a8, 3.0);
    sun.position.set(-30, 45, 40);
    scene.add(sun);

    const scenery = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(VANE_C.dust));
    ground.rotation.x = -Math.PI / 2;
    scenery.add(ground);
    scenery.add(box(8, 0.05, 40, C.street, 0, 0.03, 4), box(50, 0.05, 6, C.street, 0, 0.03, -3));

    // The street of false fronts along the back.
    for(const f of FRONTS) {
        const g = new THREE.Group();
        g.add(box(7, 4.6, 3, VANE_C.plank, 0, 2.3, 0), box(7.4, 1.6, 0.35, VANE_C.plankDark, 0, 5.4, 1.4), box(1.3, 2.6, 0.12, C.trim, -1.5, 1.3, 1.54), box(1.3, 1.1, 0.12, C.trim, 1.6, 2.6, 1.54));
        g.position.set(f.x, 0, f.z);
        scenery.add(g);
    }
    // The clock tower, stopped.
    const tower = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 20), mat(0xe8dcc0));
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 7.2, 1.55);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.4, 4), mat(C.slate));
    cone.rotation.y = Math.PI / 4;
    cone.position.y = 10.4;
    tower.add(box(3, 9, 3, C.stone, 0, 4.5, 0), face, cone, box(0.12, 0.85, 0.06, C.trim, 0.25, 7.3, 1.68).rotateZ(-0.6), box(0.12, 0.6, 0.06, C.trim, -0.1, 7.15, 1.68).rotateZ(0.5));
    tower.position.set(CLOCK.x, 0, CLOCK.z);
    scenery.add(tower);
    // The wagon train: a canvas wagon with crates.
    const wagon = new THREE.Group();
    wagon.add(box(8, 0.5, 3, C.timber, 0, 1.1, 0), box(7.6, 2.2, 0.2, VANE_C.canvas, 0, 2.5, -1.3), box(7.6, 0.3, 3, VANE_C.canvas, 0, 3.7, 0), box(0.3, 2.2, 3, VANE_C.canvas, -3.8, 2.5, 0), box(1.6, 0.9, 1.2, VANE_C.crate, 2.4, 1.8, 0.5), box(1.2, 0.8, 1.2, VANE_C.crate, 0.6, 1.75, 0.7));
    for(const x of [-2.8, 2.8]) for(const z of [-1.7, 1.7]) wagon.add(box(0.3, 1.8, 1.8, C.timberDark, x, 0.9, z));
    wagon.position.set(WAGON.x, 0, WAGON.z);
    scenery.add(wagon);
    // The order board: two posts and a plank with the sign.
    const board = new THREE.Group();
    board.add(box(0.25, 3.6, 0.25, C.timberDark, -2.2, 1.8, 0), box(0.25, 3.6, 0.25, C.timberDark, 2.2, 1.8, 0), box(5.2, 2.2, 0.2, VANE_C.plank, 0, 2.6, 0));
    const boardSign = sign('ORDERS', 3.4);
    boardSign.position.set(0, 3.9, 0.15);
    board.add(boardSign);
    board.position.set(BOARD.x, 0, BOARD.z);
    scenery.add(board);
    // The edge: a rail fence round the yard, and the way home at the south with a lantern arch.
    const A = VANE_AREA;
    for(let x = A.minX; x <= A.maxX; x += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, x, 0.7, A.minZ + 0.3));
    for(let z = A.minZ; z <= A.maxZ; z += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, A.minX + 0.3, 0.7, z), box(0.2, 1.4, 0.2, C.timberDark, A.maxX - 0.3, 0.7, z));
    scenery.add(box(A.maxX - A.minX, 0.12, 0.12, C.timber, 0, 1.1, A.minZ + 0.3), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.minX + 0.3, 1.1, 0), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.maxX - 0.3, 1.1, 0));
    for(const side of [-1, 1]) scenery.add(box(0.4, 4.6, 0.4, C.timberDark, side * 3.4, 2.3, 23.2));
    scenery.add(box(7.2, 0.35, 0.35, C.timberDark, 0, 4.5, 23.2), lamp(-4.4, 22.6), lamp(4.4, 22.6), lamp(-6, 4), lamp(6, 4));
    const archSign = sign("VANE'S CROSSING", 5);
    archSign.position.set(0, 5.5, 23.3);
    scenery.add(archSign);
    scene.add(mergeByMaterial(scenery));

    // A gold lantern floats over the board while orders are waiting.
    const lantern = box(0.55, 0.55, 0.55, C.glow, BOARD.x, 4.9, BOARD.z, 1.5);
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
        setOrders(waiting) { lantern.visible = waiting > 0; },
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
        walkMap() { return vaneMap(); },
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
