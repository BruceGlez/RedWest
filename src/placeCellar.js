import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, sign, lamp, mat } from './townScene.js';
import { CELLAR_AREA, BARRELS, SHELF, CRATES, TABLE, HIDDEN_DOOR, cellarMap } from './cellarLayout.js';

// PLACEHOLDER SCENE (cross-lane on purpose, see AGENTS.md "Art and function"): the cellar under the parlour as plain boxes, so the place works
// at once. Every look change after this merges is the art lane's. Where things stand comes from src/cellarLayout.js. Same few parts as the
// farm's scene (scene, walkMap, follow, overview, project, folk, talkTo) so src/townWalk.js walks it as it walks the town.
// The hidden door is drawn as part of the wall: a seam a shade darker than the stone around it, with nothing to mark it.

const CE_C = { floor: 0x3a322b, wall: 0x2c2620, seam: 0x241f1a, plank: 0x5a3d2b };

export function createCellarScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0807);
    scene.fog = new THREE.Fog(0x0b0807, 30, 90);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(0, 1.2, 4), distance: 26, pitch: 1.0 };

    scene.add(new THREE.HemisphereLight(0xb89a72, 0x1a1410, 1.7));
    const sun = new THREE.DirectionalLight(0xffc880, 1.6);
    sun.position.set(-10, 24, 18);
    scene.add(sun);

    const scenery = new THREE.Group();
    const A = CELLAR_AREA;
    scenery.add(box(A.maxX - A.minX + 2, 0.1, A.maxZ - A.minZ + 2, CE_C.floor, 0, 0.05, (A.minZ + A.maxZ) / 2));
    // Stone walls round three sides; the south side is open to the camera, with the stairs coming down.
    scenery.add(box(A.maxX - A.minX + 2, 5, 0.6, CE_C.wall, 0, 2.5, A.minZ - 0.3), box(0.6, 5, A.maxZ - A.minZ, CE_C.wall, A.minX - 0.3, 2.5, (A.minZ + A.maxZ) / 2), box(0.6, 5, A.maxZ - A.minZ, CE_C.wall, A.maxX + 0.3, 2.5, (A.minZ + A.maxZ) / 2));
    scenery.add(box(0.05, 3, 1.8, CE_C.seam, A.maxX - 0.02, 1.6, HIDDEN_DOOR.z)); // the hidden door: a seam in the east wall
    for(let i = 0; i < 4; i++) scenery.add(box(2.4, 0.3, 1.6, C.stoneDark, -1.2 + i * 0.4, 0.15 + i * 0.3, 8.4 - i * 0.2)); // the stairs coming down
    // Barrels, a shelf of jars, crates and a table with a lamp.
    for(const [dx, dz] of [[-0.8, -0.6], [0.8, 0.6], [-0.7, 0.9], [0.6, -0.8]]) scenery.add(box(1, 1.3, 1, C.timber, BARRELS.x + dx, 0.65, BARRELS.z + dz));
    scenery.add(box(SHELF.hx * 2, 2.6, 0.8, C.timberDark, SHELF.x, 1.3, SHELF.z));
    for(let i = 0; i < 6; i++) scenery.add(box(0.5, 0.7, 0.5, C.stone, SHELF.x - 3 + i * 1.2, 2.2, SHELF.z + 0.1));
    scenery.add(box(CRATES.hx * 2, 1.2, CRATES.hz * 2, CE_C.plank, CRATES.x, 0.6, CRATES.z), box(1.2, 1, 1.2, CE_C.plank, CRATES.x + 0.3, 1.7, CRATES.z));
    scenery.add(box(TABLE.hx * 2, 0.15, TABLE.hz * 2, C.timber, TABLE.x, 1.1, TABLE.z), box(0.2, 1.1, 0.2, C.timberDark, TABLE.x - 1.7, 0.55, TABLE.z - 0.7), box(0.2, 1.1, 0.2, C.timberDark, TABLE.x + 1.7, 0.55, TABLE.z + 0.7));
    scenery.add(lamp(TABLE.x, TABLE.z), lamp(-5, 6), lamp(5, 6));
    const plaque = sign('CELLAR', 3.4);
    plaque.position.set(0, 3.8, A.minZ + 0.1);
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
        walkMap() { return cellarMap(); },
        follow(x, z) {
            const upright = viewSize[0] < viewSize[1];
            view.pitch = upright ? 1.1 : 1.0;
            view.distance = upright ? 36 : 26;
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
