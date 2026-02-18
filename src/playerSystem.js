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

    function shoot() {
        if(gameState.isGameOver || !gameState.isGameStarted) return;
        playerGroup.userData.isAiming = true;
        playerGroup.userData.aimTimer = 0.5;
        playSound('shoot');

        const shotCount = playerStats.tripleShotTimer > 0 ? 3 : 1;
        const gunPos = new THREE.Vector3();
        playerGroup.userData.muzzle.getWorldPosition(gunPos);

        for(let i = 0; i < shotCount; i++) {
            const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerGroup.quaternion);
            if(shotCount > 1) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 1) * 0.15);
            spawnBullet(scene, 'player', gunPos, dir.multiplyScalar(70));
        }
        gameState.runStats.shotsFired += shotCount;

        playerGroup.userData.muzzle.intensity = 5;
        setTimeout(() => playerGroup.userData.muzzle.intensity = 0, 50);
        playerGroup.userData.gunMesh.position.z = 0.2;
    }

    function update(dt, timeInSeconds) {
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
        if(move.length() > 0) {
            move.normalize().multiplyScalar(speed * dt);
            const nextX = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.x + move.x));
            const nextZ = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.z + move.z));
            if(!checkCollision(nextX, playerGroup.position.z, 1.5)) playerGroup.position.x = nextX;
            if(!checkCollision(playerGroup.position.x, nextZ, 1.5)) playerGroup.position.z = nextZ;
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
    }

    return { playerGroup, update, reset };
}
