import * as THREE from 'three';
import { setupInputs, keys, mouse } from './input.js';
// [UPDATED] Imported new assets
import { createPlayerMesh, createEnemyMesh, createWolfMesh, createGunslingerMesh, createBossMesh, createAmmoMesh, createCrate, createCactus, createWhiskeyMesh } from './assets.js';
import { checkCollision } from './physics.js';
import { gameState, playerStats, enemies, bullets, particles, obstacles } from './state.js';

// --- SETUP SCENE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 30, 90);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 35, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffd95b, 1.2);
sunLight.position.set(40, 60, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
scene.add(sunLight);

const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0xc18a4a, roughness: 1 }));
groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);

// --- AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if(type === 'shoot') {
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(300, now); 
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if(type === 'boom') {
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(100, now); 
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.2);
        gain.gain.setValueAtTime(0.1, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if(type === 'powerup') {
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(600, now); 
        osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); 
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } 
    // [NEW] Boss Hit Sound (Lower pitch)
    else if(type === 'thud') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    }
}

// --- INIT GAME ---
setupInputs();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const playerGroup = createPlayerMesh();
scene.add(playerGroup);

const loots = []; 

function getRandomPos(minDist) {
    let x, z;
    do { x = (Math.random()-0.5)*200; z = (Math.random()-0.5)*200; } while (Math.abs(x) < minDist && Math.abs(z) < minDist);
    return { x, z };
}

for(let i=0; i<20; i++) { const p = getRandomPos(10); createCrate(scene, p.x, p.z); }
for(let i=0; i<30; i++) { const p = getRandomPos(10); createCactus(scene, p.x, p.z); }

function spawnEnemy() {
    // ==========================================
    // --- SETTINGS: MANIPULATE SPAWNING HERE ---
    // ==========================================

    // 1. SPAWN CHANCES (Thresholds from 0.0 to 1.0)
    // Example: If CHANCE_BOSS is 0.1, there is a 10% chance for a boss.
    const CHANCE_BOSS = 0.1;        // 10% Chance
    const CHANCE_WOLF = 0.4;        // 30% Chance (0.1 to 0.4)
    const CHANCE_GUNSLINGER = 0.7;  // 30% Chance (0.4 to 0.7)
    // The remaining 30% (0.7 to 1.0) will be Bandits.

    // 2. BOSS STATS (Make him easier or harder)
    const BOSS_HP = 15;             // Health (Was 20)
    const BOSS_SPEED = 3.5;         // Speed (Lower is slower)
    const BOSS_SIZE = 1.2;          // Size Multiplier (1.5 = 50% bigger)

    // 3. RANDOM SIZE VARIATION (For normal enemies)
    const MIN_SIZE = 0.85;          // Minimum size
    const MAX_SIZE = 1.15;          // Maximum size

    // ==========================================
    // --- SPAWN LOGIC ---
    // ==========================================
    const r = Math.random();
    let enemy, speed, type, hp;
    
    // Calculate a random size for normal enemies
    const randomScale = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);

    // --- BOSS SPAWN ---
    if (r < CHANCE_BOSS) {
        enemy = createBossMesh();
        enemy.scale.setScalar(BOSS_SIZE); // Apply Boss Size
        speed = BOSS_SPEED; 
        type = 'boss';
        hp = BOSS_HP; 
    } 
    // --- WOLF SPAWN ---
    else if (r < CHANCE_WOLF) { 
        enemy = createWolfMesh(); 
        enemy.scale.setScalar(randomScale); // Apply Random Size
        speed = 12 + (gameState.score * 0.15); // Fast
        type = 'wolf'; 
        hp = 1;
    } 
    // --- GUNSLINGER SPAWN ---
    else if (r < CHANCE_GUNSLINGER) { 
        enemy = createGunslingerMesh(); 
        enemy.scale.setScalar(randomScale);
        speed = 5 + (gameState.score * 0.05); // Medium
        type = 'gunslinger'; 
        hp = 1;
    } 
    // --- BANDIT SPAWN ---
    else { 
        enemy = createEnemyMesh(); 
        enemy.scale.setScalar(randomScale);
        speed = 8 + (gameState.score * 0.1); // Average
        type = 'bandit'; 
        hp = 1; 
    }

    // Find a valid spawn position (not inside a wall)
    let ex, ez, attempts = 0;
    do {
        const angle = Math.random() * Math.PI * 2; 
        const dist = 50 + Math.random() * 20;
        ex = playerGroup.position.x + Math.cos(angle)*dist;
        ez = playerGroup.position.z + Math.sin(angle)*dist;
        attempts++;
    } while(checkCollision(ex, ez, 2.0) && attempts < 10);

    enemy.position.set(ex, 0, ez);
    
    // Apply data
    Object.assign(enemy.userData, { 
        speed: speed, 
        type: type, 
        hp: hp, 
        maxHp: hp, 
        shootTimer: Math.random() * 2, 
        isMoving: true,
        armAngle: 2.8 
    });
    
    scene.add(enemy); enemies.push(enemy);
}

