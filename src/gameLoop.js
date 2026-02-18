import * as THREE from 'three';
import { keys } from './input.js';
import { resumeAudio } from './audio.js';
import { gameState, playerStats, obstacles, enemies, loots, resetGameState, resetPlayerStats, clearDynamicState } from './state.js';
import { generateMap } from './world.js';
import { spawnEnemy, updateEnemies } from './enemySystem.js';
import { updateLoots } from './lootSystem.js';
import { updateBullets, clearBullets, clearPendingRespawns, getBulletPoolStats } from './bulletSystem.js';
import { updateParticles, clearParticles, getParticlePoolStats } from './particleSystem.js';
import { markObstacleGridDirty, getGridStats } from './physics.js';

export function createGameLoop(scene, camera, renderer, playerSystem, ui) {
    let lastTime = 0;
    let debugElapsed = 0;
    let fpsSmoothed = 60;

    const callbacks = {
        onUpdateHUD: () => ui.updateHUD(),
        onGameOver: () => {
            if(gameState.isGameOver) return;
            gameState.isGameOver = true;
            playerSystem.playerGroup.visible = false;
            ui.showGameOver();
        }
    };

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
        playerSystem.reset();
        generateMap(scene);
        ui.hideGameOverScreen();
        ui.showStartScreen();
        ui.updateHUD();
        ui.updateDashBar(1);
    }

    function tick(time) {
        requestAnimationFrame(tick);
        const dt = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        const timeInSeconds = time / 1000;

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
            }
            return;
        }

        if(gameState.isGameOver) {
            renderer.render(scene, camera);
            if(keys.restartRequested && ui.canRestart()) resetGame();
            emitDebug(dt);
            return;
        }

        updateParticles(dt, scene);
        if(updateLoots(dt, scene, playerSystem.playerGroup)) ui.updateHUD();
        updateBullets(dt, scene, playerSystem.playerGroup, callbacks);
        updateEnemies(dt, scene, playerSystem.playerGroup, callbacks);
        playerSystem.update(dt, timeInSeconds);
        ui.updateHUD();

        const dashPct = Math.max(0, 1 - (playerStats.dashCooldown / 2.0));
        ui.updateDashBar(dashPct);

        camera.position.lerp(playerSystem.playerGroup.position.clone().add(new THREE.Vector3(0, 35, 25)), 5 * dt);
        camera.lookAt(playerSystem.playerGroup.position);

        gameState.enemySpawnTimer -= dt;
        if(gameState.enemySpawnTimer <= 0) {
            spawnEnemy(scene, playerSystem.playerGroup.position);
            gameState.enemySpawnTimer = Math.max(0.5, 2.0 - (gameState.score * 0.02));
        }

        emitDebug(dt);

        renderer.render(scene, camera);
    }

    return { start: () => tick(0), resetGame };
}
