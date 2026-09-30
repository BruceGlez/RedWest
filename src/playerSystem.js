import * as THREE from 'three';
import { keys, mouse, touch } from './input.js';
import { createPlayerMesh } from './assets.js';
import { checkCollision } from './physics.js';
import { playSound, playFootstep } from './audio.js';
import { animateCharacter } from './animation.js';
import { spawnBullet } from './bulletSystem.js';
import { createMuzzleFlash, createShellCasing } from './particleSystem.js';
import { addKick } from './feedback.js';
import { addFootprint } from './decals.js';
import { groundSurface } from './world.js';
import { createStepper, advanceStepper } from './steps.js';
import { weaponKick, muzzleFlash } from './combatMath.js';
import { enemies } from './state.js';
import { pickTarget, leadPoint, directionTo, steadyMuzzle, muzzleOffset } from './aimAssist.js';
import { getWeapon, defaultWeapon } from './weapons.js';
import { loadCharacterModel, createCharacterInstance } from './characterModels.js';
import { BASE_DASH_TIME, BASE_DASH_COOLDOWN } from './perks.js';

const QUICK_FIRE_WINDOW = 0.4; // seconds of game time a tap stays live, to wait out the gun's cooldown
const SHOT_CONVERGE_DISTANCE = 30; // shots leave the gun and meet the aim line this far out: nearly parallel, never crooked
const TOUCH_AIM_SNAP = false; // when false, dragging or tapping fires where you point/walk; no snapping to the nearest enemy
const AIM_DISTANCE = 30; // with nothing to snap to, shots meet the aim line this far ahead
const WALK_TURN_RATE = 14; // how fast the body turns to face the walking direction (about 0.2 s for a full turn)

