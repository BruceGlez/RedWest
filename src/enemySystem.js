import * as THREE from 'three';
import { createBossMesh, createWolfMesh, createGunslingerMesh, createEnemyMesh } from './assets.js';
import { gameState, enemies, bullets, playerStats } from './state.js';
import { checkCollision } from './physics.js';
import { playSound } from './audio.js';
import { animateCharacter } from './animation.js';

/**
 * Handles enemy shooting logic (creation of bullets and sound)
 */
export function enemyShoot(enemy, playerPos, scene) {
    const muzzle = enemy.userData.muzzle; 
    if(!muzzle) return; 

    playSound('shoot');
    const isBoss = (enemy.userData.type === 'boss');
    const shotCount = isBoss ? 3 : 1;

    for(let i = 0; i < shotCount; i++) {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        const gunPos = new THREE.Vector3(); 
        muzzle.getWorldPosition(gunPos); 
        bullet.position.copy(gunPos);
        
        // Add slight inaccuracy/spread
        const target = playerPos.clone(); 
        target.x += (Math.random() - 0.5) * 2; 
        target.z += (Math.random() - 0.5) * 2; 
        target.y = 2.5; 
        
        const dir = new THREE.Vector3().subVectors(target, gunPos).normalize();
        
        // Apply spread for shotgun/boss attacks
        if(shotCount > 1) {
            dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 1) * 0.15);
        }
        
        bullet.userData = { velocity: dir.multiplyScalar(40), owner: 'enemy' };
        scene.add(bullet); 
        bullets.push(bullet);
    }

    // Muzzle flash visual
    muzzle.intensity = 5; 
    setTimeout(() => muzzle.intensity = 0, 50);
}

/**
 * Spawns a random enemy at a safe distance from the player
 */
export function spawnEnemy(scene, playerPos) {
    const r = Math.random();
    let enemy, speed, type, hp;
    const randomScale = 0.85 + Math.random() * 0.3;

    // 10% Boss, 30% Wolf, 30% Gunslinger, 30% Bandit
    if (r < 0.1) { 
        enemy = createBossMesh(); 
        enemy.scale.setScalar(1.2); 
        speed = 3.5; 
        type = 'boss'; 
        hp = 15; 
    } else if (r < 0.4) { 
        enemy = createWolfMesh(); 
        enemy.scale.setScalar(randomScale); 
        speed = 12 + (gameState.score * 0.15); 
        type = 'wolf'; 
        hp = 1;
    } else if (r < 0.7) { 
        enemy = createGunslingerMesh(); 
        enemy.scale.setScalar(randomScale); 
        speed = 5 + (gameState.score * 0.05); 
        type = 'gunslinger'; 
        hp = 1;
    } else { 
        enemy = createEnemyMesh(); 
        enemy.scale.setScalar(randomScale); 
        speed = 8 + (gameState.score * 0.1); 
        type = 'bandit'; 
        hp = 1; 
    }

    // Find a valid position (not inside an obstacle)
    let ex, ez, attempts = 0;
    do {
        const angle = Math.random() * Math.PI * 2; 
        const dist = 50 + Math.random() * 20; // Spawn 50-70 units away
        ex = playerPos.x + Math.cos(angle) * dist;
        ez = playerPos.z + Math.sin(angle) * dist;
        attempts++;
    } while(checkCollision(ex, ez, 2.0) && attempts < 10);

    enemy.position.set(ex, 0, ez);
    
    // Initialize enemy state
    Object.assign(enemy.userData, { 
        speed: speed, 
        type: type, 
        hp: hp, 
        maxHp: hp, 
        shootTimer: Math.random() * 2, 
        isMoving: true, 
        armAngle: 2.8 
    });

    scene.add(enemy); 
    enemies.push(enemy);
}

/**
 * Main update loop for all enemies
 */
export function updateEnemies(dt, scene, playerGroup, callbacks) {
    const timeInSeconds = Date.now() / 1000;

    for(let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const dir = new THREE.Vector3().subVectors(playerGroup.position, e.position).normalize();
        let isMoving = false; 
        let shouldMove = true;
        
        // --- AI LOGIC: SHOOTING ---
        if(e.userData.type === 'gunslinger' || e.userData.type === 'boss') {
            const dist = e.position.distanceTo(playerGroup.position); 
            e.userData.shootTimer -= dt;
            
            // Aim if player is within range
            if(e.userData.shootTimer < 0.8 && dist < 45) e.userData.isAiming = true; 
            else e.userData.isAiming = false;
            
            // Stop moving to shoot if close enough
            if(dist < 15) shouldMove = false; 
            
            // Fire
            if(e.userData.shootTimer <= 0 && dist < 40) { 
                enemyShoot(e, playerGroup.position, scene); 
                e.userData.shootTimer = 2.0 + Math.random(); 
            }
        }
        
        // --- AI LOGIC: MOVEMENT ---
        if(shouldMove && e.position.distanceTo(playerGroup.position) > 2.0) {
            const speed = e.userData.speed;
            const moveX = dir.x * speed * dt; 
            const moveZ = dir.z * speed * dt;
            const colRad = (e.userData.type === 'boss') ? 1.2 : 0.5;
            
            // Check collision before moving
            if(!checkCollision(e.position.x + moveX, e.position.z + moveZ, colRad)) { 
                e.position.x += moveX; 
                e.position.z += moveZ; 
                isMoving = true; 
            }
        }
        
        // --- ANIMATION & UI ---
        e.lookAt(playerGroup.position); 
        animateCharacter(e, timeInSeconds, isMoving);
        
        // Update Boss HP Bar
        if(e.userData.hpBar) {
            e.userData.hpBar.scale.x = Math.max(0, e.userData.hp / e.userData.maxHp);
        }
        
        // --- COLLISION WITH PLAYER (DAMAGE) ---
        if(e.position.distanceTo(playerGroup.position) < 2.5 && !playerStats.isDashing) {
            playerStats.hp--; 
            
            // Trigger UI update callback
            if (callbacks.onUpdateHUD) callbacks.onUpdateHUD(); 
            
            // Screen Flash Effect (Red)
            document.body.style.backgroundColor = '#550000'; 
            setTimeout(() => document.body.style.backgroundColor = '#000', 100);
            
            // Knockback enemy slightly
            e.position.add(dir.clone().multiplyScalar(-5)); 
            
            if(playerStats.hp <= 0) {
                if (callbacks.onGameOver) callbacks.onGameOver();
            }
        }
    }
}