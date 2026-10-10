// 3D Scene Builder for Outlaw 1 (Dusty Pete) Open-World Canyon Map (Copper Bit Gulch).
// Constructs canyon props and landmarks:
// - Campfire sites with stone rings, logs, and animated flame/glow for checkpoint saving
// - Supply crates with interactive opening lids
// - 3 Investigation clue props (shipping manifest, rail ledger, brass stronghold key)
// - Mine canyon arches and rail spur segments
// - Stronghold barricade gate that opens when all clues are discovered

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
    WORLD_CAMPFIRES,
    WORLD_CRATES,
    INVESTIGATION_CLUES,
    STRONGHOLD_GATE_Z
} from './peteWorldMap.js';

const COLORS = {
    wood: 0x6e4a2c,
    woodDark: 0x48301c,
    stone: 0x75716b,
    ash: 0x24201c,
    iron: 0x36383d,
    goldKey: 0xe0b438,
    paper: 0xf4eedb,
    ledgerCover: 0x822e1b,
    flameBase: 0xf56218,
    flameTip: 0xffcc33,
    emberGlow: 0xff5500,
    smoke: 0xecd9c6,
    cliffDark: 0x88351c,
    cliffBase: 0xa84c2a,
    cliffLight: 0xc46236,
    cliffRim: 0xd97846,
    cactusGreen: 0x3e8646,
    cactusHighlight: 0x549e5c,
    flowerRed: 0xe63946,
    flowerYellow: 0xffcc00,
    scrubTan: 0xc8a256,
    lanternBrass: 0xd4a03e,
    lanternGlow: 0xffaa22
};

function paint(geometry, hex) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    const color = new THREE.Color(hex);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for(let i = 0; i < count; i++) color.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
}

function box(w, h, d, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if(rx || ry || rz) {
        g.rotateX(rx);
        g.rotateY(ry);
        g.rotateZ(rz);
    }
    g.translate(x, y, z);
    return paint(g, hex);
}

function cylinder(rt, rb, h, segs, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, segs);
    if(rx || ry || rz) {
        g.rotateX(rx);
        g.rotateY(ry);
        g.rotateZ(rz);
    }
    g.translate(x, y, z);
    return paint(g, hex);
}

function dodecahedron(radius, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.DodecahedronGeometry(radius, 0);
    if(rx || ry || rz) {
        g.rotateX(rx);
        g.rotateY(ry);
        g.rotateZ(rz);
    }
    g.translate(x, y, z);
    return paint(g, hex);
}

function sharedVertexMaterial() {
    return new THREE.MeshLambertMaterial({
        vertexColors: true,
        reflectivity: 0.1
    });
}

function glowMaterial(hex = COLORS.emberGlow) {
    return new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
}

// Builds one campfire site (stone circle + logs + flame + glow halo + animated cartoon smoke puffs)
function createCampfireMesh(id, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.name = `campfire-${id}`;

    // Static base: 8 perimeter stones and central ash pit
    const stoneParts = [];
    const stoneCount = 8;
    for(let i = 0; i < stoneCount; i++) {
        const angle = (i / stoneCount) * Math.PI * 2;
        const sx = Math.cos(angle) * 1.1;
        const sz = Math.sin(angle) * 1.1;
        stoneParts.push(cylinder(0.22, 0.28, 0.25, 5, COLORS.stone, sx, 0.12, sz));
    }
    // Ash pit disk
    stoneParts.push(cylinder(0.9, 0.9, 0.05, 8, COLORS.ash, 0, 0.03, 0));
    // Crossed logs
    stoneParts.push(box(0.2, 0.2, 1.4, COLORS.woodDark, 0, 0.12, 0, 0, Math.PI * 0.25, 0));
    stoneParts.push(box(0.2, 0.2, 1.4, COLORS.woodDark, 0, 0.14, 0, 0, -Math.PI * 0.25, 0));

    const mergedBase = mergeGeometries(stoneParts, false);
    const baseMesh = new THREE.Mesh(mergedBase, sharedVertexMaterial());
    group.add(baseMesh);

    // Dynamic fire flame
    const flameParts = [
        paint(new THREE.ConeGeometry(0.35, 0.9, 5).translate(0, 0.45, 0), COLORS.flameBase),
        paint(new THREE.ConeGeometry(0.2, 0.6, 5).translate(0, 0.65, 0), COLORS.flameTip)
    ];
    const flameGeom = mergeGeometries(flameParts, false);
    const flameMesh = new THREE.Mesh(flameGeom, sharedVertexMaterial());
    flameMesh.position.set(0, 0.1, 0);
    flameMesh.visible = false;
    group.add(flameMesh);

    // Dynamic ember glow disc
    const glowGeom = new THREE.PlaneGeometry(3.2, 3.2);
    glowGeom.rotateX(-Math.PI / 2);
    const glowMesh = new THREE.Mesh(glowGeom, glowMaterial(COLORS.emberGlow));
    glowMesh.position.set(0, 0.05, 0);
    glowMesh.visible = false;
    group.add(glowMesh);

    // Dynamic cartoon smoke puffs (Mini Ninjas style: puffy rising cloud spheres)
    const smokePuffs = [];
    const smokeCount = 5;
    for(let i = 0; i < smokeCount; i++) {
        const puffGeom = new THREE.DodecahedronGeometry(0.32, 0);
        const puffMat = new THREE.MeshBasicMaterial({
            color: COLORS.smoke,
            transparent: true,
            opacity: 0.35,
            depthWrite: false
        });
        const puffMesh = new THREE.Mesh(puffGeom, puffMat);
        puffMesh.visible = false;
        group.add(puffMesh);
        smokePuffs.push({
            mesh: puffMesh,
            speed: 0.75 + (i * 0.12),
            offset: (i / smokeCount) * 3.0,
            driftX: ((i % 2 === 0 ? 1 : -1) * (0.12 + i * 0.06))
        });
    }

    return {
        id,
        group,
        flameMesh,
        glowMesh,
        smokePuffs,
        active: false,
        setActive(isActive) {
            this.active = !!isActive;
            this.flameMesh.visible = this.active;
            this.glowMesh.visible = this.active;
            if(!this.active) {
                for(const sp of this.smokePuffs) sp.mesh.visible = false;
            }
        },
        update(time) {
            if(!this.active) return;
            const flicker = 0.85 + 0.25 * Math.sin(time * 9 + x * 2);
            this.flameMesh.scale.set(flicker, flicker * 1.1, flicker);
            this.glowMesh.material.opacity = 0.35 + 0.15 * Math.sin(time * 6 + z);

            // Animate cartoon smoke puffs
            for(let i = 0; i < this.smokePuffs.length; i++) {
                const sp = this.smokePuffs[i];
                sp.mesh.visible = true;
                const cycle = ((time * sp.speed + sp.offset) % 3.0) / 3.0; // 0 to 1
                const y = 0.6 + cycle * 3.6;
                const spread = Math.sin(cycle * Math.PI) * 0.5;
                const windDrift = cycle * 0.7; // drifts downwind
                sp.mesh.position.set(sp.driftX * spread + windDrift, y, Math.cos(time * 2 + i) * 0.12);
                const scale = 0.4 + cycle * 1.5;
                sp.mesh.scale.set(scale, scale * 0.85, scale);
                sp.mesh.material.opacity = Math.sin(cycle * Math.PI) * 0.36;
            }
        }
    };
}

