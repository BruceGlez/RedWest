export const gameState = {
    score: 0,
    isGameOver: false,
    isGameStarted: false,
    isPaused: false,
    isSettingsOpen: false,
    enemySpawnTimer: 0,
    waveNumber: 1,
    waveTimer: 0,
    waveDuration: 0,
    intermissionTimer: 0,
    isIntermission: false,
    waveBossSpawned: false,
    waveBudgetRemaining: 0,
    waveModifier: null,
    MAP_SIZE: 140,
    runStats: {
        shotsFired: 0,
        shotsHit: 0,
        damageTaken: 0,
        enemiesKilled: 0,
        banditsKilled: 0,
        gunslingersKilled: 0,
        wolvesKilled: 0,
        bossesKilled: 0,
        obstaclesDestroyed: 0,
        lootCollected: 0,
        whiskeyCollected: 0,
        ammoCollected: 0,
        waveReached: 1
    }
};

export const playerStats = {
    maxHp: 5, 
    hp: 5,
    speed: 15, 
    dashSpeed: 45,
    isDashing: false, 
    dashCooldown: 0, 
    dashDuration: 0,
    shootCooldown: 0,
    fireRate: 0.2,
    tripleShotTimer: 0,
    weapon: 'revolver'
};

// Global Arrays
export const obstacles = []; 
export const bullets = [];
export const enemies = [];
export const particles = [];
export const loots = []; 

export function resetGameState() {
    gameState.score = 0;
    gameState.isGameOver = false;
    gameState.isGameStarted = false;
    gameState.isPaused = false;
    gameState.isSettingsOpen = false;
    gameState.enemySpawnTimer = 0;
    gameState.waveNumber = 1;
    gameState.waveTimer = 0;
    gameState.intermissionTimer = 0;
    gameState.waveDuration = 0;
    gameState.isIntermission = false;
    gameState.waveBossSpawned = false;
    gameState.waveBudgetRemaining = 0;
    gameState.waveModifier = null;
    const s = gameState.runStats;
    s.shotsFired = 0;
    s.shotsHit = 0;
    s.damageTaken = 0;
    s.enemiesKilled = 0;
    s.banditsKilled = 0;
    s.gunslingersKilled = 0;
    s.wolvesKilled = 0;
    s.bossesKilled = 0;
    s.obstaclesDestroyed = 0;
    s.lootCollected = 0;
    s.whiskeyCollected = 0;
    s.ammoCollected = 0;
    s.waveReached = 1;
}

export function resetPlayerStats() {
    playerStats.hp = playerStats.maxHp;
    playerStats.isDashing = false;
    playerStats.dashCooldown = 0;
    playerStats.dashDuration = 0;
    playerStats.shootCooldown = 0;
    playerStats.tripleShotTimer = 0;
    playerStats.weapon = 'revolver';
}

export function clearDynamicState() {
    obstacles.length = 0;
    bullets.length = 0;
    enemies.length = 0;
    particles.length = 0;
    loots.length = 0;
}
