import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { obstacles } from './state.js';
import { markObstacleGridDirty } from './physics.js';
import { mergeByMaterial } from './meshMerge.js';

function addObstacle(obstacle) {
    obstacles.push(obstacle);
    markObstacleGridDirty();
}

// Props built from several boxes are drawn as one mesh per material (fewer draw calls on phones).
function placeProp(scene, group, obstacle) {
    const prop = mergeByMaterial(group);
    prop.traverse(o => { if(o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(prop);
    addObstacle({ ...obstacle, mesh: prop });
}


// ---------- Cartoon look: cel shading + outlines (Brawl Stars-style readability) ----------
// Three light bands instead of smooth shading.
const TOON_GRADIENT = (() => {
    const texture = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
})();

// Accepts the old MeshStandardMaterial options; metals get a little glow so they still read as shiny.
function toonMat({ color = 0xffffff, transparent = false, opacity = 1, metalness = 0 } = {}) {
    const material = new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT, transparent, opacity });
    if(metalness > 0.5) material.emissive = new THREE.Color(color).multiplyScalar(0.25);
    return material;
}

// Cel shading for imported, textured characters (colour comes from the model's own texture).
export function toonTexturedMaterial(map) {
    return new THREE.MeshToonMaterial({ color: 0xffffff, map: map ?? null, gradientMap: TOON_GRADIENT });
}

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1a0d05, side: THREE.BackSide });
const OUTLINE_WIDTH = 0.05;

// Inverted-hull outlines: a slightly larger back-face copy of each part, drawn in dark brown.
// Tiny parts (eyes, gun details) are skipped to save draw calls on phones. Parts that never move on their
// own (everything but named limbs and parts the builder keeps in userData, see animation.js) share one
// merged outline per parent: a bandit draws 5 outlines instead of 11.
function addOutline(root) {
    const meshes = [];
    (function collect(object) {
        if(object.userData.noOutline) return;
        if(object.isMesh && !object.userData.isOutline) meshes.push(object);
        for(const child of object.children) collect(child);
    })(root);
    const moving = new Set();
    const note = value => {
        if(value?.isObject3D) moving.add(value);
        else if(Array.isArray(value)) value.forEach(note);
    };
    Object.values(root.userData).forEach(note);
    root.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    const shared = new Map(); // parent -> outline geometries in the parent's space
    for(const mesh of meshes) {
        const geometry = mesh.geometry;
        if(!geometry.boundingBox) geometry.computeBoundingBox();
        geometry.boundingBox.getSize(size);
        if(Math.max(size.x, size.y, size.z) < 0.25) continue;
        geometry.boundingBox.getCenter(center);
        const scale = new THREE.Vector3(
            1 + (2 * OUTLINE_WIDTH / Math.max(size.x, 0.05)),
            1 + (2 * OUTLINE_WIDTH / Math.max(size.y, 0.05)),
            1 + (2 * OUTLINE_WIDTH / Math.max(size.z, 0.05))
        );
        const offset = new THREE.Vector3(center.x * (1 - scale.x), center.y * (1 - scale.y), center.z * (1 - scale.z));
        if(mesh.name || moving.has(mesh) || !mesh.parent) {
            const outline = new THREE.Mesh(geometry, OUTLINE_MAT);
            outline.userData.isOutline = true;
            outline.raycast = () => {};
            outline.scale.copy(scale);
            outline.position.copy(offset);
            mesh.add(outline);
            continue;
        }
        const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        for(const name of Object.keys(baked.attributes)) if(name !== 'position') baked.deleteAttribute(name);
        baked.morphAttributes = {};
        baked.clearGroups();
        baked.applyMatrix4(new THREE.Matrix4().compose(offset, new THREE.Quaternion(), scale));
        baked.applyMatrix4(mesh.matrix);
        if(!shared.has(mesh.parent)) shared.set(mesh.parent, []);
        shared.get(mesh.parent).push(baked);
    }
    for(const [parent, geometries] of shared) {
        const outline = new THREE.Mesh(mergeGeometries(geometries, false), OUTLINE_MAT);
        for(const g of geometries) g.dispose();
        outline.userData.isOutline = true;
        outline.raycast = () => {};
        parent.add(outline);
    }
    return root;
}

