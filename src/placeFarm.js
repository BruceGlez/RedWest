import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, roof, sign, lamp, mat } from './townScene.js';
import { plotStates, eggsReady } from './farm.js';
import { FARM_AREA, PLOTS, PLOT_SIZE, BARN, COOP, STAND, KENNEL, WINDMILL, WELL, SCARECROW, HAY, farmMap } from './farmLayout.js';

// Calloway Farm as a place of its own: a whole new map the marshal walks around (src/farmLayout.js has where things
// stand, src/farm.js the rules). It is drawn like the town, from boxes in code, and has the same few parts the walking
// code needs (scene, walkMap, follow, overview, project, folk, talkTo), so src/townWalk.js walks it as it walks the town.
// Warm afternoon light: the town is dusk and the farm is the day you came out to work.

const FARM_C = {
    grass: 0x6f8a45, path: 0x9a7f5a, soil: 0x4a3322, furrow: 0x382517, barnRed: 0x8a3226, white: 0xe9e1cf, hay: 0xcfa94a,
    stalk: 0x5f9a3a, young: 0x86b848, gold: 0xdcb54a, corn: 0x4f8a3a, cob: 0xf0d050, pumpkin: 0xd9741f, leaf: 0x3f7a30, egg: 0xf4efe0, hen: 0xf2ece0, comb: 0xc23b2a
};

function windmillBlades() {
    const blades = new THREE.Group();
    for(let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.add(box(0.25, 4.6, 0.12, C.timberDark, 0, 2.6, 0), box(1.1, 3.2, 0.06, FARM_C.white, 0.6, 3.2, 0.05));
        arm.rotation.z = i * Math.PI / 2;
        blades.add(arm);
    }
    blades.add(box(0.7, 0.7, 0.7, C.iron, 0, 0, 0.1));
    return mergeByMaterial(blades);
}

function hen() {
    const g = new THREE.Group();
    g.add(box(0.6, 0.45, 0.4, FARM_C.hen, 0, 0.45, 0), box(0.28, 0.32, 0.26, FARM_C.hen, 0.34, 0.72, 0), box(0.1, 0.14, 0.1, FARM_C.comb, 0.34, 0.95, 0), box(0.18, 0.1, 0.1, C.glow, 0.52, 0.7, 0), box(0.3, 0.3, 0.3, FARM_C.hen, -0.36, 0.55, 0));
    return mergeByMaterial(g);
}

// What stands in one bed for a crop at a stage of growth: a few boxes per plant, kept low-poly.
function cropBed(group, plot, crop, fraction, ready) {
    const stage = ready ? 3 : Math.min(2, Math.floor(fraction * 3));
    const left = plot.x - PLOT_SIZE.w / 2 + 0.7;
    const top = plot.z - PLOT_SIZE.d / 2 + 0.7;
    if(crop.id === 'wheat') {
        const height = [0.3, 0.7, 1.0, 1.3][stage];
        for(let i = 0; i < 9; i++) for(let j = 0; j < 5; j++) {
            const x = left + i * 0.55, z = top + j * 0.9;
            group.add(box(0.14, height, 0.14, ready ? FARM_C.gold : stage ? FARM_C.stalk : FARM_C.young, x, 0.1 + height / 2, z));
            if(ready) group.add(box(0.22, 0.34, 0.22, FARM_C.gold, x, 0.1 + height + 0.1, z));
        }
    } else if(crop.id === 'corn') {
        const height = [0.5, 1.1, 1.8, 2.3][stage];
        for(let i = 0; i < 5; i++) for(let j = 0; j < 3; j++) {
            const x = left + i * 1.0, z = top + j * 1.5;
            group.add(box(0.28, height, 0.28, FARM_C.corn, x, 0.1 + height / 2, z), box(0.7, 0.12, 0.2, FARM_C.leaf, x, 0.1 + height * 0.65, z));
            if(ready) group.add(box(0.26, 0.55, 0.26, FARM_C.cob, x + 0.2, 0.1 + height * 0.55, z));
        }
    } else {
        for(let i = 0; i < 3; i++) for(let j = 0; j < 2; j++) {
            const x = left + 0.6 + i * 1.9, z = top + 0.5 + j * 2.4;
            group.add(box(1.4, 0.1, 1.4, FARM_C.leaf, x, 0.18, z));
            const size = [0.0, 0.3, 0.55, 1.0][stage];
            if(size) group.add(box(size, size * 0.85, size, ready ? FARM_C.pumpkin : FARM_C.young, x, 0.15 + size * 0.42, z));
            if(ready) group.add(box(0.14, 0.3, 0.14, FARM_C.leaf, x, 1.2, z));
        }
    }
}

