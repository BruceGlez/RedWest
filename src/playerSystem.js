import * as THREE from 'three';
import { keys, mouse, touch } from './input.js';
import { createPlayerMesh } from './assets.js';
import { checkCollision } from './physics.js';
import { playSound } from './audio.js';
import { animateCharacter } from './animation.js';
import { spawnBullet } from './bulletSystem.js';
import { enemies } from './state.js';
import { pickTarget } from './aimAssist.js';
import { getWeapon, defaultWeapon } from './weapons.js';

const QUICK_FIRE_WINDOW_MS = 400;

export function createPlayerSystem(scene, camera, gameState, playerStats) {
    const playerGroup = createPlayerMesh();
    scene.add(playerGroup);

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

    const heldGun = () => {
        const gun = getWeapon(playerStats.guns?.[playerStats.weapon]);
        return (gun && gun.slot === playerStats.weapon ? gun : defaultWeapon(playerStats.weapon) || defaultWeapon('primary')).stats;
    };

    function shoot() {
        if(gameState.isGameOver || !gameState.isGameStarted) return;
        playerGroup.userData.isAiming = true;
        playerGroup.userData.aimTimer = 0.5;
        playSound('shoot');

        const weaponCfg = heldGun();
        const volleyOffsets = playerStats.tripleShotTimer > 0 ? [-0.15, 0, 0.15] : [0];
        const pelletsPerVolley = weaponCfg.pellets;
        const volley = { pending: volleyOffsets.length * pelletsPerVolley, hit: false };
        const gunPos = new THREE.Vector3();
        playerGroup.userData.muzzle.getWorldPosition(gunPos);

        for(const volleyOffset of volleyOffsets) {
            for(let i = 0; i < pelletsPerVolley; i++) {
                const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
                let pelletOffset = 0;
                if(pelletsPerVolley > 1) {
                    const spreadStep = weaponCfg.spread / Math.max(1, pelletsPerVolley - 1);
                    pelletOffset = (-weaponCfg.spread * 0.5) + (spreadStep * i);
                } else if(weaponCfg.spread > 0) {
                    pelletOffset = (Math.random() - 0.5) * weaponCfg.spread; // a single shot that wanders
                }
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), volleyOffset + pelletOffset);
                spawnBullet(scene, 'player', gunPos, dir.multiplyScalar(weaponCfg.speed), volley,
                    { damage: weaponCfg.damage, pierce: weaponCfg.pierce, range: weaponCfg.range });
            }
        }
        gameState.runStats.shotsFired += volleyOffsets.length * pelletsPerVolley;

        playerGroup.userData.muzzle.intensity = 5;
        setTimeout(() => playerGroup.userData.muzzle.intensity = 0, 50);
        playerGroup.userData.gunMesh.position.z = 0.2;
    }

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

        playerStats.fireRate = heldGun().fireRate;

        if(keys.shift && playerStats.dashCooldown <= 0) {
            playerStats.isDashing = true;
            playerStats.dashDuration = 0.15;
            playerStats.dashCooldown = 2.0;
            playSound('shoot');
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
        if(isMoving) playerGroup.position.y = Math.abs(Math.sin(timeInSeconds * 12)) * 0.1;
        else playerGroup.position.y = THREE.MathUtils.lerp(playerGroup.position.y, 0, dt * 14);

        let touchWantsFire = false;
        if(touch.enabled) {
            // Drag: aim with a gentle snap. Tap: quick-fire at the nearest enemy. Optional auto-fire
            // while standing still. Otherwise face the direction of travel.
            const pos = playerGroup.position;
            let faceX = move.x;
            let faceZ = move.z;
            let target = null;
            const quickFire = touch.quickFireAt > 0 && performance.now() - touch.quickFireAt < QUICK_FIRE_WINDOW_MS;
            if(touch.aiming) {
                faceX = touch.aimX;
                faceZ = touch.aimY;
                target = pickTarget(pos, enemies, { dirX: faceX, dirZ: faceZ });
                touchWantsFire = touch.firing;
            } else if(quickFire) {
                target = pickTarget(pos, enemies);
                touchWantsFire = true;
            } else if(touch.autoFire && move.lengthSq() === 0) {
                target = pickTarget(pos, enemies);
                touchWantsFire = target !== null;
            }
            if(target) {
                faceX = target.position.x - pos.x;
                faceZ = target.position.z - pos.z;
            }
            if(faceX !== 0 || faceZ !== 0) {
                playerGroup.lookAt(pos.x + faceX, pos.y, pos.z + faceZ);
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
            if(intersect) playerGroup.lookAt(intersect.x, playerGroup.position.y, intersect.z);
        }

        const gunGroup = playerGroup.userData.gunMesh;
        if(gunGroup) gunGroup.position.z = THREE.MathUtils.lerp(gunGroup.position.z, 0.2, dt * 10);

        if(playerStats.shootCooldown > 0) playerStats.shootCooldown -= dt;
        if((keys.space || keys.mouse || touchWantsFire) && playerStats.shootCooldown <= 0) {
            shoot();
            playerStats.shootCooldown = playerStats.fireRate;
            touch.quickFireAt = 0;
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
    }

    return { playerGroup, update, reset };
}
