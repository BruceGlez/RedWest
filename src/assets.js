import * as THREE from 'three';
import { obstacles } from './state.js';

const mat = {
    // ROUGH TEXTURES (Cloth, Skin, Wood)
    skin: new THREE.MeshStandardMaterial({ color: 0xf5d7b8, roughness: 1.0 }),
    coat: new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 1.0 }),
    enemyCoat: new THREE.MeshStandardMaterial({ color: 0x5a2c1c, roughness: 1.0 }),
    poncho: new THREE.MeshStandardMaterial({ color: 0x4a5d23, roughness: 1.0 }),
    hat: new THREE.MeshStandardMaterial({ color: 0x42210b, roughness: 1.0 }),
    blackHat: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x2e1a0f, roughness: 0.8 }),
    red: new THREE.MeshStandardMaterial({ color: 0x8a0303, roughness: 1.0 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1.0 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 }),
    cork: new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 1.0 }),
    
    // SHINY METALS (Gun, Gold, Steel)
    gunMetal: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 }), 
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.7 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.5 }), 
    darkGrey: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.8 }),
    
    // SPECIAL
    glass: new THREE.MeshStandardMaterial({ color: 0x8B4513, transparent: true, opacity: 0.8, roughness: 0.1 }),
    hpRed: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    hpGreen: new THREE.MeshBasicMaterial({ color: 0x00ff00 })
};


function createRevolverMesh() {
    const gunGroup = new THREE.Group();

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.35), mat.wood);
    grip.position.set(0, -0.3, 0.2); 
    grip.rotation.x = -0.4; 
    gunGroup.add(grip);

    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.5), mat.gunMetal);
    frame.position.set(0, 0.1, -0.2);
    gunGroup.add(frame);

    // Cylinder
    const cylinder = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.5), mat.darkSteel);
    cylinder.position.set(0, 0.1, -0.25);
    gunGroup.add(cylinder);

    // Barrel (Points -Z)
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.4), mat.gunMetal);
    barrel.position.set(0, 0.18, -1.1);
    gunGroup.add(barrel);

    // Hammer
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), mat.darkGrey);
    hammer.position.set(0, 0.35, 0.1);
    hammer.rotation.x = 0.3;
    gunGroup.add(hammer);

    // Sight
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.1), mat.darkGrey);
    sight.position.set(0, 0.28, -1.75); 
    gunGroup.add(sight);

    // Muzzle Flash
    const muzzleLight = new THREE.PointLight(0xffaa00, 0, 10);
    muzzleLight.position.set(0, 0.2, -1.9);
    gunGroup.add(muzzleLight);

    gunGroup.userData = { muzzle: muzzleLight };
    return gunGroup;
}

