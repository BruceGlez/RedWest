import * as THREE from 'three';
import { createBossMesh, createWolfMesh, createGunslingerMesh, createEnemyMesh, createRattlerMesh, createRiflemanMesh,
    createDynamiterMesh, createBruteMesh, createRiderMesh, createDuelistMesh, createGhostMesh, createKniferMesh, createTrooperMesh, createBatMesh, createCrawlerMesh, createStonekinMesh, createWraithMesh, addAimLaser } from './assets.js';
import { ENEMY_TYPES } from './enemyTypes.js';
import { createExplosion } from './particleSystem.js';
import { addScorch } from './decals.js';
import { addShake, haptic } from './feedback.js';
import { gameState, enemies, playerStats } from './state.js';
import { checkCollision } from './physics.js';
import { activeFloor, isOpen, spawnPoint, steerTarget, AGGRO_DISTANCE } from './mineMap.js';
import { mine } from './mine.js';
import { MINE_MONSTERS, mineHpBonus } from './mineMonsters.js';
import { playSound } from './audio.js';
import { animateCharacter } from './animation.js';
import { spawnBullet } from './bulletSystem.js';
import { applyOutlawToEnemy, getOutlaw } from './outlaws.js';
import { loadedCharacterModel, createCharacterInstance } from './characterModels.js';

/**
 * Handles enemy shooting logic (creation of bullets and sound)
 */
export function enemyShoot(enemy, playerPos, scene) {
    const muzzle = enemy.userData.muzzle; 
    if(!muzzle) return; 

    playSound('enemy-shot');
    enemy.userData.shotAt = Date.now() / 1000; // same clock as updateEnemies
    const isBoss = (enemy.userData.type === 'boss');
    const shotCount = isBoss ? 3 : 1;
    const aimSpread = enemy.userData.aimSpread ?? 2.0;
    const projectileSpeed = enemy.userData.projectileSpeed ?? 40;

    for(let i = 0; i < shotCount; i++) {
        const gunPos = new THREE.Vector3(); 
        muzzle.getWorldPosition(gunPos); 
        
        // Add slight inaccuracy/spread
        const target = playerPos.clone(); 
        target.x += (Math.random() - 0.5) * aimSpread; 
        target.z += (Math.random() - 0.5) * aimSpread; 
        target.y = 2.5; 
        
        const dir = new THREE.Vector3().subVectors(target, gunPos).normalize();
        
        // Apply spread for shotgun/boss attacks
        if(shotCount > 1) {
            dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 1) * 0.15);
        }
        
        spawnBullet(scene, 'enemy', gunPos, dir.multiplyScalar(projectileSpeed));
    }

    // Muzzle flash visual
    muzzle.intensity = 5; 
    setTimeout(() => muzzle.intensity = 0, 50);
}

/**
 * Spawns an enemy of the requested type at a safe distance from the player
 */
const NEW_TYPE_MESHES = {
    rattler: createRattlerMesh,
    rifleman: createRiflemanMesh,
    dynamiter: createDynamiterMesh,
    brute: createBruteMesh,
    rider: createRiderMesh,
    duelist: createDuelistMesh,
    ghost: createGhostMesh,
    knifer: createKniferMesh,
    trooper: createTrooperMesh
};

// The monsters that live only in the Hollow Claim (src/mineMonsters.js).
const MINE_MESHES = { bat: createBatMesh, crawler: createCrawlerMesh, stonekin: createStonekinMesh, wraith: createWraithMesh };

// Per-type shooting numbers (outlaw modifiers are applied on top).
const SHOT_PROFILE = {
    rifleman: { cooldown: 3.4, projectileSpeed: 85, aimSpread: 0 },
    duelist: { cooldown: 2.4, projectileSpeed: 44, aimSpread: 0 },
    dynamiter: { cooldown: 3.4, projectileSpeed: 0, aimSpread: 0 },
    knifer: { cooldown: 2.2, projectileSpeed: 38, aimSpread: 0 },
    trooper: { cooldown: 3.0, projectileSpeed: 60, aimSpread: 0 }
};