// Builds one loot crate (wooden chest with hinged lid + dynamic splinter burst & loot pop)
function createCrateMesh(id, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.name = `crate-${id}`;

    // Crate base body
    const bodyParts = [
        box(1.6, 1.1, 1.4, COLORS.wood, 0, 0.55, 0),
        // Iron bands
        box(1.65, 0.15, 1.45, COLORS.iron, 0, 0.25, 0),
        box(1.65, 0.15, 1.45, COLORS.iron, 0, 0.85, 0)
    ];
    const baseMesh = new THREE.Mesh(mergeGeometries(bodyParts, false), sharedVertexMaterial());
    group.add(baseMesh);

    // Crate lid (hinged at back: z = -0.7)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 1.1, -0.7);
    const lidGeom = box(1.7, 0.15, 1.5, COLORS.woodDark, 0, 0.075, 0.75);
    const lidMesh = new THREE.Mesh(lidGeom, sharedVertexMaterial());
    lidGroup.add(lidMesh);
    group.add(lidGroup);

    // Dynamic Splinter Shards Group (Mini Ninjas tactile splinters)
    const splintersGroup = new THREE.Group();
    splintersGroup.position.set(0, 0.6, 0);
    group.add(splintersGroup);

    const splinterShards = [];
    const splinterCount = 8;
    for(let i = 0; i < splinterCount; i++) {
        const isIron = (i >= 6);
        const geom = isIron 
            ? box(0.12, 0.35, 0.08, COLORS.iron)
            : box(0.2, 0.45, 0.1, (i % 2 === 0 ? COLORS.wood : COLORS.woodDark));
        const mesh = new THREE.Mesh(geom, sharedVertexMaterial());
        mesh.visible = false;
        splintersGroup.add(mesh);
        splinterShards.push({
            mesh,
            pos: new THREE.Vector3(0, 0, 0),
            vel: new THREE.Vector3(0, 0, 0),
            rotVel: new THREE.Vector3(0, 0, 0),
            active: false
        });
    }

    // Cartoon Dust Puffs Group
    const dustPuffs = [];
    const dustCount = 4;
    for(let i = 0; i < dustCount; i++) {
        const puffGeom = new THREE.DodecahedronGeometry(0.35, 0);
        const puffMat = new THREE.MeshBasicMaterial({
            color: COLORS.smoke,
            transparent: true,
            opacity: 0.45,
            depthWrite: false
        });
        const puffMesh = new THREE.Mesh(puffGeom, puffMat);
        puffMesh.visible = false;
        group.add(puffMesh);
        dustPuffs.push({
            mesh: puffMesh,
            pos: new THREE.Vector3(0, 0, 0),
            vel: new THREE.Vector3(0, 0, 0),
            age: 0
        });
    }

    // Pop-up Loot Reward Icon (spinning brass bullet / golden coin)
    const lootIconGroup = new THREE.Group();
    lootIconGroup.position.set(0, 0.6, 0);
    lootIconGroup.visible = false;
    const coinGeom = cylinder(0.26, 0.26, 0.08, 8, COLORS.goldKey, 0, 0, 0, Math.PI / 2, 0, 0);
    const bulletGeom = cylinder(0.1, 0.1, 0.32, 6, COLORS.lanternBrass, 0, 0.2, 0);
    const lootMesh = new THREE.Mesh(mergeGeometries([coinGeom, bulletGeom], false), sharedVertexMaterial());
    lootIconGroup.add(lootMesh);

    const haloGeom = new THREE.PlaneGeometry(1.6, 1.6);
    const haloMesh = new THREE.Mesh(haloGeom, glowMaterial(COLORS.goldKey));
    lootIconGroup.add(haloMesh);
    group.add(lootIconGroup);

    let lastTime = 0;

    return {
        id,
        group,
        lidGroup,
        splinterShards,
        dustPuffs,
        lootIconGroup,
        opened: false,
        shattered: false,
        shatterAge: 0,

        setOpened(isOpened) {
            const willOpen = !!isOpened;
            if(willOpen && !this.opened) {
                this.opened = true;
                this.lidGroup.rotation.x = -Math.PI * 0.45;
                this.triggerSplinterBurst();
            } else if(!willOpen && this.opened) {
                this.opened = false;
                this.lidGroup.rotation.x = 0;
            }
        },

        triggerSplinterBurst() {
            this.shattered = true;
            this.shatterAge = 0;
            if(typeof window !== 'undefined') {
                import('./audio.js').then(m => {
                    m.playSound?.('break');
                    m.playSound?.('coin');
                }).catch(() => {});
            }

            for(let i = 0; i < splinterShards.length; i++) {
                const s = splinterShards[i];
                s.active = true;
                s.mesh.visible = true;
                s.pos.set((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
                s.mesh.position.copy(s.pos);
                s.vel.set((Math.random() - 0.5) * 5.5, 3.5 + Math.random() * 3.5, (Math.random() - 0.5) * 5.5);
                s.rotVel.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
            }

            for(let i = 0; i < dustPuffs.length; i++) {
                const p = dustPuffs[i];
                p.mesh.visible = true;
                p.age = 0;
                p.mesh.position.set(0, 0.4, 0);
                p.mesh.scale.set(0.3, 0.3, 0.3);
                p.mesh.material.opacity = 0.45;
                const angle = (i / dustPuffs.length) * Math.PI * 2;
                p.vel.set(Math.cos(angle) * 1.6, 0.8, Math.sin(angle) * 1.6);
            }

            lootIconGroup.visible = true;
            lootIconGroup.position.set(0, 0.6, 0);
            lootIconGroup.scale.set(0.8, 0.8, 0.8);
        },

        update(time) {
            const dt = lastTime > 0 ? Math.min(time - lastTime, 0.1) : 0.016;
            lastTime = time;

            if(!this.shattered) return;
            this.shatterAge += dt;

            for(const s of splinterShards) {
                if(!s.active) continue;
                s.vel.y -= 14 * dt;
                s.pos.x += s.vel.x * dt;
                s.pos.y += s.vel.y * dt;
                s.pos.z += s.vel.z * dt;

                if(s.pos.y <= -0.55) {
                    s.pos.y = -0.55;
                    s.vel.y = -s.vel.y * 0.35;
                    s.vel.x *= 0.6;
                    s.vel.z *= 0.6;
                    if(Math.abs(s.vel.y) < 0.2) s.vel.set(0, 0, 0);
                }

                s.mesh.position.copy(s.pos);
                s.mesh.rotation.x += s.rotVel.x * dt;
                s.mesh.rotation.y += s.rotVel.y * dt;
                s.mesh.rotation.z += s.rotVel.z * dt;
            }

            for(const p of dustPuffs) {
                if(p.age > 0.8) {
                    p.mesh.visible = false;
                    continue;
                }
                p.age += dt;
                p.mesh.position.addScaledVector(p.vel, dt);
                const progress = p.age / 0.8;
                const scale = 0.3 + progress * 1.6;
                p.mesh.scale.set(scale, scale, scale);
                p.mesh.material.opacity = (1 - progress) * 0.45;
            }

            if(this.shatterAge < 1.4) {
                const arc = Math.min(this.shatterAge / 0.7, 1.0);
                lootIconGroup.position.y = 0.6 + Math.sin(arc * Math.PI * 0.5) * 2.2;
                lootIconGroup.rotation.y += dt * 8;
                if(this.shatterAge > 0.9) {
                    const fade = (1.4 - this.shatterAge) / 0.5;
                    lootIconGroup.scale.setScalar(Math.max(fade * 0.8, 0.01));
                }
            } else {
                lootIconGroup.visible = false;
            }
        }
    };
}

// Smashable clay pottery scattered across canyon camps
export const WORLD_POTS = [
    { id: 'pot-a1', x: -3.5, z: -34 },
    { id: 'pot-a2', x: 4.2, z: -30 },
    { id: 'pot-b1', x: -4.0, z: -2 },
    { id: 'pot-b2', x: 3.8, z: 4 },
    { id: 'pot-c1', x: -3.6, z: 36 },
    { id: 'pot-c2', x: 4.5, z: 40 }
];

function createSmashablePotMesh(id, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.name = `smashable-pot-${id}`;

    // Terracotta ceramic jar
    const potParts = [
        cylinder(0.38, 0.44, 0.65, 8, COLORS.cliffRim, 0, 0.32, 0),
        cylinder(0.24, 0.38, 0.25, 8, COLORS.cliffBase, 0, 0.72, 0),
        cylinder(0.28, 0.26, 0.12, 8, COLORS.cliffDark, 0, 0.88, 0),
        cylinder(0.18, 0.2, 0.12, 7, COLORS.wood, 0, 0.98, 0)
    ];
    const potMesh = new THREE.Mesh(mergeGeometries(potParts, false), sharedVertexMaterial());
    group.add(potMesh);

    // 6 Ceramic Pottery Shards
    const potShards = [];
    for(let i = 0; i < 6; i++) {
        const shardGeom = box(0.18, 0.25, 0.08, (i % 2 === 0 ? COLORS.cliffRim : COLORS.cliffDark));
        const sMesh = new THREE.Mesh(shardGeom, sharedVertexMaterial());
        sMesh.visible = false;
        group.add(sMesh);
        potShards.push({
            mesh: sMesh,
            pos: new THREE.Vector3(0, 0, 0),
            vel: new THREE.Vector3(0, 0, 0),
            rotVel: new THREE.Vector3(0, 0, 0),
            active: false
        });
    }

    // Clay Dust Puffs
    const dustPuffs = [];
    for(let i = 0; i < 3; i++) {
        const puffGeom = new THREE.DodecahedronGeometry(0.28, 0);
        const puffMat = new THREE.MeshBasicMaterial({
            color: COLORS.smoke,
            transparent: true,
            opacity: 0.45,
            depthWrite: false
        });
        const pMesh = new THREE.Mesh(puffGeom, puffMat);
        pMesh.visible = false;
        group.add(pMesh);
        dustPuffs.push({ mesh: pMesh, vel: new THREE.Vector3(0, 0, 0), age: 0 });
    }

    // Mini Loot Coin
    const coinGeom = cylinder(0.2, 0.2, 0.06, 8, COLORS.goldKey, 0, 0, 0, Math.PI / 2, 0, 0);
    const coinMesh = new THREE.Mesh(coinGeom, sharedVertexMaterial());
    coinMesh.visible = false;
    group.add(coinMesh);

    let lastTime = 0;

    return {
        id,
        group,
        potMesh,
        shards: potShards,
        dustPuffs,
        coinMesh,
        smashed: false,
        shatterAge: 0,

        shatter() {
            if(this.smashed) return;
            this.smashed = true;
            this.shatterAge = 0;
            this.potMesh.visible = false;

            if(typeof window !== 'undefined') {
                import('./audio.js').then(m => {
                    m.playSound?.('break');
                    m.playSound?.('coin');
                }).catch(() => {});
            }

            for(let i = 0; i < potShards.length; i++) {
                const s = potShards[i];
                s.active = true;
                s.mesh.visible = true;
                s.pos.set(0, 0.4, 0);
                s.mesh.position.copy(s.pos);
                s.vel.set((Math.random() - 0.5) * 5.0, 3.0 + Math.random() * 3.0, (Math.random() - 0.5) * 5.0);
                s.rotVel.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
            }

            for(let i = 0; i < dustPuffs.length; i++) {
                const p = dustPuffs[i];
                p.mesh.visible = true;
                p.age = 0;
                p.mesh.position.set(0, 0.4, 0);
                p.mesh.scale.set(0.3, 0.3, 0.3);
                const angle = (i / dustPuffs.length) * Math.PI * 2;
                p.vel.set(Math.cos(angle) * 1.5, 0.6, Math.sin(angle) * 1.5);
            }

            coinMesh.visible = true;
            coinMesh.position.set(0, 0.4, 0);
        },

        update(time) {
            const dt = lastTime > 0 ? Math.min(time - lastTime, 0.1) : 0.016;
            lastTime = time;

            if(!this.smashed) return;
            this.shatterAge += dt;

            for(const s of potShards) {
                if(!s.active) continue;
                s.vel.y -= 14 * dt;
                s.pos.addScaledVector(s.vel, dt);
                if(s.pos.y <= 0) {
                    s.pos.y = 0;
                    s.vel.y = -s.vel.y * 0.3;
                    s.vel.x *= 0.6;
                    s.vel.z *= 0.6;
                }
                s.mesh.position.copy(s.pos);
                s.mesh.rotation.x += s.rotVel.x * dt;
                s.mesh.rotation.y += s.rotVel.y * dt;
                s.mesh.rotation.z += s.rotVel.z * dt;
            }

            for(const p of dustPuffs) {
                if(p.age > 0.7) {
                    p.mesh.visible = false;
                    continue;
                }
                p.age += dt;
                p.mesh.position.addScaledVector(p.vel, dt);
                const progress = p.age / 0.7;
                const scale = 0.3 + progress * 1.4;
                p.mesh.scale.set(scale, scale, scale);
                p.mesh.material.opacity = (1 - progress) * 0.45;
            }

            if(this.shatterAge < 1.2) {
                const arc = Math.min(this.shatterAge / 0.6, 1.0);
                coinMesh.position.y = 0.4 + Math.sin(arc * Math.PI * 0.5) * 1.8;
                coinMesh.rotation.y += dt * 8;
                if(this.shatterAge > 0.8) {
                    const fade = (1.2 - this.shatterAge) / 0.4;
                    coinMesh.scale.setScalar(Math.max(fade, 0.01));
                }
            } else {
                coinMesh.visible = false;
            }
        }
    };
}

// Camp bandit sentries and sleepers (Mini Ninjas living camps)
export const CAMP_BANDITS = [
    // Camp Alpha (Mine Camp, Z = -30)
    { id: 'alpha-sleeper', campId: 'camp-mine', x: -2.8, z: -32, role: 'sleeper', rotY: 0.3 },
    { id: 'alpha-sentry', campId: 'camp-mine', x: 3.2, z: -28, role: 'sentry', rotY: -2.2 },

    // Camp Bravo (Rail Spur, Z = 0)
    { id: 'bravo-sleeper', campId: 'camp-spur', x: -3.5, z: -2, role: 'sleeper', rotY: 1.2 },
    { id: 'bravo-sentry', campId: 'camp-spur', x: 2.8, z: 2, role: 'sentry', rotY: -1.6 },

    // Camp Charlie (Sulfur Springs, Z = 35)
    { id: 'charlie-sleeper', campId: 'camp-springs', x: -3.2, z: 34, role: 'sleeper', rotY: 0.8 },
    { id: 'charlie-sentry', campId: 'camp-springs', x: 3.6, z: 37, role: 'sentry', rotY: -2.5 }
];

function getPlayerPos(sceneGroup, runState) {
    if(runState?.playerPos) return runState.playerPos;
    if(typeof window !== 'undefined' && window.__redWest?.playerGroup?.position) {
        return window.__redWest.playerGroup.position;
    }
    const root = sceneGroup?.parent;
    if(root?.children) {
        const p = root.children.find(c => c.userData?.type === 'player' || c.userData?.aimTimer !== undefined);
        if(p?.position) return p.position;
    }
    return null;
}

function createCampBandit(def) {
    const group = new THREE.Group();
    group.position.set(def.x, 0, def.z);
    group.rotation.y = def.rotY;
    group.name = `bandit-${def.id}`;

    // Bandit Chibi Character Body
    const bodyParts = [
        box(0.3, 0.25, 0.45, COLORS.woodDark, -0.2, 0.12, 0.05),
        box(0.3, 0.25, 0.45, COLORS.woodDark, 0.2, 0.12, 0.05),
        box(0.55, 0.55, 0.45, COLORS.iron, 0, 0.42, 0),
        box(0.72, 0.7, 0.5, COLORS.cliffBase, 0, 0.95, 0),
        box(0.74, 0.16, 0.52, COLORS.flowerRed, 0, 1.32, 0),
        dodecahedron(0.32, COLORS.paper, 0, 1.55, 0),
        cylinder(0.75, 0.75, 0.08, 8, COLORS.woodDark, 0, 1.82, 0),
        cylinder(0.42, 0.45, 0.38, 7, COLORS.woodDark, 0, 2.05, 0)
    ];

    if(def.role === 'sentry') {
        bodyParts.push(cylinder(0.12, 0.12, 0.2, 5, COLORS.iron, 0.42, 1.05, 0.25));
    }

    const characterMesh = new THREE.Mesh(mergeGeometries(bodyParts, false), sharedVertexMaterial());
    group.add(characterMesh);

    // Floating Sleep "Z" Glyphs for Sleeper
    const zGlyphs = [];
    if(def.role === 'sleeper') {
        for(let i = 0; i < 3; i++) {
            const zParts = [
                box(0.24, 0.06, 0.06, COLORS.paper, 0, 0.12, 0),
                box(0.06, 0.28, 0.06, COLORS.paper, 0, 0, 0, 0, 0, Math.PI / 4),
                box(0.24, 0.06, 0.06, COLORS.paper, 0, -0.12, 0)
            ];
            const zMesh = new THREE.Mesh(mergeGeometries(zParts, false), sharedVertexMaterial());
            zMesh.visible = true;
            group.add(zMesh);
            zGlyphs.push({ mesh: zMesh, phase: i * 0.33 });
        }
    }

    // Expressive Comic Speech Balloon (! and ?)
    const balloonGroup = new THREE.Group();
    balloonGroup.position.set(0, 2.65, 0);
    balloonGroup.scale.set(0, 0, 0);
    group.add(balloonGroup);

    const circleGeom = cylinder(0.45, 0.45, 0.06, 12, 0xffffff, 0, 0, 0, Math.PI / 2, 0, 0);
    const arrowGeom = paint(new THREE.ConeGeometry(0.14, 0.22, 4).translate(0, -0.42, 0), 0xffffff);
    const bgMesh = new THREE.Mesh(mergeGeometries([circleGeom, arrowGeom], false), sharedVertexMaterial());
    balloonGroup.add(bgMesh);

    // Exclamation mark mesh (!)
    const exclParts = [
        box(0.12, 0.38, 0.08, COLORS.flowerRed, 0, 0.1, 0.04),
        dodecahedron(0.09, COLORS.flowerRed, 0, -0.22, 0.04)
    ];
    const exclMesh = new THREE.Mesh(mergeGeometries(exclParts, false), sharedVertexMaterial());
    exclMesh.visible = false;
    balloonGroup.add(exclMesh);

    // Question mark mesh (?)
    const questParts = [
        box(0.25, 0.08, 0.08, COLORS.flowerYellow, 0, 0.24, 0.04),
        box(0.08, 0.18, 0.08, COLORS.flowerYellow, 0.1, 0.15, 0.04),
        box(0.15, 0.08, 0.08, COLORS.flowerYellow, 0.02, 0.05, 0.04),
        box(0.08, 0.14, 0.08, COLORS.flowerYellow, -0.02, -0.05, 0.04),
        dodecahedron(0.08, COLORS.flowerYellow, -0.02, -0.22, 0.04)
    ];
    const questMesh = new THREE.Mesh(mergeGeometries(questParts, false), sharedVertexMaterial());
    questMesh.visible = false;
    balloonGroup.add(questMesh);

    // Defeat / Poof Dust
    const dustPuffs = [];
    for(let d = 0; d < 4; d++) {
        const dMesh = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.35, 0),
            new THREE.MeshBasicMaterial({ color: COLORS.smoke, transparent: true, opacity: 0.5, depthWrite: false })
        );
        dMesh.visible = false;
        group.add(dMesh);
        dustPuffs.push({ mesh: dMesh, vel: new THREE.Vector3(0, 0, 0), age: 0 });
    }

    let alertAnimTime = 0;

    return {
        id: def.id,
        campId: def.campId,
        role: def.role,
        group,
        characterMesh,
        zGlyphs,
        balloonGroup,
        exclMesh,
        questMesh,
        alertState: 'idle',
        targetScale: 0,
        currentScale: 0,

        update(time, dt = 0.016, playerPos = null, isCampActive = false) {
            if(isCampActive) {
                if(this.alertState !== 'cleared') {
                    this.alertState = 'cleared';
                    this.balloonGroup.visible = false;
                    this.characterMesh.visible = false;
                    for(const zg of this.zGlyphs) zg.mesh.visible = false;
                    for(let i = 0; i < dustPuffs.length; i++) {
                        const dp = dustPuffs[i];
                        dp.mesh.visible = true;
                        dp.age = 0;
                        dp.mesh.position.set(0, 0.8, 0);
                        const angle = (i / dustPuffs.length) * Math.PI * 2;
                        dp.vel.set(Math.cos(angle) * 1.8, 1.0, Math.sin(angle) * 1.8);
                    }
                }
                for(const dp of dustPuffs) {
                    if(dp.age > 0.8) { dp.mesh.visible = false; continue; }
                    dp.age += dt;
                    dp.mesh.position.addScaledVector(dp.vel, dt);
                    const prog = dp.age / 0.8;
                    const sc = 0.3 + prog * 1.6;
                    dp.mesh.scale.set(sc, sc, sc);
                    dp.mesh.material.opacity = (1 - prog) * 0.5;
                }
                return;
            }

            if(playerPos) {
                const dx = playerPos.x - def.x;
                const dz = playerPos.z - def.z;
                const dist = Math.hypot(dx, dz);

                if(dist < 9.0) {
                    if(this.alertState !== 'alerted') {
                        this.alertState = 'alerted';
                        alertAnimTime = 0;
                        if(typeof window !== 'undefined') {
                            import('./audio.js').then(m => m.playSound?.('enemy-shot')).catch(() => {});
                        }
                    }
                } else if(dist < 15.0) {
                    if(this.alertState !== 'suspicious' && this.alertState !== 'alerted') {
                        this.alertState = 'suspicious';
                        alertAnimTime = 0;
                    }
                } else {
                    this.alertState = 'idle';
                }
            }

            if(this.alertState === 'alerted') {
                this.exclMesh.visible = true;
                this.questMesh.visible = false;
                alertAnimTime += dt;
                const pop = Math.sin(Math.min(alertAnimTime * 8, Math.PI)) * 0.4;
                this.targetScale = 1.0 + pop;
            } else if(this.alertState === 'suspicious') {
                this.exclMesh.visible = false;
                this.questMesh.visible = true;
                this.targetScale = 0.9;
                if(playerPos) {
                    const lookAngle = Math.atan2(playerPos.x - def.x, playerPos.z - def.z);
                    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, lookAngle, dt * 5);
                }
            } else {
                this.exclMesh.visible = false;
                this.questMesh.visible = false;
                this.targetScale = 0;
                group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, def.rotY, dt * 3);
            }

            this.currentScale = THREE.MathUtils.lerp(this.currentScale, this.targetScale, dt * 14);
            this.balloonGroup.scale.set(this.currentScale, this.currentScale, this.currentScale);
            this.balloonGroup.visible = this.currentScale > 0.05;

            if(this.role === 'sleeper') {
                const isSleeping = (this.alertState === 'idle');
                this.characterMesh.position.y = isSleeping ? Math.sin(time * 2.2) * 0.03 : 0;
                for(let i = 0; i < this.zGlyphs.length; i++) {
                    const zg = this.zGlyphs[i];
                    zg.mesh.visible = isSleeping;
                    if(!isSleeping) continue;
                    const cycle = ((time * 0.7 + zg.phase) % 1.0);
                    const y = 1.6 + cycle * 1.5;
                    const sway = Math.sin(cycle * Math.PI * 2) * 0.16;
                    zg.mesh.position.set(sway, y, cycle * 0.2);
                    const sc = 0.5 + cycle * 0.6;
                    zg.mesh.scale.set(sc, sc, sc);
                    zg.mesh.material.opacity = (1 - cycle) * 0.8;
                }
            } else if(this.role === 'sentry') {
                if(this.alertState === 'idle') {
                    group.rotation.y = def.rotY + Math.sin(time * 1.2) * 0.4;
                }
            }
        }
    };
}

