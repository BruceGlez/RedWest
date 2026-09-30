import * as THREE from 'three';
import { mergeByMaterial } from './meshMerge.js';

// Frontier Town as a small 3D diorama at dusk (look "A" in art/town/dusk-gang-town.jpg): gaslit brick and
// timber, chimney smoke, fog, a steam train at the depot, townsfolk in flat caps and long coats.
// Everything is built from simple shapes in code, like the rest of the game, so it costs no download.
// Buildings grow with their level. The town shares the game's renderer: while it is open the home-screen
// loop draws this scene instead (src/gameLoop.js, setLobbyView).

const C = {
    ground: 0x6a5440, street: 0x8f7355, brick: 0x7b3b2a, brickDark: 0x5c2b1f, timber: 0x5a3d2b, timberDark: 0x3b2a20,
    stone: 0x6b6258, stoneDark: 0x4d463f, slate: 0x2f3a3f, trim: 0x2a1d15, glow: 0xffb347, iron: 0x2b2b2e, brass: 0xc8a050,
    coat: 0x2a2521, cap: 0x3a342c, skin: 0xd9a27a, smoke: 0x6e6a66, sky: 0x1d3640, green: 0x3f4f3a
};

const mat = (() => {
    const cache = new Map();
    return (color, emissive = 0) => {
        const key = `${color}:${emissive}`;
        if(!cache.has(key)) {
            cache.set(key, new THREE.MeshLambertMaterial({ color, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive }));
        }
        return cache.get(key);
    };
})();

function box(w, h, d, color, x = 0, y = 0, z = 0, emissive = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive));
    mesh.position.set(x, y, z);
    return mesh;
}

// A pitched roof along x over a w by d footprint.
function roof(w, d, h, color, y) {
    const shape = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.4, 0), new THREE.Vector2(d / 2 + 0.4, 0), new THREE.Vector2(0, h)]);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: w + 0.6, bevelEnabled: false });
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-(w + 0.6) / 2, 0, 0);
    const mesh = new THREE.Mesh(geometry, mat(color));
    mesh.position.y = y;
    return mesh;
}

// A painted sign board with Rye lettering.
function sign(text, width = 5, color = '#2a1d15', ink = '#f0d9a8') {
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
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture }));
    return mesh;
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
export const TOWN_LAYOUT = [
    { id: 'saloon', x: -15, z: -14, label: 'SALOON' },
    { id: 'sheriff', x: 0, z: -13, label: "SHERIFF'S OFFICE" },
    { id: 'bank', x: 14, z: -13, label: 'BANK' },
    { id: 'jail', x: -16, z: 5, label: 'JAIL' },
    { id: 'gunsmith', x: 1, z: 5, label: 'GUNSMITH' },
    { id: 'tailor', x: 12, z: 5, label: 'TAILOR' },
    { id: 'depot', x: 33, z: -15, label: 'MOST WANTED' }
];

function lamp(x, z) {
    const g = new THREE.Group();
    g.add(box(0.2, 4.2, 0.2, C.iron, 0, 2.1, 0), box(0.7, 0.8, 0.7, C.glow, 0, 4.5, 0, 1.4), box(0.9, 0.15, 0.9, C.iron, 0, 4.95, 0));
    g.position.set(x, 0, z);
    return g;
}

function townsperson(seed) {
    const g = new THREE.Group();
    g.add(box(0.9, 1.6, 0.6, C.coat, 0, 1.3, 0), box(0.8, 0.8, 0.55, 0x2b2b2e, 0, 0.4, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), mat(C.skin));
    head.position.y = 2.45;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.22, 10), mat(seed % 3 ? C.cap : 0x4a3b2a));
    cap.position.set(0, 2.72, 0.04);
    g.add(head, cap, box(0.6, 0.06, 0.35, seed % 3 ? C.cap : 0x4a3b2a, 0, 2.63, 0.38));
    g.scale.setScalar(1.15);
    return g;
}

