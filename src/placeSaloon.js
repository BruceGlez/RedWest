import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, sign, lamp, mat } from './townScene.js';
import { SALOON_AREA, SALOON, PIANO, KEGS, RAIL, saloonMap } from './saloonLayout.js';

// PLACEHOLDER SCENE (cross-lane on purpose, see AGENTS.md "Art and function"): Copper Bit as plain boxes, so the place works at once.
// Every look change after this merges is the art lane's. Where things stand comes from src/saloonLayout.js. Same few parts as the farm's
// scene (scene, walkMap, follow, overview, project, folk, talkTo) so src/townWalk.js walks it as it walks the town.

const CB_C = { dust: 0x9a7a52, plank: 0x7a6a55, plankDark: 0x6a5a48, barrel: 0x6b4a2b, ivory: 0xe8dcc0 };

export function createSaloonScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd4bf9a);
    scene.fog = new THREE.Fog(0xdcc8a4, 70, 160);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(0, 1.2, 14), distance: 40, pitch: 0.98 };

    scene.add(new THREE.HemisphereLight(0xeadcc0, 0x6b5a3a, 2.3));
    const sun = new THREE.DirectionalLight(0xffe2a8, 3.0);
    sun.position.set(-30, 45, 40);
    scene.add(sun);

    const scenery = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(CB_C.dust));
    ground.rotation.x = -Math.PI / 2;
    scenery.add(ground);
    scenery.add(box(8, 0.05, 40, C.street, 0, 0.03, 4), box(50, 0.05, 6, C.street, 0, 0.03, -3));
    // The saloon: a false front, a porch, swing doors and a SALOON sign.
    const house = new THREE.Group();
    house.add(box(18, 6, 8, CB_C.plank, 0, 3, 0), box(18.6, 2.4, 0.4, CB_C.plankDark, 0, 7.2, 3.6), box(20, 0.3, 3, C.timber, 0, 0.15, 5.4), box(0.3, 3.4, 0.3, C.timberDark, -9, 1.9, 6.7), box(0.3, 3.4, 0.3, C.timberDark, 9, 1.9, 6.7), box(20, 0.25, 3.2, C.timberDark, 0, 3.7, 5.3));
    house.add(box(1.5, 2.2, 0.15, C.timberDark, -0.8, 1.5, 4.05), box(1.5, 2.2, 0.15, C.timberDark, 0.8, 1.5, 4.05), box(2.2, 1.6, 0.15, C.glow, -5, 3, 4.05, 0.8), box(2.2, 1.6, 0.15, C.glow, 5, 3, 4.05, 0.8));
    const houseSign = sign('SALOON', 5.6);
    houseSign.position.set(0, 6.9, 3.85);
    house.add(houseSign);
    house.position.set(SALOON.x, 0, SALOON.z);
    scenery.add(house);
    // The broken piano out front: a box, a lid, a stool.
    const piano = new THREE.Group();
    piano.add(box(2.8, 1.6, 1.4, C.timberDark, 0, 0.8, 0), box(2.8, 0.15, 0.9, CB_C.ivory, 0, 1.65, 0.2), box(2.8, 1.2, 0.2, C.timber, 0, 2.3, -0.5).rotateX(-0.2), box(0.8, 0.6, 0.8, C.timber, 0, 0.3, 1.6));
    piano.position.set(PIANO.x, 0, PIANO.z);
    scenery.add(piano);
    // Spilled kegs and a hitching rail.
    for(const [dx, dz, r] of [[-0.8, 0, 0], [0.8, 0.2, 0.3], [0, -0.1, 0]]) {
        const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 10), mat(CB_C.barrel));
        keg.position.set(KEGS.x + dx, dz === -0.1 ? 1.5 : 0.5, KEGS.z + dz);
        keg.rotation.z = r;
        scenery.add(keg);
    }
    scenery.add(box(RAIL.hx * 2, 0.15, 0.15, C.timber, RAIL.x, 1.1, RAIL.z), box(0.2, 1.3, 0.2, C.timberDark, RAIL.x - RAIL.hx, 0.65, RAIL.z), box(0.2, 1.3, 0.2, C.timberDark, RAIL.x + RAIL.hx, 0.65, RAIL.z));
    // The edge: a rail fence round the street, and the way home at the south with a lantern arch.
    const A = SALOON_AREA;
    for(let x = A.minX; x <= A.maxX; x += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, x, 0.7, A.minZ + 0.3));
    for(let z = A.minZ; z <= A.maxZ; z += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, A.minX + 0.3, 0.7, z), box(0.2, 1.4, 0.2, C.timberDark, A.maxX - 0.3, 0.7, z));
    scenery.add(box(A.maxX - A.minX, 0.12, 0.12, C.timber, 0, 1.1, A.minZ + 0.3), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.minX + 0.3, 1.1, 0), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.maxX - 0.3, 1.1, 0));
    for(const side of [-1, 1]) scenery.add(box(0.4, 4.6, 0.4, C.timberDark, side * 3.4, 2.3, 23.2));
    scenery.add(box(7.2, 0.35, 0.35, C.timberDark, 0, 4.5, 23.2), lamp(-4.4, 22.6), lamp(4.4, 22.6), lamp(-8, 2), lamp(8, 2));
    const archSign = sign('COPPER BIT', 5);
    archSign.position.set(0, 5.5, 23.3);
    scenery.add(archSign);
    scene.add(mergeByMaterial(scenery));

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

    return {
        scene,
        camera,
        folk: [],
        talkTo() {},
        update() {},
        resize(width, height) {
            viewSize = [width, height];
            camera.aspect = width / height;
            camera.fov = width < height ? 50 : 38;
            camera.updateProjectionMatrix();
            placeCamera();
        },
        walkMap() { return saloonMap(); },
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
