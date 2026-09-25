import { heatMultiplier, CHAIN_WINDOW, MAX_HEAT } from './heat.js';
import { FINAL_PURSUIT } from './bounty.js';
import { formatRunLog } from './runLog.js';

export function createUIManager(gameState, playerStats, onSaveScore) {
    let preferredName = '';
    let waveBannerTimeoutId = null;
    let heatEventTimeoutId = null;
    let lastHeatLevel = 0;
    let runLog = [];
    const els = {
        score: document.getElementById('score'),
        wave: document.getElementById('wave'),
        waveTimer: document.getElementById('wave-timer'),
        weaponLabel: document.getElementById('weapon-label'),
        heatLevel: document.getElementById('heat-level'),
        heatMultiplier: document.getElementById('heat-multiplier'),
        heatRow: document.getElementById('heat-row'),
        heatEvent: document.getElementById('heat-event'),
        heatChain: document.getElementById('heat-chain'),
        heatChainFill: document.getElementById('heat-chain-fill'),
        health: document.getElementById('health-container'),
        status: document.getElementById('status-msg'),
        waveBanner: document.getElementById('wave-banner'),
        dashBar: document.getElementById('dash-bar'),
        pauseOverlay: document.getElementById('pause-overlay'),
        pauseResumeBtn: document.getElementById('pause-resume-btn'),
        pauseSettingsBtn: document.getElementById('pause-settings-btn'),
        settingsModal: document.getElementById('settings-modal'),
        settingsMusicBtn: document.getElementById('settings-music-btn'),
        settingsSfxBtn: document.getElementById('settings-sfx-btn'),
        settingsResumeBtn: document.getElementById('settings-resume-btn'),
        settingsRestartBtn: document.getElementById('settings-restart-btn'),
        settingsCloseBtn: document.getElementById('settings-close-btn'),
        startScreen: document.getElementById('start-screen'),
        gameOver: document.getElementById('gameover'),
        finalScore: document.getElementById('finalScore'),
        resultTitle: document.getElementById('result-title'),
        resultDetail: document.getElementById('result-detail'),
        bountyChoice: document.getElementById('bounty-choice'),
        bountyAmount: document.getElementById('bounty-amount'),
        bountyHeat: document.getElementById('bounty-heat'),
        bonusSeconds: document.getElementById('bonus-seconds'),
        bankBountyBtn: document.getElementById('bankBountyBtn'),
        rideOnBtn: document.getElementById('rideOnBtn'),
        runLogCount: document.getElementById('run-log-count'),
        runLogStatus: document.getElementById('run-log-status'),
        copyRunLogBtn: document.getElementById('copyRunLogBtn'),
        clearRunLogBtn: document.getElementById('clearRunLogBtn'),
        resultCopyLogBtn: document.getElementById('resultCopyLogBtn'),
        inputSection: document.getElementById('input-section'),
        restartMsg: document.getElementById('restart-msg'),
        playerName: document.getElementById('playerName'),
        playerNameList: document.getElementById('player-name-list'),
        saveButton: document.getElementById('saveScoreBtn'),
        skipButton: document.getElementById('skipScoreBtn'),
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
    els.skipButton?.addEventListener('click', () => {
        els.inputSection.style.display = 'none';
        els.restartMsg.style.display = 'block';
    });

    function updateHUD() {
        const hearts = [];
        for(let i = 0; i < playerStats.maxHp; i++) {
            if(i < playerStats.hp) hearts.push('&#10084;');
            else hearts.push('<span class="heart-dim">&#10084;</span>');
        }
        els.health.innerHTML = hearts.join('');
        els.score.innerText = gameState.score;
        els.wave.innerText = gameState.waveNumber > FINAL_PURSUIT ? 'BONUS' : gameState.waveNumber;
        els.weaponLabel.innerText = playerStats.weapon.toUpperCase();
        updateHeat(gameState.heat);

        if(gameState.isIntermission) {
            els.waveTimer.innerText = `BREAK ${Math.ceil(gameState.intermissionTimer)}s`;
            els.status.className = '';
            els.status.innerText = 'GET READY FOR NEXT WAVE';
            return;
        }

        els.waveTimer.innerText = (gameState.waveBossSpawned && gameState.waveTimer <= 0)
            ? 'OUTLAW'
            : `${Math.ceil(Math.max(0, gameState.waveTimer))}s`;
        if(playerStats.tripleShotTimer > 0) {
            els.status.className = 'status-power';
            els.status.innerText = `TRIPLE SHOT: ${Math.ceil(playerStats.tripleShotTimer)}s`;
        } else {
            els.status.className = '';
            els.status.innerText = '';
        }
    }

    function updateHeat(heat) {
        els.heatLevel.innerText = heat.level;
        els.heatMultiplier.innerText = `x${heatMultiplier(heat.level).toFixed(1)}`;
        // Row glows hotter with each level; the bar shows time left to extend the chain.
        for(let level = 0; level <= MAX_HEAT; level++) els.heatRow.classList.toggle(`heat-${level}`, level === heat.level);
        els.heatChain.classList.toggle('active', heat.chainTimer > 0);
        els.heatChainFill.style.width = `${Math.max(0, Math.min(1, heat.chainTimer / CHAIN_WINDOW)) * 100}%`;
        if(heat.level < lastHeatLevel && heat.level > 0 && !heatEventTimeoutId) showHeatEvent('cooling');
        lastHeatLevel = heat.level;
    }

    const HEAT_EVENTS = {
        up: 'HEAT UP',
        broken: 'CHAIN BROKEN',
        cooling: 'COOLING',
        lost: 'HEAT LOST'
    };

    function showHeatEvent(kind) {
        els.heatEvent.textContent = HEAT_EVENTS[kind] || '';
        els.heatRow.classList.remove('pulse-up', 'pulse-down');
        void els.heatRow.offsetWidth; // restart the CSS animation
        els.heatRow.classList.add(kind === 'up' ? 'pulse-up' : 'pulse-down');
        if(heatEventTimeoutId) clearTimeout(heatEventTimeoutId);
        heatEventTimeoutId = setTimeout(() => {
            els.heatEvent.textContent = '';
            heatEventTimeoutId = null;
        }, 1200);
    }

    function updateDashBar(percent) {
        els.dashBar.style.width = `${Math.max(0, Math.min(1, percent)) * 100}%`;
        els.dashBar.className = percent >= 1 ? 'dash-ready' : 'dash-cooldown';
    }

    function showWaveBanner(text, durationMs = 1800) {
        if(!els.waveBanner) return;
        els.waveBanner.innerText = text;
        els.waveBanner.style.display = 'block';
        if(waveBannerTimeoutId) clearTimeout(waveBannerTimeoutId);
        waveBannerTimeoutId = setTimeout(() => {
            els.waveBanner.style.display = 'none';
            waveBannerTimeoutId = null;
        }, durationMs);
    }

    function renderRunStats() {
        if(!els.runStatsTable) return;
        const s = gameState.runStats;
        const accuracy = s.shotsFired > 0 ? `${Math.round((s.shotsHit / s.shotsFired) * 100)}%` : '0%';
        const rows = [
            ['Pursuit reached', s.waveReached > FINAL_PURSUIT ? 'BONUS' : s.waveReached],
            ['Outlaw bounty', describeBounty(gameState.bounty)],
            ['Peak Heat', gameState.heat.peak],
            ['Enemies destroyed', s.enemiesKilled],
            ['Bandits destroyed', s.banditsKilled],
            ['Gunslingers destroyed', s.gunslingersKilled],
            ['Wolves destroyed', s.wolvesKilled],
            ['Bosses destroyed', s.bossesKilled],
            ['Shots fired', s.shotsFired],
            ['Shot accuracy', accuracy],
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

    function describeBounty(bounty) {
        if(bounty.status === 'banked') return `+${bounty.amount} (banked)`;
        if(bounty.status === 'escaped') return `+${bounty.amount} (escaped)`;
        if(bounty.status === 'forfeited') return `${bounty.amount} lost`;
        return 'not claimed';
    }

    const RESULT_TEXT = {
        banked: ['BOUNTY CLAIMED', 'You took the bounty and rode out.'],
        escaped: ['ESCAPED', 'You outran the posse with the bounty.'],
        died: ['WASTED', '']
    };

    // result: 'died' | 'banked' | 'escaped'
    function showGameOver(result = 'died') {
        hidePauseOverlay();
        hideSettingsModal();
        const [title, detail] = RESULT_TEXT[result] || RESULT_TEXT.died;
        els.resultTitle.textContent = title;
        els.resultTitle.classList.toggle('wasted-text', result === 'died');
        els.resultDetail.textContent = gameState.bounty.status === 'forfeited'
            ? `You rode on and lost the ${gameState.bounty.amount} bounty and your bonus earnings.`
            : detail;
        els.gameOver.style.display = 'flex';
        els.finalScore.innerText = gameState.score;
        renderRunStats();
        els.inputSection.style.display = 'flex';
        els.restartMsg.style.display = 'none';
        els.playerName.value = preferredName;
        els.playerName.focus();
    }

    function showBountyChoice(bounty, bonusSeconds) {
        hidePauseOverlay();
        hideSettingsModal();
        els.bountyAmount.textContent = bounty.amount;
        els.bountyHeat.textContent = `${bounty.heatAtOffer} (x${heatMultiplier(bounty.heatAtOffer).toFixed(1)})`;
        els.bonusSeconds.textContent = bonusSeconds;
        els.bountyChoice.style.display = 'flex';
    }

    function hideBountyChoice() {
        if(els.bountyChoice) els.bountyChoice.style.display = 'none';
    }

    function setRunLog(records) {
        runLog = records;
        if(els.runLogCount) els.runLogCount.textContent = `${records.length} run${records.length === 1 ? '' : 's'}`;
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Clipboard API unavailable (e.g. plain http): fall back to a temporary selection.
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const copied = document.execCommand('copy');
            area.remove();
            return copied;
        }
    }

    async function copyRunLog(button) {
        button.blur(); // Space starts/restarts the game; keep it from re-pressing this button.
        const copied = runLog.length ? await copyText(formatRunLog(runLog)) : false;
        const message = !runLog.length ? 'NO RUNS LOGGED YET' : copied ? `COPIED ${runLog.length} RUNS` : 'COPY FAILED';
        if(els.runLogStatus) els.runLogStatus.textContent = message;
        button.dataset.label = button.dataset.label || button.textContent;
        button.textContent = message;
        setTimeout(() => { button.textContent = button.dataset.label; }, 1500);
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

    function showSettingsModal() {
        if(els.settingsModal) els.settingsModal.style.display = 'flex';
    }

    function hideSettingsModal() {
        if(els.settingsModal) els.settingsModal.style.display = 'none';
    }

    function bindControlHandlers(handlers) {
        if(els.pauseResumeBtn) els.pauseResumeBtn.addEventListener('click', handlers.onResumeGame);
        if(els.pauseSettingsBtn) els.pauseSettingsBtn.addEventListener('click', handlers.onOpenSettings);
        if(els.settingsCloseBtn) els.settingsCloseBtn.addEventListener('click', handlers.onCloseSettings);
        if(els.settingsResumeBtn) els.settingsResumeBtn.addEventListener('click', handlers.onResumeGame);
        if(els.settingsRestartBtn) els.settingsRestartBtn.addEventListener('click', handlers.onRestartRun);
        if(els.settingsMusicBtn) els.settingsMusicBtn.addEventListener('click', handlers.onToggleMusic);
        if(els.settingsSfxBtn) els.settingsSfxBtn.addEventListener('click', handlers.onToggleSfx);
        if(els.bankBountyBtn) els.bankBountyBtn.addEventListener('click', handlers.onBankBounty);
        if(els.rideOnBtn) els.rideOnBtn.addEventListener('click', handlers.onRideOn);
        els.copyRunLogBtn?.addEventListener('click', () => copyRunLog(els.copyRunLogBtn));
        els.resultCopyLogBtn?.addEventListener('click', () => copyRunLog(els.resultCopyLogBtn));
        els.clearRunLogBtn?.addEventListener('click', () => {
            els.clearRunLogBtn.blur();
            if(!runLog.length || !window.confirm(`Delete all ${runLog.length} logged runs from this browser?`)) return;
            handlers.onClearRunLog();
            if(els.runLogStatus) els.runLogStatus.textContent = 'LOG CLEARED';
        });
    }

    function updateAudioControls(settings) {
        if(els.settingsMusicBtn) {
            els.settingsMusicBtn.textContent = `Music: ${settings.musicEnabled ? 'ON' : 'OFF'}`;
            els.settingsMusicBtn.className = settings.musicEnabled ? '' : 'off';
        }
        if(els.settingsSfxBtn) {
            els.settingsSfxBtn.textContent = `SFX: ${settings.sfxEnabled ? 'ON' : 'OFF'}`;
            els.settingsSfxBtn.className = settings.sfxEnabled ? '' : 'off';
        }
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

    return {
        updateHUD,
        updateDashBar,
        showWaveBanner,
        showGameOver,
        showBountyChoice,
        showHeatEvent,
        setRunLog,
        hideBountyChoice,
        hideGameOverScreen,
        showStartScreen,
        hideStartScreen,
        updateLeaderboard,
        canRestart,
        updateDebug,
        bindControlHandlers,
        updateAudioControls,
        setPreferredName,
        showPauseOverlay,
        hidePauseOverlay,
        showSettingsModal,
        hideSettingsModal
    };
}
