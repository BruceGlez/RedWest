export function createUIManager(gameState, playerStats, onSaveScore) {
    const els = {
        score: document.getElementById('score'),
        health: document.getElementById('health-container'),
        status: document.getElementById('status-msg'),
        dashBar: document.getElementById('dash-bar'),
        startScreen: document.getElementById('start-screen'),
        gameOver: document.getElementById('gameover'),
        finalScore: document.getElementById('finalScore'),
        inputSection: document.getElementById('input-section'),
        restartMsg: document.getElementById('restart-msg'),
        playerName: document.getElementById('playerName'),
        saveButton: document.getElementById('saveScoreBtn'),
        leaderboard: document.getElementById('highscore-list')
    };

    if(els.saveButton) {
        els.saveButton.addEventListener('click', () => {
            const name = (els.playerName.value.trim() || 'UNKNOWN').toUpperCase();
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

    function showGameOver() {
        els.gameOver.style.display = 'flex';
        els.finalScore.innerText = gameState.score;
        els.inputSection.style.display = 'flex';
        els.restartMsg.style.display = 'none';
        els.playerName.value = '';
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
        if(!scores.length) {
            const li = document.createElement('li');
            li.textContent = 'NO RECORDS YET';
            els.leaderboard.appendChild(li);
            return;
        }
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
        });
    }

    return {
        updateHUD,
        updateDashBar,
        showGameOver,
        hideGameOverScreen,
        showStartScreen,
        hideStartScreen,
        updateLeaderboard,
        canRestart
    };
}
