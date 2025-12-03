import * as THREE from 'three';
import { bullets, obstacles, enemies, playerStats, gameState } from './state.js';
import { getObstacleAt } from './physics.js';
import { createExplosion } from './particleSystem.js';
import { spawnLoot } from './lootSystem.js';
import { playSound } from './audio.js';
import { createCrate, createCactus, createDeadTree, createFence, createRock } from './assets.js';

// Helper to respawn destructibles
function respawnObstacle(scene, type) {
    setTimeout(() => {
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
    }, 10000);
}

export function updateBullets(dt, scene, playerGroup, callbacks) {
    for(let i=bullets.length-1; i>=0; i--) {
        const b = bullets[i]; 
        b.position.addScaledVector(b.userData.velocity, dt);

        // 1. Remove if too far
        if(b.position.distanceTo(playerGroup.position) > 100) { 
            scene.remove(b); 
            bullets.splice(i,1); 
            continue; 
        }
        
        // 2. Check Obstacle Collision (Destruction)
        const hitObs = getObstacleAt(b.position.x, b.position.z, 0.5);
        if(hitObs) { 
            createExplosion(scene, b.position, 0x8B4513); 
            scene.remove(b); 
            bullets.splice(i,1); 
            
            if(hitObs.destructible) {
                playSound('thud'); 
                scene.remove(hitObs.mesh);
                
                // Remove from obstacles array
                const idx = obstacles.indexOf(hitObs); 
                if(idx > -1) obstacles.splice(idx, 1);
                
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
                callbacks.onUpdateHUD(); 
                createExplosion(scene, playerGroup.position, 0xff0000); 
                scene.remove(b); 
                bullets.splice(i,1);
                
                // Screen Flash
                document.body.style.backgroundColor = '#550000'; 
                setTimeout(() => document.body.style.backgroundColor = '#000', 100);
                
                if(playerStats.hp <= 0) callbacks.onGameOver();
            }
            continue;
        }

        // 4. Check Enemy Collision (Player Bullets)
        // Note: We iterate enemies inside the bullet loop or vice versa. 
        // For performance with few enemies/bullets, this nested loop is fine.
        let bulletHit = false;
        for(let j=enemies.length-1; j>=0; j--) {
            const e = enemies[j];
            const dist = new THREE.Vector3(e.position.x - b.position.x, 0, e.position.z - b.position.z).length();
            const hitRad = (e.userData.type === 'boss') ? 2.5 : 2.0;
            
            if(dist < hitRad) {
                scene.remove(b); 
                bullets.splice(i,1); 
                bulletHit = true;
                e.userData.hp--;
                
                if(e.userData.hp <= 0) { 
                    // Enemy Dead
                    createExplosion(scene, e.position, 0x8a0303); 
                    spawnLoot(scene, e.position.x, e.position.z); 
                    scene.remove(e); 
                    enemies.splice(j,1); 
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