const mat = {
    // ROUGH TEXTURES (Cloth, Skin, Wood)
    skin: toonMat({ color: 0xf5d7b8, roughness: 1.0 }),
    coat: toonMat({ color: 0xb8662a, roughness: 1.0 }),
    enemyCoat: toonMat({ color: 0xa8432a, roughness: 1.0 }),
    poncho: toonMat({ color: 0x7d9a34, roughness: 1.0 }),
    hat: toonMat({ color: 0x7a4520, roughness: 1.0 }),
    blackHat: toonMat({ color: 0x2e2a2a, roughness: 1.0 }),
    pants: toonMat({ color: 0x3f5a8a, roughness: 0.9 }),
    belt: toonMat({ color: 0x5a3417, roughness: 0.8 }),
    red: toonMat({ color: 0xd32f2f, roughness: 1.0 }),
    green: toonMat({ color: 0x43a047, roughness: 1.0 }),
    wood: toonMat({ color: 0x8B4513, roughness: 0.9 }),
    cork: toonMat({ color: 0xd2b48c, roughness: 1.0 }),
    
    // SHINY METALS (Gun, Gold, Steel)
    gunMetal: toonMat({ color: 0x222222, roughness: 0.4, metalness: 0.6 }), 
    darkSteel: toonMat({ color: 0x111111, roughness: 0.3, metalness: 0.7 }),
    grey: toonMat({ color: 0x808080, roughness: 0.5 }), 
    darkGrey: toonMat({ color: 0x333333, roughness: 0.5 }),
    wolfFur: toonMat({ color: 0x8a8f99 }),
    gold: toonMat({ color: 0xffd700, roughness: 0.2, metalness: 0.8 }),
    
    // ENVIRONMENT (New)
    stone: toonMat({ color: 0x888888, roughness: 0.9 }),
    sandStone: toonMat({ color: 0xa0825f, roughness: 1.0 }),
    deadWood: toonMat({ color: 0x4d3319, roughness: 1.0 }),

    // SPECIAL
    glass: toonMat({ color: 0x8B4513, transparent: true, opacity: 0.8, roughness: 0.1 }),
    hpRed: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    hpGreen: new THREE.MeshBasicMaterial({ color: 0x00ff00 })
};

// Only the player's gun gets a real flash light: every light is paid by every lit pixel, and a new one
// appearing mid-fight makes phones recompile shaders. Enemy muzzles are plain markers.
function createRevolverMesh(flashLight = false) {
    const gunGroup = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.35), mat.wood); grip.position.set(0, -0.3, 0.2); grip.rotation.x = -0.4; gunGroup.add(grip);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.5), mat.gunMetal); frame.position.set(0, 0.1, -0.2); gunGroup.add(frame);
    const cylinder = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.5), mat.darkSteel); cylinder.position.set(0, 0.1, -0.25); gunGroup.add(cylinder);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.4), mat.gunMetal); barrel.position.set(0, 0.18, -1.1); gunGroup.add(barrel);
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), mat.darkGrey); hammer.position.set(0, 0.35, 0.1); hammer.rotation.x = 0.3; gunGroup.add(hammer);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.1), mat.darkGrey); sight.position.set(0, 0.28, -1.75); gunGroup.add(sight);
    const muzzleLight = flashLight ? new THREE.PointLight(0xffaa00, 0, 10) : new THREE.Object3D(); muzzleLight.position.set(0, 0.2, -1.9); gunGroup.add(muzzleLight);
    gunGroup.userData = { muzzle: muzzleLight };
    return gunGroup;
}