export function spawnEnemy(scene, playerPos, requestedType = null, at = null) {
    let enemy, speed, type, hp;
    const randomScale = 0.85 + Math.random() * 0.3;
    const wave = gameState.waveNumber;

    // The wave director in gameLoop.js always chooses the type.
    const spawnType = requestedType || 'bandit';
    // A mine monster may borrow another monster's look (and its shot numbers) with `look` until it has its own model (src/mineMonsters.js).
    const look = MINE_MONSTERS[spawnType]?.look ?? spawnType;

    const bossStyle = spawnType === 'boss' ? getOutlaw(gameState.outlawIndex).signature.style : null;
    if (spawnType === 'boss') { 
        enemy = createBossMesh(getOutlaw(gameState.outlawIndex).colors); 
        enemy.scale.setScalar(bossStyle === 'brothers' ? 1.0 : 1.2); 
        speed = 3.2 + Math.min(wave * 0.08, 1.5); 
        type = 'boss'; 
        hp = 12 + Math.floor(wave * 1.5); 
    } else if (spawnType === 'wolf') { 
        enemy = createWolfMesh(); 
        enemy.scale.setScalar(randomScale); 
        speed = 10 + Math.min(wave * 0.7, 8); 
        type = 'wolf'; 
        hp = 1;
    } else if (spawnType === 'gunslinger') { 
        enemy = createGunslingerMesh(); 
        enemy.scale.setScalar(randomScale); 
        speed = 5 + Math.min(wave * 0.4, 4); 
        type = 'gunslinger'; 
        hp = Math.max(1, Math.floor(wave / 5));
    } else if (MINE_MESHES[look]) {
        const def = MINE_MONSTERS[spawnType];
        enemy = MINE_MESHES[look]();
        if(!def.heavy) enemy.scale.setScalar(0.9 + Math.random() * 0.2);
        speed = def.speed * (1 + Math.min(wave * 0.05, 0.3));
        type = spawnType;
        hp = def.hp;
    } else if (NEW_TYPE_MESHES[look]) {
        const def = ENEMY_TYPES[spawnType] ?? MINE_MONSTERS[spawnType];
        enemy = NEW_TYPE_MESHES[look]();
        if(!def.heavy) enemy.scale.setScalar(0.9 + Math.random() * 0.2);
        speed = def.speed * (1 + Math.min(wave * 0.05, 0.3));
        type = spawnType;
        hp = def.hp;
    } else { 
        enemy = createEnemyMesh(); 
        enemy.scale.setScalar(randomScale); 
        speed = 7 + Math.min(wave * 0.5, 6); 
        type = 'bandit'; 
        hp = 1; 
    }

    // Find a valid position (not inside an obstacle). In the mine they come out of the tunnel mouths instead (src/mineMap.js).
    let ex, ez, attempts = 0;
    const cave = activeFloor();
    if(at) {
        ({ x: ex, z: ez } = at); // the mine puts each monster in its own chamber (src/mineMonsters.js, planNode)
    } else if(cave) {
        ({ x: ex, z: ez } = spawnPoint(cave, playerPos));
    } else {
        do {
            const angle = Math.random() * Math.PI * 2; 
            const dist = 50 + Math.random() * 20; // Spawn 50-70 units away
            ex = playerPos.x + Math.cos(angle) * dist;
            ez = playerPos.z + Math.sin(angle) * dist;
            attempts++;
        } while(checkCollision(ex, ez, 2.0) && attempts < 10);
    }

    enemy.position.set(ex, 0, ez);
    
    // Initialize enemy state
    // The current Wanted Road outlaw sets stage difficulty and signature threats.
    const shot = SHOT_PROFILE[look];
    const stats = applyOutlawToEnemy(type, {
        speed, hp,
        shootCooldown: shot ? shot.cooldown + Math.random() * 0.6 : 2.0 + Math.random(),
        projectileSpeed: shot ? shot.projectileSpeed : 40,
        aimSpread: shot ? shot.aimSpread : 2.0
    }, gameState.outlawIndex);
    const def = ENEMY_TYPES[type] ?? MINE_MONSTERS[type];
    const depthHp = mine.enabled && stats.hp > 1 ? mineHpBonus(mine.floor) : 0; // below the eighth floor everything takes more hits

    Object.assign(enemy.userData, { 
        speed: stats.speed, 
        type: type, 
        hp: stats.hp + depthHp, 
        maxHp: stats.hp + depthHp, 
        shootTimer: Math.random() * 2,
        shootCooldown: stats.shootCooldown,
        projectileSpeed: stats.projectileSpeed,
        aimSpread: stats.aimSpread,
        isMoving: true, 
        armAngle: 2.8,
        behavior: type === 'boss' ? 'boss' : (def?.behavior ?? 'chase'),
        heavy: !!def?.heavy,
        hitRadius: def?.hitRadius,
        state: 'move',
        stateTimer: 0,
        cooldown: 1 + Math.random(),
        phase: Math.random() * Math.PI * 2,
        faded: false,
        untargetable: false
    });
    if(type === 'boss') {
        attachOutlawModel(enemy, getOutlaw(gameState.outlawIndex));
        setupBoss(enemy, bossStyle);
    }
    if(type === 'wolf') attachWolfModel(enemy);
    if(look === 'ghost' || look === 'wraith') enemy.userData.stateTimer = 1.5 + Math.random();
    if(look === 'rider') enemy.userData.stateTimer = 2.5 + Math.random() * 1.5;

    scene.add(enemy); 
    enemies.push(enemy);
}

// ---------- Shared helpers ----------
const UP = new THREE.Vector3(0, 1, 0);
const hazards = []; // dynamite in flight

export function damagePlayer(callbacks) {
    if(playerStats.isDashing || playerStats.invulnerabilityTimer > 0 || gameState.isGameOver) return false;
    playerStats.hp--;
    playerStats.invulnerabilityTimer = 0.6;
    gameState.runStats.damageTaken++;
    callbacks.onPlayerDamaged?.();
    playSound('hurt');
    callbacks.onUpdateHUD?.();
    document.body.style.backgroundColor = '#550000';
    setTimeout(() => document.body.style.backgroundColor = '#000', 100);
    if(playerStats.hp <= 0) callbacks.onGameOver?.();
    return true;
}

// Fires from the weapon's muzzle toward a point on the ground (so shots line up with the aim
// laser even though the gun is held off to one side).
function fireBullets(enemy, targetPoint, count, spread, speed, scene) {
    const from = new THREE.Vector3();
    (enemy.userData.muzzle || enemy).getWorldPosition(from);
    from.y = Math.max(from.y, 2);
    const direction = new THREE.Vector3(targetPoint.x - from.x, 0, targetPoint.z - from.z);
    playSound('enemy-shot');
    for(let i = 0; i < count; i++) {
        const dir = direction.clone().normalize();
        if(count > 1) dir.applyAxisAngle(UP, (i - (count - 1) / 2) * (spread / (count - 1)));
        spawnBullet(scene, 'enemy', from, dir.multiplyScalar(speed));
    }
}