export function createFarmScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8c8d8);
    scene.fog = new THREE.Fog(0xc9d3b4, 70, 160);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(0, 1.2, 14), distance: 40, pitch: 0.98 };

    scene.add(new THREE.HemisphereLight(0xcfe3ee, 0x6b5a3a, 2.3));
    const sun = new THREE.DirectionalLight(0xffe2a8, 3.0);
    sun.position.set(-30, 45, 40);
    scene.add(sun);

    // ---------- Everything that never changes: one merged mesh per material ----------
    const scenery = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(FARM_C.grass));
    ground.rotation.x = -Math.PI / 2;
    scenery.add(ground);
    for(const [w, d, x, z] of [[6, 18, 0, 15], [50, 3.6, 0, 10.8], [3.6, 17, -18, -3.2], [3.6, 15, 18, -5.2]]) scenery.add(box(w, 0.05, d, FARM_C.path, x, 0.03, z));
    for(const plot of PLOTS) {
        scenery.add(box(PLOT_SIZE.w, 0.16, PLOT_SIZE.d, FARM_C.soil, plot.x, 0.08, plot.z));
        for(let i = 0; i < 5; i++) scenery.add(box(PLOT_SIZE.w - 0.4, 0.04, 0.16, FARM_C.furrow, plot.x, 0.18, plot.z - PLOT_SIZE.d / 2 + 0.7 + i * 0.9));
    }

    const barn = new THREE.Group();
    barn.add(box(12, 6, 7.6, FARM_C.barnRed, 0, 3, 0), roof(12, 7.6, 3.2, C.timberDark, 6), box(3.6, 4.4, 0.2, FARM_C.white, 0, 2.2, 3.85), box(0.3, 4.4, 0.3, C.timberDark, 0, 2.2, 3.95),
        box(3.8, 0.3, 0.3, FARM_C.white, 0, 4.5, 3.95), box(1.6, 1.6, 0.2, FARM_C.white, 0, 6.6, 3.85));
    const barnSign = sign('CALLOWAY', 4.4);
    barnSign.position.set(0, 5.2, 3.97);
    barn.add(barnSign);
    barn.position.set(BARN.x, 0, BARN.z);
    scenery.add(barn);

    const coop = new THREE.Group();
    coop.add(box(4.8, 2.6, 3.6, C.timber, 0, 1.3, 0), roof(4.8, 3.6, 1.4, C.timberDark, 2.6), box(0.9, 1.2, 0.15, C.trim, 0, 0.9, 1.85), box(1.6, 0.18, 1.5, C.timber, 0, 0.2, 2.6).rotateX(-0.25));
    coop.position.set(COOP.x, 0, COOP.z);
    scenery.add(coop);
    for(let x = -4; x <= 4; x += 2) scenery.add(box(0.14, 0.9, 0.14, C.timberDark, COOP.x + x, 0.45, COOP.z + 5.4));
    scenery.add(box(8, 0.1, 0.1, C.timber, COOP.x, 0.7, COOP.z + 5.4), box(0.1, 0.1, 3.6, C.timber, COOP.x - 4, 0.7, COOP.z + 3.6), box(0.1, 0.1, 3.6, C.timber, COOP.x + 4, 0.7, COOP.z + 3.6));

    const stand = new THREE.Group();
    stand.add(box(5.2, 1.1, 1.8, C.timber, 0, 0.55, 0), box(0.2, 2.8, 0.2, C.timberDark, -2.5, 1.4, 0.7), box(0.2, 2.8, 0.2, C.timberDark, 2.5, 1.4, 0.7));
    for(let i = 0; i < 6; i++) stand.add(box(0.9, 0.12, 2.6, i % 2 ? FARM_C.white : FARM_C.barnRed, -2.25 + i * 0.9, 2.9 - (i % 2) * 0.01, 0.6));
    const standSign = sign('FARM STAND', 3.6);
    standSign.position.set(0, 2.1, 1.55);
    stand.add(standSign, box(0.9, 0.6, 0.9, C.timberDark, -1.6, 1.4, 0), box(0.8, 0.5, 0.8, FARM_C.pumpkin, -1.6, 1.8, 0), box(0.7, 0.4, 0.7, FARM_C.cob, 1.0, 1.35, 0));
    stand.position.set(STAND.x, 0, STAND.z);
    scenery.add(stand);

    const kennel = new THREE.Group();
    kennel.add(box(2, 1.4, 1.6, C.timber, 0, 0.7, 0), roof(2, 1.6, 0.8, C.timberDark, 1.4), box(0.7, 0.9, 0.1, C.trim, 0, 0.5, 0.82));
    kennel.position.set(KENNEL.x, 0, KENNEL.z);
    scenery.add(kennel);

    const mill = new THREE.Group();
    mill.add(box(3.4, 7, 3.4, FARM_C.white, 0, 3.5, 0), box(2.6, 0.6, 2.6, C.timberDark, 0, 7.2, 0), box(1.8, 1.4, 1.8, C.slate, 0, 8.2, 0), box(1.0, 2.0, 0.12, C.timberDark, 0, 1.0, 1.72));
    mill.position.set(WINDMILL.x, 0, WINDMILL.z);
    scenery.add(mill);

    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.9, 12), mat(C.stone));
    well.position.set(WELL.x, 0.45, WELL.z);
    scenery.add(well, box(0.2, 2.6, 0.2, C.timberDark, WELL.x - 1, 1.3, WELL.z), box(0.2, 2.6, 0.2, C.timberDark, WELL.x + 1, 1.3, WELL.z), box(2.6, 0.16, 0.5, C.timberDark, WELL.x, 2.6, WELL.z));

    scenery.add(box(0.2, 2.6, 0.2, C.timberDark, SCARECROW.x, 1.3, SCARECROW.z), box(2.0, 0.18, 0.18, C.timberDark, SCARECROW.x, 2.1, SCARECROW.z), box(0.55, 0.55, 0.55, 0xd9a27a, SCARECROW.x, 2.9, SCARECROW.z),
        box(0.9, 0.12, 0.9, C.trim, SCARECROW.x, 3.25, SCARECROW.z), box(0.45, 0.35, 0.45, C.trim, SCARECROW.x, 3.45, SCARECROW.z), box(0.8, 1.0, 0.3, 0x7b2a1f, SCARECROW.x, 1.7, SCARECROW.z));
    for(const [x, y, z] of [[HAY.x - 0.8, 0.5, HAY.z], [HAY.x + 0.8, 0.5, HAY.z + 0.1], [HAY.x, 1.5, HAY.z]]) scenery.add(box(1.5, 1, 1.2, FARM_C.hay, x, y, z));

    // The edge of the farm: a fence along the north, west and east sides, and the way home at the south with an arch.
    const A = FARM_AREA;
    for(let x = A.minX; x <= A.maxX; x += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, x, 0.7, A.minZ + 0.3));
    for(let z = A.minZ; z <= A.maxZ; z += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, A.minX + 0.3, 0.7, z), box(0.2, 1.4, 0.2, C.timberDark, A.maxX - 0.3, 0.7, z));
    for(const y of [0.6, 1.2]) scenery.add(box(A.maxX - A.minX, 0.12, 0.12, C.timber, 0, y, A.minZ + 0.3), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.minX + 0.3, y, 0), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.maxX - 0.3, y, 0));
    for(const x of [-12, 12]) for(let i = 0; i < 3; i++) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, x + (x < 0 ? -1 : 1) * i * 3, 0.7, A.maxZ - 0.3), box(3, 0.12, 0.12, C.timber, x + (x < 0 ? -1 : 1) * i * 3 + (x < 0 ? -1.5 : 1.5), 1.0, A.maxZ - 0.3));
    for(const side of [-1, 1]) scenery.add(box(0.4, 4.6, 0.4, C.timberDark, side * 3.4, 2.3, 23.2));
    scenery.add(box(7.2, 0.35, 0.35, C.timberDark, 0, 4.5, 23.2), lamp(-4.4, 22.6), lamp(4.4, 22.6));
    const archSign = sign('CALLOWAY FARM', 5);
    archSign.position.set(0, 5.5, 23.3);
    scenery.add(archSign);
    // Trees beyond the fence and along the north, in blocks of green on a trunk.
    for(const [x, z, s] of [[-26, -29, 1.2], [-12, -30, 1.0], [2, -31, 1.3], [22, -29, 1.1], [34, -22, 1.2], [36, 4, 1.0], [-36, -12, 1.3], [-37, 10, 1.1], [-33, 22, 1.0], [34, 20, 1.2]]) {
        scenery.add(box(0.7 * s, 3 * s, 0.7 * s, C.timberDark, x, 1.5 * s, z), box(3.4 * s, 2.6 * s, 3.4 * s, FARM_C.leaf, x, 4.2 * s, z), box(2.4 * s, 1.8 * s, 2.4 * s, FARM_C.stalk, x, 6.2 * s, z));
    }
    for(const [x, z] of [[-4, 8], [4, 8], [-14, -9], [14, -9]]) scenery.add(lamp(x, z));
    scene.add(mergeByMaterial(scenery));

    const blades = windmillBlades();
    blades.position.set(WINDMILL.x, 6.4, WINDMILL.z + 1.9);
    scene.add(blades);
    const hens = [0, 1].map(i => {
        const object = hen();
        scene.add(object);
        return { object, phase: i * 3.1, home: [COOP.x - 1.6 + i * 3.2, COOP.z + 3.6] };
    });

    // ---------- What changes: the crops in the beds, the eggs at the coop ----------
    let farm = null;
    let level = 1;
    let now = new Date();
    let shown = null; // the mesh now in the scene
    let shownKey = '';
    function cropsKey() {
        const states = plotStates(farm, now);
        return states.map(s => (s.state === 'empty' ? '-' : `${s.crop.id}${s.state === 'ready' ? 'R' : Math.min(2, Math.floor(s.fraction * 3))}`)).join('|') + `#${eggsReady(farm, now, level)}`;
    }
    function rebuild() {
        const states = plotStates(farm, now);
        const group = new THREE.Group();
        states.forEach((s, i) => {
            if(s.state === 'empty') return;
            cropBed(group, PLOTS[i], s.crop, s.fraction, s.state === 'ready');
            if(s.state === 'ready') { // a gold lantern floats over a bed that is ready
                const marker = box(0.55, 0.55, 0.55, C.glow, PLOTS[i].x, 3.6, PLOTS[i].z, 1.5);
                marker.rotation.set(0.6, 0.8, 0);
                group.add(marker);
            }
        });
        const eggs = eggsReady(farm, now, level);
        for(let e = 0; e < eggs; e++) group.add(box(0.28, 0.36, 0.28, FARM_C.egg, COOP.x - 1.2 + (e % 4) * 0.55, 0.2, COOP.z + 2.4 + Math.floor(e / 4) * 0.5));
        if(shown) {
            scene.remove(shown);
            shown.traverse(o => { if(o.isMesh) o.geometry.dispose(); });
        }
        shown = group.children.length ? mergeByMaterial(group) : null;
        if(shown) scene.add(shown);
    }

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
        // The farm's state (src/farm.js): rebuilt only when something a player can see has changed.
        setFarm(next, at = new Date(), nextLevel = 1) {
            farm = next;
            level = nextLevel;
            now = at;
            if(!farm) return;
            const key = cropsKey();
            if(key !== shownKey) {
                shownKey = key;
                rebuild();
            }
        },
        update(dt) {
            elapsed += dt;
            blades.rotation.z = elapsed * 0.6;
            for(const h of hens) {
                const t = elapsed * 0.5 + h.phase;
                h.object.position.set(h.home[0] + Math.sin(t) * 1.4, Math.max(0, Math.sin(elapsed * 5 + h.phase) * 0.08), h.home[1] + Math.cos(t * 0.7) * 0.8);
                h.object.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI;
            }
            if(farm) { // a crop ripens while the marshal watches
                now = new Date();
                const key = cropsKey();
                if(key !== shownKey) {
                    shownKey = key;
                    rebuild();
                }
            }
        },
        resize(width, height) {
            viewSize = [width, height];
            camera.aspect = width / height;
            camera.fov = width < height ? 50 : 38;
            camera.updateProjectionMatrix();
            placeCamera();
        },
        walkMap() { return farmMap(farm, new Date(), level); },
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