// Player with detailed face
export function createPlayerMesh() {
    const group = new THREE.Group();
    const mesh = new THREE.Group(); mesh.rotation.y = Math.PI; group.add(mesh);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.coat); body.position.y = 2.5; body.castShadow = true; body.userData.slot = 'coat'; mesh.add(body);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 1.6), mat.belt); belt.position.y = 1.6; mesh.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), mat.gold); buckle.position.set(0, 0, -0.85); belt.add(buckle);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); leftLeg.position.set(-0.5, 0.75, 0); leftLeg.castShadow = true; leftLeg.name = 'leftLeg'; leftLeg.userData.slot = 'pants'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); rightLeg.position.set(0.5, 0.75, 0); rightLeg.castShadow = true; rightLeg.name = 'rightLeg'; rightLeg.userData.slot = 'pants'; mesh.add(rightLeg);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.coat); leftArm.position.set(-1.2, 2.5, 0); leftArm.castShadow = true; leftArm.name = 'leftArm'; leftArm.userData.slot = 'coat'; mesh.add(leftArm);
    const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(1.2, 3.25, 0); rightArmPivot.name = 'rightArm'; mesh.add(rightArmPivot);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.coat); rightArmMesh.position.set(0, -0.75, 0); rightArmMesh.userData.slot = 'coat'; rightArmPivot.add(rightArmMesh);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat.skin); rightHand.position.set(0, -1.5, 0); rightArmPivot.add(rightHand);

    const gunGroup = createRevolverMesh(true); gunGroup.position.set(0, -0.2, 0.2); gunGroup.rotation.set(-Math.PI / 2, 0, 0); rightHand.add(gunGroup);

    // Head
    const headGroup = new THREE.Group(); headGroup.position.y = 4.1; mesh.add(headGroup);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin); head.castShadow = true; headGroup.add(head);

    const eyeGeo = new THREE.BoxGeometry(0.25, 0.25, 0.1); const pupilGeo = new THREE.BoxGeometry(0.1, 0.1, 0.11);
    const leftEye = new THREE.Group(); leftEye.position.set(-0.3, 0.1, -0.6); 
    const leWhite = new THREE.Mesh(eyeGeo, toonMat({color: 0xffffff})); const lePupil = new THREE.Mesh(pupilGeo, toonMat({color: 0x000000})); lePupil.position.z = -0.05; leftEye.add(leWhite); leftEye.add(lePupil); headGroup.add(leftEye);
    const rightEye = leftEye.clone(); rightEye.position.set(0.3, 0.1, -0.6); headGroup.add(rightEye);

    const stacheGeo = new THREE.BoxGeometry(0.8, 0.15, 0.1); const stache = new THREE.Mesh(stacheGeo, mat.hat); stache.position.set(0, -0.25, -0.6); 
    const stacheDrop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.1), mat.hat); stacheDrop.position.set(-0.4, -0.1, 0); stache.add(stacheDrop);
    const stacheDropR = stacheDrop.clone(); stacheDropR.position.set(0.4, -0.1, 0); stache.add(stacheDropR); headGroup.add(stache);

    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), mat.hat); hatBrim.position.y = 0.5; hatBrim.userData.slot = 'hat'; headGroup.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), mat.hat); hatTop.position.y = 0.9; hatTop.userData.slot = 'hat'; headGroup.add(hatTop);

    group.userData = { muzzle: gunGroup.userData.muzzle, gunMesh: gunGroup, type: 'player' };
    addOutline(group);
    return group;
}

// Gunslinger with Bandolier
export function createGunslingerMesh() {
    const group = new THREE.Group();
    const mesh = new THREE.Group(); mesh.rotation.y = Math.PI; group.add(mesh);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.blackHat); body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    const poncho = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.7), mat.poncho); poncho.position.y = 3.2; mesh.add(poncho);

    const bandolier = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 1.6), mat.belt); bandolier.rotation.z = -0.6; bandolier.position.set(0, 0, -0.8); body.add(bandolier); 
    for(let i = -0.8; i < 0.8; i += 0.4) {
        const bullet = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.15), mat.gold); bullet.position.set(i, 0, -0.1); bandolier.add(bullet);
    }

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); leftLeg.position.set(-0.5, 0.75, 0); leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); rightLeg.position.set(0.5, 0.75, 0); rightLeg.name = 'rightLeg'; mesh.add(rightLeg);
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.blackHat); leftArm.position.set(-1.2, 2.5, 0); leftArm.name = 'leftArm'; mesh.add(leftArm);
    
    const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(1.2, 3.25, 0); rightArmPivot.name = 'rightArm'; mesh.add(rightArmPivot);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.blackHat); rightArmMesh.position.set(0, -0.75, 0); rightArmPivot.add(rightArmMesh);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat.skin); rightHand.position.set(0, -1.5, 0); rightArmPivot.add(rightHand);
    const gunGroup = createRevolverMesh(); gunGroup.position.set(0, -0.2, 0.2); gunGroup.rotation.set(-Math.PI / 2, 0, 0); rightHand.add(gunGroup); 

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin); head.position.y = 4.1; mesh.add(head);
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 1.25), mat.red); bandana.position.y = 3.9; mesh.add(bandana);
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.2), mat.red); knot.position.set(0, 3.9, 0.7); knot.rotation.z = Math.PI / 4; mesh.add(knot);

    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), mat.blackHat); hatBrim.position.y = 4.6; mesh.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.4), mat.blackHat); hatTop.position.y = 5.0; mesh.add(hatTop);

    group.userData = { muzzle: gunGroup.userData.muzzle, type: 'gunslinger' };
    addOutline(group);
    return group;
}

