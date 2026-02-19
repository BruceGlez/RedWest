import * as THREE from 'three';
import { keys, mouse } from './input.js';
import { createPlayerMesh } from './assets.js';
import { checkCollision } from './physics.js';
import { playSound } from './audio.js';
import { animateCharacter } from './animation.js';
import { spawnBullet } from './bulletSystem.js';

export function createPlayerSystem(scene, camera, gameState, playerStats) {
    const playerGroup = createPlayerMesh();
    scene.add(playerGroup);

    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    playerGroup.userData.blockedFrames = 0;

    const WEAPONS = {
        revolver: { pellets: 1, spread: 0, speed: 70, fireRate: 0.2 },
        shotgun: { pellets: 7, spread: 0.38, speed: 62, fireRate: 0.75 }
    };

    function shoot() {
        if(gameState.isGameOver || !gameState.isGameStarted) return;
        playerGroup.userData.isAiming = true;
        playerGroup.userData.aimTimer = 0.5;
        playSound('shoot');

        const weaponCfg = WEAPONS[playerStats.weapon] || WEAPONS.revolver;
        const volleyOffsets = playerStats.tripleShotTimer > 0 ? [-0.15, 0, 0.15] : [0];
        const pelletsPerVolley = weaponCfg.pellets;
        const gunPos = new THREE.Vector3();
        playerGroup.userData.muzzle.getWorldPosition(gunPos);

        for(const volleyOffset of volleyOffsets) {
            for(let i = 0; i < pelletsPerVolley; i++) {
                const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
                let pelletOffset = 0;
                if(pelletsPerVolley > 1) {
                    const spreadStep = weaponCfg.spread / Math.max(1, pelletsPerVolley - 1);
                    pelletOffset = (-weaponCfg.spread * 0.5) + (spreadStep * i);
                }
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), volleyOffset + pelletOffset);
                spawnBullet(scene, 'player', gunPos, dir.multiplyScalar(weaponCfg.speed));
            }
        }
        gameState.runStats.shotsFired += volleyOffsets.length * pelletsPerVolley;

        playerGroup.userData.muzzle.intensity = 5;
        setTimeout(() => playerGroup.userData.muzzle.intensity = 0, 50);
        playerGroup.userData.gunMesh.position.z = 0.2;
    }

    function update(dt, timeInSeconds) {
        if(keys.weaponSwitchRequested) {
            keys.weaponSwitchRequested = false;
            playerStats.weapon = playerStats.weapon === 'revolver' ? 'shotgun' : 'revolver';
        }

        const weaponCfg = WEAPONS[playerStats.weapon] || WEAPONS.revolver;
        playerStats.fireRate = weaponCfg.fireRate;

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

        if(keys.mouse || keys.space || playerStats.shootCooldown > 0 || playerGroup.userData.aimTimer > 0) {
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
        const beforePos = playerGroup.position.clone();
        if(move.length() > 0) {
            move.normalize().multiplyScalar(speed * dt);
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

        raycaster.setFromCamera(mouse, camera);
        const intersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, intersect);
        if(intersect) playerGroup.lookAt(intersect.x, playerGroup.position.y, intersect.z);

        const gunGroup = playerGroup.userData.gunMesh;
        if(gunGroup) gunGroup.position.z = THREE.MathUtils.lerp(gunGroup.position.z, 0.2, dt * 10);

        if(playerStats.shootCooldown > 0) playerStats.shootCooldown -= dt;
        if((keys.space || keys.mouse) && playerStats.shootCooldown <= 0) {
            shoot();
            playerStats.shootCooldown = playerStats.fireRate;
        }
    }

    function reset() {
        playerGroup.visible = true;
        playerGroup.position.set(0, 0, 0);
        playerGroup.rotation.set(0, 0, 0);
        playerGroup.userData.isAiming = false;
        playerGroup.userData.aimTimer = 0;
        playerStats.weapon = 'revolver';
    }

    return { playerGroup, update, reset };
}