export function createPlayerSystem(scene, camera, gameState, playerStats) {
    const playerGroup = createPlayerMesh();
    scene.add(playerGroup);
    // The box-built Drifter is always there (and is the fallback); an imported character hides it.
    const drifter = playerGroup.children[0];
    const muzzle = playerGroup.userData.muzzle;
    const drifterMuzzleParent = muzzle.parent;
    const drifterMuzzlePosition = muzzle.position.clone();
    let character = null; // { id, instance } while an imported model is shown
    let characterRequest = 0;

    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    playerGroup.userData.blockedFrames = 0;

    // Ground line showing where the aim stick points; it turns orange when aim assist has a target.
    const aimLine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.45, 16),
        new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.4, depthWrite: false })
    );
    aimLine.geometry.rotateX(-Math.PI / 2);
    aimLine.geometry.translate(0, 0.08, 8);
    aimLine.visible = false;
    scene.add(aimLine);

    const heldWeapon = () => {
        const gun = getWeapon(playerStats.guns?.[playerStats.weapon]);
        return gun && gun.slot === playerStats.weapon ? gun : defaultWeapon(playerStats.weapon) || defaultWeapon('primary');
    };
    const heldGun = () => heldWeapon().stats;

    // Where the shot is aimed on the ground (set every frame from the aim), and how fast each enemy is moving,
    // so shots go from the gun to the aim point and lead a moving target.
    const stepper = createStepper();
    let aimPoint = null;
    // The muzzle's average place in the body's frame. The walking hand sways, so shots leave from this steady
    // point instead of the raw muzzle, which keeps them straight while moving.
    let steadyOffset = null;
    function facingOf(group) {
        const f = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
        const length = Math.hypot(f.x, f.z) || 1;
        return { x: f.x / length, z: f.z / length };
    }
    function trackMuzzle(dt) {
        const muzzleWorld = new THREE.Vector3();
        playerGroup.userData.muzzle.getWorldPosition(muzzleWorld);
        const raw = muzzleOffset(playerGroup.position, facingOf(playerGroup), muzzleWorld);
        if(!steadyOffset || dt <= 0) { steadyOffset = raw; return; }
        const t = 1 - Math.exp(-8 * dt);
        steadyOffset.side += (raw.side - steadyOffset.side) * t;
        steadyOffset.forward += (raw.forward - steadyOffset.forward) * t;
    }
    function trackEnemyVelocity(dt) {
        if(dt <= 0) return;
        for(const e of enemies) {
            const u = e.userData;
            if(u.lastX !== undefined) {
                u.vx = THREE.MathUtils.lerp(u.vx ?? 0, (e.position.x - u.lastX) / dt, 0.35);
                u.vz = THREE.MathUtils.lerp(u.vz ?? 0, (e.position.z - u.lastZ) / dt, 0.35);
            }
            u.lastX = e.position.x;
            u.lastZ = e.position.z;
        }
    }

    function shoot() {
        if(gameState.isGameOver || !gameState.isGameStarted) return;
        playerGroup.userData.isAiming = true;
        playerGroup.userData.aimTimer = 0.5;
        // Each gun has its own shot: 'gun-rifle' plays 'shot-rifle'.
        playSound(heldWeapon().id.replace(/^gun-/, 'shot-'));

        const weaponCfg = heldGun();
        const perk = playerStats.perk || {};
        playerStats.shotsFired++;
        // Deacon's perk: every Nth shot is a triple shot, like the ammo pickup.
        const perkTriple = perk.tripleEvery && playerStats.shotsFired % perk.tripleEvery === 0;
        const volleyOffsets = playerStats.tripleShotTimer > 0 || perkTriple ? [-0.15, 0, 0.15] : [0];
        const pelletsPerVolley = weaponCfg.pellets;
        const volley = { pending: volleyOffsets.length * pelletsPerVolley, hit: false };
        const gunPos = new THREE.Vector3();
        playerGroup.userData.muzzle.getWorldPosition(gunPos);

        // Bullets leave from the gun's steadied spot (not the swaying hand), and head for a point far down the
        // aim line, so they look like they come from the gun yet fly almost parallel to where the character points.
        const facing = facingOf(playerGroup);
        if(!steadyOffset) trackMuzzle(0);
        const steady = steadyMuzzle(playerGroup.position, facing, steadyOffset);
        const shotOrigin = new THREE.Vector3(steady.x, gunPos.y, steady.z);
        const body = playerGroup.position;
        const aimDir = (aimPoint && directionTo(body, aimPoint, 0.01)) || facing;
        const aimDistance = aimPoint ? Math.hypot(aimPoint.x - body.x, aimPoint.z - body.z) : 0;
        const meet = Math.max(aimDistance, SHOT_CONVERGE_DISTANCE);
        const converge = { x: body.x + aimDir.x * meet, z: body.z + aimDir.z * meet };

        for(const volleyOffset of volleyOffsets) {
            for(let i = 0; i < pelletsPerVolley; i++) {
                const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
                const toAim = directionTo(steady, converge);
                if(toAim) dir.set(toAim.x, 0, toAim.z);
                let pelletOffset = 0;
                if(pelletsPerVolley > 1) {
                    const spreadStep = weaponCfg.spread / Math.max(1, pelletsPerVolley - 1);
                    pelletOffset = (-weaponCfg.spread * 0.5) + (spreadStep * i);
                } else if(weaponCfg.spread > 0) {
                    pelletOffset = (Math.random() - 0.5) * weaponCfg.spread; // a single shot that wanders
                }
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), volleyOffset + pelletOffset);
                spawnBullet(scene, 'player', shotOrigin, dir.multiplyScalar(weaponCfg.speed), volley,
                    { damage: weaponCfg.damage, pierce: weaponCfg.pierce, range: weaponCfg.range * (perk.range || 1), size: weaponCfg.size * (perk.bulletSize || 1) });
            }
        }
        gameState.runStats.shotsFired += volleyOffsets.length * pelletsPerVolley;

        // The flash at the muzzle, a casing from the ejection side, and a shove of the camera against the shot.
        const shotDir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion).setY(0).normalize();
        createMuzzleFlash(scene, gunPos, shotDir, muzzleFlash(weaponCfg));
        createShellCasing(scene, gunPos, new THREE.Vector3(shotDir.z, 0, -shotDir.x));
        addKick(-shotDir.x, -shotDir.z, weaponKick(weaponCfg));

        playerGroup.userData.muzzle.intensity = 5;
        setTimeout(() => playerGroup.userData.muzzle.intensity = 0, 50);
        playerGroup.userData.gunMesh.position.z = 0.2;
    }

    // Imported characters are slimmer than the box-built ones, so they stand a little taller to read as well.
    const CHARACTER_HEIGHT = 6;
    function setCharacter(item) {
        const request = ++characterRequest;
        if(!item?.model) return Promise.resolve(showDrifter());
        if(character?.id === item.id) return Promise.resolve(true);
        return loadCharacterModel(item.model).then(gltf => {
            if(request !== characterRequest) return false;
            showDrifter();
            const instance = createCharacterInstance(gltf, CHARACTER_HEIGHT);
            playerGroup.add(instance.object);
            drifter.visible = false;
            // Shots leave from the character's gun hand instead of the hidden box revolver.
            // The flash light rides on the barrel tip of the gun in the hand, so bullets start there.
            if(instance.muzzle) {
                instance.muzzle.add(muzzle);
                muzzle.position.set(0, 0, 0);
            } else {
                playerGroup.add(muzzle);
                muzzle.position.set(1, 3.1, 1.8);
            }
            character = { id: item.id, instance };
            return true;
        }).catch(() => {
            if(request === characterRequest) showDrifter();
            return false;
        });
    }

    function showDrifter() {
        if(character) playerGroup.remove(character.instance.object);
        character = null;
        drifter.visible = true;
        drifterMuzzleParent.add(muzzle);
        muzzle.position.copy(drifterMuzzlePosition);
        return true;
    }

    // Animation for an imported character; runs every frame, also after the run ends.
    function animateModel(dt, { moving = false, shooting = false } = {}) {
        if(!character) return;
        // The gun comes out while shooting (run-and-aim or standing aim) and goes back after a moment.
        if(!gameState.isGameOver) character.instance.combat(dt, { moving, aiming: shooting });
        character.instance.mixer.update(dt);
    }

    function die() {
        if(character?.instance.has('dead')) {
            character.instance.play('dead', 0.1);
            playerGroup.visible = true;
        } else {
            playerGroup.visible = false;
        }
    }

    let seenTapAt = 0;
    let quickFireLeft = 0;
    function update(dt, timeInSeconds) {
        if(playerStats.invulnerabilityTimer > 0) {
            playerStats.invulnerabilityTimer = Math.max(0, playerStats.invulnerabilityTimer - dt);
        }
        // Blink while hits can't land so the grace window after damage is readable.
        playerGroup.visible = playerStats.invulnerabilityTimer <= 0 || Math.floor(timeInSeconds * 16) % 2 === 0;
        if(keys.weaponSwitchRequested) {
            keys.weaponSwitchRequested = false;
            playerStats.weapon = playerStats.weapon === 'primary' ? 'secondary' : 'primary';
        }

        const perk = playerStats.perk || {};
        playerStats.fireRate = heldGun().fireRate * (perk.fireRate || 1);

        if(keys.shift && playerStats.dashCooldown <= 0) {
            playerStats.isDashing = true;
            playerStats.dashDuration = perk.dashTime || BASE_DASH_TIME;
            playerStats.dashCooldown = perk.dashCooldown || BASE_DASH_COOLDOWN;
            // El Espectro's perk: untouchable for a moment after the dash ends.
            if(perk.dashGhost) playerStats.invulnerabilityTimer = Math.max(playerStats.invulnerabilityTimer, playerStats.dashDuration + perk.dashGhost);
            playSound('dash');
        }
        if(playerStats.dashDuration > 0) playerStats.dashDuration -= dt;
        else playerStats.isDashing = false;
        if(playerStats.dashCooldown > 0) playerStats.dashCooldown -= dt;
        if(playerStats.tripleShotTimer > 0) playerStats.tripleShotTimer -= dt;

        if(keys.mouse || keys.space || touch.firing || playerStats.shootCooldown > 0 || playerGroup.userData.aimTimer > 0) {
            playerGroup.userData.isAiming = true;
        } else {
            playerGroup.userData.isAiming = false;
        }
        if(playerGroup.userData.aimTimer > 0) playerGroup.userData.aimTimer -= dt;

        const speed = playerStats.isDashing ? playerStats.dashSpeed : playerStats.speed;
        const move = new THREE.Vector3(0, 0, 0);
        if(keys.w) move.z -= 1;
        if(keys.s) move.z += 1;
        if(keys.a) move.x -= 1;
        if(keys.d) move.x += 1;
        if(touch.enabled) {
            move.x += touch.moveX;
            move.z += touch.moveY;
        }
        const beforePos = playerGroup.position.clone();
        if(move.length() > 0) {
            // Keys give full speed; a partly tilted stick gives proportionally less.
            move.clampLength(0, 1).multiplyScalar(speed * dt);
            const nextX = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.x + move.x));
            const nextZ = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.z + move.z));
            if(!checkCollision(nextX, playerGroup.position.z, 1.5)) playerGroup.position.x = nextX;
            if(!checkCollision(playerGroup.position.x, nextZ, 1.5)) playerGroup.position.z = nextZ;
        }
        const movedDistance = playerGroup.position.distanceTo(beforePos);
        // Footprints: every stride a foot lands, a little behind the walker along the line of travel.
        for(const step of advanceStepper(stepper, movedDistance)) {
            const heading = Math.atan2(playerGroup.position.x - beforePos.x, playerGroup.position.z - beforePos.z);
            addFootprint(scene, playerGroup.position.x, playerGroup.position.z, heading, step.left);
            playFootstep(groundSurface(), step.left);
        }
        if(move.length() > 0 && movedDistance < 0.001) {
            playerGroup.userData.blockedFrames++;
            if(playerGroup.userData.blockedFrames > 8) {
                const dir = move.clone().setY(0).normalize();
                const side = new THREE.Vector3(-dir.z, 0, dir.x);
                const nudge = side.multiplyScalar(0.8);
                const nudgedX = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.x + nudge.x));
                const nudgedZ = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.z + nudge.z));
                if(!checkCollision(nudgedX, nudgedZ, 1.5)) {
                    playerGroup.position.x = nudgedX;
                    playerGroup.position.z = nudgedZ;
                    playerGroup.userData.blockedFrames = 0;
                }
            }
        } else {
            playerGroup.userData.blockedFrames = 0;
        }

        const isMoving = move.length() > 0;
        animateCharacter(playerGroup, timeInSeconds, isMoving);
        animateModel(dt, { moving: isMoving, shooting: playerGroup.userData.isAiming });
        if(isMoving && !character) playerGroup.position.y = Math.abs(Math.sin(timeInSeconds * 12)) * 0.1;
        else playerGroup.position.y = THREE.MathUtils.lerp(playerGroup.position.y, 0, dt * 14);

        trackEnemyVelocity(dt);
        let touchWantsFire = false;
        if(touch.enabled) {
            // Drag: aim with a gentle snap. Tap: quick-fire at the nearest enemy. Optional auto-fire
            // while standing still. Otherwise face the direction of travel.
            const pos = playerGroup.position;
            let faceX = move.x;
            let faceZ = move.z;
            let target = null;
            // A tap stays live for a short window to wait out the gun's cooldown. Both count game time,
            // so a slow frame (or a phone hiccup) can never let the tap expire before the gun is ready.
            if(touch.quickFireAt > 0 && touch.quickFireAt !== seenTapAt) {
                seenTapAt = touch.quickFireAt;
                quickFireLeft = QUICK_FIRE_WINDOW;
            }
            const quickFire = quickFireLeft > 0;
            quickFireLeft = Math.max(0, quickFireLeft - dt);
            if(touch.aiming) {
                faceX = touch.aimX;
                faceZ = touch.aimY;
                target = TOUCH_AIM_SNAP ? pickTarget(pos, enemies, { dirX: faceX, dirZ: faceZ }) : null;
                touchWantsFire = touch.firing;
            } else if(quickFire) {
                target = TOUCH_AIM_SNAP ? pickTarget(pos, enemies) : null;
                touchWantsFire = true;
            } else if(touch.autoFire && move.lengthSq() === 0) {
                target = pickTarget(pos, enemies);
                touchWantsFire = target !== null;
            }
            aimPoint = null;
            if(target) {
                const lead = leadPoint(pos, target.position, { x: target.userData.vx ?? 0, z: target.userData.vz ?? 0 }, heldGun().speed);
                aimPoint = lead;
                faceX = lead.x - pos.x;
                faceZ = lead.z - pos.z;
            }
            if(faceX !== 0 || faceZ !== 0) {
                if(!touch.aiming && !target) {
                    // Facing the way you walk: turn smoothly, so thumb wobble on the stick doesn't twitch the body.
                    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
                    const current = Math.atan2(facing.x, facing.z);
                    const wanted = Math.atan2(faceX, faceZ);
                    const delta = Math.atan2(Math.sin(wanted - current), Math.cos(wanted - current));
                    const angle = current + delta * (1 - Math.exp(-WALK_TURN_RATE * dt));
                    faceX = Math.sin(angle);
                    faceZ = Math.cos(angle);
                }
                playerGroup.lookAt(pos.x + faceX, pos.y, pos.z + faceZ);
                if(!aimPoint) {
                    const length = Math.hypot(faceX, faceZ) || 1;
                    aimPoint = { x: pos.x + (faceX / length) * AIM_DISTANCE, z: pos.z + (faceZ / length) * AIM_DISTANCE };
                }
            }
            aimLine.visible = touch.aiming;
            if(touch.aiming) {
                aimLine.position.set(pos.x, 0, pos.z);
                aimLine.rotation.y = Math.atan2(faceX, faceZ);
                aimLine.material.color.setHex(target ? 0xff7043 : 0xffd54f);
            }
        } else {
            raycaster.setFromCamera(mouse, camera);
            const intersect = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersect);
            if(intersect) {
                playerGroup.lookAt(intersect.x, playerGroup.position.y, intersect.z);
                aimPoint = { x: intersect.x, z: intersect.z };
            }
        }

        trackMuzzle(dt);
        const gunGroup = playerGroup.userData.gunMesh;
        if(gunGroup) gunGroup.position.z = THREE.MathUtils.lerp(gunGroup.position.z, 0.2, dt * 10);

        if(playerStats.shootCooldown > 0) playerStats.shootCooldown -= dt;
        if((keys.space || keys.mouse || touchWantsFire) && playerStats.shootCooldown <= 0) {
            shoot();
            playerStats.shootCooldown = playerStats.fireRate;
            // Silas's drawback: a reload pause after every full cylinder.
            if(perk.magazine && playerStats.shotsFired % perk.magazine.shots === 0) {
                playerStats.shootCooldown = perk.magazine.reload;
                playSound('reload');
            }
            touch.quickFireAt = 0;
            quickFireLeft = 0;
        }
    }

    function reset() {
        playerGroup.visible = true;
        aimLine.visible = false;
        playerGroup.position.set(0, 0, 0);
        playerGroup.rotation.set(0, 0, 0);
        playerGroup.userData.isAiming = false;
        playerGroup.userData.aimTimer = 0;
        playerStats.weapon = 'primary';
        character?.instance.play('idle', 0);
    }

    return { playerGroup, update, reset, setCharacter, animateModel, die };
}
