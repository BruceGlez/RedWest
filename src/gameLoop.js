import * as THREE from 'three';
import { keys, touch } from './input.js';
import { resumeAudio, playSound, playVoice, setMusicTrack, setFightIntensity, getAudioSettings, toggleMusicEnabled, toggleSfxEnabled } from './audio.js';
import { gameState, playerStats, obstacles, enemies, loots, resetGameState, resetPlayerStats, clearDynamicState } from './state.js';
import { generateMap, updateSun, setAtmosphere } from './world.js';
import { updateAmbience } from './ambience.js';
import { spawnEnemy, updateEnemies, updateHazards, clearHazards } from './enemySystem.js';
import { updateLoots } from './lootSystem.js';
import { updateBullets, clearBullets, clearPendingRespawns, getBulletPoolStats } from './bulletSystem.js';
import { updateParticles, clearParticles, getParticlePoolStats } from './particleSystem.js';
import { updateDecals, clearDecals } from './decals.js';
import { markObstacleGridDirty, getGridStats } from './physics.js';
import { advanceHeat, heatSpawnMultiplier, recordDamage, recordKill, recordMiss } from './heat.js';
import { buildRunRecord, appendRunRecord } from './runLog.js';
import { track } from './analytics.js';
import { DEMO, DEMO_SECONDS, showDemoEnd } from './demo.js';
import { getOutlaw, applyOutlawToWave, setEventModifiers } from './outlaws.js';
import { ENEMY_TYPES, rosterWave, featuredFor, enemyCost } from './enemyTypes.js';
import { markSeen, recordKills } from './progress.js';
import { addShake, shakeOffset, hitStop, timeScale, haptic, floatText, updateFeedback, resetFeedback } from './feedback.js';
import { recordRun, saveProgress } from './progress.js';
import { arena } from './arena.js';
import { FINAL_PURSUIT, BONUS_PURSUIT_SECONDS, offerBounty, bankBounty, rideOn, escapeWithBounty, forfeitBounty } from './bounty.js';
import { clearCombatFx, updateCombatFx } from './combatFx.js';
import { disposeBaked } from './meshMerge.js';

const FINAL_WAVE = FINAL_PURSUIT;
// Phones get a closer camera so characters read at small sizes; off-screen arrows cover the rest.
const CAMERA_OFFSET_DESKTOP = new THREE.Vector3(0, 35, 25);
const CAMERA_OFFSET_PHONE = new THREE.Vector3(0, 26, 18.5);
const OUTLAW_DOWN_SLOWMO_MS = 650;
const BONUS_WAVE = FINAL_PURSUIT + 1;

const MIN_ENEMY_COST = 0.8;

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

// Base pursuit numbers, adjusted for the current Wanted Road outlaw.
function getOutlawWave(wave) {
    return applyOutlawToWave({
        budget: getWaveBudget(wave),
        interval: getBaseSpawnInterval(wave),
        ...rosterWave(gameState.outlawIndex, wave)
    }, gameState.outlawIndex);
}