// Builds one investigation clue prop
function createClueMesh(clueDef) {
    const group = new THREE.Group();
    group.position.set(clueDef.x, 0, clueDef.z);
    group.name = `clue-${clueDef.id}`;

    let itemMesh = null;
    if(clueDef.id === 'clue-manifest') {
        // Shipping paper on a small wooden crate
        const parts = [
            box(0.9, 0.7, 0.9, COLORS.woodDark, 0, 0.35, 0),
            box(0.55, 0.04, 0.45, COLORS.paper, 0, 0.72, 0, 0, 0.15, 0)
        ];
        itemMesh = new THREE.Mesh(mergeGeometries(parts, false), sharedVertexMaterial());
        group.add(itemMesh);
    } else if(clueDef.id === 'clue-ledger') {
        // Open ledger book on a stone slab
        const parts = [
            cylinder(0.6, 0.7, 0.7, 6, COLORS.stone, 0, 0.35, 0),
            box(0.65, 0.08, 0.5, COLORS.ledgerCover, 0, 0.74, 0, 0, 0.2, 0),
            box(0.6, 0.06, 0.46, COLORS.paper, 0, 0.77, 0, 0, 0.2, 0)
        ];
        itemMesh = new THREE.Mesh(mergeGeometries(parts, false), sharedVertexMaterial());
        group.add(itemMesh);
    } else {
        // Brass stronghold key floating with subtle bob
        const parts = [
            cylinder(0.7, 0.75, 0.8, 6, COLORS.woodDark, 0, 0.4, 0),
            // Key ring
            cylinder(0.18, 0.18, 0.05, 8, COLORS.goldKey, 0, 1.25, 0, Math.PI / 2, 0, 0),
            // Key shaft & teeth
            box(0.08, 0.45, 0.05, COLORS.goldKey, 0, 0.95, 0),
            box(0.18, 0.12, 0.05, COLORS.goldKey, 0.06, 0.8, 0)
        ];
        itemMesh = new THREE.Mesh(mergeGeometries(parts, false), sharedVertexMaterial());
        group.add(itemMesh);
    }

    return {
        id: clueDef.id,
        group,
        collected: false,
        setCollected(isCollected) {
            this.collected = !!isCollected;
            this.group.visible = !this.collected;
        },
        update(time) {
            if(this.collected) return;
            if(clueDef.id === 'clue-key') {
                group.position.y = Math.sin(time * 3) * 0.08;
            }
        }
    };
}