export function createEnemyMesh() {
    const group = new THREE.Group(); const mesh = new THREE.Group(); mesh.rotation.y = Math.PI; group.add(mesh);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.enemyCoat); body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 1.6), mat.belt); belt.position.y = 1.6; mesh.add(belt);
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), mat.belt); holster.position.set(1.1, 1.4, 0); mesh.add(holster);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); leftLeg.position.set(-0.5, 0.75, 0); leftLeg.castShadow = true; leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); rightLeg.position.set(0.5, 0.75, 0); rightLeg.castShadow = true; rightLeg.name = 'rightLeg'; mesh.add(rightLeg);
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.enemyCoat); leftArm.position.set(-1.2, 2.5, 0); leftArm.name = 'leftArm'; mesh.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.enemyCoat); rightArm.position.set(1.2, 2.5, 0); rightArm.name = 'rightArm'; mesh.add(rightArm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin); head.position.y = 4.1; mesh.add(head);
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 1.25), mat.red); bandana.position.y = 3.9; mesh.add(bandana);
    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), mat.blackHat); hatBrim.position.y = 4.6; mesh.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), mat.blackHat); hatTop.position.y = 5.0; mesh.add(hatTop);
    addOutline(group);
    return group;
}

export function createWolfMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 3), mat.wolfFur); body.position.y = 1.5; body.castShadow = true; group.add(body);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.5), mat.blackHat); mane.position.set(0, 1.6, 1.5); group.add(mane);
    const legGeo = new THREE.BoxGeometry(0.4, 1.5, 0.4);
    const fl = new THREE.Mesh(legGeo, mat.wolfFur); fl.position.set(-0.5, 0.75, 1.0); fl.name='fl'; group.add(fl);
    const fr = new THREE.Mesh(legGeo, mat.wolfFur); fr.position.set(0.5, 0.75, 1.0); fr.name='fr'; group.add(fr);
    const bl = new THREE.Mesh(legGeo, mat.wolfFur); bl.position.set(-0.5, 0.75, -1.0); bl.name='bl'; group.add(bl);
    const br = new THREE.Mesh(legGeo, mat.wolfFur); br.position.set(0.5, 0.75, -1.0); br.name='br'; group.add(br);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.4), mat.wolfFur); head.position.set(0, 2.5, 2.0); group.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat.blackHat); snout.position.set(0, 2.3, 2.9); group.add(snout);
    const earGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
    const leftEar = new THREE.Mesh(earGeo, mat.wolfFur); leftEar.position.set(-0.4, 3.2, 1.8); group.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, mat.wolfFur); rightEar.position.set(0.4, 3.2, 1.8); group.add(rightEar);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.5), mat.wolfFur); tail.position.set(0, 1.8, -1.8); tail.rotation.x = -0.5; group.add(tail);
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), mat.red); leftEye.position.set(-0.3, 2.7, 2.75); group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), mat.red); rightEye.position.set(0.3, 2.7, 2.75); group.add(rightEye);
    group.userData = { type: 'wolf' };
    addOutline(group);
    return group;
}

export function createWhiskeyMesh() {
    const group = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), mat.glass); bottle.position.y = 0.5; group.add(bottle);
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.52), mat.cork); label.position.y = 0.5; group.add(label);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), mat.glass); neck.position.y = 1.1; group.add(neck);
    const cork = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), mat.cork); cork.position.y = 1.3; group.add(cork);
    group.userData = { type: 'whiskey', floatOffset: Math.random() * 100 };
    addOutline(group);
    return group;
}