function spawnLoot(x, z) {
    // [UPDATED] Chance to spawn Ammo Box
    const r = Math.random();
    let loot;
    if(r > 0.8) {
        loot = createAmmoMesh(); // Rare Triple Shot
    } else if (r > 0.5) {
        loot = createWhiskeyMesh(); // Health
    } else {
        return;
    }

    loot.position.set(x, 0, z);
    scene.add(loot); loots.push(loot);
}

function shoot() {
    if(gameState.isGameOver) return;
    
    playerGroup.userData.isAiming = true;
    playerGroup.userData.aimTimer = 0.5; 

    playSound('shoot');
    
    // [UPDATED] Triple Shot Logic
    const shotCount = (playerStats.tripleShotTimer > 0) ? 3 : 1;
    
    for(let i=0; i<shotCount; i++) {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
        const gunGroup = playerGroup.userData.gunMesh; 
        const gunPos = new THREE.Vector3();
        playerGroup.userData.muzzle.getWorldPosition(gunPos);
        bullet.position.copy(gunPos);

        // Base Direction
        const baseDir = new THREE.Vector3(0,0,1).applyQuaternion(playerGroup.quaternion);
        
        // [NEW] Spread calculation for Triple Shot
        if(shotCount > 1) {
            const angleOffset = (i - 1) * 0.15; // -0.15, 0, +0.15 radians
            baseDir.applyAxisAngle(new THREE.Vector3(0,1,0), angleOffset);
        }

        bullet.userData = { velocity: baseDir.multiplyScalar(70), owner: 'player' };
        scene.add(bullet); bullets.push(bullet);
    }

    playerGroup.userData.muzzle.intensity = 5; 
    setTimeout(() => playerGroup.userData.muzzle.intensity = 0, 50);

    const gunGroup = playerGroup.userData.gunMesh;
    gunGroup.position.z = 0.2; 
}

// REPLACE THIS FUNCTION IN src/main.js

function enemyShoot(enemy) {
    if(gameState.isGameOver) return;
    const muzzle = enemy.userData.muzzle; 
    if(!muzzle) return;

    playSound('shoot');

    // [NEW] Boss fires 3 bullets, others fire 1
    const isBoss = (enemy.userData.type === 'boss');
    const shotCount = isBoss ? 3 : 1;

    for(let i=0; i<shotCount; i++) {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xff0000 }));

        const gunPos = new THREE.Vector3();
        muzzle.getWorldPosition(gunPos); 
        bullet.position.copy(gunPos);

        const target = playerGroup.position.clone();
        // Add slight inaccuracy so they aren't robots
        target.x += (Math.random()-0.5)*2; 
        target.z += (Math.random()-0.5)*2;
        target.y = 2.5; 

        // Calculate Direction
        const dir = new THREE.Vector3().subVectors(target, gunPos).normalize();

        // [NEW] Apply Spread if Boss
        if(shotCount > 1) {
            // Spread angles: -0.15, 0, +0.15 radians
            const angleOffset = (i - 1) * 0.15; 
            dir.applyAxisAngle(new THREE.Vector3(0,1,0), angleOffset);
        }

        bullet.userData = { velocity: dir.multiplyScalar(40), owner: 'enemy' };
        scene.add(bullet); 
        bullets.push(bullet);
    }

    // Muzzle Flash
    muzzle.intensity = 5; 
    setTimeout(() => muzzle.intensity = 0, 50);
}

function createExplosion(pos, color) {
    playSound('boom');
    for(let i=0; i<8; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshBasicMaterial({color:color}));
        m.position.copy(pos); m.position.y += 1.5;
        m.userData = { vel: new THREE.Vector3((Math.random()-0.5)*10, Math.random()*10, (Math.random()-0.5)*10), life: 1.0 };
        scene.add(m); particles.push(m);
    }
}

