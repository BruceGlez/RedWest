import * as THREE from 'three';
import { keys } from './input.js';
import { resumeAudio, playSound, getAudioSettings, toggleMusicEnabled, toggleSfxEnabled } from './audio.js';
import { gameState, playerStats, obstacles, enemies, loots, resetGameState, resetPlayerStats, clearDynamicState } from './state.js';
import { generateMap } from './world.js';
import { spawnEnemy, updateEnemies } from './enemySystem.js';
import { updateLoots } from './lootSystem.js';
import { updateBullets, clearBullets, clearPendingRespawns, getBulletPoolStats } from './bulletSystem.js';
import { updateParticles, clearParticles, getParticlePoolStats } from './particleSystem.js';
import { markObstacleGridDirty, getGridStats } from './physics.js';
import { advanceHeat, heatSpawnMultiplier, recordDamage, recordKill, recordMiss } from './heat.js';
import { buildRunRecord, appendRunRecord } from './runLog.js';
import { FINAL_PURSUIT, BONUS_PURSUIT_SECONDS, offerBounty, bankBounty, rideOn, escapeWithBounty, forfeitBounty } from './bounty.js';

const FINAL_WAVE = FINAL_PURSUIT;
const BONUS_WAVE = FINAL_PURSUIT + 1;

const ENEMY_COST = {
    bandit: 1.0,
    wolf: 1.2,
    gunslinger: 2.0
};

function getWaveDuration(wave) {
    if(wave === BONUS_WAVE) return BONUS_PURSUIT_SECONDS;
    return wave === FINAL_WAVE ? 35 : 28;
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
        gunslinger: Math.max(1, Math.floor(wave / 2))
    };
}

function getWaveWeights(wave) {
    return {
        bandit: Math.max(0.8, 2.4 - (wave * 0.12)),
        wolf: Math.min(2.2, 0.8 + (wave * 0.16)),
        gunslinger: Math.min(2.4, 0.3 + (wave * 0.2))
    };
}