export function createCrate(scene, x, z) {
    const size = 3.5;
    const group = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat.wood);
    crate.position.set(0, size / 2, 0);
    crate.castShadow = true;
    crate.receiveShadow = true;
    group.add(crate);

    const detail = new THREE.Mesh(new THREE.BoxGeometry(size + 0.2, size * 0.1, 0.2), mat.coat);
    detail.position.set(0, size / 2, size / 2);
    detail.rotation.z = Math.PI / 4;
    group.add(detail);
    const detail2 = detail.clone();
    detail2.rotation.z = -Math.PI / 4;
    group.add(detail2);

    group.position.set(x, 0, z);
    placeProp(scene, group, { x, z, radius: size * 0.7, destructible: true, type: 'crate' });
}


export function createCactus(scene, x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), mat.green); trunk.position.y = 3; trunk.castShadow = true; group.add(trunk);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1), mat.green); arm.position.set(1, 4, 0); group.add(arm);
    const armUp = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat.green); armUp.position.set(2, 5, 0); group.add(armUp);
    group.position.set(x, 0, z);
    placeProp(scene, group, { x, z, radius: 1.5, destructible: true, type: 'cactus' });
}

export function createAmmoMesh() {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat.gold); box.position.y = 0.3; box.castShadow = true; group.add(box);
    const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.2), mat.darkGrey); strap1.position.y = 0.3; group.add(strap1);
    group.userData = { type: 'ammo', floatOffset: Math.random() * 100 };
    addOutline(group);
    return group;
}

// colors: optional { coat, poncho, bandana } hex values so each outlaw on the Wanted Road looks different.
export function createBossMesh(colors = null) {
    const coatMat = colors?.coat !== undefined ? toonMat({ color: colors.coat, roughness: 1.0 }) : mat.enemyCoat;
    const ponchoMat = colors?.poncho !== undefined ? toonMat({ color: colors.poncho, roughness: 1.0 }) : mat.blackHat;
    const bandanaMat = colors?.bandana !== undefined ? toonMat({ color: colors.bandana, roughness: 0.6 }) : mat.gold;
    const hatMat = colors?.hat !== undefined ? toonMat({ color: colors.hat }) : mat.blackHat;
    const group = new THREE.Group(); const mesh = new THREE.Group(); mesh.rotation.y = Math.PI; group.add(mesh);
    mesh.scale.set(1.5, 1.5, 1.5);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), coatMat); body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    const poncho = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.7), ponchoMat); poncho.position.y = 3.2; mesh.add(poncho);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); leftLeg.position.set(-0.5, 0.75, 0); leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); rightLeg.position.set(0.5, 0.75, 0); rightLeg.name = 'rightLeg'; mesh.add(rightLeg);
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), coatMat); leftArm.position.set(-1.2, 2.5, 0); leftArm.name = 'leftArm'; mesh.add(leftArm);
    const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(1.2, 3.25, 0); rightArmPivot.name = 'rightArm'; mesh.add(rightArmPivot);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), coatMat); rightArmMesh.position.set(0, -0.75, 0); rightArmPivot.add(rightArmMesh);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat.skin); rightHand.position.set(0, -1.5, 0); rightArmPivot.add(rightHand);
    const gunReal = createRevolverMesh(); gunReal.position.set(0, -0.2, 0.2); gunReal.rotation.set(-Math.PI / 2, 0, 0); rightHand.add(gunReal); 
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin); head.position.y = 4.1; mesh.add(head);
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 1.25), bandanaMat); bandana.position.y = 3.9; mesh.add(bandana);
    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), hatMat); hatBrim.position.y = 4.6; mesh.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.4), hatMat); hatTop.position.y = 5.0; mesh.add(hatTop);
    
    const hpGroup = new THREE.Group(); hpGroup.position.set(0, 7.5, 0); hpGroup.userData.noOutline = true; 
    const hpBg = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.1), mat.hpRed); hpGroup.add(hpBg);
    const hpFg = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.11), mat.hpGreen); hpFg.position.z = 0.05; hpFg.geometry.translate(1.5, 0, 0); hpFg.position.x = -1.5; hpGroup.add(hpFg);
    mesh.add(hpGroup);

    group.userData = { muzzle: gunReal.userData.muzzle, hpBar: hpFg, type: 'boss' };
    addOutline(group);
    return group;
}