// src/assets.js - Partial Update for Player
export function createPlayerMesh() {
    const group = new THREE.Group();
    
    // Wrapper Rotated 180
    const mesh = new THREE.Group();
    mesh.rotation.y = Math.PI;
    group.add(mesh);

    // Body & Clothes
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.coat);
    body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 1.6), mat.belt);
    belt.position.y = 1.6; mesh.add(belt);
    // Gold Belt Buckle (Moved to -Z)
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), mat.gold);
    buckle.position.set(0, 0, -0.85); // [FIXED] Negative Z
    belt.add(buckle);

    // Legs
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    leftLeg.position.set(-0.5, 0.75, 0); leftLeg.castShadow = true; leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    rightLeg.position.set(0.5, 0.75, 0); rightLeg.castShadow = true; rightLeg.name = 'rightLeg'; mesh.add(rightLeg);

    // Arms
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.coat);
    leftArm.position.set(-1.2, 2.5, 0); leftArm.castShadow = true; leftArm.name = 'leftArm'; mesh.add(leftArm);
    
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(1.2, 3.25, 0); 
    rightArmPivot.name = 'rightArm'; 
    mesh.add(rightArmPivot);

    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.coat);
    rightArmMesh.position.set(0, -0.75, 0); 
    rightArmPivot.add(rightArmMesh);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat.skin);
    rightHand.position.set(0, -1.5, 0); 
    rightArmPivot.add(rightHand);

    // Gun
    const gunGroup = createRevolverMesh();
    gunGroup.position.set(0, -0.2, 0.2); 
    gunGroup.rotation.set(-Math.PI / 2, 0, 0); 
    rightHand.add(gunGroup); 

    // --- DETAILED HEAD ---
    const headGroup = new THREE.Group();
    headGroup.position.y = 4.1;
    mesh.add(headGroup);

    // 1. Head Shape
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin);
    head.castShadow = true; 
    headGroup.add(head);

    // 2. Eyes (Moved to -Z)
    const eyeGeo = new THREE.BoxGeometry(0.25, 0.25, 0.1);
    const pupilGeo = new THREE.BoxGeometry(0.1, 0.1, 0.11);
    
    const leftEye = new THREE.Group();
    // [FIXED] Z is now -0.6 (Front of face)
    leftEye.position.set(-0.3, 0.1, -0.6); 
    const leWhite = new THREE.Mesh(eyeGeo, new THREE.MeshStandardMaterial({color: 0xffffff}));
    const lePupil = new THREE.Mesh(pupilGeo, new THREE.MeshStandardMaterial({color: 0x000000}));
    // Pupil pushed slightly forward in -Z direction
    lePupil.position.z = -0.05; 
    leftEye.add(leWhite); leftEye.add(lePupil);
    headGroup.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.set(0.3, 0.1, -0.6); // [FIXED]
    headGroup.add(rightEye);

    // 3. Handlebar Mustache (Moved to -Z)
    const stacheGeo = new THREE.BoxGeometry(0.8, 0.15, 0.1);
    const stache = new THREE.Mesh(stacheGeo, mat.hat); 
    // [FIXED] Z is now -0.6
    stache.position.set(0, -0.25, -0.6); 
    // Droopy bits
    const stacheDrop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.1), mat.hat);
    stacheDrop.position.set(-0.4, -0.1, 0);
    stache.add(stacheDrop);
    const stacheDropR = stacheDrop.clone();
    stacheDropR.position.set(0.4, -0.1, 0);
    stache.add(stacheDropR);
    headGroup.add(stache);

    // 4. Hat
    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), mat.hat);
    hatBrim.position.y = 0.5; 
    headGroup.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), mat.hat);
    hatTop.position.y = 0.9; 
    headGroup.add(hatTop);

    group.userData = { muzzle: gunGroup.userData.muzzle, gunMesh: gunGroup, type: 'player' };
    return group;
}

// src/assets.js - Partial Update for Gunslinger
export function createGunslingerMesh() {
    const group = new THREE.Group();
    
    // Wrapper Rotated 180
    const mesh = new THREE.Group();
    mesh.rotation.y = Math.PI;
    group.add(mesh);

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.blackHat);
    body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    
    // Poncho
    const poncho = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.7), mat.poncho);
    poncho.position.y = 3.2; mesh.add(poncho);

    // --- BANDOLIER (Moved to -Z to be on Front) ---
    const bandolier = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 1.6), mat.belt);
    bandolier.rotation.z = -0.6; 
    // [FIXED] Z changed from 0.05 to -0.05 (slightly forward) relative to body center? 
    // Actually body depth is 1.5 (front is at -0.75).
    // Let's attach it to the body surface:
    bandolier.position.set(0, 0, -0.8); // [FIXED] Pushed to front
    body.add(bandolier); 

    // Add Bullets
    for(let i = -0.8; i < 0.8; i += 0.4) {
        const bullet = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.15), mat.gold);
        // Bullets stick out further in -Z
        bullet.position.set(i, 0, -0.1); 
        bandolier.add(bullet);
    }

    // Legs & Arms (Standard)
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    leftLeg.position.set(-0.5, 0.75, 0); leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    rightLeg.position.set(0.5, 0.75, 0); rightLeg.name = 'rightLeg'; mesh.add(rightLeg);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.blackHat);
    leftArm.position.set(-1.2, 2.5, 0); leftArm.name = 'leftArm'; mesh.add(leftArm);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(1.2, 3.25, 0); 
    rightArmPivot.name = 'rightArm'; 
    mesh.add(rightArmPivot);

    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.blackHat);
    rightArmMesh.position.set(0, -0.75, 0); 
    rightArmPivot.add(rightArmMesh);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat.skin);
    rightHand.position.set(0, -1.5, 0); 
    rightArmPivot.add(rightHand);

    const gunGroup = createRevolverMesh();
    gunGroup.position.set(0, -0.2, 0.2);
    gunGroup.rotation.set(-Math.PI / 2, 0, 0);
    rightHand.add(gunGroup); 

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin);
    head.position.y = 4.1; mesh.add(head);
    
    // Bandana
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 1.25), mat.red);
    bandana.position.y = 3.9; mesh.add(bandana);
    
    // Bandana Knot (On the BACK, which is +Z)
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.2), mat.red);
    knot.position.set(0, 3.9, 0.7); // [FIXED] +Z is Back
    knot.rotation.z = Math.PI / 4;
    mesh.add(knot);

    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), mat.blackHat);
    hatBrim.position.y = 4.6; mesh.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.4), mat.blackHat);
    hatTop.position.y = 5.0; mesh.add(hatTop);

    group.userData = { muzzle: gunGroup.userData.muzzle, type: 'gunslinger' };
    return group;
}

