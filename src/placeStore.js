import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, sign, lamp } from './townScene.js';
import { STORE_AREA, COUNTER, SHELVES, BARRELS, TABLE, KEEPER, storeMap } from './storeLayout.js';

// PLACEHOLDER SCENE (cross-lane on purpose, see AGENTS.md "Art and function"): the general store as plain boxes, so the place works at once.
// Every look change after this merges is the art lane's. Where things stand comes from src/storeLayout.js. Same few parts as the farm's scene
// (scene, walkMap, follow, overview, project, folk, talkTo) so src/townWalk.js walks it as it walks the town.

const ST_C = { floor: 0x6a5238, wall: 0x4a3828, jar: 0xc8a050, can: 0x8a8f94, apron: 0xd8cfb8 };

export function createStoreScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1410);
    scene.fog = new THREE.Fog(0x1a1410, 40, 100);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(0, 1.2, 3), distance: 28, pitch: 1.0 };

    scene.add(new THREE.HemisphereLight(0xe8c890, 0x2a2018, 1.9));
    const sun = new THREE.DirectionalLight(0xffd8a0, 1.8);
    sun.position.set(-8, 24, 16);
    scene.add(sun);

    const scenery = new THREE.Group();
    const A = STORE_AREA;
    scenery.add(box(A.maxX - A.minX + 2, 0.1, A.maxZ - A.minZ + 2, ST_C.floor, 0, 0.05, (A.minZ + A.maxZ) / 2));
    scenery.add(box(A.maxX - A.minX + 2, 5.5, 0.6, ST_C.wall, 0, 2.75, A.minZ - 0.3), box(0.6, 5.5, A.maxZ - A.minZ, ST_C.wall, A.minX - 0.3, 2.75, (A.minZ + A.maxZ) / 2), box(0.6, 5.5, A.maxZ - A.minZ, ST_C.wall, A.maxX + 0.3, 2.75, (A.minZ + A.maxZ) / 2));
    // The counter, with a lantern, a row of oil cans and a till on it; the shopkeeper behind.
    scenery.add(box(COUNTER.hx * 2, 1.2, COUNTER.hz * 2, C.timber, COUNTER.x, 0.6, COUNTER.z), box(COUNTER.hx * 2 + 0.3, 0.15, COUNTER.hz * 2 + 0.3, C.timberDark, COUNTER.x, 1.28, COUNTER.z));
    for(let i = 0; i < 4; i++) scenery.add(box(0.5, 0.7, 0.5, ST_C.can, -3.6 + i * 0.9, 1.7, COUNTER.z));
    scenery.add(box(1.4, 0.7, 0.9, C.brass, 3.4, 1.75, COUNTER.z), lamp(1, COUNTER.z));
    scenery.add(box(KEEPER.hx * 2, 1.7, KEEPER.hz * 2, ST_C.apron, KEEPER.x, 0.9, KEEPER.z), box(0.5, 0.5, 0.5, C.skin, KEEPER.x, 2.0, KEEPER.z), box(0.8, 0.12, 0.8, C.coat, KEEPER.x, 2.35, KEEPER.z));
    // Shelves of jars and tins along the west wall, barrels and a table of goods.
    scenery.add(box(SHELVES.hx * 2, 3.4, SHELVES.hz * 2, C.timberDark, SHELVES.x, 1.7, SHELVES.z));
    for(let i = 0; i < 7; i++) for(const y of [1.2, 2.4, 3.5]) scenery.add(box(0.5, 0.6, 0.5, (i + Math.round(y)) % 2 ? ST_C.jar : ST_C.can, SHELVES.x + 0.9, y, SHELVES.z - 4.5 + i * 1.5));
    for(const [dx, dz] of [[-0.8, -0.7], [0.9, 0.5], [-0.6, 0.9]]) scenery.add(box(1, 1.3, 1, C.timber, BARRELS.x + dx, 0.65, BARRELS.z + dz));
    scenery.add(box(TABLE.hx * 2, 0.15, TABLE.hz * 2, C.timber, TABLE.x, 1.1, TABLE.z), box(0.2, 1.1, 0.2, C.timberDark, TABLE.x - 1.5, 0.55, TABLE.z - 0.7), box(0.2, 1.1, 0.2, C.timberDark, TABLE.x + 1.5, 0.55, TABLE.z + 0.7));
    for(let i = 0; i < 3; i++) scenery.add(box(0.6, 0.5, 0.6, ST_C.jar, TABLE.x - 1 + i * 1, 1.45, TABLE.z));
    scenery.add(lamp(-8, 2), lamp(8, 6), lamp(-5, 6));
    const plaque = sign('GENERAL STORE', 4.6);
    plaque.position.set(0, 4.3, A.minZ + 0.1);
    scenery.add(plaque);
    scene.add(mergeByMaterial(scenery));

    let viewSize = [window.innerWidth, window.innerHeight];
    const projected = new THREE.Vector3();
    function placeCamera() {
        const yaw = 0.4;
        scene.fog.near = view.distance + 6;
        scene.fog.far = view.distance + 50;
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
        walkMap() { return storeMap(); },
        follow(x, z) {
            const upright = viewSize[0] < viewSize[1];
            view.pitch = upright ? 1.1 : 1.0;
            view.distance = upright ? 38 : 28;
            view.target.set(x, 1.2, z);
            placeCamera();
        },
        overview() { this.follow(0, 2); },
        project(x, y, z) {
            projected.set(x, y, z).project(camera);
            return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, visible: projected.z < 1 };
        }
    };
}