function updateHUD() {
    let h = "";
    for(let i=0; i<playerStats.maxHp; i++) h += (i < playerStats.hp) ? "❤" : "🖤";
    
    // [NEW] Show Triple Shot Status
    if(playerStats.tripleShotTimer > 0) {
        h += ` <span style="color:yellow">TRIPLE SHOT: ${Math.ceil(playerStats.tripleShotTimer)}s</span>`;
    }

    document.getElementById('health-container').innerHTML = h;
    document.getElementById('score').innerText = gameState.score;
}

function animateCharacter(mesh, time, isMoving) {
    const type = mesh.userData.type || 'bandit';
    
    if(type === 'wolf') {
        const fl = mesh.getObjectByName('fl'); const fr = mesh.getObjectByName('fr');
        const bl = mesh.getObjectByName('bl'); const br = mesh.getObjectByName('br');
        if(fl && fr && bl && br && isMoving) {
            fl.rotation.x = Math.sin(time * 15) * 0.4; fr.rotation.x = Math.cos(time * 15) * 0.4;
            bl.rotation.x = Math.cos(time * 15) * 0.4; br.rotation.x = Math.sin(time * 15) * 0.4;
        }
        return;
    }

    const leftLeg = mesh.getObjectByName('leftLeg');
    const rightLeg = mesh.getObjectByName('rightLeg');
    const leftArm = mesh.getObjectByName('leftArm');
    const rightArm = mesh.getObjectByName('rightArm');
    
    // [FIX] POSITIVE ANGLES for Forward Rotation
    // 1.57 (Forward Aim), 2.8 (High Ready)
    const targetArmAngle = (mesh.userData.isAiming) ? 1.57 : 2.8;

    if (mesh.userData.armAngle === undefined) mesh.userData.armAngle = 2.8;

    mesh.userData.armAngle = THREE.MathUtils.lerp(mesh.userData.armAngle, targetArmAngle, 0.15);

    if(isMoving) {
        if(leftLeg) leftLeg.rotation.x = Math.sin(time * 12) * 0.6;
        if(rightLeg) rightLeg.rotation.x = Math.sin(time * 12 + Math.PI) * 0.6;
        if(leftArm) leftArm.rotation.x = Math.sin(time * 12 + Math.PI) * 0.6;
        
        if(rightArm) {
            // Boss uses same animation logic as Gunslinger/Player
            if(type === 'gunslinger' || type === 'player' || type === 'boss') {
                rightArm.rotation.x = mesh.userData.armAngle + Math.sin(time * 14) * 0.1;
                rightArm.rotation.z = Math.sin(time * 7) * 0.05; 
            } else {
                rightArm.rotation.x = Math.sin(time * 12) * 0.6;
            }
        }
    } else {
        if(leftLeg) leftLeg.rotation.x = 0; 
        if(rightLeg) rightLeg.rotation.x = 0;
        if(leftArm) leftArm.rotation.x = 0;
        
        if(rightArm) {
            if(type === 'gunslinger' || type === 'player' || type === 'boss') {
                rightArm.rotation.x = mesh.userData.armAngle + Math.sin(time * 3) * 0.03; 
                rightArm.rotation.z = 0;
            } else {
                rightArm.rotation.x = 0;
            }
        }
    }
}