export function createEnemyMesh() {
    const group = new THREE.Group();
    // [FIX] Wrapper Rotated 180
    const mesh = new THREE.Group();
    mesh.rotation.y = Math.PI;
    group.add(mesh);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.enemyCoat);
    body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 1.6), mat.belt);
    belt.position.y = 1.6; mesh.add(belt);
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), mat.belt);
    holster.position.set(1.1, 1.4, 0); mesh.add(holster);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    leftLeg.position.set(-0.5, 0.75, 0); leftLeg.castShadow = true; leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    rightLeg.position.set(0.5, 0.75, 0); rightLeg.castShadow = true; rightLeg.name = 'rightLeg'; mesh.add(rightLeg);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.enemyCoat);
    leftArm.position.set(-1.2, 2.5, 0); leftArm.name = 'leftArm'; mesh.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.enemyCoat);
    rightArm.position.set(1.2, 2.5, 0); rightArm.name = 'rightArm'; mesh.add(rightArm);

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin);
    head.position.y = 4.1; mesh.add(head);
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 1.25), mat.red);
    bandana.position.y = 3.9; mesh.add(bandana);
    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), mat.blackHat);
    hatBrim.position.y = 4.6; mesh.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), mat.blackHat);
    hatTop.position.y = 5.0; mesh.add(hatTop);

    return group;
}

export function createWolfMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 3), mat.darkGrey);
    body.position.y = 1.5; body.castShadow = true; group.add(body);

    const mane = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.5), mat.blackHat);
    mane.position.set(0, 1.6, 1.5); group.add(mane);

    const legGeo = new THREE.BoxGeometry(0.4, 1.5, 0.4);
    const fl = new THREE.Mesh(legGeo, mat.darkGrey); fl.position.set(-0.5, 0.75, 1.0); fl.name='fl'; group.add(fl);
    const fr = new THREE.Mesh(legGeo, mat.darkGrey); fr.position.set(0.5, 0.75, 1.0); fr.name='fr'; group.add(fr);
    const bl = new THREE.Mesh(legGeo, mat.darkGrey); bl.position.set(-0.5, 0.75, -1.0); bl.name='bl'; group.add(bl);
    const br = new THREE.Mesh(legGeo, mat.darkGrey); br.position.set(0.5, 0.75, -1.0); br.name='br'; group.add(br);

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.4), mat.darkGrey);
    head.position.set(0, 2.5, 2.0); group.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat.blackHat);
    snout.position.set(0, 2.3, 2.9); group.add(snout);

    const earGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
    const leftEar = new THREE.Mesh(earGeo, mat.darkGrey); leftEar.position.set(-0.4, 3.2, 1.8); group.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, mat.darkGrey); rightEar.position.set(0.4, 3.2, 1.8); group.add(rightEar);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.5), mat.darkGrey);
    tail.position.set(0, 1.8, -1.8); tail.rotation.x = -0.5; group.add(tail);
    
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), mat.red);
    leftEye.position.set(-0.3, 2.7, 2.75); group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), mat.red);
    rightEye.position.set(0.3, 2.7, 2.75); group.add(rightEye);
    
    group.userData = { type: 'wolf' };
    return group;
}

export function createWhiskeyMesh() {
    const group = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), mat.glass);
    bottle.position.y = 0.5; group.add(bottle);
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.52), mat.cork);
    label.position.y = 0.5; group.add(label);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), mat.glass);
    neck.position.y = 1.1; group.add(neck);
    const cork = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), mat.cork);
    cork.position.y = 1.3; group.add(cork);
    group.userData = { type: 'whiskey', floatOffset: Math.random() * 100 };
    return group;
}

