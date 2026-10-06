import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { C, box, roof, sign, lamp } from './townScene.js';
import { HILL_WALK_AREA, CHAPEL, hillMap } from './hillLayout.js';
import { HILL_START, OIL_STAND, getPost, PIECES } from './vigil.js';

// PLACEHOLDER SCENE (cross-lane on purpose, see AGENTS.md "Art and function"): Hollow Hill as plain boxes, so the place works at once. Every look change after this
// merges is the art lane's. Where things stand comes from src/hillLayout.js and the rules (src/vigil.js): the posts, the oil stand and the gate are the rules' own.
// Same few parts as the farm's scene (scene, walkMap, follow, overview, project, folk, talkTo) so src/townWalk.js walks it as it walks the town.
// What the vigil changes is drawn from `setHill(night, lit, light, playing)`: tonight's lanterns (dark until lit), and the chapel as far as it is built.

const HI_C = { grass: 0x3d4a35, path: 0x6b5d45, stone: 0x6f6a62, burnt: 0x3b2a20, lantern: 0x2a2623, flame: 0xffc060, glass: 0xffd98a, cross: 0xcfc6b0, bell: 0xc8a050 };

export function createHillScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141a2e);
    scene.fog = new THREE.Fog(0x1c2440, 60, 150);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(0, 1.2, 14), distance: 44, pitch: 0.98 };

    scene.add(new THREE.HemisphereLight(0x8a96c0, 0x2a2a30, 1.5)); // dusk
    const moon = new THREE.DirectionalLight(0xb8c4ee, 1.4);
    moon.position.set(-30, 45, 40);
    scene.add(moon);

    // ---------- Everything that never changes ----------
    const scenery = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: HI_C.grass }));
    ground.rotation.x = -Math.PI / 2;
    scenery.add(ground);
    scenery.add(box(5, 0.05, 44, HI_C.path, 0, 0.03, -4), box(46, 0.05, 3, HI_C.path, 0, 0.03, 4)); // the paths up the hill
    // The oil stand: barrels, a trough and a hanging can.
    for(const [dx, dz] of [[-0.7, -1.4], [0.7, -1.2]]) scenery.add(box(0.9, 1.1, 0.9, C.timber, OIL_STAND.x + dx, 0.55, OIL_STAND.z + dz));
    scenery.add(box(1.8, 0.7, 0.8, C.timberDark, OIL_STAND.x, 0.35, OIL_STAND.z - 0.2), box(0.4, 0.6, 0.4, HI_C.lantern, OIL_STAND.x + 1.2, 0.3, OIL_STAND.z));
    // Graves under the hill: small stones and crosses in rows, away from the lanterns' posts.
    for(const [x, z] of [[-27, 8], [-27, 0], [-27, -8], [27, 8], [27, 0], [27, -8], [-16, 8], [16, 8], [-16, -8], [16, -8], [-4, -9], [4, -9], [-10, -16], [10, -16], [-18, -16], [18, -16]]) {
        scenery.add(box(0.9, 1.1, 0.3, HI_C.stone, x, 0.55, z), box(0.2, 0.9, 0.2, HI_C.cross, x + 0.4, 1.3, z - 0.3).rotateZ(0));
    }
    // The edge: a rail fence round the hill, and the way home at the south with an arch.
    const A = HILL_WALK_AREA;
    for(let x = A.minX; x <= A.maxX; x += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, x, 0.7, A.minZ + 0.3));
    for(let z = A.minZ; z <= A.maxZ; z += 3) scenery.add(box(0.2, 1.4, 0.2, C.timberDark, A.minX + 0.3, 0.7, z), box(0.2, 1.4, 0.2, C.timberDark, A.maxX - 0.3, 0.7, z));
    scenery.add(box(A.maxX - A.minX, 0.12, 0.12, C.timber, 0, 1.1, A.minZ + 0.3), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.minX + 0.3, 1.1, 0), box(0.12, 0.12, A.maxZ - A.minZ, C.timber, A.maxX - 0.3, 1.1, 0));
    for(const side of [-1, 1]) scenery.add(box(0.4, 4.6, 0.4, C.timberDark, side * 3.4, 2.3, 21.2));
    scenery.add(box(7.2, 0.35, 0.35, C.timberDark, 0, 4.5, 21.2), lamp(-4.4, 20.6), lamp(4.4, 20.6), lamp(HILL_START[0] - 4, HILL_START[1]), lamp(HILL_START[0] + 4, HILL_START[1]));
    const archSign = sign('HOLLOW HILL', 4.6);
    archSign.position.set(0, 5.5, 21.3);
    scenery.add(archSign);
    scene.add(mergeByMaterial(scenery));

    // ---------- What changes: tonight's lanterns, and the chapel as far as it is built ----------
    let night = null, lit = [], light = 0, playing = false, shownKey = '', shown = null;
    function rebuild() {
        const group = new THREE.Group();
        // The chapel: the burnt walls always; each piece the Deacon has built is added for good.
        const built = PIECES.filter(p => light >= p.at).map(p => p.id);
        group.add(box(CHAPEL.hx * 2, 5, CHAPEL.hz * 2, HI_C.burnt, CHAPEL.x, 2.5, CHAPEL.z), box(2.4, 3.4, 0.2, C.trim, CHAPEL.x, 1.7, CHAPEL.z + CHAPEL.hz + 0.05));
        if(built.includes('window')) group.add(box(1.6, 2.2, 0.15, HI_C.glass, CHAPEL.x - 3.2, 3, CHAPEL.z + CHAPEL.hz + 0.1, 0.9), box(1.6, 2.2, 0.15, HI_C.glass, CHAPEL.x + 3.2, 3, CHAPEL.z + CHAPEL.hz + 0.1, 0.9));
        if(built.includes('pews')) for(let i = 0; i < 3; i++) group.add(box(5, 0.5, 0.6, C.timber, CHAPEL.x, 0.35, CHAPEL.z + CHAPEL.hz + 2.2 + i * 1.2));
        if(built.includes('tower')) group.add(box(2.6, 7, 2.6, HI_C.burnt, CHAPEL.x + CHAPEL.hx - 1.3, 8.5, CHAPEL.z - 0.5), box(0.8, 1.1, 0.8, HI_C.bell, CHAPEL.x + CHAPEL.hx - 1.3, 12.4, CHAPEL.z - 0.5));
        if(built.includes('roof')) group.add(roof(CHAPEL.hx * 2 + 0.6, CHAPEL.hz * 2 + 0.6, 2.8, C.slate, 5).translateX(CHAPEL.x).translateZ(CHAPEL.z));
        // The bell on its frame at the door, whatever is built.
        group.add(box(0.2, 3.2, 0.2, C.timberDark, CHAPEL.x - 1.2, 1.6, CHAPEL.z + CHAPEL.hz + 1.2), box(0.2, 3.2, 0.2, C.timberDark, CHAPEL.x + 1.2, 1.6, CHAPEL.z + CHAPEL.hz + 1.2), box(2.6, 0.2, 0.2, C.timberDark, CHAPEL.x, 3.2, CHAPEL.z + CHAPEL.hz + 1.2), box(0.7, 0.9, 0.7, HI_C.bell, CHAPEL.x, 2.6, CHAPEL.z + CHAPEL.hz + 1.2));
        // Tonight's lanterns on their posts: dark until lit, then a warm glow.
        for(const l of night?.lanterns ?? []) {
            const post = getPost(l.id);
            group.add(box(0.25, 2.2, 0.25, C.timberDark, post.x, 1.1, post.z), box(0.8, 0.9, 0.8, lit.includes(l.id) ? HI_C.flame : HI_C.lantern, post.x, 2.5, post.z, lit.includes(l.id) ? 1.4 : 0));
            if(l.dry) group.add(box(0.3, 0.3, 0.3, 0x6a8fb0, post.x + 0.7, 0.2, post.z)); // a dry lantern has a small blue oil jar at its foot
        }
        if(shown) { scene.remove(shown); shown.traverse(o => { if(o.isMesh) o.geometry.dispose(); }); }
        shown = mergeByMaterial(group);
        scene.add(shown);
    }
    const keyOf = () => `${night?.day ?? '-'}:${night?.lanterns.map(l => l.id).join()}|${lit.join()}|${PIECES.filter(p => light >= p.at).length}`;

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
    rebuild();

    return {
        scene,
        camera,
        folk: [],
        talkTo() {},
        // Tonight's hill ({ lanterns, oil, ... } or null), which lanterns are lit, the chapel's light, and whether a vigil is being played.
        setHill(nextNight, nextLit = [], nextLight = 0, nextPlaying = false) {
            night = nextNight;
            lit = nextLit;
            light = nextLight;
            playing = nextPlaying;
            const key = keyOf();
            if(key !== shownKey) { shownKey = key; rebuild(); }
        },
        get playing() { return playing; },
        update() {},
        resize(width, height) {
            viewSize = [width, height];
            camera.aspect = width / height;
            camera.fov = width < height ? 50 : 38;
            camera.updateProjectionMatrix();
            placeCamera();
        },
        walkMap() { return hillMap(night, lit); },
        follow(x, z) {
            const upright = viewSize[0] < viewSize[1];
            view.pitch = upright ? 1.1 : 0.98;
            view.distance = upright ? 58 : 44;
            view.target.set(x, 1.2, z);
            placeCamera();
        },
        overview() { this.follow(0, 4); },
        project(x, y, z) {
            projected.set(x, y, z).project(camera);
            return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, visible: projected.z < 1 };
        }
    };
}
