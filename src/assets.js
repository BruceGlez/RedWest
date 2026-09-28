import * as THREE from 'three';
import { obstacles } from './state.js';
import { markObstacleGridDirty } from './physics.js';

function addObstacle(obstacle) {
    obstacles.push(obstacle);
    markObstacleGridDirty();
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

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1a0d05, side: THREE.BackSide });
const OUTLINE_WIDTH = 0.05;

// Inverted-hull outlines: a slightly larger back-face copy of each part, drawn in dark brown.
// Tiny parts (eyes, gun details) are skipped to save draw calls on phones.
function addOutline(root) {
    const meshes = [];
    (function collect(object) {
        if(object.userData.noOutline) return;
        if(object.isMesh && !object.userData.isOutline) meshes.push(object);
        for(const child of object.children) collect(child);
    })(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    for(const mesh of meshes) {
        const geometry = mesh.geometry;
        if(!geometry.boundingBox) geometry.computeBoundingBox();
        geometry.boundingBox.getSize(size);
        if(Math.max(size.x, size.y, size.z) < 0.25) continue;
        geometry.boundingBox.getCenter(center);
        const outline = new THREE.Mesh(geometry, OUTLINE_MAT);
        outline.userData.isOutline = true;
        outline.raycast = () => {};
        const sx = 1 + (2 * OUTLINE_WIDTH / Math.max(size.x, 0.05));
        const sy = 1 + (2 * OUTLINE_WIDTH / Math.max(size.y, 0.05));
        const sz = 1 + (2 * OUTLINE_WIDTH / Math.max(size.z, 0.05));
        outline.scale.set(sx, sy, sz);
        outline.position.set(center.x * (1 - sx), center.y * (1 - sy), center.z * (1 - sz));
        mesh.add(outline);
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

function createRevolverMesh() {
    const gunGroup = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.35), mat.wood); grip.position.set(0, -0.3, 0.2); grip.rotation.x = -0.4; gunGroup.add(grip);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.5), mat.gunMetal); frame.position.set(0, 0.1, -0.2); gunGroup.add(frame);
    const cylinder = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.5), mat.darkSteel); cylinder.position.set(0, 0.1, -0.25); gunGroup.add(cylinder);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.4), mat.gunMetal); barrel.position.set(0, 0.18, -1.1); gunGroup.add(barrel);
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), mat.darkGrey); hammer.position.set(0, 0.35, 0.1); hammer.rotation.x = 0.3; gunGroup.add(hammer);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.1), mat.darkGrey); sight.position.set(0, 0.28, -1.75); gunGroup.add(sight);
    const muzzleLight = new THREE.PointLight(0xffaa00, 0, 10); muzzleLight.position.set(0, 0.2, -1.9); gunGroup.add(muzzleLight);
    gunGroup.userData = { muzzle: muzzleLight };
    return gunGroup;
}

// Player with detailed face
export function createPlayerMesh() {
    const group = new THREE.Group();
    const mesh = new THREE.Group(); mesh.rotation.y = Math.PI; group.add(mesh);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.coat); body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 1.6), mat.belt); belt.position.y = 1.6; mesh.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), mat.gold); buckle.position.set(0, 0, -0.85); belt.add(buckle);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); leftLeg.position.set(-0.5, 0.75, 0); leftLeg.castShadow = true; leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants); rightLeg.position.set(0.5, 0.75, 0); rightLeg.castShadow = true; rightLeg.name = 'rightLeg'; mesh.add(rightLeg);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.coat); leftArm.position.set(-1.2, 2.5, 0); leftArm.castShadow = true; leftArm.name = 'leftArm'; mesh.add(leftArm);
    const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(1.2, 3.25, 0); rightArmPivot.name = 'rightArm'; mesh.add(rightArmPivot);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.coat); rightArmMesh.position.set(0, -0.75, 0); rightArmPivot.add(rightArmMesh);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat.skin); rightHand.position.set(0, -1.5, 0); rightArmPivot.add(rightHand);

    const gunGroup = createRevolverMesh(); gunGroup.position.set(0, -0.2, 0.2); gunGroup.rotation.set(-Math.PI / 2, 0, 0); rightHand.add(gunGroup); 

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

    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), mat.hat); hatBrim.position.y = 0.5; headGroup.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), mat.hat); hatTop.position.y = 0.9; headGroup.add(hatTop);

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
    scene.add(group);
    addObstacle({ mesh: group, x: x, z: z, radius: size * 0.7, destructible: true, type: 'crate' });
}


export function createCactus(scene, x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), mat.green); trunk.position.y = 3; trunk.castShadow = true; group.add(trunk);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1), mat.green); arm.position.set(1, 4, 0); group.add(arm);
    const armUp = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat.green); armUp.position.set(2, 5, 0); group.add(armUp);
    group.position.set(x, 0, z); scene.add(group);
    addObstacle({ mesh: group, x: x, z: z, radius: 1.5, destructible: true, type: 'cactus' });
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
    group.position.set(x, 0, z); scene.add(group);
    addObstacle({ mesh: group, x: x, z: z, radius: 1.0, destructible: true, type: 'tree' });
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
    group.position.set(x, 0, z); group.rotation.y = angle; scene.add(group);
    addObstacle({ mesh: group, x: x, z: z, radius: 1.5, destructible: true, type: 'fence' });
}
