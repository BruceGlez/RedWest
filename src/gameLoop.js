import * as THREE from 'three';
import { keys } from './input.js';
import { resumeAudio, getAudioSettings, toggleMusicEnabled, toggleSfxEnabled } from './audio.js';
import { gameState, playerStats, obstacles, enemies, loots, resetGameState, resetPlayerStats, clearDynamicState } from './state.js';
import { generateMap } from './world.js';
import { spawnEnemy, updateEnemies } from './enemySystem.js';
import { updateLoots } from './lootSystem.js';
import { updateBullets, clearBullets, clearPendingRespawns, getBulletPoolStats } from './bulletSystem.js';
import { updateParticles, clearParticles, getParticlePoolStats } from './particleSystem.js';
import { markObstacleGridDirty, getGridStats } from './physics.js';

const ENEMY_COST = {
    bandit: 1.0,
    wolf: 1.2,
    gunslinger: 2.0,
    boss: 8.0
};

function getWaveDuration(wave) {
    return Math.max(18, 34 - (wave * 1.25));
}

function getBaseSpawnInterval(wave) {
    return Math.max(0.3, 1.25 - (wave * 0.06));
}

function getWaveBudget(wave) {
    return 12 + (wave * 4.5);
}

function getWaveCaps(wave) {
    return {
        bandit: 10 + Math.floor(wave * 0.8),
        wolf: 4 + Math.floor(wave * 0.45),
        gunslinger: Math.max(1, Math.floor(wave / 2)),
        boss: wave >= 5 ? 1 : 0
    };
}

function getWaveWeights(wave) {
    return {
        bandit: Math.max(0.8, 2.4 - (wave * 0.12)),
        wolf: Math.min(2.2, 0.8 + (wave * 0.16)),
        gunslinger: Math.min(2.4, 0.3 + (wave * 0.2)),
        boss: wave >= 5 ? 0.1 : 0
    };
}

function getActiveEnemyCounts() {
    const counts = { bandit: 0, wolf: 0, gunslinger: 0, boss: 0 };
    for(const e of enemies) {
        const t = e.userData.type;
        if(counts[t] !== undefined) counts[t]++;
    }
    return counts;
}

function chooseWeightedType(candidates) {
    let totalWeight = 0;
    for(const c of candidates) totalWeight += c.weight;
    if(totalWeight <= 0) return null;
    let r = Math.random() * totalWeight;
    for(const c of candidates) {
        r -= c.weight;
        if(r <= 0) return c.type;
    }
    return candidates[candidates.length - 1]?.type || null;
}