// The beaten outlaws make themselves at home (STORY_BIBLE.md section 6): each one adds something to Lantern Rock once
// they are in the jail. Small, merged into a few meshes, and placed in the open ground between the buildings.
// Each entry: where it stands ([x, z]) and how to build it (parts around its own origin).
export const GUESTS = {
    'dusty-pete': { at: [-13.5, -7.5], turn: 0.3, parts: () => [ // the Tin Cup's piano, dragged into the street
        box(3, 1.4, 1.3, 0x2f1d14, 0, 1.3, 0), box(3, 0.12, 0.6, 0xf2ead8, 0, 2.05, 0.8), box(2.8, 0.1, 1.2, 0x241510, 0, 2.6, -0.4),
        box(0.2, 0.9, 0.2, 0x241510, -1.3, 0.45, 0.4), box(0.2, 0.9, 0.2, 0x241510, 1.3, 0.45, 0.4), box(1.4, 0.7, 0.8, 0x5a3d2b, 0, 0.35, 1.6)
    ] },
    'rattlesnake-rosa': { at: [-14, 8.5], turn: 0, parts: () => [ // two wolf pups on the jail porch
        box(0.9, 0.5, 0.5, 0x8a8f99, 0, 0.4, 0), box(0.4, 0.4, 0.4, 0x8a8f99, 0.6, 0.65, 0), box(0.15, 0.2, 0.1, 0x6f747d, 0.6, 0.95, -0.1),
        box(0.9, 0.5, 0.5, 0x7a7f88, 1.6, 0.4, 0.9), box(0.4, 0.4, 0.4, 0x7a7f88, 2.2, 0.65, 0.9), box(0.15, 0.2, 0.1, 0x5f646c, 2.2, 0.95, 0.8)
    ] },
    'deacon-graves': { at: [-33, -8], turn: 0.2, parts: () => [ // a small chapel at the edge of town
        box(5, 3.2, 4, 0xe8e0cf, 0, 1.6, 0), box(5.4, 0.4, 4.4, 0x3b2a20, 0, 3.4, 0), box(1.4, 4.4, 1.4, 0xe8e0cf, -1.8, 2.2, 2.2), box(0.25, 1.4, 0.25, 0x2a1d15, -1.8, 5.2, 2.2),
        box(0.9, 0.25, 0.25, 0x2a1d15, -1.8, 5.4, 2.2), box(1, 1.7, 0.2, 0x2a1d15, 0, 0.85, 2.05)
    ] },
    'calloway-gang': { at: [9, -7.5], turn: 0, parts: () => { // the brothers' fence, rebuilt outside the bank
        const out = [box(9, 0.2, 0.15, 0x6b4a2e, 2.25, 1.6, 0), box(9, 0.2, 0.15, 0x6b4a2e, 2.25, 0.9, 0)];
        for(let i = 0; i < 4; i++) out.push(box(0.25, 1.9, 0.25, 0x6b4a2e, i * 3, 0.95, 0));
        return out;
    } },
    'iron-jack': { at: [4.2, 8.6], turn: 0, parts: () => [ // an anvil, and the armour Ezra cut him out of, on a stand
        box(1.6, 0.6, 0.8, 0x2b2b2e, 0, 0.9, 0), box(0.8, 0.9, 0.6, 0x3a3a3e, 0, 0.45, 0), box(2.2, 0.15, 1.2, 0x3a3a3e, 0, 0.1, 0),
        box(1.3, 1.6, 0.8, 0x7d858c, 2.8, 1.8, 0), box(0.6, 0.5, 0.6, 0x7d858c, 2.8, 2.9, 0), box(0.25, 2.2, 0.25, 0x5a3d2b, 2.8, 1.1, 0)
    ] },
    'mesa-morgan': { at: [3.4, -8], turn: 0.4, parts: () => [ // the volunteer fire crew's water cart
        box(2.6, 0.8, 1.4, 0xa23a2c, 0, 1.2, 0), box(1.6, 1.1, 1.1, 0x5a3d2b, 0, 2.15, 0), box(0.2, 1.2, 0.2, 0x2b2b2e, 1.6, 1.2, 0),
        box(0.8, 0.8, 0.15, 0x2b2b2e, -1, 0.6, 0.8), box(0.8, 0.8, 0.15, 0x2b2b2e, -1, 0.6, -0.8), box(0.8, 0.8, 0.15, 0x2b2b2e, 1, 0.6, 0.8), box(0.8, 0.8, 0.15, 0x2b2b2e, 1, 0.6, -0.8)
    ] },
    'silas-vane': { at: [13.5, 8.5], turn: 0, parts: () => [ // a shooting gallery: a board of targets
        box(4, 2.4, 0.2, 0x5a3d2b, 0, 2, 0), box(0.25, 2, 0.25, 0x3b2a20, -1.8, 1, 0.3), box(0.25, 2, 0.25, 0x3b2a20, 1.8, 1, 0.3),
        box(0.8, 0.8, 0.1, 0xf2ead8, -1.1, 2.2, 0.15), box(0.4, 0.4, 0.12, 0xb02a2a, -1.1, 2.2, 0.2), box(0.8, 0.8, 0.1, 0xf2ead8, 0, 2.5, 0.15),
        box(0.4, 0.4, 0.12, 0xb02a2a, 0, 2.5, 0.2), box(0.8, 0.8, 0.1, 0xf2ead8, 1.1, 2.2, 0.15), box(0.4, 0.4, 0.12, 0xb02a2a, 1.1, 2.2, 0.2)
    ] },
    'el-espectro': { at: [-18.8, 8.4], turn: 0.3, parts: () => [ // the chair on the jail's front porch
        box(1.1, 0.2, 1.1, 0xe8e0cf, 0, 0.9, 0), box(1.1, 1.3, 0.2, 0xe8e0cf, 0, 1.6, -0.45), box(0.15, 0.9, 0.15, 0xe8e0cf, -0.45, 0.45, 0.45),
        box(0.15, 0.9, 0.15, 0xe8e0cf, 0.45, 0.45, 0.45), box(0.15, 0.9, 0.15, 0xe8e0cf, -0.45, 0.45, -0.45), box(0.15, 0.9, 0.15, 0xe8e0cf, 0.45, 0.45, -0.45),
        box(0.8, 0.12, 0.6, 0x6a1b9a, 0, 1.05, 0.05)
    ] },
    'lucky-lou': { at: [-18.5, -8], turn: 0, parts: () => [ // her card table under a lantern
        box(2.4, 0.15, 1.6, 0x2f6b3a, 0, 1.6, 0), box(0.25, 1.5, 0.25, 0x3b2a20, 0, 0.75, 0), box(1.4, 0.15, 0.9, 0x3b2a20, 0, 0.1, 0),
        box(0.5, 0.6, 0.5, 0x3b2a20, -1.7, 0.4, 0), box(0.5, 0.6, 0.5, 0x3b2a20, 1.7, 0.4, 0), box(0.4, 0.05, 0.3, 0xf2ead8, -0.4, 1.7, 0.1, 0), box(0.4, 0.05, 0.3, 0xf2ead8, 0.4, 1.7, -0.1, 0),
        box(0.3, 0.4, 0.3, C.glow, 0, 2.05, 0, 0.9)
    ] },
    'colonel-crane': { at: [29.5, -7.5], turn: 0, parts: () => [ // a flagpole by the depot
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

export function createTownScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.sky);
    scene.fog = new THREE.Fog(C.sky, 85, 150);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 300);
    const view = { target: new THREE.Vector3(3, 0, -12), distance: 70, minDistance: 36, maxDistance: 95, pitch: 0.72 };

    // Dusk: cool teal sky light, a low amber sun, warm lamps.
    scene.add(new THREE.HemisphereLight(0x8fc3cf, 0x5a3a24, 2.4));
    const sun = new THREE.DirectionalLight(0xffa860, 2.8);
    sun.position.set(-30, 40, 45);
    scene.add(sun);

    // Sky glow near the horizon.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(400, 60), new THREE.MeshBasicMaterial({ color: 0xc0603a, transparent: true, opacity: 0.35, fog: false }));
    glow.position.set(0, 10, -110);
    scene.add(glow);

    // Everything that never moves and is not tappable goes in `scenery`, merged into a few meshes below.
    const scenery = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(C.ground));
    ground.rotation.x = -Math.PI / 2;
    scenery.add(ground);
    for(const [w, d, x, z] of [[70, 9, 0, -4], [9, 50, -7, -4], [9, 50, 7.5, -4], [70, 6, 0, 13]]) {
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
        buildings.set(spot.id, { group, key: builtKey(spot.id, level), level, top: new THREE.Vector3((box3.min.x + box3.max.x) / 2, box3.max.y + 1.2, (box3.min.z + box3.max.z) / 2) });
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
    stable.position.set(-32, 0, -14);
    scenery.add(stable);
    const undertaker = new THREE.Group();
    undertaker.add(box(5, 4.5, 5, C.timberDark, 0, 2.25, 0), box(5, 1.4, 0.3, C.trim, 0, 5.1, 2.4), roof(5, 5, 1.6, C.slate, 4.5));
    const undertakerSign = sign('UNDERTAKER', 4.4);
    undertakerSign.position.set(0, 3.6, 2.6);
    undertaker.add(undertakerSign, box(0.7, 2, 0.4, C.timberDark, 3.2, 0.9, 2.6));
    undertaker.position.set(-31, 0, 6);
    scenery.add(undertaker);

    // A foundry chimney on the skyline.
    const foundry = new THREE.Group();
    foundry.add(box(12, 7, 8, C.brickDark, 0, 3.5, 0), box(2, 18, 2, C.brick, 4, 9, -1));
    foundry.position.set(26, 0, -32);
    scenery.add(foundry);
    smokeSources.push({ id: 'foundry', at: new THREE.Vector3(30, 18.5, -33) });

    // Props: lamps, barrels, crates, a wagon, telegraph poles.
    for(const [x, z] of [[-8, 0.8], [8, 0.8], [-8, -9], [8, -9], [22, 1], [-24, 1]]) scenery.add(lamp(x, z));
    for(const [x, z] of [[-5, 9], [-4.2, 9.6], [18, 9], [-21, -9]]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 10), mat(C.timber));
        barrel.position.set(x, 0.7, z);
        scenery.add(barrel);
    }
    for(const [x, z] of [[17, 10], [17.8, 11], [-23, 10]]) scenery.add(box(1.3, 1.3, 1.3, C.timberDark, x, 0.65, z));
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
    wagon.position.set(-26, 0, -4);
    wagon.rotation.y = 0.3;
    scenery.add(wagon);
    for(const x of [-34, -12, 10]) scenery.add(box(0.3, 9, 0.3, C.timberDark, x, 4.5, -24), box(2.4, 0.2, 0.2, C.timberDark, x, 8.4, -24));

    scene.add(mergeByMaterial(scenery));
    // Two real lamp lights on the main street (each light costs every lit pixel on a phone); the other lamps glow.
    for(const [x, z] of [[-8, 1.5], [8, -9]]) {
        const light = new THREE.PointLight(0xffa040, 75, 26, 1.6);
        light.position.set(x, 4.5, z);
        scene.add(light);
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

    // Townsfolk walking up and down the streets.
    const walkers = [];
    const paths = [[-26, -4, 26, -4], [26, -3, -26, -3], [-7, 12, -7, -20], [7.5, -20, 7.5, 12], [-20, 13, 20, 13], [20, 14, -20, 14]];
    paths.forEach((path, i) => {
        const person = mergeByMaterial(townsperson(i)); // six parts, three or four draw calls
        person.userData = { path, t: (i * 0.37) % 1, speed: 0.025 + (i % 3) * 0.006 };
        scene.add(person);
        walkers.push(person);
    });

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
        for(const person of walkers) {
            const u = person.userData;
            u.t = (u.t + dt * u.speed) % 1;
            const [x1, z1, x2, z2] = u.path;
            person.position.set(x1 + (x2 - x1) * u.t, Math.abs(Math.sin(elapsed * 8 + u.t * 40)) * 0.12, z1 + (z2 - z1) * u.t);
            person.rotation.y = Math.atan2(x2 - x1, z2 - z1);
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
            camera.aspect = width / height;
            // Upright screens see the whole town by standing further back with a wider view.
            const upright = width < height;
            camera.fov = upright ? 50 : 38;
            view.pitch = upright ? 0.95 : 0.72; // look further down, so the tall screen is town rather than sky
            view.maxDistance = upright ? 150 : 95;
            view.distance = upright ? Math.max(view.distance, 125) : Math.min(view.distance, view.maxDistance);
            camera.updateProjectionMatrix();
            placeCamera();
        },
        pan(dx, dz) {
            view.target.x = THREE.MathUtils.clamp(view.target.x + dx, -24, 28);
            view.target.z = THREE.MathUtils.clamp(view.target.z + dz, -22, 12);
            placeCamera();
        },
        zoom(factor) {
            view.distance = THREE.MathUtils.clamp(view.distance * factor, view.minDistance, view.maxDistance);
            placeCamera();
        },
        get distance() { return view.distance; },
        // Building id under a screen point (normalized device coordinates), or null.
        pick(ndcX, ndcY) {
            raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
            return raycaster.intersectObjects(hitMeshes, false)[0]?.object.userData.building ?? null;
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