export function createRock(scene, x, z) {
    const scale = 0.5 + Math.random();
    const geo = new THREE.DodecahedronGeometry(scale, 0); 
    const mesh = new THREE.Mesh(geo, Math.random() > 0.5 ? mat.stone : mat.sandStone);
    mesh.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    mesh.position.set(x, scale * 0.3, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    addObstacle({ mesh: mesh, x: x, z: z, radius: scale * 0.5, destructible: true, type: 'rock' });
}


export function createDeadTree(scene, x, z) {
    const group = new THREE.Group();
    const trunkHeight = 4 + Math.random() * 2;
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.6, trunkHeight, 0.6), mat.deadWood);
    trunk.position.y = trunkHeight / 2; trunk.rotation.z = (Math.random() - 0.5) * 0.3; trunk.castShadow = true; group.add(trunk);
    const branchCount = 2 + Math.floor(Math.random() * 3);
    for(let i=0; i<branchCount; i++) {
        const len = 1.5 + Math.random();
        const branch = new THREE.Mesh(new THREE.BoxGeometry(0.3, len, 0.3), mat.deadWood);
        branch.position.y = (trunkHeight * 0.4) + Math.random() * (trunkHeight * 0.5);
        branch.rotation.y = Math.random() * Math.PI * 2;
        branch.rotation.z = Math.PI / 3 + Math.random() * 0.5; branch.translateOnAxis(new THREE.Vector3(0,1,0), len/2);
        group.add(branch);
    }
    group.position.set(x, 0, z);
    placeProp(scene, group, { x, z, radius: 1.0, destructible: true, type: 'tree' });
}

// [DESTRUCTIBLE] Fence
export function createFence(scene, x, z, angle) {
    const group = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.4, 2.5, 0.4);
    const p1 = new THREE.Mesh(postGeo, mat.wood); p1.position.set(-1.5, 1.25, 0); p1.castShadow = true; group.add(p1);
    const p2 = new THREE.Mesh(postGeo, mat.wood); p2.position.set(1.5, 1.25, 0); p2.castShadow = true; group.add(p2);
    const railGeo = new THREE.BoxGeometry(3.4, 0.2, 0.1);
    const r1 = new THREE.Mesh(railGeo, mat.wood); r1.position.set(0, 1.8, 0); r1.rotation.z = (Math.random()-0.5)*0.1; group.add(r1);
    const r2 = new THREE.Mesh(railGeo, mat.wood); r2.position.set(0, 1.0, 0); r2.rotation.z = (Math.random()-0.5)*0.1; group.add(r2);
    group.position.set(x, 0, z); group.rotation.y = angle;
    placeProp(scene, group, { x, z, radius: 1.5, destructible: true, type: 'fence' });
}

// Recolour the player's outfit. colors: { hat, coat, pants } hex values (see cosmetics.js).
export function applyPlayerLoadout(playerGroup, colors) {
    playerGroup.traverse(part => {
        const slot = part.userData.slot;
        if(slot && colors[slot] !== undefined && !part.userData.isOutline) part.material = colorMat(colors[slot]);
    });
}

// ---------- New enemy models (one per Wanted Road stage) ----------
const colorMatCache = new Map();
function colorMat(hex) {
    if(!colorMatCache.has(hex)) colorMatCache.set(hex, toonMat({ color: hex }));
    return colorMatCache.get(hex);
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
}

// Held weapons. Each returns { group, muzzle } where muzzle is an empty marker at the barrel tip.
function createHeldWeapon(kind) {
    const group = new THREE.Group();
    const muzzle = new THREE.Object3D();
    if(kind === 'rifle') {
        group.add(box(0.22, 0.25, 2.8, mat.gunMetal, 0, 0.1, -1.1));
        group.add(box(0.3, 0.45, 1.0, mat.wood, 0, -0.05, 0.6));
        group.add(box(0.1, 0.18, 0.4, mat.darkGrey, 0, 0.3, -0.6));
        muzzle.position.set(0, 0.1, -2.6);
    } else if(kind === 'shotgun') {
        group.add(box(0.4, 0.26, 1.5, mat.gunMetal, 0, 0.1, -0.6));
        group.add(box(0.3, 0.45, 0.8, mat.wood, 0, -0.05, 0.45));
        muzzle.position.set(0, 0.1, -1.4);
    } else if(kind === 'dynamite') {
        group.add(box(0.28, 0.9, 0.28, colorMat(0xd32f2f), 0, 0.2, 0));
        group.add(box(0.06, 0.35, 0.06, colorMat(0xfff3c4), 0, 0.8, 0));
        muzzle.position.set(0, 0.9, 0);
    }
    group.add(muzzle);
    return { group, muzzle };
}

