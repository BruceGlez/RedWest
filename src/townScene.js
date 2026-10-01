import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';
import { TOWN_AREA, DISTRICTS, walkAreas, districtPlaces, getDistrict, districtOffsetById } from './townDistricts.js';
import { TOWN_LAYOUT, SPREAD, spread, near, moved } from './townSpace.js';
import { FOLK, createWalker, stepWalker } from './townFolk.js';
import { skyAt } from './townTime.js';
import { SPOTS, getSpot, coinCount, cashBoxFull, boardNotes, BOARD_NOTES } from './townSpots.js';

// Frontier Town as a small 3D diorama at dusk (look "A" in art/town/dusk-gang-town.jpg): gaslit brick and
// timber, chimney smoke, fog, a steam train at the depot, townsfolk in flat caps and long coats.
// Everything is built from simple shapes in code, like the rest of the game, so it costs no download.
// Buildings grow with their level. The town shares the game's renderer: while it is open the home-screen
// loop draws this scene instead (src/gameLoop.js, setLobbyView).

export const C = {
    ground: 0x6a5440, street: 0x8f7355, brick: 0x7b3b2a, brickDark: 0x5c2b1f, timber: 0x5a3d2b, timberDark: 0x3b2a20,
    stone: 0x6b6258, stoneDark: 0x4d463f, slate: 0x2f3a3f, trim: 0x2a1d15, glow: 0xffb347, iron: 0x2b2b2e, brass: 0xc8a050,
    coat: 0x2a2521, cap: 0x3a342c, skin: 0xd9a27a, smoke: 0x6e6a66, sky: 0x1d3640, green: 0x3f4f3a
};

// Lamp and window materials, with the glow they were made with: the time of day (src/townTime.js) scales them.
const glowBase = new Map();
export const mat = (() => {
    const cache = new Map();
    return (color, emissive = 0) => {
        const key = `${color}:${emissive}`;
        if(!cache.has(key)) {
            const material = new THREE.MeshLambertMaterial({ color, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive });
            cache.set(key, material);
            if(emissive) glowBase.set(material, emissive);
        }
        return cache.get(key);
    };
})();

export function box(w, h, d, color, x = 0, y = 0, z = 0, emissive = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive));
    mesh.position.set(x, y, z);
    return mesh;
}

// A pitched roof along x over a w by d footprint.
export function roof(w, d, h, color, y) {
    const shape = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.4, 0), new THREE.Vector2(d / 2 + 0.4, 0), new THREE.Vector2(0, h)]);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: w + 0.6, bevelEnabled: false });
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-(w + 0.6) / 2, 0, 0);
    const mesh = new THREE.Mesh(geometry, mat(color));
    mesh.position.y = y;
    return mesh;
}

// A painted sign board with Rye lettering. The same words share one material, so repeats merge into one draw call.
const signMaterials = new Map();
export function sign(text, width = 5, color = '#2a1d15', ink = '#f0d9a8') {
    const key = `${text}|${color}|${ink}`;
    if(signMaterials.has(key)) return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), signMaterials.get(key));
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#c8a050';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 500, 116);
    g.fillStyle = ink;
    g.font = "76px Rye, 'Times New Roman', serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 70, 470);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    signMaterials.set(key, material);
    return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material);
}

// How lively the town looks: more windows light up as buildings are upgraded (set before building).
let litBoost = 0;

// Windows on a facade (front face at +z = depth/2): lit amber ones and a few dark ones.
function windows(group, { w, y, z, count, lit = 0.7, size = 0.9 }) {
    for(let i = 0; i < count; i++) {
        const x = -w / 2 + (w / (count + 1)) * (i + 1);
        const on = ((i * 7 + Math.round(y * 3)) % 10) / 10 < Math.min(1, lit - 0.25 + litBoost);
        group.add(box(size, size * 1.3, 0.15, on ? C.glow : C.timberDark, x, y, z, on ? 0.9 : 0));
    }
}

function porch(group, { w, z, h = 2.6, color = C.timberDark }) {
    group.add(box(w, 0.2, 2.2, color, 0, h, z + 1.1));
    for(const x of [-w / 2 + 0.3, w / 2 - 0.3]) group.add(box(0.25, h, 0.25, color, x, h / 2, z + 2.1));
    group.add(box(w, 0.25, 2.4, C.timber, 0, 0.12, z + 1.2));
}

