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
    emberGlow: 0xff5500
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

function cylinder(rt, rb, h, segs, hex, x = 0, y = 0, z = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, segs);
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

// Builds one campfire site (stone circle + logs + flame + glow halo)
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

    return {
        id,
        group,
        flameMesh,
        glowMesh,
        active: false,
        setActive(isActive) {
            this.active = !!isActive;
            this.flameMesh.visible = this.active;
            this.glowMesh.visible = this.active;
        },
        update(time) {
            if(!this.active) return;
            const flicker = 0.85 + 0.25 * Math.sin(time * 9 + x * 2);
            this.flameMesh.scale.set(flicker, flicker * 1.1, flicker);
            this.glowMesh.material.opacity = 0.35 + 0.15 * Math.sin(time * 6 + z);
        }
    };
}

// Builds one loot crate (wooden chest with hinged lid)
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

    return {
        id,
        group,
        lidGroup,
        opened: false,
        setOpened(isOpened) {
            this.opened = !!isOpened;
            this.lidGroup.rotation.x = this.opened ? -Math.PI * 0.45 : 0;
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

// Builds canyon architectural accents: mine arches, rail spur segments, and stronghold gate
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
        }
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

    return {
        group,
        campfires: campfireMeshes,
        crates: crateMeshes,
        clues: clueMeshes,
        gate: landmarks,

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

            // Sync crates
            if(Array.isArray(runState.crates)) {
                for(const crateMesh of crateMeshes) {
                    const data = runState.crates.find(c => c.id === crateMesh.id);
                    if(data && data.opened !== crateMesh.opened) {
                        crateMesh.setOpened(data.opened);
                    }
                }
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