function throwDynamite(scene, from, target) {
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), new THREE.MeshBasicMaterial({ color: 0xd32f2f }));
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(4.1, 4.5, 40),
        new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(target.x, 0.15, target.z);
    const fill = new THREE.Mesh(
        new THREE.CircleGeometry(4.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.15, depthWrite: false })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(target.x, 0.1, target.z);
    stick.position.copy(from).setY(3);
    scene.add(stick, ring, fill);
    hazards.push({ stick, ring, fill, from: from.clone(), to: new THREE.Vector3(target.x, 0, target.z), t: 0, duration: 1.2 });
    playSound('fuse');
}

export function updateHazards(dt, scene, playerGroup, callbacks) {
    for(let i = hazards.length - 1; i >= 0; i--) {
        const h = hazards[i];
        h.t += dt;
        const k = Math.min(1, h.t / h.duration);
        h.stick.position.lerpVectors(h.from, h.to, k);
        h.stick.position.y = 1 + Math.sin(Math.PI * k) * 7;
        h.stick.rotation.x += dt * 10;
        h.fill.material.opacity = 0.12 + (k * 0.3);
        if(k < 1) continue;
        createExplosion(scene, h.to, 0xff6f00);
        createExplosion(scene, h.to.clone().setY(1), 0xffd54f);
        addScorch(scene, h.to.x, h.to.z);
        playSound('boom');
        if(h.to.distanceTo(playerGroup.position) < 25) addShake(0.3);
        const dx = playerGroup.position.x - h.to.x;
        const dz = playerGroup.position.z - h.to.z;
        if(Math.hypot(dx, dz) < 4.5 && damagePlayer(callbacks)) haptic('heavy');
        removeHazard(scene, i);
    }
}

function removeHazard(scene, index) {
    const h = hazards[index];
    scene.remove(h.stick, h.ring, h.fill);
    h.stick.geometry.dispose(); h.ring.geometry.dispose(); h.fill.geometry.dispose();
    hazards.splice(index, 1);
}

export function clearHazards(scene) {
    for(let i = hazards.length - 1; i >= 0; i--) removeHazard(scene, i);
}

function setGhostFaded(enemy, faded) {
    enemy.userData.faded = faded;
    enemy.userData.untargetable = faded;
    for(const material of enemy.userData.fadeMaterials || []) material.opacity = faded ? 0.18 : 1;
    enemy.traverse(o => { if(o.userData.isOutline) o.visible = !faded; });
}

// Distance band helper: approach when too far, back off when too close, else hold.
function keepRange(dir, dist, near, far) {
    if(dist > far) return dir.clone();
    if(dist < near) return dir.clone().negate();
    return null;
}

// ---------- Outlaw signature attacks (OUTLAWS[].signature in outlaws.js) ----------
// All timings are first guesses for playtesting. Every attack has a visible tell before it lands.
const BROTHER_HP_SHARE = 0.45;

// Imported 3D outlaw (OUTLAWS[].model): shown instead of the box figure once loaded. The box
// figure stays for its gun muzzle and health bar; everything else about the fight is unchanged.
const OUTLAW_MODEL_HEIGHT = 7.5; // before the boss's own 1.2x scale: about 1.5x the player
function attachOutlawModel(enemy, outlaw) {
    const gltf = outlaw.model ? loadedCharacterModel(outlaw.model) : null;
    if(!gltf) return;
    const instance = createCharacterInstance(gltf, OUTLAW_MODEL_HEIGHT);
    const box = enemy.children[0];
    const hpBar = enemy.userData.hpBar?.parent;
    for(const part of box.children) if(part !== hpBar) part.visible = false;
    if(hpBar) hpBar.position.y = (OUTLAW_MODEL_HEIGHT + 0.9) / box.scale.y; // just above the model's head
    enemy.add(instance.object);
    enemy.userData.model = instance;
    // Shots leave from the revolver in the model's hand, not the hidden box figure's gun.
    if(instance.muzzle) enemy.userData.muzzle = instance.muzzle;
}

// Imported 3D wolf (public/models/wolf.glb, rigged in Blender: tools/blender/README.md): shown instead
// of the box wolf once it has loaded, else the box wolf stays. Its clips are idle and run; the shared
// enemy update below plays them (no gun, so createCharacterInstance's combat() just picks idle or run).
export const WOLF_MODEL = 'models/wolf.glb';
export const WOLF_MODEL_HEIGHT = 3.4; // ears to paws; the box wolf is about 3.5 tall
function attachWolfModel(enemy) {
    const gltf = loadedCharacterModel(WOLF_MODEL);
    if(!gltf) return;
    const instance = createCharacterInstance(gltf, WOLF_MODEL_HEIGHT);
    for(const part of enemy.children) part.visible = false;
    enemy.add(instance.object);
    enemy.userData.model = instance;
}

// The part that shakes as an attack tell: the imported model, or the box figure.
const bodyOf = e => e.userData.model?.object ?? e.children[0];

// Own see-through materials, so fading him never fades anyone else sharing a colour. Safe to call again after a model is
// attached late: only meshes not yet prepared are changed.
function prepareFade(enemy) {
    const u = enemy.userData;
    u.fadeMaterials = u.fadeMaterials || [];
    enemy.traverse(o => {
        if(!o.isMesh || o.userData.isOutline || o.userData.fadeReady) return;
        o.material = o.material.clone();
        o.material.transparent = true;
        o.userData.fadeReady = true;
        u.fadeMaterials.push(o.material);
    });
}