// ---------- Buildings. Each returns a group; `level` changes what is built. ----------
const BUILDERS = {
    jail(level) {
        const g = new THREE.Group();
        g.add(box(8, 5, 7, C.stone, 0, 2.5, 0));
        g.add(box(8.4, 0.5, 7.4, C.stoneDark, 0, 5.1, 0));
        g.add(box(1.8, 3, 0.3, C.iron, 0, 1.5, 3.55));
        for(const x of [-2.6, 2.6]) {
            g.add(box(1.2, 1.2, 0.2, C.glow, x, 3, 3.55, 0.5));
            for(let b = -1; b <= 1; b++) g.add(box(0.1, 1.3, 0.3, C.iron, x + b * 0.35, 3, 3.62));
        }
        const s = sign('JAIL', 4);
        s.position.set(0, 4.3, 3.62);
        g.add(s);
        if(level >= 2) { // a cell wing
            g.add(box(5, 4, 6, C.stoneDark, 6.5, 2, 0.5));
            for(let b = -2; b <= 2; b++) g.add(box(0.12, 1.3, 0.3, C.iron, 6.5 + b * 0.4, 2.6, 3.6));
        }
        if(level >= 3) { // an upper floor
            g.add(box(7, 3.5, 6, C.stone, 0, 7, -0.3));
            windows(g, { w: 7, y: 7.2, z: 2.75, count: 3, lit: 0.6 });
            g.add(roof(7, 6, 2.2, C.slate, 8.75));
        } else {
            g.add(roof(8, 7, 2, C.slate, 5.35));
        }
        if(level >= 4) { // watchtower
            g.add(box(2.4, 9, 2.4, C.stoneDark, -5.4, 4.5, -2));
            g.add(box(3.2, 0.4, 3.2, C.timberDark, -5.4, 9.2, -2));
            g.add(box(0.7, 0.7, 0.7, C.glow, -5.4, 9.8, -2, 1.2));
        }
        if(level >= 5) { // flag
            g.add(box(0.15, 5, 0.15, C.iron, 3, 11.2, -1));
            g.add(box(2.4, 1.4, 0.08, 0x8b0000, 4.2, 12.8, -1));
        }
        return g;
    },
    sheriff(level) {
        const g = new THREE.Group();
        g.add(box(7, 5, 6, C.timber, 0, 2.5, 0));
        g.add(box(7, 2, 0.4, C.timberDark, 0, 6, 2.9)); // false front
        g.add(box(1.6, 2.8, 0.2, C.trim, 0, 1.4, 3.05));
        windows(g, { w: 7, y: 2.2, z: 3.05, count: 2, lit: 0.9 });
        const star = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 5), mat(C.brass, 0.3));
        star.rotation.x = Math.PI / 2;
        star.position.set(0, 6.1, 3.15);
        g.add(star);
        const s = sign('SHERIFF', 5);
        s.position.set(0, 4.3, 3.1);
        g.add(s);
        g.add(roof(7, 6, 1.6, C.slate, 5));
        if(level >= 2) porch(g, { w: 7, z: 3 });
        if(level >= 3) { // second floor and a bell
            g.add(box(6, 3, 5, C.timber, 0, 8.4, -0.5));
            windows(g, { w: 6, y: 8.5, z: 2.05, count: 2, lit: 0.8 });
            g.add(roof(6, 5, 1.5, C.slate, 9.9));
            g.add(box(1, 1.2, 1, C.brass, 0, 12, -0.5, 0.2));
        }
        return g;
    },
    // extra: how many shop guns the player owns, shown on a rack by the door.
    gunsmith(level, extra = 0) {
        const g = new THREE.Group();
        for(let i = 0; i < Math.min(4, extra); i++) {
            const rifle = box(0.18, 1.9, 0.18, C.timberDark, 2.3 + i * 0.35, 1.2, 3.3);
            rifle.rotation.z = 0.12;
            g.add(rifle, box(0.1, 0.9, 0.12, C.iron, 2.3 + i * 0.35, 2.0, 3.36));
        }
        g.add(box(6, 4.5, 6, C.timberDark, 0, 2.25, 0));
        g.add(box(6, 1.6, 0.4, C.timber, 0, 5.3, 2.9));
        g.add(box(1.5, 2.6, 0.2, C.trim, -1.5, 1.3, 3.05));
        g.add(box(2.2, 1.4, 0.15, C.glow, 1.3, 2.2, 3.05, 0.8));
        const s = sign('GUNSMITH', 5);
        s.position.set(0, 5.3, 3.12);
        g.add(s);
        g.add(box(3.2, 0.3, 0.3, C.iron, 0, 6.5, 3)); // rifle over the door
        g.add(roof(6, 6, 1.4, C.slate, 4.5));
        porch(g, { w: 6, z: 3, h: 2.8 });
        return g;
    },
    // extra: how many looks the player owns; the window fills with mannequins.
    tailor(level, extra = 0) {
        const g = new THREE.Group();
        for(let i = 0; i < Math.min(3, Math.floor(extra / 3)); i++) {
            const x = -0.2 + i * 1;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xe0cfb0));
            head.position.set(x, 2.35, 2.9);
            g.add(box(0.5, 0.9, 0.3, [0x37474f, 0x6b1d1d, 0x3e2723][i], x, 1.75, 2.9), head);
        }
        g.add(box(6, 6, 6, C.brick, 0, 3, 0));
        windows(g, { w: 6, y: 4.6, z: 3.05, count: 2, lit: 0.8 });
        g.add(box(3.5, 1.6, 0.15, C.glow, 0.8, 1.8, 3.05, 0.7));
        g.add(box(1.3, 2.6, 0.2, C.trim, -2, 1.3, 3.05));
        g.add(box(6.4, 0.2, 1.6, 0x6b1d1d, 0, 3.1, 3.8)); // awning
        const s = sign('TAILOR', 4.5);
        s.position.set(0, 3.7, 3.1);
        g.add(s);
        g.add(box(6.4, 0.5, 6.4, C.brickDark, 0, 6.2, 0));
        return g;
    },
    // The Arena (src/arena.js): a walled ring of sand with a gate and a flag, where practice fights are picked.
    arena() {
        const g = new THREE.Group();
        g.add(box(11, 0.08, 9, 0xb89a64, 0, 0.05, 0)); // the sand
        g.add(box(11, 3, 0.4, C.timber, 0, 1.5, -4.3)); // back wall
        for(const x of [-5.3, 5.3]) g.add(box(0.4, 3, 9, C.timber, x, 1.5, 0)); // side walls
        for(const x of [-3.75, 3.75]) g.add(box(3.5, 3, 0.4, C.timber, x, 1.5, 4.3)); // front wall, with the gate between
        for(const x of [-2, 2]) g.add(box(0.5, 5, 0.5, C.timber, x, 2.5, 4.3)); // gateposts
        g.add(box(4.8, 0.4, 0.5, C.timber, 0, 5, 4.3)); // the beam
        const s = sign('ARENA', 4);
        s.position.set(0, 6, 4.6);
        g.add(s);
        g.add(box(0.25, 7, 0.25, C.timber, -5.3, 3.5, 4.3), box(2.2, 1.2, 0.08, 0x8b0000, -4.2, 6.4, 4.3)); // a flag
        g.add(box(0.5, 1.8, 0.5, C.timber, 0, 0.9, 0)); // the post in the middle of the ring
        return g;
    },
    saloon() {
        const g = new THREE.Group();
        g.add(box(10, 8, 7, C.brick, 0, 4, 0));
        g.add(box(10, 2.4, 0.4, C.brickDark, 0, 9.1, 3.3));
        windows(g, { w: 10, y: 6, z: 3.55, count: 4, lit: 0.8, size: 1.1 });
        g.add(box(2.4, 2.8, 0.2, C.glow, 0, 1.5, 3.55, 0.6)); // swinging doors, lit from inside
        windows(g, { w: 10, y: 2, z: 3.55, count: 2, lit: 1, size: 1.3 });
        g.add(box(10, 0.3, 2, C.timberDark, 0, 4.3, 4.5)); // balcony
        g.add(box(10, 0.8, 0.15, C.timber, 0, 4.9, 5.45));
        for(const x of [-4.7, 4.7]) g.add(box(0.3, 4.3, 0.3, C.timberDark, x, 2.15, 5.3));
        const s = sign('SALOON', 6);
        s.position.set(0, 9.1, 3.55);
        g.add(s);
        g.add(box(1.2, 3, 1.2, C.brickDark, -3.5, 10, -2)); // chimney
        g.userData.smoke = new THREE.Vector3(-3.5, 11.6, -2);
        return g;
    },
    bank(level) {
        const g = new THREE.Group();
        if(level >= 2) { // a vault annex with an iron door
            g.add(box(3.5, 4, 5, C.stoneDark, -5.3, 2, -0.3), box(1.6, 1.6, 0.25, C.iron, -5.3, 1.6, 2.3));
            const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 6, 12), mat(C.brass));
            wheel.position.set(-5.3, 1.6, 2.45);
            g.add(wheel);
        }
        if(level >= 3) { // an upper floor and a clock
            g.add(box(6, 3, 5, C.stone, 0, 8, -0.4), box(6.4, 0.4, 5.4, C.stoneDark, 0, 9.7, -0.4));
            windows(g, { w: 6, y: 8, z: 2.15, count: 3, lit: 0.8 });
            const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 16), mat(0xf0e6cc, 0.2));
            clock.rotation.x = Math.PI / 2;
            clock.position.set(0, 10.8, 2);
            g.add(box(2.4, 2.4, 0.5, C.stoneDark, 0, 10.8, 1.7), clock);
        }
        g.add(box(7, 6, 6, C.stone, 0, 3, 0));
        for(const x of [-2.6, -0.9, 0.9, 2.6]) g.add(box(0.6, 4.6, 0.6, 0xb8ac98, x, 2.3, 3.3));
        g.add(box(7.6, 1, 1.2, 0xb8ac98, 0, 5.2, 3.2));
        g.add(box(1.8, 2.8, 0.2, C.iron, 0, 1.4, 3.05));
        const s = sign('BANK', 3.5);
        s.position.set(0, 5.2, 3.85);
        g.add(s);
        g.add(box(7.4, 0.5, 6.4, C.stoneDark, 0, 6.2, 0));
        return g;
    },
    depot() {
        const g = new THREE.Group();
        g.add(box(6, 4, 5, C.timber, 0, 2, 0));
        g.add(roof(6, 5, 1.6, C.green, 4));
        g.add(box(10, 0.3, 3.5, C.timberDark, 0, 3.4, 4)); // platform canopy
        for(const x of [-4.5, 0, 4.5]) g.add(box(0.25, 3.4, 0.25, C.timberDark, x, 1.7, 5.5));
        windows(g, { w: 6, y: 2, z: 2.55, count: 2, lit: 1 });
        const s = sign('DEPOT', 4);
        s.position.set(0, 5.3, 1.5);
        g.add(s);
        // Rails and a steam locomotive
        for(const z of [8, 9.4]) g.add(box(24, 0.15, 0.2, C.iron, 0, 0.1, z));
        for(let x = -11.2; x <= 11.2; x += 1.6) g.add(box(0.4, 0.1, 2.4, C.timberDark, x, 0.05, 8.7));
        const loco = new THREE.Group();
        const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 5, 12), mat(0x1c1c1f));
        boiler.rotation.z = Math.PI / 2;
        boiler.position.set(0, 2.2, 0);
        loco.add(boiler, box(2.6, 3, 2.6, 0x1c1c1f, 3.4, 2.4, 0), box(0.8, 1.6, 0.8, 0x1c1c1f, -1.8, 3.8, 0));
        loco.add(box(0.6, 0.6, 0.2, C.glow, -2.6, 2.4, 0, 1.2)); // headlamp
        loco.add(box(2.4, 0.3, 2.9, 0x8b0000, 3.4, 4, 0));
        for(const x of [-1.6, 0, 1.6, 3.4]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.7, 10), mat(0x8b0000));
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, 0.7, 0);
            loco.add(wheel);
        }
        loco.position.set(-5, 0, 8.7);
        g.add(loco);
        g.userData.smoke = new THREE.Vector3(-6.8, 4.8, 8.7);
        return g;
    }
};

// Where each building stands (x, z). All face the camera (+z); the depot's railway ends main street.
// Where each building stands is in src/townSpace.js (the town is laid out with room between its buildings).
export { TOWN_LAYOUT };

export function lamp(x, z) {
    const g = new THREE.Group();
    g.add(box(0.2, 4.2, 0.2, C.iron, 0, 2.1, 0), box(0.7, 0.8, 0.7, C.glow, 0, 4.5, 0, 1.4), box(0.9, 0.15, 0.9, C.iron, 0, 4.95, 0));
    g.position.set(x, 0, z);
    return g;
}

function townsperson(seed) {
    const g = new THREE.Group();
    g.add(box(0.9, 1.6, 0.6, C.coat, 0, 1.3, 0), box(0.8, 0.8, 0.55, C.coat, 0, 0.4, 0)); // one material for coat and trousers: fewer draw calls
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), mat(C.skin));
    head.position.y = 2.45;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.22, 10), mat(C.cap));
    cap.position.set(0, 2.72, 0.04);
    g.add(head, cap, box(0.6, 0.06, 0.35, C.cap, 0, 2.63, 0.38));
    g.scale.setScalar(1.15);
    return g;
}