// Builds canyon architectural accents: mine arches, rail spur segments, stronghold gate, and hanging lanterns
function createCanyonLandmarks() {
    const group = new THREE.Group();
    group.name = 'pete-world-landmarks';

    const archParts = [];
    // 2 Mine arches in Zone A (Canyon Mine Camp)
    const archZs = [-88, -66];
    for(const az of archZs) {
        // Left post, right post, crossbeam
        archParts.push(box(0.6, 5.0, 0.6, COLORS.woodDark, -6.5, 2.5, az));
        archParts.push(box(0.6, 5.0, 0.6, COLORS.woodDark, 6.5, 2.5, az));
        archParts.push(box(14.0, 0.6, 0.8, COLORS.wood, 0, 4.8, az));
    }

    // Hanging swinging brass lanterns with glowing cores on mine arches
    const lanternGroups = [];
    for(const az of archZs) {
        for(const lx of [-3.5, 3.5]) {
            const lantern = new THREE.Group();
            lantern.position.set(lx, 4.5, az);

            const chain = box(0.06, 0.5, 0.06, COLORS.iron, 0, -0.25, 0);
            const cage = cylinder(0.24, 0.28, 0.6, 5, COLORS.lanternBrass, 0, -0.75, 0);
            const cap = paint(new THREE.ConeGeometry(0.32, 0.22, 5).translate(0, -0.4, 0), COLORS.lanternBrass);
            const core = paint(new THREE.DodecahedronGeometry(0.16, 0).translate(0, -0.75, 0), COLORS.lanternGlow);
            const lampMesh = new THREE.Mesh(mergeGeometries([chain, cage, cap, core], false), sharedVertexMaterial());
            lantern.add(lampMesh);

            const haloGeom = new THREE.PlaneGeometry(1.5, 1.5);
            const haloMesh = new THREE.Mesh(haloGeom, glowMaterial(COLORS.lanternGlow));
            haloMesh.position.set(0, -0.75, 0);
            lantern.add(haloMesh);

            group.add(lantern);
            lanternGroups.push({
                group: lantern,
                phase: (az + lx) * 0.4
            });
        }
    }

    // Rail tracks in Zone B (Rail Spur, Z from -48 to -8)
    const railParts = [];
    for(let rz = -48; rz <= -8; rz += 2.0) {
        // Wooden tie
        railParts.push(box(3.2, 0.12, 0.35, COLORS.woodDark, 2.0, 0.06, rz));
    }
    // Two iron rails
    railParts.push(box(0.12, 0.15, 42.0, COLORS.iron, 0.8, 0.16, -28));
    railParts.push(box(0.12, 0.15, 42.0, COLORS.iron, 3.2, 0.16, -28));

    // Mine cart at spur end
    railParts.push(box(2.2, 1.4, 2.8, COLORS.iron, 2.0, 0.85, -12, 0, 0.05, 0));

    const archesMesh = new THREE.Mesh(mergeGeometries(archParts, false), sharedVertexMaterial());
    const railsMesh = new THREE.Mesh(mergeGeometries(railParts, false), sharedVertexMaterial());
    group.add(archesMesh);
    group.add(railsMesh);

    // Stronghold Barricade Gate at Z = 74
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, STRONGHOLD_GATE_Z);
    gateGroup.name = 'stronghold-gate';

    const gateParts = [
        // Left and right fortified fence posts
        box(0.8, 4.0, 0.8, COLORS.woodDark, -5.5, 2.0, 0),
        box(0.8, 4.0, 0.8, COLORS.woodDark, 5.5, 2.0, 0),
        // Barricade barrels flanking the road
        cylinder(0.65, 0.65, 1.4, 8, COLORS.woodDark, -4.5, 0.7, 0),
        cylinder(0.65, 0.65, 1.4, 8, COLORS.woodDark, 4.5, 0.7, 0)
    ];

    // Left and right swing gates
    const leftDoorGeom = box(4.8, 2.6, 0.3, COLORS.wood, -2.5, 1.4, 0);
    const rightDoorGeom = box(4.8, 2.6, 0.3, COLORS.wood, 2.5, 1.4, 0);
    const gateFixedMesh = new THREE.Mesh(mergeGeometries(gateParts, false), sharedVertexMaterial());
    gateGroup.add(gateFixedMesh);

    const leftDoor = new THREE.Mesh(leftDoorGeom, sharedVertexMaterial());
    const rightDoor = new THREE.Mesh(rightDoorGeom, sharedVertexMaterial());
    gateGroup.add(leftDoor);
    gateGroup.add(rightDoor);

    group.add(gateGroup);

    return {
        group,
        gateGroup,
        leftDoor,
        rightDoor,
        lanterns: lanternGroups,
        setBreached(breached) {
            if(breached) {
                leftDoor.position.x = -6.0;
                rightDoor.position.x = 6.0;
                leftDoor.rotation.y = -Math.PI * 0.4;
                rightDoor.rotation.y = Math.PI * 0.4;
            } else {
                leftDoor.position.set(0, 0, 0);
                rightDoor.position.set(0, 0, 0);
                leftDoor.rotation.y = 0;
                rightDoor.rotation.y = 0;
            }
        },
        update(time) {
            for(const item of lanternGroups) {
                item.group.rotation.z = Math.sin(time * 2.2 + item.phase) * 0.12;
                item.group.rotation.x = Math.cos(time * 1.6 + item.phase) * 0.08;
            }
        }
    };
}