// A humanoid outlaw built like the original gunslinger (same part names, so animation works).
// opts: { type, coat, hat, bandana, pants, weapon, bulk, materials }
function createHumanoid(opts) {
    const m = opts.materials || ((hex) => colorMat(hex));
    const coat = m(opts.coat);
    const hat = m(opts.hat);
    const pants = m(opts.pants ?? 0x3f5a8a);
    const skin = opts.skinMat || mat.skin;
    const group = new THREE.Group();
    const mesh = new THREE.Group(); mesh.rotation.y = Math.PI; group.add(mesh);
    const bulk = opts.bulk ?? 1;
    mesh.scale.set(bulk, bulk, bulk);

    mesh.add(box(2, 2, 1.5, coat, 0, 2.5, 0));
    if(opts.vest !== undefined) mesh.add(box(2.1, 1.2, 1.6, m(opts.vest), 0, 2.8, 0));
    const leftLeg = box(0.6, 1.5, 0.8, pants, -0.5, 0.75, 0); leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = box(0.6, 1.5, 0.8, pants, 0.5, 0.75, 0); rightLeg.name = 'rightLeg'; mesh.add(rightLeg);
    const leftArm = box(0.5, 1.5, 0.5, coat, -1.2, 2.5, 0); leftArm.name = 'leftArm'; mesh.add(leftArm);
    const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(1.2, 3.25, 0); rightArmPivot.name = 'rightArm'; mesh.add(rightArmPivot);
    rightArmPivot.add(box(0.5, 1.5, 0.5, coat, 0, -0.75, 0));
    const rightHand = box(0.4, 0.4, 0.4, skin, 0, -1.5, 0); rightArmPivot.add(rightHand);
    const head = box(1.2, 1.2, 1.2, skin, 0, 4.1, 0); mesh.add(head);
    if(opts.bandana !== undefined) mesh.add(box(1.25, 0.6, 1.25, m(opts.bandana), 0, 3.9, 0));
    if(opts.hatStyle === 'bowler') {
        mesh.add(box(1.9, 0.2, 1.9, hat, 0, 4.6, 0));
        mesh.add(box(1.3, 0.7, 1.3, hat, 0, 5.0, 0));
    } else if(opts.hatStyle === 'sombrero') {
        mesh.add(box(3.2, 0.2, 3.2, hat, 0, 4.6, 0));
        mesh.add(box(1.2, 1.0, 1.2, hat, 0, 5.1, 0));
    } else if(opts.hatStyle === 'hood') {
        mesh.add(box(1.5, 1.5, 1.5, hat, 0, 4.3, 0.1));
    } else {
        mesh.add(box(2.4, 0.2, 2.4, hat, 0, 4.6, 0));
        mesh.add(box(1.4, 0.9, 1.4, hat, 0, 5.0, 0));
    }

    let muzzle = null;
    if(opts.weapon) {
        const weapon = createHeldWeapon(opts.weapon);
        weapon.group.position.set(0, -0.2, 0.2);
        weapon.group.rotation.set(-Math.PI / 2, 0, 0);
        rightHand.add(weapon.group);
        muzzle = weapon.muzzle;
    }
    group.userData = { muzzle, type: opts.type, shooter: !!opts.weapon && opts.weapon !== 'dynamite' };
    return group;
}