// The beaten outlaws make themselves at home (STORY_BIBLE.md section 6): each one adds something to Lantern Rock once
// they are in the jail. Small, merged into a few meshes, and placed in the open ground between the buildings.
// Each entry: where it stands ([x, z]) and how to build it (parts around its own origin).
export const GUESTS = {
    'dusty-pete': { at: near('saloon', -13.5, -7.5), turn: 0.3, parts: () => [ // the Tin Cup's piano, dragged into the street
        box(3, 1.4, 1.3, 0x2f1d14, 0, 1.3, 0), box(3, 0.12, 0.6, 0xf2ead8, 0, 2.05, 0.8), box(2.8, 0.1, 1.2, 0x241510, 0, 2.6, -0.4),
        box(0.2, 0.9, 0.2, 0x241510, -1.3, 0.45, 0.4), box(0.2, 0.9, 0.2, 0x241510, 1.3, 0.45, 0.4), box(1.4, 0.7, 0.8, 0x5a3d2b, 0, 0.35, 1.6)
    ] },
    'rattlesnake-rosa': { at: near('jail', -14, 8.5), turn: 0, parts: () => [ // two wolf pups on the jail porch
        box(0.9, 0.5, 0.5, 0x8a8f99, 0, 0.4, 0), box(0.4, 0.4, 0.4, 0x8a8f99, 0.6, 0.65, 0), box(0.15, 0.2, 0.1, 0x6f747d, 0.6, 0.95, -0.1),
        box(0.9, 0.5, 0.5, 0x7a7f88, 1.6, 0.4, 0.9), box(0.4, 0.4, 0.4, 0x7a7f88, 2.2, 0.65, 0.9), box(0.15, 0.2, 0.1, 0x5f646c, 2.2, 0.95, 0.8)
    ] },
    'deacon-graves': { at: spread(-33, -8), turn: 0.2, parts: () => [ // a small chapel at the edge of town
        box(5, 3.2, 4, 0xe8e0cf, 0, 1.6, 0), box(5.4, 0.4, 4.4, 0x3b2a20, 0, 3.4, 0), box(1.4, 4.4, 1.4, 0xe8e0cf, -1.8, 2.2, 2.2), box(0.25, 1.4, 0.25, 0x2a1d15, -1.8, 5.2, 2.2),
        box(0.9, 0.25, 0.25, 0x2a1d15, -1.8, 5.4, 2.2), box(1, 1.7, 0.2, 0x2a1d15, 0, 0.85, 2.05)
    ] },
    'calloway-gang': { at: near('bank', 9, -7.5), turn: 0, parts: () => { // the brothers' fence, rebuilt outside the bank
        const out = [box(9, 0.2, 0.15, 0x6b4a2e, 2.25, 1.6, 0), box(9, 0.2, 0.15, 0x6b4a2e, 2.25, 0.9, 0)];
        for(let i = 0; i < 4; i++) out.push(box(0.25, 1.9, 0.25, 0x6b4a2e, i * 3, 0.95, 0));
        return out;
    } },
    'iron-jack': { at: near('gunsmith', 4.2, 8.6), turn: 0, parts: () => [ // an anvil, and the armour Ezra cut him out of, on a stand
        box(1.6, 0.6, 0.8, 0x2b2b2e, 0, 0.9, 0), box(0.8, 0.9, 0.6, 0x3a3a3e, 0, 0.45, 0), box(2.2, 0.15, 1.2, 0x3a3a3e, 0, 0.1, 0),
        box(1.3, 1.6, 0.8, 0x7d858c, 2.8, 1.8, 0), box(0.6, 0.5, 0.6, 0x7d858c, 2.8, 2.9, 0), box(0.25, 2.2, 0.25, 0x5a3d2b, 2.8, 1.1, 0)
    ] },
    'mesa-morgan': { at: near('sheriff', 3.4, -8), turn: 0.4, parts: () => [ // the volunteer fire crew's water cart
        box(2.6, 0.8, 1.4, 0xa23a2c, 0, 1.2, 0), box(1.6, 1.1, 1.1, 0x5a3d2b, 0, 2.15, 0), box(0.2, 1.2, 0.2, 0x2b2b2e, 1.6, 1.2, 0),
        box(0.8, 0.8, 0.15, 0x2b2b2e, -1, 0.6, 0.8), box(0.8, 0.8, 0.15, 0x2b2b2e, -1, 0.6, -0.8), box(0.8, 0.8, 0.15, 0x2b2b2e, 1, 0.6, 0.8), box(0.8, 0.8, 0.15, 0x2b2b2e, 1, 0.6, -0.8)
    ] },
    'silas-vane': { at: near('tailor', 13.5, 8.5), turn: 0, parts: () => [ // a shooting gallery: a board of targets
        box(4, 2.4, 0.2, 0x5a3d2b, 0, 2, 0), box(0.25, 2, 0.25, 0x3b2a20, -1.8, 1, 0.3), box(0.25, 2, 0.25, 0x3b2a20, 1.8, 1, 0.3),
        box(0.8, 0.8, 0.1, 0xf2ead8, -1.1, 2.2, 0.15), box(0.4, 0.4, 0.12, 0xb02a2a, -1.1, 2.2, 0.2), box(0.8, 0.8, 0.1, 0xf2ead8, 0, 2.5, 0.15),
        box(0.4, 0.4, 0.12, 0xb02a2a, 0, 2.5, 0.2), box(0.8, 0.8, 0.1, 0xf2ead8, 1.1, 2.2, 0.15), box(0.4, 0.4, 0.12, 0xb02a2a, 1.1, 2.2, 0.2)
    ] },
    'el-espectro': { at: near('jail', -18.8, 8.4), turn: 0.3, parts: () => [ // the chair on the jail's front porch
        box(1.1, 0.2, 1.1, 0xe8e0cf, 0, 0.9, 0), box(1.1, 1.3, 0.2, 0xe8e0cf, 0, 1.6, -0.45), box(0.15, 0.9, 0.15, 0xe8e0cf, -0.45, 0.45, 0.45),
        box(0.15, 0.9, 0.15, 0xe8e0cf, 0.45, 0.45, 0.45), box(0.15, 0.9, 0.15, 0xe8e0cf, -0.45, 0.45, -0.45), box(0.15, 0.9, 0.15, 0xe8e0cf, 0.45, 0.45, -0.45),
        box(0.8, 0.12, 0.6, 0x6a1b9a, 0, 1.05, 0.05)
    ] },
    'lucky-lou': { at: near('saloon', -18.5, -8), turn: 0, parts: () => [ // her card table under a lantern
        box(2.4, 0.15, 1.6, 0x2f6b3a, 0, 1.6, 0), box(0.25, 1.5, 0.25, 0x3b2a20, 0, 0.75, 0), box(1.4, 0.15, 0.9, 0x3b2a20, 0, 0.1, 0),
        box(0.5, 0.6, 0.5, 0x3b2a20, -1.7, 0.4, 0), box(0.5, 0.6, 0.5, 0x3b2a20, 1.7, 0.4, 0), box(0.4, 0.05, 0.3, 0xf2ead8, -0.4, 1.7, 0.1, 0), box(0.4, 0.05, 0.3, 0xf2ead8, 0.4, 1.7, -0.1, 0),
        box(0.3, 0.4, 0.3, C.glow, 0, 2.05, 0, 0.9)
    ] },
    'colonel-crane': { at: near('depot', 29.5, -7.5), turn: 0, parts: () => [ // a flagpole by the depot
        box(0.2, 9, 0.2, 0xd8d8dc, 0, 4.5, 0), box(2.2, 1.4, 0.08, 0xb02a2a, 1.2, 8, 0), box(2.2, 0.45, 0.1, 0xf4f0e6, 1.2, 8.3, 0), box(1.2, 0.3, 1.2, 0x6b6258, 0, 0.15, 0)
    ] }
};

function guestsGroup(ids) {
    const group = new THREE.Group();
    for(const id of ids) {
        const def = GUESTS[id];
        if(!def) continue;
        const prop = new THREE.Group();
        for(const part of def.parts()) prop.add(part);
        prop.position.set(def.at[0], 0, def.at[1]);
        prop.rotation.y = def.turn;
        group.add(prop);
    }
    return group.children.length ? mergeByMaterial(group) : group;
}


// ---------- Districts beyond the town's edge (TOWN_PLAN.md, step B; src/townDistricts.js has the rules) ----------
// Each one is always drawn, so a shut district can be seen over its fence; only the fence and gate change when it opens.
const fenceLine = d => {
    const [x1, z1] = d.fence.from, [x2, z2] = d.fence.to;
    return { x1, z1, x2, z2, alongX: z1 === z2, length: Math.hypot(x2 - x1, z2 - z1), cx: (x1 + x2) / 2, cz: (z1 + z2) / 2 };
};

// A shut gate: a fence across the way in, and a LOCKED sign.
function shutGate(d) {
    const g = new THREE.Group();
    const f = fenceLine(d);
    const posts = Math.round(f.length / 2);
    for(let i = 0; i <= posts; i++) {
        const t = i / posts;
        g.add(box(0.25, 1.9, 0.25, C.timberDark, f.x1 + (f.x2 - f.x1) * t, 0.95, f.z1 + (f.z2 - f.z1) * t));
    }
    for(const y of [0.7, 1.5]) g.add(f.alongX ? box(f.length, 0.14, 0.14, C.timber, f.cx, y, f.cz) : box(0.14, 0.14, f.length, C.timber, f.cx, y, f.cz));
    const notice = sign('LOCKED', 2.6);
    notice.position.set(f.cx, 2.7, f.cz);
    notice.rotation.y = f.alongX ? 0 : 0.6;
    g.add(notice, f.alongX ? box(0.2, 2.2, 0.2, C.timberDark, f.cx, 1.1, f.cz) : box(0.2, 2.2, 0.2, C.timberDark, f.cx, 1.1, f.cz));
    return g;
}

// An open gate: two tall posts, a beam and the district's name.
function openGate(d) {
    const g = new THREE.Group();
    const f = fenceLine(d);
    const along = f.alongX ? [1, 0] : [0, 1];
    for(const side of [-1, 1]) g.add(box(0.35, 4.4, 0.35, C.timberDark, f.cx + along[0] * 3 * side, 2.2, f.cz + along[1] * 3 * side));
    g.add(f.alongX ? box(6.6, 0.3, 0.3, C.timberDark, f.cx, 4.3, f.cz) : box(0.3, 0.3, 6.6, C.timberDark, f.cx, 4.3, f.cz));
    const name = sign(d.name, 4.6);
    name.position.set(f.cx, 5.3, f.cz);
    name.rotation.y = f.alongX ? 0 : 0.6;
    g.add(name, lamp(f.cx + along[0] * 3.4, f.cz + along[1] * 3.4));
    return g;
}