// Builds stylized canyon cliffs, natural rock arches, blooming flora, and abandoned camp clutter
function createCanyonEnvironment() {
    const group = new THREE.Group();
    group.name = 'pete-canyon-environment';

    const cliffParts = [];

    // Stepped, chunky terracotta cliff formations flanking the canyon corridor
    const zSteps = [-96, -80, -64, -48, -32, -16, 0, 16, 32, 48, 64, 80, 96];

    for(let i = 0; i < zSteps.length; i++) {
        const cz = zSteps[i];
        const seed = Math.sin(i * 1.7);
        const seed2 = Math.cos(i * 2.3);

        // West cliff formation (X ~ -16 to -22)
        const wx = -17 - Math.abs(seed) * 3;
        const wh = 6 + Math.abs(seed2) * 3.5;
        cliffParts.push(box(9, wh, 14, COLORS.cliffBase, wx, wh / 2, cz));
        cliffParts.push(box(6, wh * 0.4, 9, COLORS.cliffLight, wx - 1.5, wh + (wh * 0.2), cz + 1));
        cliffParts.push(dodecahedron(3.2, COLORS.cliffDark, wx + 3.2, 2.5, cz - 3, 0.2, 0.4, 0.1));
        cliffParts.push(box(7, 0.8, 12, COLORS.cliffRim, wx + 1, wh - 0.4, cz));

        // East cliff formation (X ~ 16 to 22)
        const ex = 17 + Math.abs(seed2) * 3;
        const eh = 6 + Math.abs(seed) * 3.5;
        cliffParts.push(box(9, eh, 14, COLORS.cliffBase, ex, eh / 2, cz));
        cliffParts.push(box(6, eh * 0.4, 9, COLORS.cliffLight, ex + 1.5, eh + (eh * 0.2), cz - 1));
        cliffParts.push(dodecahedron(3.2, COLORS.cliffDark, ex - 3.2, 2.5, cz + 3, -0.2, -0.3, 0.1));
        cliffParts.push(box(7, 0.8, 12, COLORS.cliffRim, ex - 1, eh - 0.4, cz));
    }

    // High natural rock arch spanning over the canyon at Z = -48 (Zone A to B entrance)
    cliffParts.push(box(38, 3.5, 6, COLORS.cliffBase, 0, 10.5, -48));
    cliffParts.push(box(24, 2.0, 5, COLORS.cliffRim, 0, 12.0, -48));
    cliffParts.push(dodecahedron(3.8, COLORS.cliffLight, -6, 12.5, -48));

    // High natural rock arch spanning over the canyon at Z = 52 (Zone C to D entrance)
    cliffParts.push(box(38, 3.5, 6, COLORS.cliffBase, 0, 11.5, 52));
    cliffParts.push(box(22, 2.0, 5, COLORS.cliffRim, 0, 13.0, 52));
    cliffParts.push(dodecahedron(3.8, COLORS.cliffLight, 5, 13.5, 52));

    const cliffsMesh = new THREE.Mesh(mergeGeometries(cliffParts, false), sharedVertexMaterial());
    group.add(cliffsMesh);

    // Desert Flora & Camp Clutter (Flowering saguaro cacti, scrub, TNT crates)
    const floraParts = [];

    // Saguaro cacti along the canyon margins
    const cactusZs = [-84, -60, -36, -12, 12, 36, 60, 84];
    for(let j = 0; j < cactusZs.length; j++) {
        const cz = cactusZs[j];
        const side = (j % 2 === 0 ? 1 : -1);
        const cx = side * (12.5 + ((j * 3) % 4) * 0.5);

        // Main trunk
        floraParts.push(cylinder(0.65, 0.75, 5.2, 6, COLORS.cactusGreen, cx, 2.6, cz));
        // Left arm
        floraParts.push(box(0.5, 0.5, 1.4, COLORS.cactusHighlight, cx - (side * 0.9), 3.2, cz));
        floraParts.push(cylinder(0.4, 0.45, 2.2, 5, COLORS.cactusGreen, cx - (side * 1.5), 4.2, cz));
        // Right arm
        floraParts.push(box(0.5, 0.5, 1.4, COLORS.cactusHighlight, cx + (side * 0.9), 2.4, cz));
        floraParts.push(cylinder(0.4, 0.45, 2.0, 5, COLORS.cactusGreen, cx + (side * 1.5), 3.3, cz));
        // Blooming crown flower
        floraParts.push(dodecahedron(0.45, COLORS.flowerRed, cx, 5.4, cz));
        floraParts.push(cylinder(0.18, 0.18, 0.25, 5, COLORS.flowerYellow, cx, 5.65, cz));

        // Dry scrub tufts
        floraParts.push(dodecahedron(0.85, COLORS.scrubTan, cx + (side * 1.8), 0.4, cz + 1.2));
        floraParts.push(dodecahedron(0.65, COLORS.scrubTan, cx - (side * 1.2), 0.35, cz - 1.4));
    }

    // Abandoned camp props (TNT dynamite crates, prospector water casks)
    const campZs = [-32, 2, 38];
    for(const campZ of campZs) {
        // Red TNT crates
        floraParts.push(box(1.2, 0.9, 1.0, COLORS.ledgerCover, -4.8, 0.45, campZ));
        floraParts.push(box(1.25, 0.25, 1.05, COLORS.paper, -4.8, 0.45, campZ));
        // Water casks
        floraParts.push(cylinder(0.55, 0.6, 1.3, 7, COLORS.woodDark, 4.8, 0.65, campZ + 1.5));
        floraParts.push(cylinder(0.58, 0.58, 0.15, 7, COLORS.iron, 4.8, 0.4, campZ + 1.5));
        floraParts.push(cylinder(0.58, 0.58, 0.15, 7, COLORS.iron, 4.8, 0.9, campZ + 1.5));
    }

    const floraMesh = new THREE.Mesh(mergeGeometries(floraParts, false), sharedVertexMaterial());
    group.add(floraMesh);

    return {
        group,
        cliffsMesh,
        floraMesh
    };
}

