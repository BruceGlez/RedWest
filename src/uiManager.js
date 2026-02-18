export function createUIManager(gameState, playerStats, onSaveScore) {
    let preferredName = '';
    const els = {
        score: document.getElementById('score'),
        health: document.getElementById('health-container'),
        status: document.getElementById('status-msg'),
        dashBar: document.getElementById('dash-bar'),
        pauseOverlay: document.getElementById('pause-overlay'),
        startScreen: document.getElementById('start-screen'),
        gameOver: document.getElementById('gameover'),
        finalScore: document.getElementById('finalScore'),
        inputSection: document.getElementById('input-section'),
        restartMsg: document.getElementById('restart-msg'),
        playerName: document.getElementById('playerName'),
        playerNameList: document.getElementById('player-name-list'),
        saveButton: document.getElementById('saveScoreBtn'),
        toggleMusicBtn: document.getElementById('toggle-music-btn'),
        toggleSfxBtn: document.getElementById('toggle-sfx-btn'),
        leaderboard: document.getElementById('highscore-list'),
        debugPanel: document.getElementById('debug-panel'),
        runStatsTable: document.getElementById('run-stats-table')
    };

    if(els.saveButton) {
        els.saveButton.addEventListener('click', () => {
            const name = (els.playerName.value.trim() || preferredName || 'UNKNOWN').toUpperCase();
            preferredName = name;
            onSaveScore(name, gameState.score);
            els.inputSection.style.display = 'none';
            els.restartMsg.style.display = 'block';
        });
    }

    function updateHUD() {
        const hearts = [];
        for(let i = 0; i < playerStats.maxHp; i++) {
            if(i < playerStats.hp) hearts.push('&#10084;');
            else hearts.push('<span class="heart-dim">&#10084;</span>');
        }
        els.health.innerHTML = hearts.join('');
        els.score.innerText = gameState.score;

        if(playerStats.tripleShotTimer > 0) {
            els.status.className = 'status-power';
            els.status.innerText = `TRIPLE SHOT: ${Math.ceil(playerStats.tripleShotTimer)}s`;
        } else {
            els.status.className = '';
            els.status.innerText = '';
        }
    }

    function updateDashBar(percent) {
        els.dashBar.style.width = `${Math.max(0, Math.min(1, percent)) * 100}%`;
        els.dashBar.className = percent >= 1 ? 'dash-ready' : 'dash-cooldown';
    }

    function renderRunStats() {
        if(!els.runStatsTable) return;
        const s = gameState.runStats;
        const rows = [
            ['Enemies destroyed', s.enemiesKilled],
            ['Bandits destroyed', s.banditsKilled],
            ['Gunslingers destroyed', s.gunslingersKilled],
            ['Wolves destroyed', s.wolvesKilled],
            ['Bosses destroyed', s.bossesKilled],
            ['Shots fired', s.shotsFired],
            ['Damage taken', s.damageTaken],
            ['Obstacles destroyed', s.obstaclesDestroyed],
            ['Loot collected', s.lootCollected],
            ['Whiskey picked up', s.whiskeyCollected],
            ['Ammo picked up', s.ammoCollected]
        ];
        els.runStatsTable.innerHTML = '';
        for(const [label, value] of rows) {
            const tr = document.createElement('tr');
            const tdLabel = document.createElement('td');
            const tdValue = document.createElement('td');
            tdLabel.textContent = label;
            tdValue.textContent = value;
            tr.appendChild(tdLabel);
            tr.appendChild(tdValue);
            els.runStatsTable.appendChild(tr);
        }
    }

    function showGameOver() {
        els.gameOver.style.display = 'flex';
        els.finalScore.innerText = gameState.score;
        renderRunStats();
        els.inputSection.style.display = 'flex';
        els.restartMsg.style.display = 'none';
        els.playerName.value = preferredName;
        els.playerName.focus();
    }

    function showStartScreen() {
        els.startScreen.style.display = 'flex';
    }

    function hideStartScreen() {
        els.startScreen.style.display = 'none';
    }

    function hideGameOverScreen() {
        els.gameOver.style.display = 'none';
    }

    function canRestart() {
        return els.inputSection.style.display === 'none';
    }

    function updateLeaderboard(scores) {
        if(!els.leaderboard) return;
        els.leaderboard.innerHTML = '';
        if(els.playerNameList) els.playerNameList.innerHTML = '';
        if(!scores.length) {
            const li = document.createElement('li');
            li.textContent = 'NO RECORDS YET';
            els.leaderboard.appendChild(li);
            return;
        }

        const uniqueNames = new Set();
        scores.forEach((s, i) => {
            const li = document.createElement('li');
            const rank = document.createElement('span');
            rank.textContent = `#${i + 1} ${s.name}`;
            const value = document.createElement('span');
            value.className = 'score-value';
            value.textContent = s.score;
            li.appendChild(rank);
            li.appendChild(value);
            els.leaderboard.appendChild(li);
            uniqueNames.add(s.name);
        });

        if(els.playerNameList) {
            for(const name of uniqueNames) {
                const option = document.createElement('option');
                option.value = name;
                els.playerNameList.appendChild(option);
            }
        }
    }

    function setPreferredName(name) {
        preferredName = (name || '').toUpperCase();
        if(els.playerName) els.playerName.value = preferredName;
    }

    function showPauseOverlay() {
        if(els.pauseOverlay) els.pauseOverlay.style.display = 'block';
    }

    function hidePauseOverlay() {
        if(els.pauseOverlay) els.pauseOverlay.style.display = 'none';
    }

    function updateDebug(debugData) {
        if(!els.debugPanel) return;
        els.debugPanel.textContent =
`FPS: ${debugData.fps}
Enemies: ${debugData.enemies}
Obstacles: ${debugData.obstacles}
Loot: ${debugData.loot}
Bullets: ${debugData.bulletsActive} / pool ${debugData.bulletsPooled}
Particles: ${debugData.particlesActive} / pool ${debugData.particlesPooled}
Respawns queued: ${debugData.pendingRespawns}
Grid cells: O=${debugData.obstacleCells} E=${debugData.enemyCells}
Grid dirty: ${debugData.obstacleGridDirty ? 'yes' : 'no'}`;
    }

    function bindAudioControls(onToggleMusic, onToggleSfx) {
        if(els.toggleMusicBtn) els.toggleMusicBtn.addEventListener('click', onToggleMusic);
        if(els.toggleSfxBtn) els.toggleSfxBtn.addEventListener('click', onToggleSfx);
    }

    function updateAudioControls(settings) {
        if(els.toggleMusicBtn) {
            els.toggleMusicBtn.textContent = `Music: ${settings.musicEnabled ? 'ON' : 'OFF'}`;
            els.toggleMusicBtn.className = settings.musicEnabled ? '' : 'off';
        }
        if(els.toggleSfxBtn) {
            els.toggleSfxBtn.textContent = `SFX: ${settings.sfxEnabled ? 'ON' : 'OFF'}`;
            els.toggleSfxBtn.className = settings.sfxEnabled ? '' : 'off';
        }
    }

    return {
        updateHUD,
        updateDashBar,
        showGameOver,
        hideGameOverScreen,
        showStartScreen,
        hideStartScreen,
        updateLeaderboard,
        canRestart,
        updateDebug,
        bindAudioControls,
        updateAudioControls,
        setPreferredName,
        showPauseOverlay,
        hidePauseOverlay
    };
}
