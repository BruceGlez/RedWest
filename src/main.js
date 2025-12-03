import * as THREE from 'three';
import { setupInputs, keys, mouse } from './input.js';
import { createPlayerMesh } from './assets.js';
import { checkCollision } from './physics.js';
import { gameState, playerStats, bullets } from './state.js';

// --- MODULE IMPORTS ---
import { setupScene, generateMap } from './world.js';
import { playSound, resumeAudio } from './audio.js';
import { spawnEnemy, updateEnemies } from './enemySystem.js';
import { updateParticles } from './particleSystem.js';
import { updateLoots } from './lootSystem.js';
import { updateBullets } from './bulletSystem.js';
import { animateCharacter } from './animation.js';

// --- SCENE INIT ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- WORLD SETUP ---
setupScene(scene, camera, renderer);
generateMap(scene);
setupInputs();

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const playerGroup = createPlayerMesh();
scene.add(playerGroup);

// --- UI MANAGERS ---
function updateHUD() {
    let h = "";
    for(let i=0; i<playerStats.maxHp; i++) h += (i < playerStats.hp) ? "❤" : "<span style='opacity:0.3'>❤</span>";
    document.getElementById('health-container').innerHTML = h;
    document.getElementById('score').innerText = gameState.score;
    const statusDiv = document.getElementById('status-msg');
    if(statusDiv) {
        if(playerStats.tripleShotTimer > 0) {
            statusDiv.innerText = `TRIPLE SHOT: ${Math.ceil(playerStats.tripleShotTimer)}s`;
            statusDiv.style.color = '#ffff00';
        } else { statusDiv.innerText = ''; }
    }
}

function gameOver() {
    if(gameState.isGameOver) return;
    gameState.isGameOver = true;
    const goScreen = document.getElementById('gameover');
    goScreen.style.display = 'flex'; 
    document.getElementById('finalScore').innerText = gameState.score;
    document.getElementById('input-section').style.display = 'flex';
    document.getElementById('restart-msg').style.display = 'none';
    document.getElementById('playerName').value = '';
    document.getElementById('playerName').focus(); 
    playerGroup.visible = false;
}

// Callbacks passed to systems
const gameCallbacks = { onUpdateHUD: updateHUD, onGameOver: gameOver };

// --- HIGH SCORES (Keep local for now) ---
function loadHighScores() {
    try { return JSON.parse(localStorage.getItem('redWestScores')) || []; } catch { return []; }
}
function saveHighScore(name, score) {
    let scores = loadHighScores();
    if(typeof scores[0] === 'number') scores = [];
    scores.push({ name: name.toUpperCase(), score: score });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem('redWestScores', JSON.stringify(scores.slice(0, 5)));
    updateLeaderboardUI(scores);
}
function updateLeaderboardUI(scores) {
    const list = document.getElementById('highscore-list');
    if(!list) return;
    list.innerHTML = scores.length ? '' : '<li>NO RECORDS YET</li>';
    scores.forEach((s, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>#${i+1} ${s.name}</span> <span style="color:#ffd700">${s.score}</span>`;
        list.appendChild(li);
    });
}
updateLeaderboardUI(loadHighScores());

const saveBtn = document.getElementById('saveScoreBtn');
if(saveBtn) {
    saveBtn.addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim() || "UNKNOWN";
        saveHighScore(name, gameState.score);
        document.getElementById('input-section').style.display = 'none';
        document.getElementById('restart-msg').style.display = 'block';
    });
}

// --- PLAYER ACTIONS ---
function shoot() {
    if(gameState.isGameOver || !gameState.isGameStarted) return;
    playerGroup.userData.isAiming = true; playerGroup.userData.aimTimer = 0.5; playSound('shoot');
    const shotCount = (playerStats.tripleShotTimer > 0) ? 3 : 1;
    for(let i=0; i<shotCount; i++) {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
        const gunPos = new THREE.Vector3();
        playerGroup.userData.muzzle.getWorldPosition(gunPos);
        bullet.position.copy(gunPos);
        const baseDir = new THREE.Vector3(0,0,1).applyQuaternion(playerGroup.quaternion);
        if(shotCount > 1) baseDir.applyAxisAngle(new THREE.Vector3(0,1,0), (i - 1) * 0.15);
        bullet.userData = { velocity: baseDir.multiplyScalar(70), owner: 'player' };
        scene.add(bullet); bullets.push(bullet);
    }
    playerGroup.userData.muzzle.intensity = 5; setTimeout(() => playerGroup.userData.muzzle.intensity = 0, 50);
    playerGroup.userData.gunMesh.position.z = 0.2; 
}