// Master factory for Pete's Open-World 3D Scene
export function createPeteWorldScene() {
    const group = new THREE.Group();
    group.name = 'pete-world-scene';

    // 1. Build campfires
    const campfireMeshes = WORLD_CAMPFIRES.map(c => {
        const item = createCampfireMesh(c.id, c.x, c.z);
        group.add(item.group);
        return item;
    });

    // 2. Build crates
    const crateMeshes = WORLD_CRATES.map(c => {
        const item = createCrateMesh(c.id, c.x, c.z);
        group.add(item.group);
        return item;
    });

    // 3. Build clue props
    const clueMeshes = INVESTIGATION_CLUES.map(c => {
        const item = createClueMesh(c);
        group.add(item.group);
        return item;
    });

    // 4. Build canyon landmarks & stronghold gate
    const landmarks = createCanyonLandmarks();
    group.add(landmarks.group);

    // 5. Build canyon cliffs, rock arches, flora, and environment
    const environment = createCanyonEnvironment();
    group.add(environment.group);

    // 6. Build smashable clay pots (Mini Ninjas breakable pottery)
    const potMeshes = WORLD_POTS.map(p => {
        const item = createSmashablePotMesh(p.id, p.x, p.z);
        group.add(item.group);
        return item;
    });

    // 7. Build bandit camp sentries & sleeping guards (Mini Ninjas camp life)
    const banditMeshes = CAMP_BANDITS.map(def => {
        const item = createCampBandit(def);
        group.add(item.group);
        return item;
    });

    return {
        group,
        campfires: campfireMeshes,
        crates: crateMeshes,
        pots: potMeshes,
        clues: clueMeshes,
        gate: landmarks,
        environment,
        bandits: banditMeshes,

        update(runState, timeInSeconds) {
            if(!runState) return;

            // Sync campfires
            if(Array.isArray(runState.campfires)) {
                for(const fireMesh of campfireMeshes) {
                    const data = runState.campfires.find(f => f.id === fireMesh.id);
                    if(data && data.active !== fireMesh.active) {
                        fireMesh.setActive(data.active);
                    }
                    fireMesh.update(timeInSeconds);
                }
            }

            // Sync crates and animate splinter burst
            if(Array.isArray(runState.crates)) {
                for(const crateMesh of crateMeshes) {
                    const data = runState.crates.find(c => c.id === crateMesh.id);
                    if(data && data.opened !== crateMesh.opened) {
                        crateMesh.setOpened(data.opened);
                    }
                    crateMesh.update(timeInSeconds);
                }
            }

            // Animate smashable pots
            for(const pot of potMeshes) {
                pot.update(timeInSeconds);
            }

            // Animate bandit sentries & alert reactions
            const playerPos = getPlayerPos(group, runState);
            const dt = 0.016;
            for(const bandit of banditMeshes) {
                const campData = runState.campfires?.find(c => c.id === bandit.campId);
                const isCampActive = campData?.active ?? false;
                bandit.update(timeInSeconds, dt, playerPos, isCampActive);
            }

            // Sync clues
            if(Array.isArray(runState.collectedClues)) {
                for(const clueMesh of clueMeshes) {
                    const collected = runState.collectedClues.includes(clueMesh.id);
                    if(collected !== clueMesh.collected) {
                        clueMesh.setCollected(collected);
                    }
                    clueMesh.update(timeInSeconds);
                }
            }

            // Sync stronghold gate
            if(landmarks && landmarks.setBreached) {
                landmarks.setBreached(!!runState.gateBreached);
            }

            // Animate dynamic landmarks (swinging lanterns)
            if(landmarks && landmarks.update) {
                landmarks.update(timeInSeconds);
            }
        },

        dispose() {
            group.traverse(o => {
                if(o.geometry) o.geometry.dispose?.();
                if(o.material) {
                    if(Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
                    else o.material.dispose?.();
                }
            });
        }
    };
}