export function createCrate(scene, x, z) {
    const size = 3.5;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat.wood);
    crate.position.set(x, size/2, z);
    crate.castShadow = true; crate.receiveShadow = true;
    
    const detail = new THREE.Mesh(new THREE.BoxGeometry(size+0.2, size*0.1, 0.2), mat.coat);
    detail.position.set(x, size/2, z+size/2); detail.rotation.z = Math.PI/4; scene.add(detail);
    const detail2 = new THREE.Mesh(new THREE.BoxGeometry(size+0.2, size*0.1, 0.2), mat.coat);
    detail2.position.set(x, size/2, z+size/2); detail2.rotation.z = -Math.PI/4; scene.add(detail2);

    scene.add(crate);
    obstacles.push({ mesh: crate, x: x, z: z, radius: size * 0.7 });
}

export function createCactus(scene, x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), mat.green);
    trunk.position.y = 3; trunk.castShadow = true; group.add(trunk);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1), mat.green);
    arm.position.set(1, 4, 0); group.add(arm);
    const armUp = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat.green);
    armUp.position.set(2, 5, 0); group.add(armUp);
    
    group.position.set(x, 0, z);
    scene.add(group);
    obstacles.push({ mesh: group, x: x, z: z, radius: 1.5 });
}

// [NEW] Visual for Triple Shot Powerup
export function createAmmoMesh() {
    const group = new THREE.Group();
    // A golden crate
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat.gold);
    box.position.y = 0.3; 
    box.castShadow = true;
    group.add(box);

    // Detail: Straps
    const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.2), mat.darkGrey);
    strap1.position.y = 0.3; 
    group.add(strap1);

    group.userData = { type: 'ammo', floatOffset: Math.random() * 100 };
    return group;
}

export function createBossMesh() {
    const group = new THREE.Group();
    
    // Wrapper Rotated 180
    const mesh = new THREE.Group();
    mesh.rotation.y = Math.PI;
    group.add(mesh);

    // Scale him up!
    mesh.scale.set(1.5, 1.5, 1.5);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), mat.enemyCoat);
    body.position.y = 2.5; body.castShadow = true; mesh.add(body);
    const poncho = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.7), mat.blackHat); 
    poncho.position.y = 3.2; mesh.add(poncho);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    leftLeg.position.set(-0.5, 0.75, 0); leftLeg.name = 'leftLeg'; mesh.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.8), mat.pants);
    rightLeg.position.set(0.5, 0.75, 0); rightLeg.name = 'rightLeg'; mesh.add(rightLeg);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.enemyCoat);
    leftArm.position.set(-1.2, 2.5, 0); leftArm.name = 'leftArm'; mesh.add(leftArm);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(1.2, 3.25, 0); 
    rightArmPivot.name = 'rightArm'; 
    mesh.add(rightArmPivot);

    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), mat.enemyCoat);
    rightArmMesh.position.set(0, -0.75, 0); 
    rightArmPivot.add(rightArmMesh);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat.skin);
    rightHand.position.set(0, -1.5, 0); 
    rightArmPivot.add(rightHand);

    // Gun
    // (Assuming createRevolverMesh is available in this file scope)
    // If you get an error here, make sure createRevolverMesh is defined above this function
    const gunGroup = new THREE.Group(); // Placeholder if helper not copied, but in your file it is there.
    
    // Re-paste createRevolverMesh if you lost it, otherwise assume it calls the helper:
    // This part assumes you kept the helper function in the file.
    const gunReal = createRevolverMesh();
    gunReal.position.set(0, -0.2, 0.2);
    gunReal.rotation.set(-Math.PI / 2, 0, 0);
    rightHand.add(gunReal); 

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat.skin);
    head.position.y = 4.1; mesh.add(head);
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 1.25), mat.gold);
    bandana.position.y = 3.9; mesh.add(bandana);
    
    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), mat.blackHat);
    hatBrim.position.y = 4.6; mesh.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.4), mat.blackHat);
    hatTop.position.y = 5.0; mesh.add(hatTop);

    // [NEW] Health Bar Visuals
    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, 7.5, 0); // Float above hat
    // 1. Red Background
    const hpBg = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.1), mat.hpRed);
    hpGroup.add(hpBg);
    // 2. Green Foreground
    const hpFg = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.11), mat.hpGreen);
    hpFg.position.z = 0.05; // Slightly in front
    
    // Trick: Move geometry anchor to the left edge so it scales from left-to-right
    hpFg.geometry.translate(1.5, 0, 0); 
    hpFg.position.x = -1.5; 

    hpGroup.add(hpFg);
    mesh.add(hpGroup);

    // Store reference to gun and HP bar
    group.userData = { muzzle: gunReal.userData.muzzle, hpBar: hpFg, type: 'boss' };
    return group;
}