// A boss that spawned before its 3D model had finished downloading (a slow connection) is the plain box figure. When the
// download finishes the model is attached to it, instead of the box figure staying for the whole fight.
export function attachMissingOutlawModels() {
    for(const enemy of enemies) {
        if(enemy.userData.type !== 'boss' || enemy.userData.model) continue;
        attachOutlawModel(enemy, getOutlaw(gameState.outlawIndex));
        if(enemy.userData.model && enemy.userData.bossStyle === 'specter') prepareFade(enemy);
    }
}

function setupBoss(enemy, style) {
    const u = enemy.userData;
    u.bossStyle = style;
    u.special = 3 + Math.random(); // time to the next signature move
    u.shootTimer = 1.5 + Math.random();
    if(style === 'brothers') {
        u.hp = u.maxHp = Math.max(4, Math.ceil(u.hp * BROTHER_HP_SHARE));
        u.strafe = Math.random() < 0.5 ? -1 : 1;
        u.shootTimer = 0.8 + Math.random() * 1.6;
    }
    if(style === 'preacher') addAimLaser(enemy, { width: 0.3, height: 2.4 });
    if(style === 'juggernaut') u.frontArmor = true;
    if(style === 'specter') {
        prepareFade(enemy);
        u.state = 'solid';
        u.stateTimer = 3;
    }
}

function turnToward(u, dir, maxAngle) {
    if(!u.facing) u.facing = dir.clone();
    const angle = Math.atan2(u.facing.x * dir.z - u.facing.z * dir.x, u.facing.dot(dir));
    u.facing.applyAxisAngle(UP, -Math.sign(angle) * Math.min(Math.abs(angle), maxAngle)).normalize();
    return u.facing;
}

function freeSpotNear(center, minR, maxR) {
    for(let attempt = 0; attempt < 10; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const r = minR + Math.random() * (maxR - minR);
        const x = center.x + Math.cos(angle) * r;
        const z = center.z + Math.sin(angle) * r;
        if(!checkCollision(x, z, 1.2)) return { x, z };
    }
    return null;
}

// Windup (shake) -> charge along a locked line -> recover (standing, open to shots).
function chargeCycle(e, u, dir, dist, timeInSeconds, { range, windup, speed, time, recover, cooldown }) {
    if(u.state === 'move' && dist < range && u.cooldown <= 0) { u.state = 'windup'; u.stateTimer = windup; }
    if(u.state === 'windup') {
        bodyOf(e).position.x = Math.sin(timeInSeconds * 60) * 0.15;
        if(u.stateTimer <= 0) { u.state = 'charge'; u.stateTimer = time; u.lockedDir = dir.clone(); bodyOf(e).position.x = 0; }
        return { moveDir: null, faceDir: u.facing ?? null };
    }
    if(u.state === 'charge') {
        if(u.stateTimer <= 0) { u.state = 'recover'; u.stateTimer = recover; }
        return { moveDir: u.lockedDir, faceDir: u.lockedDir, speed };
    }
    if(u.state === 'recover') {
        if(u.stateTimer <= 0) { u.state = 'move'; u.cooldown = cooldown; }
        return { moveDir: null, faceDir: u.lockedDir };
    }
    return null;
}