export function createRattlerMesh() {
    const group = new THREE.Group();
    const scales = colorMat(0x9e8a4a);
    const belly = colorMat(0x6d5a2a);
    const segments = [];
    for(let i = 0; i < 5; i++) {
        const seg = box(0.8 - i * 0.08, 0.5, 0.9, i % 2 ? belly : scales, 0, 0.3, -i * 0.8);
        seg.name = `seg${i}`;
        group.add(seg);
        segments.push(seg);
    }
    group.add(box(0.9, 0.55, 0.9, scales, 0, 0.35, 0.75));
    group.add(box(0.12, 0.12, 0.12, colorMat(0xffeb3b), -0.3, 0.55, 1.1));
    group.add(box(0.12, 0.12, 0.12, colorMat(0xffeb3b), 0.3, 0.55, 1.1));
    group.add(box(0.3, 0.4, 0.4, colorMat(0xe0cfa0), 0, 0.4, -4.1));
    group.userData = { type: 'rattler', segments };
    addOutline(group);
    return group;
}

// Aim laser: a thin red beam along the enemy's facing (+Z), stretched to the player while aiming.
export function addAimLaser(group, { width = 0.12, height = 2.6 } = {}) {
    const laser = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.7, depthWrite: false }));
    laser.geometry.translate(0, 0, 0.5);
    laser.position.set(0, height, 0);
    laser.visible = false;
    laser.userData.noOutline = true;
    group.add(laser);
    group.userData.laser = laser;
    return laser;
}

export function createRiflemanMesh() {
    const group = createHumanoid({ type: 'rifleman', coat: 0x2f5d8a, hat: 0x3b2a1a, bandana: 0xe0e0e0, weapon: 'rifle', hatStyle: 'bowler' });
    addAimLaser(group);
    addOutline(group);
    return group;
}

export function createDynamiterMesh() {
    const group = createHumanoid({ type: 'dynamiter', coat: 0x8d6e63, vest: 0xd84315, hat: 0x5d4037, bandana: 0x212121, weapon: 'dynamite', hatStyle: 'bowler' });
    addOutline(group);
    return group;
}

export function createBruteMesh() {
    const group = createHumanoid({ type: 'brute', coat: 0x5d4037, vest: 0x78909c, hat: 0x3e2723, bandana: 0x8d0000, bulk: 1.45 });
    addOutline(group);
    return group;
}

export function createDuelistMesh() {
    const group = createHumanoid({ type: 'duelist', coat: 0x4a148c, hat: 0x111111, bandana: 0xffc107, weapon: 'shotgun', hatStyle: 'sombrero' });
    addOutline(group);
    return group;
}

export function createGhostMesh() {
    // Each ghost fades independently, so it gets its own transparent materials.
    const own = hex => new THREE.MeshToonMaterial({ color: hex, gradientMap: TOON_GRADIENT, transparent: true, opacity: 1, emissive: new THREE.Color(hex).multiplyScalar(0.25) });
    const group = createHumanoid({ type: 'ghost', coat: 0xcfd8dc, hat: 0xeceff1, pants: 0xb0bec5, bandana: 0x6a1b9a, materials: own, skinMat: own(0xe3f2fd), weapon: null, hatStyle: 'hood' });
    const materials = new Set();
    group.traverse(o => { if(o.isMesh && o.material.transparent) materials.add(o.material); });
    group.userData.fadeMaterials = [...materials];
    addOutline(group);
    return group;
}

export function createRiderMesh() {
    const group = new THREE.Group();
    const horse = colorMat(0x6d4c41);
    const mane = colorMat(0x2b1d16);
    group.add(box(1.5, 1.5, 3.4, horse, 0, 2.2, 0));
    group.add(box(1.0, 1.4, 1.1, horse, 0, 3.2, 1.9));
    group.add(box(0.9, 0.8, 1.2, horse, 0, 3.1, 2.8));
    group.add(box(0.3, 1.2, 1.4, mane, 0, 3.5, 1.5));
    const legs = [['fl', -0.5, 1.2], ['fr', 0.5, 1.2], ['bl', -0.5, -1.2], ['br', 0.5, -1.2]];
    for(const [name, x, z] of legs) {
        const leg = box(0.4, 1.6, 0.4, horse, x, 0.8, z);
        leg.name = name;
        group.add(leg);
    }
    const rider = createHumanoid({ type: 'rider-person', coat: 0xbf360c, hat: 0x3e2723, bandana: 0x1b5e20, weapon: null });
    rider.scale.setScalar(0.72);
    rider.position.set(0, 2.1, -0.2);
    group.add(rider);
    group.userData = { type: 'rider', quadruped: true };
    addOutline(group);
    return group;
}