// The fixed ground, buildings and props of each district, added to `scenery`. Returns the boxes they block.
function districtScenery(scenery, smokeSources) {
    const blocks = [];
    for(const d of DISTRICTS) {
        const a = d.area;
        scenery.add(box(a.maxX - a.minX, 0.06, a.maxZ - a.minZ, d.ground, (a.minX + a.maxX) / 2, 0.03, (a.minZ + a.maxZ) / 2));
    }

    // Calloway farm, seen over the fence: a barn, hay, a trough. The farm itself is a place you step into (src/placeFarm.js).
    {
        const D = districtOffsetById('ranch'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        const barn = new THREE.Group();
        barn.add(box(9, 5, 6, C.brick, 0, 2.5, 0), roof(9, 6, 2.4, C.timberDark, 5), box(2.6, 3.4, 0.2, C.trim, 0, 1.7, 3.05), box(3.4, 0.25, 0.3, C.timber, 0, 3.6, 3.1));
        barn.position.set(-60, 0, -4);
        sc.add(barn);
        block(-60, -4, 4.6, 3.1);
        for(const [x, y, z] of [[-52, 0.5, -7.5], [-50.6, 0.5, -7.7], [-51.3, 1.5, -7.6]]) sc.add(box(1.3, 1, 1.2, 0xc9a54a, x, y, z));
        block(-51.3, -7.6, 1.5, 0.8);
        sc.add(box(2.4, 0.6, 0.8, C.timberDark, -41, 0.3, -6));
        block(-41, -6, 1.3, 0.5);
        for(let x = -71; x <= -37; x += 3) sc.add(box(0.2, 1.4, 0.2, C.timberDark, x, 0.7, -9.7));
        sc.add(box(34, 0.12, 0.12, C.timber, -54, 0.6, -9.7), box(34, 0.12, 0.12, C.timber, -54, 1.2, -9.7));
    }

    // Foundry yard: Jack's furnace, an anvil, slag, crates.
    {
        const D = districtOffsetById('foundry'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        const furnace = new THREE.Group();
        furnace.add(box(3.2, 3.4, 2.8, C.brickDark, 0, 1.7, 0), box(1.1, 6, 1.1, C.brick, 0.8, 6.3, -0.4), box(1.5, 1.1, 0.15, C.glow, 0, 1.0, 1.42, 1.9), box(3.5, 0.3, 3.1, C.stoneDark, 0, 3.55, 0));
        furnace.position.set(16, 0, -30);
        sc.add(furnace);
        block(16, -30, 1.6, 1.4);
        pushSmoke({ id: 'furnace', at: new THREE.Vector3(16.8, 9.6, -30.4) });
        sc.add(box(0.9, 0.5, 1.5, C.iron, 19.6, 0.75, -27.6), box(0.5, 0.5, 0.6, C.iron, 19.6, 0.25, -27.6));
        block(19.6, -27.6, 0.6, 0.9);
        for(const [x, y, z, w] of [[35, 0.6, -24, 3], [36.5, 0.4, -25.5, 2], [33.5, 0.4, -25, 1.8]]) sc.add(box(w, y * 2, w * 0.8, 0x24211f, x, y, z));
        block(35, -24.4, 2.4, 1.8);
        for(const [x, z] of [[22, -24], [23.2, -24.4], [22.6, -24.2]]) sc.add(box(1.2, 1.2, 1.2, C.timberDark, x, 0.6 + (x === 22.6 ? 1.2 : 0), z));
        block(22.6, -24.2, 1.6, 1);
        sc.add(lamp(30, -22), lamp(14, -24));
    }

    // Morgan's channel: water across the district, a footbridge, the warehouse, buckets, the log.
    {
        const D = districtOffsetById('canal'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        sc.add(box(44, 0.04, 4, 0x2f6f7a, 2, 0.06, 30, 0.12));
        pushBlocks({ minX: -20, maxX: 0.4, minZ: 28, maxZ: 32 }, { minX: 3.6, maxX: 24, minZ: 28, maxZ: 32 });
        sc.add(box(3.2, 0.22, 4.8, C.timber, 2, 0.22, 30));
        for(const x of [0.5, 3.5]) {
            sc.add(box(0.12, 0.12, 4.8, C.timberDark, x, 1.05, 30));
            for(const z of [27.9, 30, 32.1]) sc.add(box(0.14, 1, 0.14, C.timberDark, x, 0.6, z));
        }
        const warehouse = new THREE.Group();
        warehouse.add(box(10, 5.2, 7, C.timberDark, 0, 2.6, 0), roof(10, 7, 2, C.slate, 5.2), box(2.6, 3.4, 0.2, C.trim, 0, 1.7, 3.55));
        warehouse.position.set(-10, 0, 38);
        sc.add(warehouse);
        block(-10, 38, 5.2, 3.6);
        for(const [x, z] of [[6, 36], [7.3, 36.8], [6.6, 38]]) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 10), mat(C.timber));
            barrel.position.set(x, 0.7, z);
            sc.add(barrel);
        }
        block(6.6, 37, 1.6, 1.6);
        const log = sign('CHANNEL LOG', 2.8);
        log.position.set(3.8, 2.9, 34.75);
        sc.add(box(0.15, 2.4, 0.15, C.timberDark, 3.8, 1.2, 34.6), log);
        block(3.8, 34.6, 0.3, 0.3);
        sc.add(lamp(0, 25), lamp(4.6, 35.4));
    }

    // Vane's Crossing: a street of weathered false fronts and a clock tower whose clock has stopped.
    {
        const D = districtOffsetById('crossing'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        const falseFront = (x, z, turn) => {
            const g = new THREE.Group();
            g.add(box(7, 4.6, 3, 0x7a6a55, 0, 2.3, 0), box(7.4, 1.6, 0.35, 0x6a5a48, 0, 5.4, 1.4), box(1.3, 2.6, 0.12, C.trim, -1.5, 1.3, 1.54), box(1.3, 1.1, 0.12, C.trim, 1.6, 2.6, 1.54));
            g.position.set(x, 0, z);
            g.rotation.y = turn;
            sc.add(g);
            block(x, z, 3.7, 1.7);
        };
        for(const x of [50, 58, 66]) { falseFront(x, -9, 0); falseFront(x, 7.5, Math.PI); }
        const tower = new THREE.Group();
        const face = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 20), mat(0xe8dcc0));
        face.rotation.x = Math.PI / 2;
        face.position.set(0, 7.2, 1.55);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.4, 4), mat(C.slate));
        cone.rotation.y = Math.PI / 4;
        cone.position.y = 10.4;
        tower.add(box(3, 9, 3, C.stone, 0, 4.5, 0), face, cone,
            box(0.12, 0.85, 0.06, C.trim, 0.25, 7.3, 1.68).rotateZ(-0.6), box(0.12, 0.6, 0.06, C.trim, -0.1, 7.15, 1.68).rotateZ(0.5));
        tower.position.set(75, 0, -1);
        sc.add(tower);
        block(75, -1, 1.5, 1.5);
        sc.add(box(0.2, 1.3, 0.2, C.timberDark, 56, 0.65, -4.2), box(2.2, 0.14, 0.14, C.timberDark, 56, 1.2, -4.2), lamp(48, -1), lamp(62, 3));
    }

    // Tres Rios: an adobe hacienda, a well, and a stone with a struck-out date.
    {
        const D = districtOffsetById('tresrios'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        const hacienda = new THREE.Group();
        hacienda.add(box(12, 4.2, 6, 0xc9a77c, 0, 2.1, 0), box(12.5, 0.45, 6.5, 0x9a5a3a, 0, 4.4, 0), box(1.6, 2.8, 0.12, C.trim, 0, 1.4, 3.05), box(1.3, 1.2, 0.12, C.trim, -3.5, 2.4, 3.05), box(1.3, 1.2, 0.12, C.trim, 3.5, 2.4, 3.05));
        hacienda.position.set(-18, 0, -38);
        sc.add(hacienda);
        block(-18, -38, 6.2, 3.2);
        const stone = new THREE.Group();
        stone.add(box(1, 1.6, 0.3, C.stone, 0, 0.8, 0), box(0.6, 0.12, 0.34, C.stoneDark, 0, 1.2, 0), box(1.4, 0.3, 2.2, 0x8a6a42, 0, 0.15, -1.2));
        stone.position.set(-27, 0, -26);
        sc.add(stone);
        block(-27, -26, 0.6, 0.4);
        const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.9, 12), mat(C.stone));
        well.position.set(-12, 0.45, -30);
        sc.add(well, box(0.2, 2.6, 0.2, C.timberDark, -13, 1.3, -30), box(0.2, 2.6, 0.2, C.timberDark, -11, 1.3, -30), box(2.6, 0.16, 0.5, C.timberDark, -12, 2.6, -30));
        block(-12, -30, 1.1, 1.1);
        sc.add(box(10, 1.4, 0.5, 0xc9a77c, -28, 0.7, -44), box(10, 1.4, 0.5, 0xc9a77c, -10, 0.7, -44), lamp(-20, -22), lamp(-9, -24));
    }

    // The Silver Belle: a riverboat tied up at a pier, a notice post, crates.
    {
        const D = districtOffsetById('belle'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        sc.add(box(38, 0.04, 8, 0x2f6f7a, 45, 0.06, 38, 0.12));
        pushBlocks({ minX: 26, maxX: 64, minZ: 34, maxZ: 42 });
        const boat = new THREE.Group();
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3.6, 12), mat(0x8b0000));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(-7.4, 1.8, 0);
        boat.add(box(14, 1.6, 5, 0xe8e0d0, 0, 1.0, 0), box(14.4, 0.8, 5.2, C.timberDark, 0, 0.3, 0), box(8, 2.4, 3.6, 0xf2ead8, -1, 3.0, 0), box(8.5, 0.3, 4, 0x8b0000, -1, 4.35, 0),
            box(0.9, 3, 0.9, C.iron, 3.2, 4.6, 0), box(0.9, 0.4, 0.9, 0x8b0000, 3.2, 5.9, 0), wheel);
        const hull = sign('SILVER BELLE', 5);
        hull.position.set(-1, 3.0, 1.85);
        boat.add(hull);
        boat.position.set(46, 0, 38);
        sc.add(boat, box(2.6, 0.2, 6, C.timber, 44.5, 0.25, 32.6));
        const notice = sign('SILVER BELLE', 3.4);
        notice.position.set(49, 2.9, 30.75);
        sc.add(box(0.15, 2.4, 0.15, C.timberDark, 49, 1.2, 30.6), notice);
        block(49, 30.6, 0.3, 0.3);
        for(const [x, z] of [[56, 28], [57.3, 28.7]]) sc.add(box(1.3, 1.3, 1.3, C.timberDark, x, 0.65, z));
        block(56.6, 28.4, 1.4, 1.2);
        sc.add(lamp(40, 26), lamp(53, 26));
    }

    // Fort Pell: a palisade, barracks, a flagpole, and the gatling, oiled and pointed at the sky.
    {
        const D = districtOffsetById('fort'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        sc.add(box(43, 3.2, 0.5, C.timber, 58.5, 1.6, -45.2), box(0.5, 3.2, 32, C.timber, 79.4, 1.6, -30));
        for(let x = 38; x <= 79; x += 1.5) sc.add(box(0.5, 0.7, 0.5, C.timberDark, x, 3.5, -45.2));
        const barracks = new THREE.Group();
        barracks.add(box(14, 4, 6, 0x8a6a48, 0, 2, 0), roof(14, 6, 2, C.slate, 4), box(1.6, 2.8, 0.12, C.trim, -3, 1.4, 3.05), box(1.6, 2.8, 0.12, C.trim, 3, 1.4, 3.05));
        barracks.position.set(62, 0, -38);
        sc.add(barracks);
        block(62, -38, 7.2, 3.2);
        sc.add(box(0.25, 11, 0.25, C.iron, 48, 5.5, -24), box(2.4, 1.4, 0.08, 0x2a3f6a, 49.3, 10, -24));
        block(48, -24, 0.4, 0.4);
        const gatling = new THREE.Group();
        gatling.add(box(2.2, 0.8, 1.8, C.iron, 0, 0.9, 0), box(0.5, 0.5, 0.9, C.brass, 0, 1.5, -0.2));
        for(const side of [-1, 1]) {
            const w = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.14, 12), mat(C.timberDark));
            w.rotation.z = Math.PI / 2;
            w.position.set(side * 1.2, 0.85, 0);
            gatling.add(w);
        }
        const barrels = new THREE.Group();
        for(const [bx, by] of [[0, 0], [0.22, 0.14], [-0.22, 0.14], [0, 0.3]]) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8), mat(C.iron));
            barrel.position.set(bx, by, 1.3);
            barrel.rotation.x = Math.PI / 2;
            barrels.add(barrel);
        }
        barrels.position.set(0, 1.6, 0);
        barrels.rotation.x = -0.95;
        gatling.add(barrels);
        gatling.position.set(60, 0, -26);
        sc.add(gatling);
        block(60, -26, 1.2, 1.0);
        sc.add(lamp(50, -20), lamp(70, -23));
    }

    // Copper Bit: a tumbledown saloon street, spilled kegs, a hitching rail, and the broken piano.
    {
        const D = districtOffsetById('copper'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        const tumbledown = (x, z, turn, color) => {
            const g = new THREE.Group();
            g.add(box(8, 4.4, 3.2, color, 0, 2.2, 0), box(8.4, 1.5, 0.35, 0x5e4a38, 0, 5.2, 1.5), box(1.4, 2.6, 0.12, C.trim, -1.8, 1.3, 1.64), box(1.4, 1.2, 0.12, C.glow, 1.8, 2.4, 1.64, 0.5));
            g.position.set(x, 0, z);
            g.rotation.y = turn;
            sc.add(g);
            block(x, z, 4.2, 1.8);
        };
        tumbledown(-56, 41, Math.PI, 0x7a6048);
        tumbledown(-46, 41, Math.PI, 0x6c5540);
        tumbledown(-36, 41, Math.PI, 0x82694e);
        const saloonSign = sign('SALOON', 4);
        saloonSign.position.set(-46, 6.6, 39.1);
        saloonSign.rotation.y = Math.PI;
        sc.add(saloonSign);
        const piano = new THREE.Group();
        piano.add(box(2.8, 1.5, 1.4, C.timberDark, 0, 0.75, 0), box(2.9, 0.15, 0.7, 0xe8dcc0, 0, 1.58, 0.55), box(0.7, 0.1, 0.5, C.timberDark, -0.9, 1.7, 0.5).rotateZ(0.5), box(2.8, 1.1, 0.2, C.timber, 0, 2.05, -0.55));
        piano.position.set(-46, 0, 30);
        sc.add(piano);
        block(-46, 30, 1.4, 0.8);
        for(const [x, z, turn] of [[-52, 34, 0.5], [-51, 35.2, 1.6], [-40, 28, 0.2]]) {
            const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 10), mat(C.timber));
            keg.position.set(x, 0.55, z);
            keg.rotation.z = turn > 1 ? Math.PI / 2 : 0;
            sc.add(keg);
        }
        block(-52, 34.6, 1.1, 1.1);
        block(-40, 28, 0.7, 0.7);
        for(let x = -58; x <= -34; x += 6) sc.add(box(0.2, 1.3, 0.2, C.timberDark, x, 0.65, 25));
        sc.add(box(24, 0.14, 0.14, C.timber, -46, 1.2, 25), lamp(-58, 28), lamp(-34, 28));
    }

    // Whisper Wash: a dry riverbed with a thread of water, canyon walls, the wolves' den.
    {
        const D = districtOffsetById('wash'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        sc.add(box(37, 0.05, 5, 0xb59a72, -53.5, 0.07, -26.5), box(37, 0.04, 0.7, 0x2f6f7a, -53.5, 0.1, -26.5, 0.1));
        pushBlocks({ minX: -72, maxX: -36, minZ: -33.5, maxZ: -30 });
        for(const [x, z, w, h] of [[-66, -31.5, 5, 5], [-58, -32.4, 7, 7], [-48, -31.8, 6, 4.5], [-41, -33, 5, 6.5]]) {
            sc.add(box(w, h, 3.2, 0x8c6a4c, x, h / 2, z), box(w * 0.6, 1.2, 2.4, 0x7a5a40, x + 0.4, h + 0.5, z));
            block(x, z, w / 2, 1.6);
        }
        const den = new THREE.Group();
        den.add(box(3.6, 2.2, 2.4, 0x5a4636, 0, 1.1, 0), box(1.6, 1.4, 0.2, 0x1a1410, 0, 0.7, 1.25), box(4, 0.5, 2.8, 0x8c6a4c, 0, 2.4, 0));
        den.position.set(-58, 0, -24);
        sc.add(den);
        block(-58, -24, 1.8, 1.2);
        for(const [x, z, turn] of [[-54.6, -21.6, 0.4], [-53.4, -22.2, -0.5], [-61.5, -21.4, 0.9]]) {
            const pup = new THREE.Group();
            pup.add(box(0.9, 0.5, 0.4, 0x6a625a, 0, 0.5, 0), box(0.4, 0.4, 0.34, 0x6a625a, 0.55, 0.7, 0), box(0.12, 0.2, 0.1, 0x2b2b2e, 0.62, 1.0, 0.1), box(0.12, 0.2, 0.1, 0x2b2b2e, 0.62, 1.0, -0.1));
            pup.position.set(x, 0, z);
            pup.rotation.y = turn;
            sc.add(pup);
        }
        for(let x = -70; x <= -40; x += 7) sc.add(box(0.5, 2.4, 0.5, 0x4b4036, x, 1.2, -13.4), box(0.9, 0.35, 0.9, 0x6b6258, x, 2.6, -13.4));
        sc.add(lamp(-48, -14), lamp(-64, -14));
    }

    // Hollow Hill: a small chapel rebuilt from burnt beams, its bell, and graves under the hill.
    {
        const D = districtOffsetById('chapel'); // drawn where it was designed, then the whole district is moved out with the town's edge
        const sc = new THREE.Group();
        sc.position.set(D[0], 0, D[1]);
        scenery.add(sc);
        const pushBlocks = (...list) => list.forEach(b => blocks.push({ minX: b.minX + D[0], maxX: b.maxX + D[0], minZ: b.minZ + D[1], maxZ: b.maxZ + D[1] }));
        const block = (x, z, hx, hz) => pushBlocks({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
        const pushSmoke = source => smokeSources.push({ ...source, at: source.at.clone().add(new THREE.Vector3(D[0], 0, D[1])) });
        const chapel = new THREE.Group();
        chapel.add(box(7, 4.4, 5, 0x6a5444, 0, 2.2, 0), roof(7, 5, 2.2, 0x2f3a3f, 4.4), box(1.4, 2.6, 0.12, C.trim, 0, 1.3, 2.55), box(1.0, 1.4, 0.12, C.glow, -2.3, 2.5, 2.55, 1.1), box(1.0, 1.4, 0.12, C.glow, 2.3, 2.5, 2.55, 1.1));
        chapel.add(box(1.8, 4.2, 1.8, 0x5a4636, 0, 8.0, -1.4), box(1.2, 1.0, 1.2, C.brass, 0, 9.6, -1.4), box(2.2, 0.3, 2.2, C.slate, 0, 10.4, -1.4));
        chapel.position.set(3.5, 0, -42);
        sc.add(chapel);
        block(3.5, -42, 3.6, 2.6);
        const bell = new THREE.Group();
        bell.add(box(0.2, 3.2, 0.2, C.timberDark, -0.9, 1.6, 0), box(0.2, 3.2, 0.2, C.timberDark, 0.9, 1.6, 0), box(2.2, 0.2, 0.3, C.timberDark, 0, 3.2, 0), box(0.9, 1.1, 0.9, C.brass, 0, 2.4, 0));
        bell.position.set(3.5, 0, -34);
        sc.add(bell);
        block(3.5, -34, 1.0, 0.5);
        for(const [x, z] of [[-0.6, -26], [1.6, -27], [5.5, -26.4], [7.8, -27.2], [-0.4, -23.4], [8, -23.8]]) {
            sc.add(box(0.8, 1.3, 0.25, C.stone, x, 0.65, z), box(0.5, 0.3, 0.3, C.stoneDark, x, 1.35, z));
            block(x, z, 0.45, 0.2);
        }
        sc.add(box(14, 0.12, 0.12, C.timberDark, 3.5, 1.0, -19.2), box(0.2, 1.4, 0.2, C.timberDark, -2.6, 0.7, -19.2), box(0.2, 1.4, 0.2, C.timberDark, 9.6, 0.7, -19.2), lamp(-1.5, -30), lamp(8.5, -30));
    }
    return blocks;
}

// options.time: false keeps the light at dusk (?time=off, src/townTime.js).
export function createTownScene(options = {}) {
    const timeOn = options.time !== false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.sky);
    scene.fog = new THREE.Fog(C.sky, 85, 150);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 520);
    const view = { target: new THREE.Vector3(3 * SPREAD, 0, -12 * SPREAD), distance: 70 * SPREAD, minDistance: 40, maxDistance: 95 * SPREAD, pitch: 0.72 };

    // Dusk: cool teal sky light, a low amber sun, warm lamps.
    const hemi = new THREE.HemisphereLight(0x8fc3cf, 0x5a3a24, 2.4);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffa860, 2.8);
    sun.position.set(-30, 40, 45);
    scene.add(sun);

    // Sky glow near the horizon.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(700, 80), new THREE.MeshBasicMaterial({ color: 0xc0603a, transparent: true, opacity: 0.35, fog: false }));
    glow.position.set(0, 10, -190);
    scene.add(glow);

    // Everything that never moves and is not tappable goes in `scenery`, merged into a few meshes below.
    const scenery = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mat(C.ground));
    ground.rotation.x = -Math.PI / 2;
    scenery.add(ground);
    // The streets spread with the town: main street, two cross streets, and the south road.
    for(const [w, d, x, z] of [[70 * SPREAD, 9, 0, -4 * SPREAD], [9, 50 * SPREAD, -7 * SPREAD, -4 * SPREAD], [9, 50 * SPREAD, 7.5 * SPREAD, -4 * SPREAD], [70 * SPREAD, 6, 0, 13 * SPREAD]]) {
        const street = box(w, 0.05, d, C.street, x, 0.03, z);
        scenery.add(street);
    }

    // Buildings, tappable: every mesh knows its building id.
    const buildings = new Map();
    const hitMeshes = [];
    const smokeSources = [];
    let extras = {};
    const builtKey = (id, level) => `${level}|${extras[id] || 0}|${litBoost}`;
    function placeBuilding(spot, level = 1) {
        const old = buildings.get(spot.id);
        if(old) {
            scene.remove(old.group);
            old.group.traverse(o => {
                if(!o.isMesh) return;
                hitMeshes.splice(hitMeshes.indexOf(o), 1);
                o.geometry.dispose();
            });
        }
        // Built from dozens of boxes, drawn as one mesh per material (every mesh knows its building id).
        const group = mergeByMaterial(BUILDERS[spot.id](level, extras[spot.id] || 0), { building: spot.id });
        group.position.set(spot.x, 0, spot.z);
        group.rotation.y = spot.rotation || 0;
        group.traverse(o => { if(o.isMesh) hitMeshes.push(o); });
        scene.add(group);
        group.updateMatrixWorld(true);
        const box3 = new THREE.Box3().setFromObject(group);
        buildings.set(spot.id, { group, key: builtKey(spot.id, level), level, box: box3, top: new THREE.Vector3((box3.min.x + box3.max.x) / 2, box3.max.y + 1.2, (box3.min.z + box3.max.z) / 2) });
        const smoke = smokeSources.findIndex(s => s.id === spot.id);
        if(smoke >= 0) smokeSources.splice(smoke, 1);
        if(group.userData.smoke) smokeSources.push({ id: spot.id, at: group.localToWorld(group.userData.smoke.clone()) });
    }
    for(const spot of TOWN_LAYOUT) placeBuilding(spot);

    // Scenery (not tappable): a stable with horses and the undertaker's.
    const stable = new THREE.Group();
    stable.add(box(8, 4.5, 6, C.timber, 0, 2.25, 0), roof(8, 6, 2.2, C.timberDark, 4.5), box(3, 3, 0.2, C.trim, 0, 1.5, 3.05));
    for(let i = 0; i < 5; i++) stable.add(box(0.2, 1.2, 0.2, C.timberDark, -4 + i * 2, 0.6, 5.5), box(2, 0.15, 0.15, C.timberDark, -3 + i * 2, 1, 5.5));
    for(const [x, z, color] of [[-2.5, 7.5, 0x5d4037], [2, 8, 0x3e2723]]) {
        const horse = new THREE.Group();
        horse.add(box(2.4, 1.1, 0.8, color, 0, 1.6, 0), box(0.8, 0.9, 0.5, color, 1.3, 2.3, 0));
        for(const lx of [-0.9, 0.9]) for(const lz of [-0.25, 0.25]) horse.add(box(0.2, 1.1, 0.2, color, lx, 0.55, lz));
        horse.position.set(x, 0, z);
        horse.rotation.y = x < 0 ? 0.4 : -0.3;
        stable.add(horse);
    }
    const stableAt = spread(-32, -14);
    stable.position.set(stableAt[0], 0, stableAt[1]);
    scenery.add(stable);
    const undertaker = new THREE.Group();
    undertaker.add(box(5, 4.5, 5, C.timberDark, 0, 2.25, 0), box(5, 1.4, 0.3, C.trim, 0, 5.1, 2.4), roof(5, 5, 1.6, C.slate, 4.5));
    const undertakerSign = sign('UNDERTAKER', 4.4);
    undertakerSign.position.set(0, 3.6, 2.6);
    undertaker.add(undertakerSign, box(0.7, 2, 0.4, C.timberDark, 3.2, 0.9, 2.6));
    const undertakerAt = spread(-31, 6);
    undertaker.position.set(undertakerAt[0], 0, undertakerAt[1]);
    scenery.add(undertaker);

    // A foundry chimney on the skyline.
    const foundry = new THREE.Group();
    foundry.add(box(12, 7, 8, C.brickDark, 0, 3.5, 0), box(2, 18, 2, C.brick, 4, 9, -1));
    const foundryAt = spread(26, -32);
    foundry.position.set(foundryAt[0], 0, foundryAt[1]);
    scenery.add(foundry);
    smokeSources.push({ id: 'foundry', at: new THREE.Vector3(foundryAt[0] + 4, 18.5, foundryAt[1] - 1) });

    // Props: lamps, barrels, crates, a wagon, telegraph poles.
    const LAMPS = [[-8, 0.8], [8, 0.8], [-8, -9], [8, -9], [22, 1], [-24, 1]].map(([x, z]) => spread(x, z));
    const BARRELS = [[-5, 9], [-4.2, 9.6], [18, 9], [-21, -9]].map(([x, z]) => spread(x, z));
    const CRATES = [[17, 10], [17.8, 11], [-23, 10]].map(([x, z]) => spread(x, z));
    for(const [x, z] of LAMPS) scenery.add(lamp(x, z));
    for(const [x, z] of BARRELS) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 10), mat(C.timber));
        barrel.position.set(x, 0.7, z);
        scenery.add(barrel);
    }
    for(const [x, z] of CRATES) scenery.add(box(1.3, 1.3, 1.3, C.timberDark, x, 0.65, z));
    const wagon = new THREE.Group();
    wagon.add(box(4, 1, 2.2, C.timber, 0, 1.3, 0));
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 4, 12, 1, false, 0, Math.PI), mat(0xd8cbb0));
    cover.rotation.z = Math.PI / 2;
    cover.position.y = 1.8;
    wagon.add(cover);
    for(const [x, z] of [[-1.4, 1.2], [1.4, 1.2], [-1.4, -1.2], [1.4, -1.2]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.15, 12), mat(C.timberDark));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.7, z);
        wagon.add(wheel);
    }
    const wagonAt = spread(-26, -4);
    wagon.position.set(wagonAt[0], 0, wagonAt[1]);
    wagon.rotation.y = 0.3;
    scenery.add(wagon);
    for(const x of [-34, -12, 10].map(x => x * SPREAD)) scenery.add(box(0.3, 9, 0.3, C.timberDark, x, 4.5, -24 * SPREAD), box(2.4, 0.2, 0.2, C.timberDark, x, 8.4, -24 * SPREAD));

    const districtBlocks = districtScenery(scenery, smokeSources);
    // Places you walk up to and use (src/townSpots.js): the bounty board, the jail's cash box, the train out.
    // The wood and iron are scenery; the coins and the notes change, so they are separate small groups.
    const boardAt = getSpot('board').object;
    const boardProp = new THREE.Group();
    boardProp.add(box(0.25, 3.2, 0.25, C.timberDark, -1.35, 1.6, 0), box(0.25, 3.2, 0.25, C.timberDark, 1.35, 1.6, 0),
        box(3.0, 1.9, 0.18, C.timber, 0, 2.35, 0), box(3.4, 0.22, 0.34, C.timberDark, 0, 3.4, 0));
    const boardSign = sign('BOUNTIES', 3);
    boardSign.position.set(0, 4.05, 0.05);
    boardProp.add(boardSign);
    boardProp.position.set(boardAt.x, 0, boardAt.z);
    scenery.add(boardProp);
    const cashAt = getSpot('cashbox').object;
    const cashProp = new THREE.Group();
    cashProp.add(box(2.4, 1.2, 1.6, C.iron, 0, 0.6, 0), box(2.46, 0.18, 1.66, C.brass, 0, 0.8, 0), box(2.4, 0.28, 1.6, C.stoneDark, 0, 1.34, 0),
        box(0.4, 0.4, 0.12, C.brass, 0, 0.8, 0.84));
    const cashSign = sign('CASH', 1.8);
    cashSign.position.set(0, 0.42, 0.83);
    cashProp.add(cashSign);
    cashProp.position.set(cashAt.x, 0, cashAt.z);
    scenery.add(cashProp);
    const trainSign = sign('RIDE OUT', 3.6);
    const platformAt = getSpot('platform').object; // the town train's stop: a post, a sign and a bench
    const platformSign = sign('TOWN TRAIN', 3.6);
    platformSign.position.set(platformAt.x, 4, platformAt.z + 0.1);
    scenery.add(box(0.25, 3.6, 0.25, C.timberDark, platformAt.x, 1.8, platformAt.z), platformSign, box(2.6, 0.2, 0.7, C.timber, platformAt.x - 2.2, 0.8, platformAt.z + 0.3), box(0.2, 0.8, 0.5, C.timberDark, platformAt.x - 3.3, 0.4, platformAt.z + 0.3), box(0.2, 0.8, 0.5, C.timberDark, platformAt.x - 1.1, 0.4, platformAt.z + 0.3));
    const signPost = near('depot', 34.5, -3.4); // beside the locomotive, so it moves with the depot
    trainSign.position.set(signPost[0], 4, signPost[1] + 0.1);
    scenery.add(box(0.25, 3.6, 0.25, C.timberDark, signPost[0], 1.8, signPost[1]), trainSign);
    scene.add(mergeByMaterial(scenery));
    // Gates: a fence while a district is shut, an open gate once its outlaw is beaten (setDistricts).
    // Many small boxes that never move on their own: baked into a mesh per material, like the rest of the town. All the shut
    // gates are one merged set and all the open gates are another (each rebuilt when a district opens); a gate that is rising
    // out of the ground is its own group until it has finished, and then joins the open set.
    const gates = new Map(); // id -> { rise: the group of a gate that is rising, or null }
    let openDistricts = [];
    const sets = { shut: null, open: null };
    const setKeys = { shut: '', open: '' };
    const rising = new Map(); // open gates growing up out of the ground, id -> 0..1
    function rebuildSet(name, make, ids) {
        const key = ids.join(',');
        if(key === setKeys[name] && sets[name]) return;
        setKeys[name] = key;
        if(sets[name]) {
            scene.remove(sets[name]);
            sets[name].traverse(o => { if(o.isMesh) o.geometry.dispose(); });
        }
        const group = new THREE.Group();
        for(const d of DISTRICTS) if(ids.includes(d.id)) group.add(make(d));
        sets[name] = mergeByMaterial(group);
        scene.add(sets[name]);
    }
    function rebuildGates() {
        rebuildSet('shut', shutGate, DISTRICTS.map(d => d.id).filter(id => !openDistricts.includes(id)));
        rebuildSet('open', openGate, openDistricts.filter(id => !rising.has(id)));
    }
    for(const d of DISTRICTS) gates.set(d.id, { rise: null });
    rebuildGates();
    function setDistricts(ids) {
        openDistricts = DISTRICTS.filter(d => ids.includes(d.id)).map(d => d.id);
        rebuildGates();
    }
    // A district's gate rises out of the ground (when the player is told it has opened).
    function celebrate(ids) {
        for(const id of ids) {
            const gate = gates.get(id);
            if(!gate || !openDistricts.includes(id) || rising.has(id)) continue;
            gate.rise = mergeByMaterial(openGate(getDistrict(id)));
            gate.rise.scale.y = 0.01;
            scene.add(gate.rise);
            rising.set(id, 0);
        }
        rebuildGates(); // the rising gates leave the open set while they grow
    }
    // Notes on the board: one for each job left today. Coins in the cash box: what the jail has earned. Each is rebuilt as
    // a few merged meshes when it changes (rarely), so it costs a draw call or two, not one for every note and coin.
    const swap = (holder, build) => {
        if(holder.mesh) {
            scene.remove(holder.mesh);
            holder.mesh.traverse(o => { if(o.isMesh) o.geometry.dispose(); });
        }
        const group = new THREE.Group();
        build(group);
        holder.mesh = group.children.length ? mergeByMaterial(group) : null;
        if(holder.mesh) scene.add(holder.mesh);
    };
    const notesHolder = { mesh: null };
    let notesKey = -1;
    const coinGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.1, 12);
    const coinsHolder = { mesh: null };
    let coinKey = '';
    function setJailCash(stored, capacity) {
        const count = coinCount(stored, capacity);
        const full = cashBoxFull(stored, capacity);
        const key = `${count}|${full}`;
        if(key === coinKey) return;
        coinKey = key;
        swap(coinsHolder, group => {
            for(let i = 0; i < count; i++) {
                const coin = new THREE.Mesh(coinGeometry, mat(0xd9a520, full ? 0.9 : 0.25));
                coin.position.set(cashAt.x - 0.75 + (i % 4) * 0.5, 1.55 + (i > 3 ? 0.1 : 0), cashAt.z + (i % 2 ? 0.25 : -0.25));
                group.add(coin);
            }
            // A full box shows a lamp on top, and its gold glows (bloom picks it up with LOOK on).
            if(full) group.add(box(0.36, 0.36, 0.36, C.glow, cashAt.x, 1.95, cashAt.z, 1.6));
        });
    }
    function setBoardNotes(jobsLeft) {
        const shown = boardNotes(jobsLeft);
        if(shown === notesKey) return;
        notesKey = shown;
        swap(notesHolder, group => {
            for(let i = 0; i < shown; i++) {
                const note = new THREE.Group();
                note.add(box(0.75, 1.0, 0.05, 0xe8d9b0, 0, 0, 0), box(0.55, 0.14, 0.06, 0x7a2a1f, 0, 0.3, 0), box(0.55, 0.08, 0.06, 0x3b2a20, 0, 0.02, 0), box(0.45, 0.08, 0.06, 0x3b2a20, 0, -0.18, 0));
                note.position.set(boardAt.x - 0.95 + i * 0.95, 2.35, boardAt.z + 0.13);
                note.rotation.z = (i - 1) * 0.06;
                group.add(note);
            }
        });
    }
    setJailCash(0, 1);
    setBoardNotes(BOARD_NOTES);
    // What the walkable town (src/townWalk.js) cannot walk through, besides the buildings: the scenery above,
    // as boxes on the ground plane.
    const at = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
    const shiftBox = (b, [dx, dz]) => ({ minX: b.minX + dx, maxX: b.maxX + dx, minZ: b.minZ + dz, maxZ: b.maxZ + dz });
    const walkBoxes = [
        at(stableAt[0], stableAt[1], 4.2, 3.2), at(undertakerAt[0], undertakerAt[1], 2.8, 2.8), at(foundryAt[0], foundryAt[1], 6.2, 4.2), at(wagonAt[0], wagonAt[1], 2.4, 1.7),
        ...BARRELS.map(([x, z]) => at(x, z, 0.7, 0.7)),
        ...CRATES.map(([x, z]) => at(x, z, 0.75, 0.75)),
        ...LAMPS.map(([x, z]) => at(x, z, 0.3, 0.3)),
        // The locomotive on the depot's rails (the depot builder puts it at (-5, 8.7) from the station), the sign post
        // beside it, and the props of src/townSpots.js. They stand with the depot, so they move with it.
        shiftBox({ minX: 25.4, maxX: 32.7, minZ: -7.8, maxZ: -4.8 }, moved('depot')), at(signPost[0], signPost[1], 0.3, 0.3),
        ...SPOTS.filter(spot => spot.object).map(({ object: o }) => at(o.x, o.z, o.hx, o.hz)),
        ...districtBlocks
    ];
    // Two real lamp lights on the main street (each light costs every lit pixel on a phone); the other lamps glow.
    const lampLights = [];
    for(const [x, z] of [[-8, 1.5], [8, -9]].map(([x, z]) => spread(x, z))) {
        const light = new THREE.PointLight(0xffa040, 75, 26, 1.6);
        light.position.set(x, 4.5, z);
        scene.add(light);
        lampLights.push(light);
    }

    // The time of day (src/townTime.js): the light, the sky and the lamps follow a slow ten-minute round that starts
    // at the dusk the town has always had.
    let timeOffset = 0;
    function applyTime(seconds) {
        const k = skyAt(seconds);
        hemi.color.setHex(k.hemiSky);
        hemi.groundColor.setHex(k.hemiGround);
        hemi.intensity = k.hemiI;
        sun.color.setHex(k.sun);
        sun.intensity = k.sunI;
        scene.fog.color.setHex(k.sky);
        if(scene.background?.isColor) scene.background.setHex(k.sky);
        else scene.backgroundIntensity = k.bg; // the painted sky of LOOK
        glow.material.opacity = k.glow;
        for(const [material, base] of glowBase) material.emissiveIntensity = base * k.lamps;
        for(const light of lampLights) light.intensity = 75 * k.lights;
        return k;
    }

    // Smoke puffs rising and fading: one instanced mesh for every puff (a single draw call), reused in a ring.
    // Each puff fades on its own through a per-instance alpha added to the Lambert shader.
    const PUFF_LIFE = 4;
    const PUFF_EVERY = 0.35;
    const MAX_PUFFS = 96;
    const puffGeometry = new THREE.SphereGeometry(1, 8, 6);
    const puffAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PUFFS), 1);
    puffAlpha.setUsage(THREE.DynamicDrawUsage);
    puffGeometry.setAttribute('puffAlpha', puffAlpha);
    const puffMaterial = new THREE.MeshLambertMaterial({ color: C.smoke, transparent: true, depthWrite: false });
    puffMaterial.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute float puffAlpha;\nvarying float vPuffAlpha;\n'
            + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPuffAlpha = puffAlpha;');
        shader.fragmentShader = 'varying float vPuffAlpha;\n'
            + shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.a *= vPuffAlpha;');
    };
    const smoke = new THREE.InstancedMesh(puffGeometry, puffMaterial, MAX_PUFFS);
    smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    smoke.frustumCulled = false; // instances drift away from the mesh's own bounds
    smoke.count = 0;
    const puffs = Array.from({ length: MAX_PUFFS }, () => ({ at: new THREE.Vector3(), age: PUFF_LIFE }));
    let nextPuff = 0;
    const puffMatrix = new THREE.Matrix4();
    scene.add(smoke);
    function puff(at) {
        const p = puffs[nextPuff];
        nextPuff = (nextPuff + 1) % MAX_PUFFS;
        p.at.copy(at);
        p.age = 0;
    }

    // Townsfolk keep routines between their stops (src/townFolk.js); the marshal can stop one to hear a line.
    const folk = FOLK.map((def, i) => {
        const object = mergeByMaterial(townsperson(i)); // six parts, three or four draw calls
        const walker = createWalker(def.route, i * 7.5);
        scene.add(object);
        return { id: def.id, name: def.name, walker, object };
    });

    let viewSize = [window.innerWidth, window.innerHeight];
    function placeCamera() {
        const angle = { yaw: 0.52, pitch: view.pitch };
        // Fog starts just beyond the town, wherever the camera stands.
        scene.fog.near = view.distance + 15;
        scene.fog.far = view.distance + 90;
        camera.position.set(
            view.target.x + Math.sin(angle.yaw) * Math.cos(angle.pitch) * view.distance,
            view.target.y + Math.sin(angle.pitch) * view.distance,
            view.target.z + Math.cos(angle.yaw) * Math.cos(angle.pitch) * view.distance
        );
        camera.lookAt(view.target);
    }
    placeCamera();

    let smokeTimer = 0;
    let elapsed = 0;
    function update(dt) {
        elapsed += dt;
        if(timeOn) applyTime(elapsed + timeOffset);
        for(const [id, progress] of rising) {
            const next = Math.min(1, progress + dt * 1.2);
            const gate = gates.get(id);
            gate.rise.scale.y = 0.01 + 0.99 * (1 - Math.pow(1 - next, 3));
            if(next >= 1) { // it has grown: it joins the open gates, and its own group goes
                rising.delete(id);
                scene.remove(gate.rise);
                gate.rise.traverse(o => { if(o.isMesh) o.geometry.dispose(); });
                gate.rise = null;
                rebuildGates();
            } else rising.set(id, next);
        }
        smokeTimer -= dt;
        if(smokeTimer <= 0) {
            smokeTimer = PUFF_EVERY;
            for(const source of smokeSources) puff(source.at);
        }
        // Live puffs are packed at the front, and only those are drawn (smoke.count).
        let live = 0;
        for(const p of puffs) {
            if(p.age >= PUFF_LIFE) continue;
            p.age += dt;
            if(p.age >= PUFF_LIFE) continue;
            p.at.y += dt * 2.2;
            p.at.x += dt * 0.8;
            const size = 0.8 + p.age * 0.9;
            smoke.setMatrixAt(live, puffMatrix.makeScale(size, size, size).setPosition(p.at));
            puffAlpha.array[live] = Math.max(0, 0.55 - p.age * 0.14); // as the separate puffs used to fade
            live++;
        }
        smoke.count = live;
        smoke.instanceMatrix.needsUpdate = true;
        puffAlpha.needsUpdate = true;
        for(const person of folk) {
            stepWalker(person.walker, dt);
            const w = person.walker;
            person.object.position.set(w.x, w.moving ? Math.abs(Math.sin(elapsed * 8 + w.x * 3)) * 0.12 : 0, w.z);
            person.object.rotation.y = w.heading;
        }
    }

    const raycaster = new THREE.Raycaster();
    const projected = new THREE.Vector3();
    let guests = null; // the beaten outlaws' things, rebuilt when the list changes
    let guestsKey = '';
    return {
        scene,
        camera,
        update,
        // levels: building levels; nextExtras: { gunsmith: guns owned, tailor: looks owned }.
        setLevels(levels, nextExtras = {}) {
            extras = nextExtras;
            // Upgrades beyond the first level brighten the whole town.
            const prosperity = Object.values(levels || {}).reduce((sum, level) => sum + Math.max(0, (level || 1) - 1), 0);
            litBoost = Math.min(0.5, prosperity * 0.06);
            for(const spot of TOWN_LAYOUT) {
                const level = levels?.[spot.id] || 1;
                if(buildings.get(spot.id)?.key !== builtKey(spot.id, level)) placeBuilding(spot, level);
            }
        },
        // ids: the outlaws in the jail (OUTLAWS ids): each adds its own thing to the town.
        setGuests(ids) {
            const key = ids.join(',');
            if(key === guestsKey) return;
            guestsKey = key;
            if(guests) {
                scene.remove(guests);
                guests.traverse(o => { if(o.isMesh) o.geometry.dispose(); });
            }
            guests = guestsGroup(ids);
            scene.add(guests);
        },
        resize(width, height) {
            viewSize = [width, height];
            camera.aspect = width / height;
            // Upright screens see the whole town by standing further back with a wider view.
            const upright = width < height;
            camera.fov = upright ? 50 : 38;
            view.pitch = upright ? 0.95 : 0.72; // look further down, so the tall screen is town rather than sky
            view.maxDistance = (upright ? 150 : 95) * SPREAD;
            view.distance = upright ? Math.max(view.distance, 125 * SPREAD) : Math.min(view.distance, view.maxDistance);
            camera.updateProjectionMatrix();
            placeCamera();
        },
        pan(dx, dz) {
            view.target.x = THREE.MathUtils.clamp(view.target.x + dx, -24 * SPREAD, 28 * SPREAD);
            view.target.z = THREE.MathUtils.clamp(view.target.z + dz, -22 * SPREAD, 12 * SPREAD);
            placeCamera();
        },
        zoom(factor) {
            view.distance = THREE.MathUtils.clamp(view.distance * factor, view.minDistance, view.maxDistance);
            placeCamera();
        },
        get distance() { return view.distance; },
        // Walkable town: plain data for src/townWalkLogic.js. Boxes are on the ground plane; each building's door
        // is on its front (+z) side, centred.
        walkMap() {
            const boxes = [...walkBoxes];
            const doors = [];
            for(const spot of TOWN_LAYOUT) {
                const b = buildings.get(spot.id)?.box;
                if(!b) continue;
                if(spot.id === 'depot') {
                    // Only the station house blocks the way; the railway yard in front of it is open ground.
                    boxes.push(at(spot.x, spot.z, 3.2, 2.7));
                    doors.push({ id: spot.id, label: spot.label, verb: 'ENTER', x: spot.x - 2, z: spot.z + 6.4 });
                    continue;
                }
                boxes.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
                doors.push({ id: spot.id, label: spot.label, verb: 'ENTER', x: (b.min.x + b.max.x) / 2, z: b.max.z + 1.3 });
            }
            for(const spot of SPOTS) doors.push({ id: spot.id, label: spot.id.toUpperCase(), verb: spot.verb, x: spot.stand[0], z: spot.stand[1] });
            // Open districts add ground and their places; a shut one adds a gate to read.
            for(const place of districtPlaces(openDistricts)) doors.push({ id: place.id, label: place.id.toUpperCase(), verb: place.verb, x: place.stand[0], z: place.stand[1], district: place.district });
            for(const d of DISTRICTS) {
                if(!openDistricts.includes(d.id)) doors.push({ id: `gate-${d.id}`, label: 'LOCKED', verb: 'READ', x: d.fence.read[0], z: d.fence.read[1], district: d.id });
                else if(d.interior) doors.push({ id: `enter-${d.id}`, label: d.name, verb: 'ENTER', x: d.fence.read[0], z: d.fence.read[1], district: d.id }); // a place of its own
            }
            return { areas: walkAreas(openDistricts), boxes, doors };
        },
        // Third-person view that follows a point (the walking marshal); overview() goes back to the whole town.
        follow(x, z) {
            const upright = viewSize[0] < viewSize[1];
            // High enough to see over the roofs in front, so a building never hides the marshal.
            view.pitch = upright ? 1.1 : 0.98;
            view.distance = upright ? 46 : 34;
            view.target.set(x, 1.2, z);
            placeCamera();
        },
        overview() {
            view.target.set(3 * SPREAD, 0, -12 * SPREAD);
            this.resize(...viewSize);
        },
        // Building id under a screen point (normalized device coordinates), or null.
        pick(ndcX, ndcY) {
            raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
            return raycaster.intersectObjects(hitMeshes, false)[0]?.object.userData.building ?? null;
        },
        // What the jail has earned (the coins in the cash box) and the jobs left today (notes on the board).
        setJailCash,
        setBoardNotes,
        // Step B: which districts are open (the ids from src/townDistricts.js).
        setDistricts,
        celebrate,
        // The light at a moment of the town's day, in seconds (tests, and ?time=off still allows an explicit one).
        setTimeOfDay(seconds) {
            timeOffset = seconds - elapsed;
            return applyTime(seconds).name;
        },
        get timeOfDay() { return skyAt(elapsed + timeOffset).name; },
        get openDistricts() { return [...openDistricts]; },
        // Step C: the townsfolk. talkTo(id, x, z) makes one stand still and face a point; talkTo(null) lets everyone go on.
        folk,
        talkTo(id, x, z) {
            for(const person of folk) {
                const talking = person.id === id;
                person.walker.talking = talking;
                if(talking) person.walker.heading = Math.atan2(x - person.walker.x, z - person.walker.z);
            }
        },
        // A world point as a screen position (0..1) for the speech bubble.
        project(x, y, z) {
            projected.set(x, y, z).project(camera);
            return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, visible: projected.z < 1 };
        },
        // Screen positions (0..1) above each building, for the name labels.
        labelPositions() {
            const out = {};
            for(const [id, b] of buildings) {
                projected.copy(b.top).project(camera);
                out[id] = { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, visible: projected.z < 1 };
            }
            return out;
        }
    };
}