function updateBoss(e, u, ctx) {
    const { dt, dist, dir, playerPos, scene, callbacks, timeInSeconds } = ctx;
    u.shootTimer -= dt;
    u.special -= dt;
    const fan = () => { enemyShoot(e, playerPos, scene); u.shootTimer = u.shootCooldown || (2 + Math.random()); };
    switch(u.bossStyle) {
    case 'brawler': {
        // Dusty Pete: no gun play, just a telegraphed charge and a breather after it.
        const charge = chargeCycle(e, u, dir, dist, timeInSeconds, { range: 18, windup: 0.7, speed: 26, time: 0.7, recover: 1.1, cooldown: 1.8 });
        return charge ?? { moveDir: dir };
    }
    case 'packleader': {
        // Rattlesnake Rosa: keeps her distance, shoots, and howls wolves in.
        if(u.state === 'howl') {
            if(u.stateTimer <= 0) {
                for(let i = 0; i < 2; i++) {
                    spawnEnemy(scene, playerPos, 'wolf');
                    const spot = freeSpotNear(e.position, 3, 5);
                    if(spot) enemies.at(-1).position.set(spot.x, 0, spot.z);
                }
                u.state = 'move';
                u.special = 9;
            }
            return { moveDir: null };
        }
        if(u.special <= 0 && enemies.filter(o => o.userData.type === 'wolf').length < 6) {
            u.state = 'howl'; u.stateTimer = 0.9;
            callbacks.onBossSignal?.('AWOOO!', e.position);
            playSound('howl');
            return { moveDir: null };
        }
        u.isAiming = u.shootTimer < 0.6 && dist < 40;
        if(u.shootTimer <= 0 && dist < 38) fan();
        return { moveDir: keepRange(dir, dist, 14, 24) };
    }
    case 'preacher': {
        // Deacon Graves: a thick red line marks the triple shot; it locks just before firing.
        const laser = u.laser;
        if(u.shootTimer < 1.3 && dist < 55) {
            u.isAiming = true;
            if(u.shootTimer > 0.4 || !u.lockedDir) { u.lockedDir = dir.clone(); u.lockedTarget = playerPos.clone(); }
            laser.visible = true;
            laser.scale.z = Math.min(dist + 20, 70);
            laser.material.opacity = u.shootTimer < 0.4 ? 0.95 : 0.45;
            if(u.shootTimer <= 0) {
                fireBullets(e, u.lockedTarget, 3, 0.12, 80, scene);
                u.shootTimer = (u.shootCooldown || 2.5) + 0.8;
                u.lockedDir = null;
                laser.visible = false;
            }
            return { moveDir: null, faceDir: u.lockedDir };
        }
        laser.visible = false;
        return { moveDir: keepRange(dir, dist, 20, 32) };
    }
    case 'brothers': {
        // The Calloways: three weaker brothers circling and firing single shots.
        const tangent = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(u.strafe);
        const radial = dist > 22 ? 1 : dist < 10 ? -1 : 0;
        u.isAiming = u.shootTimer < 0.5 && dist < 36;
        if(u.shootTimer <= 0 && dist < 34) {
            fireBullets(e, playerPos, 1, 0, u.projectileSpeed || 40, scene);
            u.shootTimer = 1.4 + Math.random() * 1.2;
        }
        if(u.special <= 0) { u.strafe *= -1; u.special = 2 + Math.random() * 2; }
        return { moveDir: tangent.addScaledVector(dir, radial).normalize() };
    }
    case 'juggernaut': {
        // Iron Jack: armoured front (see bulletSystem), turns slowly, charges now and then.
        // Turns slowly while walking; holds the charge line through the charge and recovery.
        if((u.state === 'charge' || u.state === 'recover') && u.lockedDir) u.facing = u.lockedDir.clone();
        const facing = u.state === 'move' ? turnToward(u, dir, 1.3 * dt) : (u.facing ??= dir.clone());
        const charge = chargeCycle(e, u, facing, dist, timeInSeconds, { range: 22, windup: 1.0, speed: 22, time: 1.0, recover: 1.8, cooldown: 3.5 });
        if(charge) return charge;
        u.isAiming = u.shootTimer < 0.6 && dist < 36;
        if(u.shootTimer <= 0 && dist < 34) fan();
        return { moveDir: dist > 8 ? facing : null, faceDir: facing, speed: u.speed * 0.8 };
    }
    case 'bombardier': {
        // Mad Mesa Morgan: three sticks of dynamite at once, around where you stand.
        u.isAiming = u.shootTimer < 0.6 && dist < 32;
        if(u.shootTimer <= 0 && dist < 30) {
            const side = new THREE.Vector3(-dir.z, 0, dir.x);
            for(const offset of [0, -6, 6]) throwDynamite(scene, e.position, playerPos.clone().addScaledVector(side, offset));
            u.shootTimer = (u.shootCooldown || 2.5) + 1.6;
        }
        return { moveDir: keepRange(dir, dist, 14, 22) };
    }
    case 'fanhammer': {
        // Silas Vane: aims, fans six fast shots, then stands still to reload.
        if(u.state === 'burst') {
            if(u.stateTimer <= 0) {
                const target = playerPos.clone();
                target.x += (Math.random() - 0.5) * 2.5;
                target.z += (Math.random() - 0.5) * 2.5;
                fireBullets(e, target, 1, 0, (u.projectileSpeed || 40) * 1.15, scene);
                u.shotsLeft--;
                u.stateTimer = 0.11;
                if(u.shotsLeft <= 0) {
                    u.state = 'reload'; u.stateTimer = 2.2;
                    callbacks.onBossSignal?.('RELOADING', e.position);
                    playSound('reload');
                }
            }
            return { moveDir: null };
        }
        if(u.state === 'reload') {
            if(u.stateTimer <= 0) { u.state = 'move'; u.shootTimer = 1.2; }
            return { moveDir: null };
        }
        u.isAiming = u.shootTimer < 0.7 && dist < 36;
        if(u.shootTimer <= 0 && dist < 34) { u.state = 'burst'; u.stateTimer = 0; u.shotsLeft = 6; }
        const tangent = new THREE.Vector3(-dir.z, 0, dir.x);
        return { moveDir: (keepRange(dir, dist, 12, 22) ?? new THREE.Vector3()).addScaledVector(tangent, 0.6).normalize() };
    }
    case 'specter': {
        // El Espectro: solid (fan shot) -> fades out, untouchable -> reappears beside you -> ring of bullets.
        if(u.state === 'solid') {
            if(u.shootTimer <= 0 && dist < 36) fan();
            if(u.stateTimer <= 0) { setGhostFaded(e, true); u.state = 'fade'; u.stateTimer = 1.8; }
            return { moveDir: keepRange(dir, dist, 10, 22) };
        }
        if(u.state === 'fade') {
            if(u.stateTimer <= 0) {
                const spot = freeSpotNear(playerPos, 8, 11);
                if(spot) e.position.set(spot.x, 0, spot.z);
                setGhostFaded(e, false);
                u.state = 'appear'; u.stateTimer = 0.5;
                callbacks.onBossSignal?.('BOO!', e.position);
            }
            return { moveDir: dir, speed: u.speed * 1.8 };
        }
        if(u.state === 'appear') {
            bodyOf(e).position.x = Math.sin(timeInSeconds * 60) * 0.12;
            if(u.stateTimer <= 0) {
                bodyOf(e).position.x = 0;
                const from = e.position.clone().setY(2.2);
                for(let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    spawnBullet(scene, 'enemy', from, new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(26));
                }
                playSound('enemy-shot');
                u.state = 'solid'; u.stateTimer = 3 + Math.random();
                u.shootTimer = 1.4;
            }
            return { moveDir: null };
        }
        return { moveDir: dir };
    }
    case 'cardsharp': {
        // Lucky Lou: deals a fan of seven cards with one gap, then a second fan offset by half a step.
        if(u.state === 'deal') {
            u.isAiming = true;
            if(u.stateTimer <= 0) {
                const from = new THREE.Vector3();
                (u.muzzle || e).getWorldPosition(from);
                from.y = Math.max(from.y, 2);
                const toward = new THREE.Vector3(playerPos.x - from.x, 0, playerPos.z - from.z).normalize();
                const STEP = 0.2; // radians between cards: a gap is two steps, wide enough to slip through
                const offset = u.fansLeft === 2 ? 0 : STEP / 2;
                for(let i = -3; i <= 3; i++) {
                    if(i === u.gap) continue;
                    const dir = toward.clone().applyAxisAngle(UP, i * STEP + offset);
                    spawnBullet(scene, 'enemy', from, dir.multiplyScalar((u.projectileSpeed || 40) * 0.8), null, { size: 1.3 });
                }
                playSound('enemy-shot');
                u.shotAt = Date.now() / 1000;
                u.fansLeft--;
                u.gap = Math.floor(Math.random() * 5) - 2;
                u.stateTimer = 0.45;
                if(u.fansLeft <= 0) { u.state = 'move'; u.shootTimer = 2.4 + Math.random(); }
            }
            return { moveDir: null };
        }
        u.isAiming = u.shootTimer < 0.7 && dist < 36;
        if(u.shootTimer <= 0 && dist < 34) {
            u.state = 'deal'; u.stateTimer = 0.55; u.fansLeft = 2; u.gap = Math.floor(Math.random() * 5) - 2;
            callbacks.onBossSignal?.('DEALING', e.position);
        }
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(u.strafe || 1);
        if(Math.random() < dt * 0.4) u.strafe = -(u.strafe || 1);
        return { moveDir: (keepRange(dir, dist, 14, 24) ?? new THREE.Vector3()).addScaledVector(side, 0.8).normalize() };
    }
    case 'gatling': {
        // Colonel Crane: sets up (1 s tell), sweeps a stream of bullets across 120 degrees, then overheats.
        if(u.state === 'setup') {
            u.isAiming = true;
            bodyOf(e).position.x = Math.sin(timeInSeconds * 50) * 0.08;
            if(u.stateTimer <= 0) {
                bodyOf(e).position.x = 0;
                u.state = 'spray'; u.stateTimer = 2.4; u.fireIn = 0;
                u.sweepFrom = Math.atan2(dir.x, dir.z) + (u.sweepSide = Math.random() < 0.5 ? -1 : 1) * 1.05;
            }
            return { moveDir: null, faceDir: dir };
        }
        if(u.state === 'spray') {
            u.isAiming = true;
            const angle = u.sweepFrom - u.sweepSide * 2.1 * (1 - u.stateTimer / 2.4);
            const aim = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            u.fireIn -= dt;
            while(u.fireIn <= 0) {
                u.fireIn += 0.07;
                const from = new THREE.Vector3();
                (u.muzzle || e).getWorldPosition(from);
                from.y = Math.max(from.y, 2);
                spawnBullet(scene, 'enemy', from, aim.clone().multiplyScalar((u.projectileSpeed || 40) * 1.1));
            }
            if(Math.random() < dt * 12) playSound('enemy-shot');
            u.shotAt = Date.now() / 1000;
            if(u.stateTimer <= 0) {
                u.state = 'cool'; u.stateTimer = 1.8;
                callbacks.onBossSignal?.('OVERHEATED', e.position);
            }
            return { moveDir: null, faceDir: aim };
        }
        if(u.state === 'cool') {
            if(u.stateTimer <= 0) { u.state = 'move'; u.special = 2.5 + Math.random() * 1.5; u.shootTimer = 1.2; }
            return { moveDir: null };
        }
        // Between sweeps he keeps his distance and fires ordinary volleys.
        u.isAiming = u.shootTimer < 0.7 && dist < 40;
        if(u.shootTimer <= 0 && dist < 38) fan();
        if(u.special <= 0 && dist < 34) {
            u.state = 'setup'; u.stateTimer = 1.0;
            callbacks.onBossSignal?.('GATLING!', e.position);
        }
        return { moveDir: keepRange(dir, dist, 16, 26) };
    }
    default: {
        u.isAiming = u.shootTimer < 0.8 && dist < 45;
        if(u.shootTimer <= 0 && dist < 40) fan();
        return { moveDir: dist < 15 ? null : dir };
    }
    }
}