// --- MAIN LOOP ---
let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time; 
    
    const timeInSeconds = time / 1000; 

    if(gameState.isGameOver) { renderer.render(scene, camera); return; }

    // -- Player --
    if(keys.shift && playerStats.dashCooldown <= 0) { playerStats.isDashing = true; playerStats.dashDuration = 0.15; playerStats.dashCooldown = 2.0; playSound('shoot'); }
    if(playerStats.dashDuration > 0) playerStats.dashDuration -= dt; else playerStats.isDashing = false;
    if(playerStats.dashCooldown > 0) playerStats.dashCooldown -= dt;
    
    if(playerStats.tripleShotTimer > 0) {
        playerStats.tripleShotTimer -= dt;
        updateHUD(); 
    }

    const dashPct = Math.max(0, 1 - (playerStats.dashCooldown / 2.0));
    document.getElementById('dash-bar').style.width = (dashPct * 100) + "%";
    document.getElementById('dash-bar').style.backgroundColor = dashPct >= 1 ? '#00ffcc' : '#ff3300';

    if(keys.mouse || keys.space || playerStats.shootCooldown > 0 || playerGroup.userData.aimTimer > 0) {
        playerGroup.userData.isAiming = true;
    } else {
        playerGroup.userData.isAiming = false;
    }
    if(playerGroup.userData.aimTimer > 0) playerGroup.userData.aimTimer -= dt;

    const speed = playerStats.isDashing ? playerStats.dashSpeed : playerStats.speed;
    const move = new THREE.Vector3(0,0,0);
    if(keys.w) move.z -= 1; if(keys.s) move.z += 1; if(keys.a) move.x -= 1; if(keys.d) move.x += 1;
    
    if(move.length() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        const nextX = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.x + move.x));
        const nextZ = Math.max(-gameState.MAP_SIZE, Math.min(gameState.MAP_SIZE, playerGroup.position.z + move.z));
        if(!checkCollision(nextX, playerGroup.position.z, 1.5)) playerGroup.position.x = nextX;
        if(!checkCollision(playerGroup.position.x, nextZ, 1.5)) playerGroup.position.z = nextZ;
    }
    
    animateCharacter(playerGroup, timeInSeconds, move.length() > 0);
    playerGroup.position.y = Math.abs(Math.sin(timeInSeconds * 12)) * 0.1; 

    raycaster.setFromCamera(mouse, camera);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, intersect);
    if(intersect) playerGroup.lookAt(intersect.x, playerGroup.position.y, intersect.z);
    
    const gunGroup = playerGroup.userData.gunMesh;
    if(gunGroup) gunGroup.position.z = THREE.MathUtils.lerp(gunGroup.position.z, 0.2, dt * 10); 

    if(playerStats.shootCooldown > 0) playerStats.shootCooldown -= dt;
    if((keys.space || keys.mouse) && playerStats.shootCooldown <= 0) { shoot(); playerStats.shootCooldown = playerStats.fireRate; }

    const camTarget = playerGroup.position.clone().add(new THREE.Vector3(0, 35, 25));
    camera.position.lerp(camTarget, 5 * dt);
    camera.lookAt(playerGroup.position);

    // -- Bullets --
    for(let i=bullets.length-1; i>=0; i--) {
        const b = bullets[i];
        b.position.addScaledVector(b.userData.velocity, dt);
        if(b.position.distanceTo(playerGroup.position) > 100) { scene.remove(b); bullets.splice(i,1); continue; }
        
        if(checkCollision(b.position.x, b.position.z, 0.5)) { createExplosion(b.position, 0x8B4513); scene.remove(b); bullets.splice(i,1); continue; }
        
        if(b.userData.owner === 'enemy') {
            const dx = b.position.x - playerGroup.position.x;
            const dz = b.position.z - playerGroup.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            if(dist < 1.0 && !playerStats.isDashing) { 
                playerStats.hp--; updateHUD(); createExplosion(playerGroup.position, 0xff0000);
                scene.remove(b); bullets.splice(i,1);
                document.body.style.backgroundColor = '#550000'; setTimeout(() => document.body.style.backgroundColor = '#87CEEB', 100);
                if(playerStats.hp <= 0) { gameState.isGameOver = true; document.getElementById('gameover').style.display='block'; document.getElementById('finalScore').innerText=gameState.score; playerGroup.visible=false; }
            }
        }
    }

    // -- Enemies --
    gameState.enemySpawnTimer -= dt;
    if(gameState.enemySpawnTimer <= 0) { spawnEnemy(); gameState.enemySpawnTimer = Math.max(0.5, 2.0 - (gameState.score*0.02)); }

    for(let i=enemies.length-1; i>=0; i--) {
        const e = enemies[i];
        const dir = new THREE.Vector3().subVectors(playerGroup.position, e.position).normalize();
        let isMoving = false;
        let shouldMove = true;

        if(e.userData.type === 'gunslinger' || e.userData.type === 'boss') {
            const dist = e.position.distanceTo(playerGroup.position);
            e.userData.shootTimer -= dt;

            if(e.userData.shootTimer < 0.8 && dist < 45) {
                e.userData.isAiming = true;
            } else {
                e.userData.isAiming = false;
            }

            if(dist < 15) shouldMove = false; 
            if(e.userData.shootTimer <= 0 && dist < 40) { 
                enemyShoot(e); 
                e.userData.shootTimer = 2.0 + Math.random(); 
            }
        }

        if(shouldMove && e.position.distanceTo(playerGroup.position) > 2.0) {
            const speed = e.userData.speed;
            const attempts = [0, 45, -45, 90, -90];
            
            for(let ang of attempts) {
                const rad = ang * (Math.PI / 180);
                const rx = dir.x * Math.cos(rad) - dir.z * Math.sin(rad);
                const rz = dir.x * Math.sin(rad) + dir.z * Math.cos(rad);
                
                const moveX = rx * speed * dt;
                const moveZ = rz * speed * dt;
                const nextX = e.position.x + moveX;
                const nextZ = e.position.z + moveZ;

                const colRad = (e.userData.type === 'boss') ? 1.2 : 0.5;
                if(!checkCollision(nextX, nextZ, colRad)) {
                    e.position.x = nextX;
                    e.position.z = nextZ;
                    isMoving = true;
                    break; 
                }
            }
        }

        e.lookAt(playerGroup.position);
        animateCharacter(e, timeInSeconds, isMoving);

        // [NEW] Update Health Bar Logic
        if(e.userData.hpBar) {
            const pct = Math.max(0, e.userData.hp / e.userData.maxHp);
            e.userData.hpBar.scale.x = pct; // Shrink bar
        }

        let dead = false;
        for(let j=bullets.length-1; j>=0; j--) {
            const b = bullets[j];
            if(b.userData.owner === 'enemy') continue; 
            
            const dx = e.position.x - b.position.x;
            const dz = e.position.z - b.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            const hitRad = (e.userData.type === 'boss') ? 2.5 : 2.0;

            if(dist < hitRad) {
                scene.remove(b); bullets.splice(j,1); 
                e.userData.hp--;
                
                if(e.userData.hp <= 0) {
                    createExplosion(e.position, 0x8a0303); 
                    dead = true; 
                    if(e.userData.type === 'boss') gameState.score += 9; 
                    break;
                } else {
                    playSound('thud');
                    createExplosion(e.position, 0xffaa00); 
                    if(e.userData.type !== 'boss') e.position.add(dir.clone().multiplyScalar(-1.0));
                }
            }
        }
        if(dead) { 
            spawnLoot(e.position.x, e.position.z);
            scene.remove(e); enemies.splice(i,1); gameState.score++; updateHUD(); continue; 
        }

        if(e.position.distanceTo(playerGroup.position) < 2.5 && !playerStats.isDashing) {
            playerStats.hp--; updateHUD();
            document.body.style.backgroundColor = '#550000'; setTimeout(() => document.body.style.backgroundColor = '#87CEEB', 100);
            e.position.add(dir.clone().multiplyScalar(-5)); 
            if(playerStats.hp <= 0) { gameState.isGameOver = true; document.getElementById('gameover').style.display='block'; document.getElementById('finalScore').innerText=gameState.score; playerGroup.visible=false; }
        }
    }

    // -- Loot --
    for(let i=loots.length-1; i>=0; i--) {
        const l = loots[i];
        l.rotation.y += dt; 
        l.position.y = 0.5 + Math.sin(timeInSeconds * 3 + l.userData.floatOffset) * 0.2;
        
        if(l.position.distanceTo(playerGroup.position) < 2.0) {
            if(l.userData.type === 'ammo') {
                playerStats.tripleShotTimer = 10.0; 
                updateHUD(); playSound('powerup');
                scene.remove(l); loots.splice(i,1);
            }
            else if (playerStats.hp < playerStats.maxHp) {
                playerStats.hp++; updateHUD(); playSound('powerup');
                scene.remove(l); loots.splice(i,1);
            }
        }
    }

    for(let i=particles.length-1; i>=0; i--) {
        const p = particles[i];
        p.userData.life -= dt; p.position.addScaledVector(p.userData.vel, dt); p.userData.vel.y -= 20 * dt;
        if(p.userData.life <= 0 || p.position.y < 0) { scene.remove(p); particles.splice(i,1); }
    }
    renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
window.addEventListener('mousedown', () => { if(audioCtx.state === 'suspended') audioCtx.resume(); }); 
updateHUD(); animate(0);