// --- MAIN LOOP ---
let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time; const timeInSeconds = time / 1000; 

    // 1. Start Screen Orbit
    if(!gameState.isGameStarted) {
        camera.position.set(Math.sin(timeInSeconds*0.5)*30, 20, Math.cos(timeInSeconds*0.5)*30);
        camera.lookAt(playerGroup.position);
        renderer.render(scene, camera);
        if(keys.space) {
            gameState.isGameStarted = true;
            document.getElementById('start-screen').style.display = 'none';
            camera.position.set(0, 35, 25);
            resumeAudio();
        }
        return; 
    }

    if(gameState.isGameOver) { renderer.render(scene, camera); return; }

    // 2. Run Systems
    updateParticles(dt, scene);
    if(updateLoots(dt, scene, playerGroup)) updateHUD();
    updateBullets(dt, scene, playerGroup, gameCallbacks);
    updateEnemies(dt, scene, playerGroup, gameCallbacks);

    // 3. Player Logic (Input & Movement)
    if(keys.shift && playerStats.dashCooldown <= 0) { 
        playerStats.isDashing = true; playerStats.dashDuration = 0.15; playerStats.dashCooldown = 2.0; playSound('shoot'); 
    }
    if(playerStats.dashDuration > 0) playerStats.dashDuration -= dt; else playerStats.isDashing = false;
    if(playerStats.dashCooldown > 0) playerStats.dashCooldown -= dt;
    if(playerStats.tripleShotTimer > 0) { playerStats.tripleShotTimer -= dt; updateHUD(); }

    // Dash UI
    const dashPct = Math.max(0, 1 - (playerStats.dashCooldown / 2.0));
    document.getElementById('dash-bar').style.width = (dashPct * 100) + "%";
    document.getElementById('dash-bar').style.backgroundColor = dashPct >= 1 ? '#00ffcc' : '#ff3300';

    // Aim State
    if(keys.mouse || keys.space || playerStats.shootCooldown > 0 || playerGroup.userData.aimTimer > 0) 
        playerGroup.userData.isAiming = true; 
    else playerGroup.userData.isAiming = false;
    if(playerGroup.userData.aimTimer > 0) playerGroup.userData.aimTimer -= dt;

    // Move
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
    
    // Player Visuals
    animateCharacter(playerGroup, timeInSeconds, move.length() > 0);
    playerGroup.position.y = Math.abs(Math.sin(timeInSeconds * 12)) * 0.1; 
    
    raycaster.setFromCamera(mouse, camera);
    const intersect = new THREE.Vector3(); raycaster.ray.intersectPlane(groundPlane, intersect);
    if(intersect) playerGroup.lookAt(intersect.x, playerGroup.position.y, intersect.z);
    
    const gunGroup = playerGroup.userData.gunMesh; 
    if(gunGroup) gunGroup.position.z = THREE.MathUtils.lerp(gunGroup.position.z, 0.2, dt * 10); 
    
    // Shoot
    if(playerStats.shootCooldown > 0) playerStats.shootCooldown -= dt;
    if((keys.space || keys.mouse) && playerStats.shootCooldown <= 0) { 
        shoot(); playerStats.shootCooldown = playerStats.fireRate; 
    }

    // Camera Follow
    camera.position.lerp(playerGroup.position.clone().add(new THREE.Vector3(0, 35, 25)), 5 * dt); 
    camera.lookAt(playerGroup.position);

    // 4. Spawn Logic
    gameState.enemySpawnTimer -= dt;
    if(gameState.enemySpawnTimer <= 0) { 
        spawnEnemy(scene, playerGroup.position); 
        gameState.enemySpawnTimer = Math.max(0.5, 2.0 - (gameState.score*0.02)); 
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth/window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
});
window.addEventListener('mousedown', resumeAudio); 
updateHUD(); animate(0);