/**
 * Main update loop for all enemies
 */
export function updateEnemies(dt, scene, playerGroup, callbacks) {
    const timeInSeconds = Date.now() / 1000;
    const playerPos = playerGroup.position;

    for(let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const u = e.userData;
        // Safety net for the mine: anyone found inside the rock comes out of a tunnel mouth again.
        const cave = activeFloor();
        if(cave && !isOpen(cave, e.position.x, e.position.z)) {
            const back = spawnPoint(cave, playerPos);
            e.position.set(back.x, 0, back.z);
        }
        const toPlayer = new THREE.Vector3().subVectors(playerPos, e.position).setY(0);
        const dist = toPlayer.length();
        const dir = toPlayer.clone().normalize();
        let moveDir = dir.clone();
        let speed = u.speed;
        let faceDir = null; // null = face the player
        let isMoving = false;
        u.isAiming = false;
        u.stateTimer -= dt;
        u.cooldown -= dt;

        switch(u.behavior) {
        case 'boss': {
            const result = updateBoss(e, u, { dt, dist, dir, playerPos, scene, callbacks, timeInSeconds });
            moveDir = result.moveDir;
            if(result.faceDir) faceDir = result.faceDir;
            if(result.speed) speed = result.speed;
            break;
        }
        case 'shooter': {
            u.shootTimer -= dt;
            u.isAiming = u.shootTimer < 0.8 && dist < 45;
            if(dist < 15) moveDir = null;
            if(u.shootTimer <= 0 && dist < 40) {
                enemyShoot(e, playerPos, scene);
                u.shootTimer = u.shootCooldown || (2.0 + Math.random());
            }
            break;
        }
        case 'zigzag': {
            moveDir.applyAxisAngle(UP, Math.sin((timeInSeconds * 5) + u.phase) * 0.95);
            faceDir = moveDir;
            break;
        }
        case 'sniper': {
            u.shootTimer -= dt;
            moveDir = keepRange(dir, dist, 22, 34);
            const laser = u.laser;
            if(u.shootTimer < 1.3 && dist < 50) {
                moveDir = null;
                u.isAiming = true;
                if(u.shootTimer > 0.35 || !u.lockedDir) {
                    u.lockedDir = dir.clone();
                    u.lockedTarget = playerPos.clone();
                }
                faceDir = u.lockedDir;
                laser.visible = true;
                laser.scale.z = Math.min(dist + 20, 70);
                laser.material.opacity = u.shootTimer < 0.35 ? 0.95 : 0.45;
                if(u.shootTimer <= 0) {
                    fireBullets(e, u.lockedTarget, 1, 0, u.projectileSpeed, scene);
                    u.shootTimer = u.shootCooldown;
                    u.lockedDir = null;
                    laser.visible = false;
                }
            } else if(laser) {
                laser.visible = false;
            }
            break;
        }
        case 'lobber': {
            u.shootTimer -= dt;
            moveDir = keepRange(dir, dist, 12, 22);
            if(u.shootTimer < 0.5 && dist < 30) u.isAiming = true;
            if(u.shootTimer <= 0 && dist < 30) {
                throwDynamite(scene, e.position, playerPos);
                u.shootTimer = u.shootCooldown;
            }
            break;
        }
        case 'charger': {
            if(u.state === 'move' && dist < 20 && u.cooldown <= 0) {
                u.state = 'windup'; u.stateTimer = 0.75;
            }
            if(u.state === 'windup') {
                moveDir = null;
                e.children[0].position.x = Math.sin(timeInSeconds * 60) * 0.12; // shake as a tell
                if(u.stateTimer <= 0) {
                    u.state = 'charge'; u.stateTimer = 0.9; u.lockedDir = dir.clone();
                    e.children[0].position.x = 0;
                }
            } else if(u.state === 'charge') {
                moveDir = u.lockedDir; faceDir = u.lockedDir; speed = 24;
                if(u.stateTimer <= 0) { u.state = 'recover'; u.stateTimer = 0.9; }
            } else if(u.state === 'recover') {
                moveDir = null;
                if(u.stateTimer <= 0) { u.state = 'move'; u.cooldown = 2.5; }
            }
            break;
        }
        case 'rider': {
            if(u.state === 'move') {
                const tangent = new THREE.Vector3(-dir.z, 0, dir.x);
                const radial = dist > 24 ? 0.8 : dist < 16 ? -0.8 : 0;
                moveDir = tangent.multiplyScalar(0.9).addScaledVector(dir, radial).normalize();
                faceDir = moveDir;
                if(u.stateTimer <= 0 && dist < 34) { u.state = 'rear'; u.stateTimer = 0.6; }
            } else if(u.state === 'rear') {
                moveDir = null;
                if(u.stateTimer <= 0) {
                    u.state = 'charge'; u.stateTimer = 1.3; u.lockedDir = dir.clone();
                }
            } else if(u.state === 'charge') {
                moveDir = u.lockedDir; faceDir = u.lockedDir; speed = 28;
                if(u.stateTimer <= 0) { u.state = 'move'; u.stateTimer = 3 + Math.random() * 1.5; }
            }
            break;
        }
        case 'scattergun': {
            u.shootTimer -= dt;
            if(dist < 9) moveDir = null;
            if(u.shootTimer < 0.6 && dist < 15) u.isAiming = true;
            if(u.shootTimer <= 0 && dist < 15) {
                fireBullets(e, playerPos, 5, 0.55, u.projectileSpeed, scene);
                u.shootTimer = u.shootCooldown;
            }
            break;
        }
        case 'knives': {
            // Darts in on a zigzag, stops to throw three knives in a narrow fan.
            u.shootTimer -= dt;
            moveDir.applyAxisAngle(UP, Math.sin((timeInSeconds * 4) + u.phase) * 0.6);
            if(dist < 12) moveDir = null;
            if(u.shootTimer < 0.45 && dist < 20) { u.isAiming = true; moveDir = null; }
            if(u.shootTimer <= 0 && dist < 20) {
                fireBullets(e, playerPos, 3, 0.32, u.projectileSpeed, scene);
                u.shootTimer = u.shootCooldown;
            }
            break;
        }
        case 'volley': {
            // Holds range, aims (laser) and fires a three-round burst, then reloads.
            u.shootTimer -= dt;
            moveDir = keepRange(dir, dist, 18, 26);
            if(u.burstLeft > 0) {
                moveDir = null;
                u.isAiming = true;
                u.burstIn -= dt;
                if(u.burstIn <= 0) {
                    fireBullets(e, playerPos, 1, 0, u.projectileSpeed, scene);
                    u.burstLeft--;
                    u.burstIn = 0.14;
                    if(!u.burstLeft) u.shootTimer = u.shootCooldown;
                }
            } else if(u.shootTimer < 0.7 && dist < 34) {
                moveDir = null;
                u.isAiming = true;
                if(u.shootTimer <= 0) { u.burstLeft = 3; u.burstIn = 0; }
            }
            if(u.laser) {
                u.laser.visible = u.isAiming;
                if(u.isAiming) u.laser.scale.z = Math.min(dist + 20, 70);
            }
            break;
        }
        case 'phantom': {
            if(!u.faded && u.stateTimer <= 0) {
                setGhostFaded(e, true);
                u.stateTimer = 2.0;
            } else if(u.faded) {
                speed *= 1.7;
                if(u.stateTimer <= 0) {
                    // Reappear beside the player (or right here if already close).
                    for(let attempt = 0; attempt < 8 && dist > 10; attempt++) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = 7 + Math.random() * 3;
                        const x = playerPos.x + Math.cos(angle) * r;
                        const z = playerPos.z + Math.sin(angle) * r;
                        if(!checkCollision(x, z, 0.6)) { e.position.set(x, 0, z); break; }
                    }
                    setGhostFaded(e, false);
                    u.stateTimer = 2.2 + Math.random();
                }
            }
            break;
        }
        default:
            break;
        }

        // In a cave: anyone far from the marshal is asleep, and anyone who cannot see him heads along the road of chambers instead of
        // pressing against the rock (src/mineMap.js). Backing away (a gunman keeping his range) is left alone.
        if(cave && moveDir) {
            if(dist > AGGRO_DISTANCE) {
                moveDir = null;
            } else if(dist > 6 && u.state !== 'charge' && moveDir.dot(dir) > 0) {
                const aim = steerTarget(cave, e.position, playerPos);
                if(aim.x !== playerPos.x || aim.z !== playerPos.z) {
                    moveDir = new THREE.Vector3(aim.x - e.position.x, 0, aim.z - e.position.z).normalize();
                    if(faceDir) faceDir = moveDir;
                }
            }
        }

        // --- MOVEMENT ---
        if(moveDir && dist > 2.0) {
            const moveX = moveDir.x * speed * dt;
            const moveZ = moveDir.z * speed * dt;
            const colRad = (u.type === 'boss' || u.heavy) ? 1.2 : 0.5;
            if(!checkCollision(e.position.x + moveX, e.position.z + moveZ, colRad)) {
                e.position.x += moveX;
                e.position.z += moveZ;
                isMoving = true;
            } else if(activeFloor() && u.state !== 'charge') {
                // A cave wall: slide along it instead of standing against it.
                if(!checkCollision(e.position.x + moveX, e.position.z, colRad)) { e.position.x += moveX; isMoving = true; }
                else if(!checkCollision(e.position.x, e.position.z + moveZ, colRad)) { e.position.z += moveZ; isMoving = true; }
            } else if(u.state === 'charge') {
                const recovers = u.behavior === 'charger' || u.behavior === 'boss';
                u.state = recovers ? 'recover' : 'move';
                u.stateTimer = recovers ? 0.9 : 3;
                addShake(0.15);
            }
        }

        // --- ANIMATION & UI ---
        if(faceDir) e.lookAt(e.position.x + faceDir.x, e.position.y, e.position.z + faceDir.z);
        else e.lookAt(playerPos.x, e.position.y, playerPos.z);
        if(u.state === 'rear') e.rotateX(-0.35); // the horse rears up before charging
        animateCharacter(e, timeInSeconds, isMoving);
        if(u.model) {
            // Outlaws draw before they fire (u.isAiming is set just before a shot), aim, then holster.
            u.model.combat(dt, { moving: isMoving, aiming: u.isAiming || timeInSeconds - (u.shotAt ?? -9) < 0.2, quickDraw: true });
            u.model.mixer.update(dt);
        }
        if(u.hpBar) u.hpBar.scale.x = Math.max(0, u.hp / u.maxHp);

        // --- COLLISION WITH PLAYER (DAMAGE) ---
        // Enemies stop moving at 2.0 units, so every reach must be larger than that.
        const big = u.heavy || u.type === 'boss';
        const reach = u.type === 'boss' ? 3.4 : u.heavy ? 3.2 : u.type === 'rattler' ? 2.2 : 2.5;
        if(!u.faded && e.position.distanceTo(playerPos) < reach && damagePlayer(callbacks)) {
            const knock = dir.clone().multiplyScalar(big ? -2.5 : -5);
            // In the mine a knock-back never carries anyone into the rock.
            if(!activeFloor() || isOpen(activeFloor(), e.position.x + knock.x, e.position.z + knock.z, 1)) e.position.add(knock);
            if(u.state === 'charge') {
                u.state = u.behavior === 'charger' || u.behavior === 'boss' ? 'recover' : 'move';
                u.stateTimer = 1;
            }
        }
    }
}