function getActiveEnemyCounts() {
    const counts = { bandit: 0, wolf: 0, gunslinger: 0 };
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
    let sessionRun = 0;

    // result: 'died' | 'banked' | 'escaped'
    function finishRun(result) {
        if(gameState.isGameOver) return;
        if(result === 'died') gameState.score = forfeitBounty(gameState.bounty, gameState.score);
        gameState.runWon = result !== 'died';
        gameState.isGameOver = true;
        gameState.isChoosingBounty = false;
        playerSystem.playerGroup.visible = false;
        ui.hideBountyChoice();
        ui.setRunLog(appendRunRecord(buildRunRecord(gameState, result, sessionRun)));
        ui.showGameOver(result);
    }

    function openBountyChoice() {
        if(gameState.isGameOver || gameState.isChoosingBounty) return;
        offerBounty(gameState.bounty, gameState.heat.level);
        gameState.isChoosingBounty = true;
        clearBullets(scene);
        ui.showBountyChoice(gameState.bounty, BONUS_PURSUIT_SECONDS);
    }

    function bankAndLeave() {
        if(!gameState.isChoosingBounty) return;
        gameState.score = bankBounty(gameState.bounty, gameState.score);
        finishRun('banked');
    }

    function rideOnToBonus() {
        if(!gameState.isChoosingBounty) return;
        rideOn(gameState.bounty, gameState.score);
        gameState.isChoosingBounty = false;
        ui.hideBountyChoice();
        beginWave(BONUS_WAVE);
    }

    const callbacks = {
        onUpdateHUD: () => ui.updateHUD(),
        onGameOver: () => finishRun('died'),
        onBossDefeated: () => openBountyChoice(),
        onPlayerDamaged: () => {
            const hadHeat = gameState.heat.level > 0;
            recordDamage(gameState.heat);
            if(hadHeat) {
                playSound('heatLost');
                ui.showHeatEvent('lost');
            }
        },
        onPlayerMiss: () => {
            const hadChain = gameState.heat.streak > 0;
            recordMiss(gameState.heat);
            if(hadChain) ui.showHeatEvent('broken');
        },
        onEnemyKilled: (type) => {
            const levelBefore = gameState.heat.level;
            const multiplier = recordKill(gameState.heat);
            if(gameState.heat.level > levelBefore) {
                playSound('heatUp');
                ui.showHeatEvent('up');
            }
            // The outlaw pays out through the bounty choice instead of as a kill score.
            if(type !== 'boss') {
                gameState.score += Math.round(10 * multiplier);
                gameState.waveBudgetRemaining += Math.min(1.2, gameState.heat.level * 0.3);
            }
            ui.updateHUD();
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
        if(waveNumber === FINAL_WAVE) {
            spawnEnemy(scene, playerSystem.playerGroup.position, 'boss');
            gameState.waveBossSpawned = true;
            ui.showWaveBanner('OUTLAW ARRIVES — TAKE THE BOUNTY', 2500);
        } else if(waveNumber === BONUS_WAVE) {
            for(const type of ['gunslinger', 'wolf', 'wolf']) {
                spawnEnemy(scene, playerSystem.playerGroup.position, type);
                gameState.waveBudgetRemaining -= ENEMY_COST[type];
            }
            ui.showWaveBanner(`BONUS PURSUIT — SURVIVE ${BONUS_PURSUIT_SECONDS}s TO ESCAPE`, 2500);
        } else {
            const introductions = waveNumber === 1 ? ['bandit'] : ['wolf', 'gunslinger'];
            for(const type of introductions) {
                spawnEnemy(scene, playerSystem.playerGroup.position, type);
                gameState.waveBudgetRemaining -= ENEMY_COST[type];
            }
            ui.showWaveBanner(`PURSUIT ${waveNumber} / ${FINAL_WAVE}`);
        }
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
        // Higher Heat sends more dangerous pursuers, not only more of them.
        weights.gunslinger *= 1 + (gameState.heat.level * 0.25);
        weights.wolf *= 1 + (gameState.heat.level * 0.15);
        const active = getActiveEnemyCounts();
        const candidates = [];

        for(const type of ['bandit', 'wolf', 'gunslinger']) {
            const heatCapBonus = type === 'bandit' ? gameState.heat.level * 2 : Math.floor(gameState.heat.level / 2);
            if(active[type] >= (caps[type] || 0) + heatCapBonus) continue;
            if(ENEMY_COST[type] > remaining) continue;
            candidates.push({ type, weight: weights[type] || 0 });
        }

        const chosenType = chooseWeightedType(candidates);
        if(!chosenType) return;

        spawnEnemy(scene, playerSystem.playerGroup.position, chosenType);
        gameState.waveBudgetRemaining = Math.max(0, gameState.waveBudgetRemaining - ENEMY_COST[chosenType]);
    }

    function pauseGame() {
        if(!gameState.isGameStarted || gameState.isGameOver || gameState.isChoosingBounty) return;
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
        if(!gameState.isGameStarted || gameState.isGameOver || gameState.isChoosingBounty) return;
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
        keys.bankRequested = false;
        keys.rideOnRequested = false;
        playerSystem.reset();
        generateMap(scene);
        ui.hideGameOverScreen();
        ui.hideBountyChoice();
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
        // The final pursuit only ends with the outlaw; keep reinforcements coming after the timer.
        if(gameState.waveTimer <= 0 && gameState.waveNumber === FINAL_WAVE) {
            gameState.waveTimer = 0;
            if(gameState.waveBudgetRemaining < ENEMY_COST.bandit) gameState.waveBudgetRemaining = ENEMY_COST.bandit;
        } else if(gameState.waveTimer <= 0 && gameState.waveNumber === BONUS_WAVE) {
            gameState.score = escapeWithBounty(gameState.bounty, gameState.score);
            finishRun('escaped');
            return;
        } else if(gameState.waveTimer <= 0) {
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
        let interval = getBaseSpawnInterval(gameState.waveNumber) * phaseMultiplier;
        gameState.enemySpawnTimer = interval / heatSpawnMultiplier(gameState.heat.level);
    }

    function tick(time) {
        requestAnimationFrame(tick);
        const dt = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        const timeInSeconds = time / 1000;

        handlePauseToggle();
        handleSettingsToggle();
        handleAudioToggles();
        // B / C only answer the bounty choice; ignore presses made before it opens.
        if(!gameState.isChoosingBounty) {
            keys.bankRequested = false;
            keys.rideOnRequested = false;
        }

        if(!gameState.isGameStarted) {
            camera.position.set(Math.sin(timeInSeconds * 0.5) * 30, 20, Math.cos(timeInSeconds * 0.5) * 30);
            camera.lookAt(playerSystem.playerGroup.position);
            renderer.render(scene, camera);
            emitDebug(dt);
            if(keys.space) {
                gameState.isGameStarted = true;
                sessionRun++;
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

        if(gameState.isChoosingBounty) {
            if(keys.bankRequested) bankAndLeave();
            else if(keys.rideOnRequested) rideOnToBonus();
            keys.bankRequested = false;
            keys.rideOnRequested = false;
            renderer.render(scene, camera);
            emitDebug(dt);
            return;
        }

        if(gameState.isPaused || gameState.isSettingsOpen) {
            renderer.render(scene, camera);
            ui.updateHUD();
            emitDebug(dt);
            return;
        }

        gameState.runTime += dt;
        advanceHeat(gameState.heat, dt);
        updateParticles(dt, scene);
        if(updateLoots(dt, scene, playerSystem.playerGroup)) ui.updateHUD();
        updateBullets(dt, scene, playerSystem.playerGroup, callbacks);
        // A bullet can end the run or open the bounty choice; freeze the rest of this frame if so.
        const stillFighting = () => !gameState.isGameOver && !gameState.isChoosingBounty;
        if(stillFighting()) updateEnemies(dt, scene, playerSystem.playerGroup, callbacks);
        if(stillFighting()) playerSystem.update(dt, timeInSeconds);
        if(stillFighting()) updateWaveFlow(dt);
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
        closeSettings,
        bankAndLeave,
        rideOnToBonus
    };
}
