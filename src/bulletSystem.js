import * as THREE from 'three';
import { bullets, obstacles, enemies, playerStats, gameState } from './state.js';
import { getObstacleAt, getNearbyEnemies, markObstacleGridDirty, rebuildEnemyGrid } from './physics.js';
import { createExplosion } from './particleSystem.js';
import { spawnLoot } from './lootSystem.js';
import { playSound } from './audio.js';
import { createCrate, createCactus, createDeadTree, createFence, createRock } from './assets.js';

const PLAYER_BULLET_COLOR = new THREE.Color(0xffff00);
const ENEMY_BULLET_COLOR = new THREE.Color(0xff0000);
const BULLET_GEOMETRY = new THREE.SphereGeometry(0.35);
const bulletPool = [];
const respawnTimeouts = new Set();

function createBulletMesh() {
    return new THREE.Mesh(BULLET_GEOMETRY, new THREE.MeshBasicMaterial({ color: PLAYER_BULLET_COLOR }));
}

function acquireBullet() {
    return bulletPool.pop() || createBulletMesh();
}

function releaseBullet(scene, bullet, index) {
    scene.remove(bullet);
    bullet.visible = false;
    if(index >= 0) bullets.splice(index, 1);
    bulletPool.push(bullet);
}

export function clearBullets(scene) {
    for(let i = bullets.length - 1; i >= 0; i--) {
        releaseBullet(scene, bullets[i], i);
    }
}

export function clearPendingRespawns() {
    for(const id of respawnTimeouts) clearTimeout(id);
    respawnTimeouts.clear();
}

export function getBulletPoolStats() {
    return {
        active: bullets.length,
        pooled: bulletPool.length,
        pendingRespawns: respawnTimeouts.size
    };
}

export function spawnBullet(scene, owner, position, velocity) {
    const bullet = acquireBullet();
    bullet.visible = true;
    bullet.position.copy(position);
    bullet.material.color.copy(owner === 'enemy' ? ENEMY_BULLET_COLOR : PLAYER_BULLET_COLOR);
    bullet.userData.owner = owner;
    bullet.userData.velocity = velocity.clone();
    scene.add(bullet);
    bullets.push(bullet);
}

// Helper to respawn destructibles
function respawnObstacle(scene, type) {
    const timeoutId = setTimeout(() => {
        // Simple random position for now
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 80;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        
        if(type === 'crate') createCrate(scene, x, z);
        else if(type === 'cactus') createCactus(scene, x, z);
        else if(type === 'tree') createDeadTree(scene, x, z);
        else if(type === 'fence') createFence(scene, x, z, Math.random() * Math.PI);
        // Rocks don't usually destruct in your code, but added for safety
        else if(type === 'rock') createRock(scene, x, z);
        respawnTimeouts.delete(timeoutId);
    }, 10000);
    respawnTimeouts.add(timeoutId);
}

export function updateBullets(dt, scene, playerGroup, callbacks) {
    const runStats = gameState.runStats;
    rebuildEnemyGrid(enemies);
    for(let i=bullets.length-1; i>=0; i--) {
        const b = bullets[i]; 
        b.position.addScaledVector(b.userData.velocity, dt);

        // 1. Remove if too far
        if(b.position.distanceTo(playerGroup.position) > 100) { 
            releaseBullet(scene, b, i);
            continue; 
        }
        
        // 2. Check Obstacle Collision (Destruction)
        const hitObs = getObstacleAt(b.position.x, b.position.z, 0.5);
            if(hitObs) { 
            createExplosion(scene, b.position, 0x8B4513); 
            releaseBullet(scene, b, i);
            
            if(hitObs.destructible) {
                runStats.obstaclesDestroyed++;
                playSound('thud'); 
                scene.remove(hitObs.mesh);
                
                // Remove from obstacles array
                const idx = obstacles.indexOf(hitObs); 
                if(idx > -1) obstacles.splice(idx, 1);
                markObstacleGridDirty();
                
                // Effects
                createExplosion(scene, hitObs.mesh.position, 0x8B4513); 
                createExplosion(scene, hitObs.mesh.position, 0xdeb887);
                
                // Drop Loot & Respawn
                if(Math.random() < 0.3) spawnLoot(scene, hitObs.x, hitObs.z);
                respawnObstacle(scene, hitObs.type);
            }
            continue; 
        }

        // 3. Check Player Collision (Enemy Bullets)
        if(b.userData.owner === 'enemy') {
            const dist = new THREE.Vector3(b.position.x - playerGroup.position.x, 0, b.position.z - playerGroup.position.z).length();
            if(dist < 1.0 && !playerStats.isDashing) { 
                playerStats.hp--; 
                runStats.damageTaken++;
                callbacks.onUpdateHUD(); 
                createExplosion(scene, playerGroup.position, 0xff0000); 
                releaseBullet(scene, b, i);
                
                // Screen Flash
                document.body.style.backgroundColor = '#550000'; 
                setTimeout(() => document.body.style.backgroundColor = '#000', 100);
                
                if(playerStats.hp <= 0) callbacks.onGameOver();
            }
            continue;
        }

        // 4. Check Enemy Collision (Player Bullets)
        let bulletHit = false;
        const nearEnemies = getNearbyEnemies(b.position.x, b.position.z, 4.0);
        for(const e of nearEnemies) {
            const j = enemies.indexOf(e);
            if(j === -1) continue;
            const dist = new THREE.Vector3(e.position.x - b.position.x, 0, e.position.z - b.position.z).length();
            const hitRad = (e.userData.type === 'boss') ? 2.5 : 2.0;
            
            if(dist < hitRad) {
                releaseBullet(scene, b, i);
                bulletHit = true;
                e.userData.hp--;
                
                if(e.userData.hp <= 0) { 
                    // Enemy Dead
                    createExplosion(scene, e.position, 0x8a0303); 
                    spawnLoot(scene, e.position.x, e.position.z); 
                    scene.remove(e); 
                    enemies.splice(j,1); 
                    runStats.enemiesKilled++;
                    if(e.userData.type === 'bandit') runStats.banditsKilled++;
                    else if(e.userData.type === 'gunslinger') runStats.gunslingersKilled++;
                    else if(e.userData.type === 'wolf') runStats.wolvesKilled++;
                    else if(e.userData.type === 'boss') runStats.bossesKilled++;
                    gameState.score += (e.userData.type === 'boss') ? 10 : 1;
                    callbacks.onUpdateHUD();
                } else { 
                    // Enemy Hit
                    playSound('thud'); 
                    createExplosion(scene, e.position, 0xffaa00); 
                    // Knockback (except boss)
                    if(e.userData.type !== 'boss') {
                        const knockDir = b.userData.velocity.clone().normalize().multiplyScalar(1.0);
                        e.position.add(knockDir); 
                    }
                }
                break; // Bullet hits one enemy
            }
        }
        if(bulletHit) continue;
    }
}