export function createGameLoop(scene, camera, renderer, playerSystem, ui) {
    let lastTime = 0;
    let debugElapsed = 0;
    let fpsSmoothed = 60;
    let pausedBeforeSettings = false;

    const callbacks = {
        onUpdateHUD: () => ui.updateHUD(),
        onGameOver: () => {
            if(gameState.isGameOver) return;
            gameState.isGameOver = true;
            playerSystem.playerGroup.visible = false;
            ui.showGameOver();
        }
    };

    function beginWave(waveNumber) {
        gameState.waveNumber = waveNumber;
        gameState.waveDuration = getWaveDuration(waveNumber);
        gameState.waveTimer = gameState.waveDuration;
        gameState.isIntermission = false;
        gameState.intermissionTimer = 0;
        gameState.waveBossSpawned = false;
        gameState.waveBudgetRemaining = getWaveBudget(waveNumber);
        gameState.enemySpawnTimer = 0.55;
        gameState.runStats.waveReached = Math.max(gameState.runStats.waveReached, waveNumber);
        ui.showWaveBanner(`WAVE ${waveNumber}`);
    }

    function beginIntermission() {
        gameState.isIntermission = true;
        gameState.intermissionTimer = 6;
        gameState.enemySpawnTimer = 0;
        ui.showWaveBanner('INTERMISSION', 1200);
    }

    function trySpawnDirectorEnemy() {
        const wave = gameState.waveNumber;
        const remaining = gameState.waveBudgetRemaining;
        if(remaining < ENEMY_COST.bandit) return;

        const caps = getWaveCaps(wave);
        const weights = getWaveWeights(wave);
        const active = getActiveEnemyCounts();
        const candidates = [];
        const timeElapsed = gameState.waveDuration - gameState.waveTimer;
        const canSpawnBoss = !gameState.waveBossSpawned && wave >= 5 && (timeElapsed >= Math.max(6, gameState.waveDuration * 0.4));

        for(const type of ['bandit', 'wolf', 'gunslinger', 'boss']) {
            if(type === 'boss' && !canSpawnBoss) continue;
            if(active[type] >= (caps[type] || 0)) continue;
            if(ENEMY_COST[type] > remaining) continue;
            candidates.push({ type, weight: weights[type] || 0 });
        }

        const chosenType = chooseWeightedType(candidates);
        if(!chosenType) return;

        spawnEnemy(scene, playerSystem.playerGroup.position, chosenType);
        gameState.waveBudgetRemaining = Math.max(0, gameState.waveBudgetRemaining - ENEMY_COST[chosenType]);
        if(chosenType === 'boss') gameState.waveBossSpawned = true;
    }

    function pauseGame() {
        if(!gameState.isGameStarted || gameState.isGameOver) return;
        gameState.isPaused = true;
        ui.showPauseOverlay();
    }

    function resumeGame() {
        gameState.isPaused = false;
        gameState.isSettingsOpen = false;
        pausedBeforeSettings = false;
        ui.hidePauseOverlay();
        ui.hideSettingsModal();
    }

    function openSettings() {
        if(!gameState.isGameStarted || gameState.isGameOver) return;
        if(gameState.isSettingsOpen) return;
        pausedBeforeSettings = gameState.isPaused;
        gameState.isPaused = true;
        gameState.isSettingsOpen = true;
        ui.hidePauseOverlay();
        ui.showSettingsModal();
    }

    function closeSettings() {
        if(!gameState.isSettingsOpen) return;
        gameState.isSettingsOpen = false;
        ui.hideSettingsModal();
        gameState.isPaused = pausedBeforeSettings;
        if(gameState.isPaused) ui.showPauseOverlay();
        else ui.hidePauseOverlay();
        pausedBeforeSettings = false;
    }

    function togglePause() {
        if(!gameState.isGameStarted || gameState.isGameOver) return;
        if(gameState.isPaused) resumeGame();
        else pauseGame();
    }

    function toggleSettings() {
        if(!gameState.isGameStarted || gameState.isGameOver) return;
        if(gameState.isSettingsOpen) closeSettings();
        else openSettings();
    }

    function handlePauseToggle() {
        if(!keys.pauseToggleRequested) return;
        keys.pauseToggleRequested = false;
        if(gameState.isSettingsOpen) {
            closeSettings();
            return;
        }
        togglePause();
    }

    function handleSettingsToggle() {
        if(!keys.settingsToggleRequested) return;
        keys.settingsToggleRequested = false;
        toggleSettings();
    }

    function handleAudioToggles() {
        let changed = false;
        if(keys.musicToggleRequested) {
            keys.musicToggleRequested = false;
            toggleMusicEnabled();
            changed = true;
        }
        if(keys.sfxToggleRequested) {
            keys.sfxToggleRequested = false;
            toggleSfxEnabled();
            changed = true;
        }
        if(changed) ui.updateAudioControls(getAudioSettings());
    }

    function emitDebug(dt) {
        const instantFps = dt > 0 ? (1 / dt) : fpsSmoothed;
        fpsSmoothed = THREE.MathUtils.lerp(fpsSmoothed, instantFps, 0.08);
        debugElapsed += dt;
        if(debugElapsed < 0.1) return;
        debugElapsed = 0;

        const bulletStats = getBulletPoolStats();
        const particleStats = getParticlePoolStats();
        const gridStats = getGridStats();
        ui.updateDebug({
            fps: Math.round(fpsSmoothed),
            enemies: enemies.length,
            obstacles: obstacles.length,
            loot: loots.length,
            bulletsActive: bulletStats.active,
            bulletsPooled: bulletStats.pooled,
            particlesActive: particleStats.active,
            particlesPooled: particleStats.pooled,
            pendingRespawns: bulletStats.pendingRespawns,
            obstacleCells: gridStats.obstacleCells,
            enemyCells: gridStats.enemyCells,
            obstacleGridDirty: gridStats.obstacleGridDirty
        });
    }

    function clearSceneCollections() {
        for(const e of enemies) scene.remove(e);
        for(const l of loots) scene.remove(l);
        for(const obs of obstacles) scene.remove(obs.mesh);
        clearBullets(scene);
        clearPendingRespawns();
        clearParticles(scene);
        clearDynamicState();
        markObstacleGridDirty();
    }

    function resetGame() {
        clearSceneCollections();
        resetGameState();
        resetPlayerStats();
        keys.restartRequested = false;
        keys.pauseToggleRequested = false;
        keys.settingsToggleRequested = false;
        keys.weaponSwitchRequested = false;
        keys.musicToggleRequested = false;
        keys.sfxToggleRequested = false;
        playerSystem.reset();
        generateMap(scene);
        ui.hideGameOverScreen();
        ui.hidePauseOverlay();
        ui.hideSettingsModal();
        ui.showStartScreen();
        ui.updateHUD();
        ui.updateDashBar(1);
    }

    function updateWaveFlow(dt) {
        if(gameState.isIntermission) {
            gameState.intermissionTimer -= dt;
            if(gameState.intermissionTimer <= 0) beginWave(gameState.waveNumber + 1);
            return;
        }

        gameState.waveTimer -= dt;
        if(gameState.waveTimer <= 0) {
            beginIntermission();
            return;
        }

        gameState.enemySpawnTimer -= dt;
        if(gameState.enemySpawnTimer > 0) return;

        const phase = gameState.waveTimer / gameState.waveDuration;
        let phaseMultiplier = 1;
        if(phase > 0.66) phaseMultiplier = 1.15; // slower opener
        else if(phase > 0.33) phaseMultiplier = 0.85; // pressure spike
        else phaseMultiplier = 1.0; // stabilize ending

        trySpawnDirectorEnemy();
        gameState.enemySpawnTimer = getBaseSpawnInterval(gameState.waveNumber) * phaseMultiplier;
    }

    function tick(time) {
        requestAnimationFrame(tick);
        const dt = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        const timeInSeconds = time / 1000;

        handlePauseToggle();
        handleSettingsToggle();
        handleAudioToggles();

        if(!gameState.isGameStarted) {
            camera.position.set(Math.sin(timeInSeconds * 0.5) * 30, 20, Math.cos(timeInSeconds * 0.5) * 30);
            camera.lookAt(playerSystem.playerGroup.position);
            renderer.render(scene, camera);
            emitDebug(dt);
            if(keys.space) {
                gameState.isGameStarted = true;
                ui.hideStartScreen();
                camera.position.set(0, 35, 25);
                resumeAudio();
                beginWave(1);
            }
            return;
        }

        if(gameState.isGameOver) {
            renderer.render(scene, camera);
            if(keys.restartRequested && ui.canRestart()) resetGame();
            emitDebug(dt);
            return;
        }

        if(gameState.isPaused || gameState.isSettingsOpen) {
            renderer.render(scene, camera);
            ui.updateHUD();
            emitDebug(dt);
            return;
        }

        updateParticles(dt, scene);
        if(updateLoots(dt, scene, playerSystem.playerGroup)) ui.updateHUD();
        updateBullets(dt, scene, playerSystem.playerGroup, callbacks);
        updateEnemies(dt, scene, playerSystem.playerGroup, callbacks);
        playerSystem.update(dt, timeInSeconds);
        updateWaveFlow(dt);
        ui.updateHUD();

        const dashPct = Math.max(0, 1 - (playerStats.dashCooldown / 2.0));
        ui.updateDashBar(dashPct);

        camera.position.lerp(playerSystem.playerGroup.position.clone().add(new THREE.Vector3(0, 35, 25)), 5 * dt);
        camera.lookAt(playerSystem.playerGroup.position);

        emitDebug(dt);
        renderer.render(scene, camera);
    }

    return {
        start: () => tick(0),
        resetGame,
        pauseGame,
        resumeGame,
        openSettings,
        closeSettings
    };
}