function getActiveEnemyCounts() {
    const counts = {};
    for(const e of enemies) counts[e.userData.type] = (counts[e.userData.type] || 0) + 1;
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

export function createGameLoop(scene, camera, renderer, playerSystem, ui, progress, economy = null) {
    let lastTime = 0;
    let debugElapsed = 0;
    let fpsSmoothed = 60;
    let pausedBeforeSettings = false;
    let sessionRun = 0;
    let bountyChoiceAt = 0; // slow-motion beat after the outlaw falls, then the choice opens
    let lobbyView = null; // another scene to draw on the home screen (Frontier Town), when active
    // Held upright, the screen shows a narrow slice of the arena, so the camera stands further back.
    const cameraOffset = () => {
        const base = touch.enabled ? CAMERA_OFFSET_PHONE : CAMERA_OFFSET_DESKTOP;
        return window.innerHeight > window.innerWidth ? base.clone().multiplyScalar(1.6) : base;
    };

    // Spawn and record first sightings for the Bounty Book (with a NEW ENEMY card in play).
    function spawn(type) {
        spawnEnemy(scene, playerSystem.playerGroup.position, type);
        if(type !== 'boss' && markSeen(progress, type)) {
            saveProgress(progress);
            ui.showNewEnemy(type);
        }
    }

    // result: 'died' | 'banked' | 'escaped'
    function finishRun(result) {
        if(gameState.isGameOver) return;
        if(DEMO) { // the playable ad ends on its end card
            gameState.isGameOver = true;
            if(result === 'died') playerSystem.die();
            showDemoEnd(result === 'died' ? 'SHOT DOWN!' : 'OUTLAW DOWN!');
            return;
        }
        track('run_end');
        setMusicTrack('home');
        if(result === 'banked' || result === 'escaped') {
            playSound('bounty');
            playVoice(result === 'banked' ? 'announce-bounty' : 'announce-escaped');
        }
        if(arena.enabled) {
            // Practice: show the result, record nothing.
            gameState.runWon = result !== 'died';
            gameState.isGameOver = true;
            gameState.isChoosingBounty = false;
            if(result === 'died') playerSystem.die();
            ui.hideBountyChoice();
            ui.showGameOver(result, null);
            ui.showPracticeResult();
            return;
        }
        if(result === 'died') gameState.score = forfeitBounty(gameState.bounty, gameState.score);
        gameState.runWon = result !== 'died';
        gameState.isGameOver = true;
        gameState.isChoosingBounty = false;
        if(result === 'died') playerSystem.die();
        ui.hideBountyChoice();
        ui.setRunLog(appendRunRecord(buildRunRecord(gameState, result, sessionRun)));
        // Event runs do not move the Wanted Road (the event outlaw may not be unlocked yet).
        const roadResult = gameState.event ? null : recordRun(progress, gameState.outlawIndex, gameState.bounty, gameState.score);
        recordKills(progress, gameState.runStats.kills);
        reportEarnings(roadResult);
        saveProgress(progress);
        ui.setProgress(progress);
        ui.showGameOver(result, roadResult);
    }

    // Bounty Dollars and daily jobs (wallet may be a server, so this is async).
    function reportEarnings(roadResult) {
        if(!economy) return;
        const s = gameState.runStats;
        const bits = roadResult?.newStars ?? 0;
        const summary = {
            score: gameState.score,
            bounty: gameState.bounty.status === 'none' ? 'none' : gameState.bounty.status,
            newStars: (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1),
            peakHeat: gameState.heat.peak,
            kills: { ...s.kills },
            shotsHit: s.shotsHit,
            loot: s.lootCollected,
            // Leaderboard records: the server checks the score is plausible for the run's length.
            seconds: Math.round(gameState.runTime),
            outlawIndex: gameState.outlawIndex,
            heatAtOutlaw: gameState.bounty.heatAtOffer,
            event: gameState.event?.week
        };
        economy.reportRun(summary)
            .then(result => ui.showEarnings(result))
            .catch(error => ui.showEarnings(null, error.message));
    }

    function openBountyChoice() {
        if(gameState.isGameOver || gameState.isChoosingBounty) return;
        offerBounty(gameState.bounty, gameState.heat.level, getOutlaw(gameState.outlawIndex).bounty);
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

    let lastDeflectAt = 0;
    const callbacks = {
        onUpdateHUD: () => ui.updateHUD(),
        // Outlaw signature moves announce themselves (howl, reload, reappearing ghost).
        onBossSignal: (text, position) => floatText(text, position, 'hot'),
        onDeflect: position => {
            if(performance.now() - lastDeflectAt < 600) return;
            lastDeflectAt = performance.now();
            floatText('CLANG!', position, '');
            playSound('clang');
        },
        onGameOver: () => finishRun('died'),
        onBossDefeated: () => {
            if(DEMO) {
                playSound('outlaw-down');
                finishRun('banked');
                return;
            }
            if(bountyChoiceAt) return;
            track('outlaw_win');
            playSound('outlaw-down');
            playVoice('announce-outlaw-down');
            addShake(0.9);
            haptic('heavy');
            hitStop(OUTLAW_DOWN_SLOWMO_MS);
            playerStats.invulnerabilityTimer = 2;
            bountyChoiceAt = performance.now() + OUTLAW_DOWN_SLOWMO_MS;
        },
        onPlayerDamaged: () => {
            addShake(0.45);
            haptic('heavy');
            floatText('-1', playerSystem.playerGroup.position, 'hurt');
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
        onEnemyKilled: (type, position) => {
            const levelBefore = gameState.heat.level;
            const multiplier = recordKill(gameState.heat, gameState.event?.twist.heatGain || 1);
            if(gameState.heat.level > levelBefore) {
                playSound('heatUp');
                ui.showHeatEvent('up');
                haptic('medium');
            }
            // The outlaw pays out through the bounty choice instead of as a kill score.
            if(type !== 'boss') {
                const points = Math.round(10 * multiplier);
                gameState.score += points;
                addShake(0.12);
                haptic('light');
                if(position) floatText(`+${points}`, position, gameState.heat.level >= 2 ? 'hot' : '');
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
        gameState.waveBudgetRemaining = getOutlawWave(waveNumber).budget;
        gameState.enemySpawnTimer = 0.55;
        gameState.runStats.waveReached = Math.max(gameState.runStats.waveReached, waveNumber);
        if(waveNumber === FINAL_WAVE) {
            const outlaw = getOutlaw(gameState.outlawIndex);
            const count = outlaw.signature.style === 'brothers' ? 3 : 1;
            for(let i = 0; i < count; i++) spawn('boss');
            gameState.waveBossSpawned = true;
            setMusicTrack('showdown');
            playVoice(outlaw.id);
            // The banner teaches the outlaw's signature move.
            ui.showWaveBanner(`${outlaw.name} RIDE${count > 1 ? '' : 'S'} IN\n\u201C${outlaw.taunt}\u201D\n${outlaw.signature.tip}`, 4600);
        } else if(waveNumber === BONUS_WAVE) {
            setMusicTrack('fight');
            const featured = featuredFor(gameState.outlawIndex);
            for(const type of ['gunslinger', 'wolf', 'wolf', ...(featured ? [featured] : [])]) {
                spawn(type);
                gameState.waveBudgetRemaining -= enemyCost(type);
            }
            // The ride-on countdown (bonus HUD) states the goal for the whole pursuit.
        } else {
            // Each stage opens by showing off its new enemy.
            const featured = featuredFor(gameState.outlawIndex);
            const introductions = waveNumber === 1 ? ['bandit'] : ['wolf', 'gunslinger'];
            if(featured) introductions.push(featured);
            for(const type of introductions) {
                spawn(type);
                gameState.waveBudgetRemaining -= enemyCost(type);
            }
            const boss = getOutlaw(gameState.outlawIndex).name;
            const gang = waveNumber !== 1 ? '' : gameState.event ? `MOST WANTED: ${gameState.event.twist.name} — `
                : `${boss}${boss.endsWith('S') ? "'" : "'S"} GANG — `;
            ui.showWaveBanner(`${gang}PURSUIT ${waveNumber} / ${FINAL_WAVE}`, waveNumber === 1 ? 2500 : 1800);
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
        if(remaining < MIN_ENEMY_COST) return;

        const { caps, weights } = getOutlawWave(wave);
        const active = getActiveEnemyCounts();
        const candidates = [];

        for(const type of Object.keys(weights)) {
            // Higher Heat sends more dangerous pursuers, not only more of them.
            const danger = ENEMY_TYPES[type]?.danger ?? 1;
            const weight = weights[type] * (danger >= 2 ? 1 + (gameState.heat.level * 0.2) : 1);
            const heatCapBonus = type === 'bandit' ? gameState.heat.level * 2 : Math.floor(gameState.heat.level / 2);
            if((active[type] || 0) >= (caps[type] || 0) + heatCapBonus) continue;
            if(enemyCost(type) > remaining) continue;
            candidates.push({ type, weight });
        }

        const chosenType = chooseWeightedType(candidates);
        if(!chosenType) return;

        spawn(chosenType);
        gameState.waveBudgetRemaining = Math.max(0, gameState.waveBudgetRemaining - enemyCost(chosenType));
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
        for(const e of enemies) { scene.remove(e); disposeBaked(e); }
        clearCombatFx();
        for(const l of loots) scene.remove(l);
        for(const obs of obstacles) {
            scene.remove(obs.mesh);
            obs.mesh.traverse(o => { if(o.isMesh) o.geometry.dispose(); }); // each prop has its own geometry
        }
        clearBullets(scene);
        clearPendingRespawns();
        clearHazards(scene);
        clearParticles(scene);
        clearDecals();
        clearDynamicState();
        markObstacleGridDirty();
    }

    let hotMusic = false;

    function resetGame() {
        hotMusic = false;
        bountyChoiceAt = 0;
        gameState.event = null;
        setEventModifiers([]);
        setMusicTrack('home');
        resetFeedback();
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
            if(gameState.waveBudgetRemaining < 1) gameState.waveBudgetRemaining = 1;
        } else if(gameState.waveTimer <= 0 && gameState.waveNumber === BONUS_WAVE) {
            gameState.score = escapeWithBounty(gameState.bounty, gameState.score);
            finishRun('escaped');
            return;
        } else if(gameState.waveTimer <= 0) {
            beginIntermission();
            return;
        }

        if(arena.enabled && !arena.gang) return; // arena: just the outlaw (and anyone they call in)
        gameState.enemySpawnTimer -= dt;
        if(gameState.enemySpawnTimer > 0) return;

        const phase = gameState.waveTimer / gameState.waveDuration;
        let phaseMultiplier = 1;
        if(phase > 0.66) phaseMultiplier = 1.15; // slower opener
        else if(phase > 0.33) phaseMultiplier = 0.85; // pressure spike
        else phaseMultiplier = 1.0; // stabilize ending

        trySpawnDirectorEnemy();
        let interval = getOutlawWave(gameState.waveNumber).interval * phaseMultiplier;
        gameState.enemySpawnTimer = interval / heatSpawnMultiplier(gameState.heat.level);
    }

    function tick(time) {
        requestAnimationFrame(tick);
        const realDt = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        // Hit-stop slows gameplay for a beat; the camera and UI keep real time.
        const dt = realDt * timeScale(performance.now());
        const timeInSeconds = time / 1000;

        handlePauseToggle();
        handleSettingsToggle();
        handleAudioToggles();
        // B / C only answer the bounty choice; ignore presses made before it opens.
        if(!gameState.isChoosingBounty) {
            keys.bankRequested = false;
            keys.rideOnRequested = false;
        }

        // Frontier Town open: draw the town instead of the desert (src/townPanel.js).
        if(!gameState.isGameStarted && lobbyView?.isActive()) {
            lobbyView.frame(renderer, realDt);
            return;
        }
        if(!gameState.isGameStarted) {
            // The desert behind the start screen wears the look of the outlaw the player is about to face.
            setAtmosphere(scene, getOutlaw(arena.enabled ? arena.outlaw : progress.selected).id);
            updateAmbience(realDt, timeInSeconds, playerSystem.playerGroup.position);
            // Slow orbit, tilted up enough to show the stage's sky and skyline behind the start screen.
            camera.position.set(Math.sin(timeInSeconds * 0.5) * 30, 11, Math.cos(timeInSeconds * 0.5) * 30);
            camera.lookAt(playerSystem.playerGroup.position.x, 7, playerSystem.playerGroup.position.z);
            renderer.render(scene, camera);
            emitDebug(realDt);
            // Entry screen still up, or the first-launch question still open.
            if(gameState.startBlocked || gameState.loading) keys.startRequested = false;
            else if(keys.space || keys.startRequested) {
                keys.startRequested = false;
                track('run_start');
                gameState.isGameStarted = true;
                // A Most Wanted event run (picked in Frontier Town) fights that week's outlaw with its twist.
                const event = arena.enabled ? null : gameState.pendingEvent;
                gameState.pendingEvent = null;
                gameState.event = event || null;
                setEventModifiers(event?.twist.modifiers);
                gameState.outlawIndex = arena.enabled ? arena.outlaw : event ? event.outlaw : progress.selected;
                setAtmosphere(scene, getOutlaw(gameState.outlawIndex).id);
                sessionRun++;
                ui.hideStartScreen();
                camera.position.copy(cameraOffset());
                setMusicTrack('fight');
                resumeAudio();
                playVoice('marshal-start');
                // The arena goes straight to the outlaw.
                beginWave(arena.enabled ? FINAL_WAVE : 1);
            }
            return;
        }

        if(gameState.isGameOver) {
            playerSystem.animateModel(realDt);
            renderer.render(scene, camera);
            if(keys.restartRequested && ui.canRestart()) resetGame();
            emitDebug(realDt);
            return;
        }

        if(gameState.isChoosingBounty) {
            if(keys.bankRequested) bankAndLeave();
            else if(keys.rideOnRequested) rideOnToBonus();
            keys.bankRequested = false;
            keys.rideOnRequested = false;
            renderer.render(scene, camera);
            emitDebug(realDt);
            return;
        }

        if(gameState.isPaused || gameState.isSettingsOpen) {
            renderer.render(scene, camera);
            ui.updateHUD();
            emitDebug(realDt);
            return;
        }

        if(bountyChoiceAt && performance.now() >= bountyChoiceAt) {
            bountyChoiceAt = 0;
            if(arena.enabled) finishRun('arena-win');
            else openBountyChoice();
            renderer.render(scene, camera);
            return;
        }

        if(arena.enabled && arena.invincible) playerStats.hp = playerStats.maxHp;
        gameState.runTime += dt;
        if(DEMO && gameState.runTime > DEMO_SECONDS) {
            gameState.isGameOver = true;
            showDemoEnd('THE HUNT GOES ON');
            return;
        }
        advanceHeat(gameState.heat, dt);
        updateParticles(dt, scene);
        updateDecals(dt);
        // The fight music heats up with the marshal's Heat (with a gap between going up and cooling, so it does not flip).
        if(gameState.heat.level >= 3) hotMusic = true; else if(gameState.heat.level < 2) hotMusic = false;
        setFightIntensity(hotMusic);
        updateCombatFx(dt);
        if(updateLoots(dt, scene, playerSystem.playerGroup)) ui.updateHUD();
        // Sub-step bullets on slow frames so fast shots cannot skip past a target between frames.
        const bulletSteps = Math.max(1, Math.ceil(dt / 0.02));
        for(let step = 0; step < bulletSteps && !gameState.isGameOver && !gameState.isChoosingBounty; step++) {
            updateBullets(dt / bulletSteps, scene, playerSystem.playerGroup, callbacks);
        }
        // A bullet can end the run or open the bounty choice; freeze the rest of this frame if so.
        const stillFighting = () => !gameState.isGameOver && !gameState.isChoosingBounty;
        if(stillFighting()) updateEnemies(dt, scene, playerSystem.playerGroup, callbacks);
        if(stillFighting()) updateHazards(dt, scene, playerSystem.playerGroup, callbacks);
        if(stillFighting()) playerSystem.update(dt, timeInSeconds);
        if(stillFighting()) updateWaveFlow(dt);
        ui.updateHUD();

        const dashPct = Math.max(0, 1 - (playerStats.dashCooldown / (playerStats.perk?.dashCooldown || 2.0)));
        ui.updateDashBar(dashPct);

        const playerPos = playerSystem.playerGroup.position;
        camera.position.lerp(playerPos.clone().add(cameraOffset()), 5 * realDt);
        const shake = shakeOffset(realDt, time);
        camera.position.x += shake.x;
        camera.position.z += shake.z;
        camera.lookAt(playerPos.x + shake.x * 0.5, playerPos.y, playerPos.z + shake.z * 0.5);
        updateFeedback(realDt, camera, enemies, playerPos);
        updateSun(playerPos);
        updateAmbience(realDt, timeInSeconds, playerPos);

        emitDebug(realDt);
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
        rideOnToBonus,
        setLobbyView: view => { lobbyView = view; }
    };
}
