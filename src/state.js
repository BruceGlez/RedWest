export const gameState = {
    score: 0,
    isGameOver: false,
    isGameStarted: false,
    enemySpawnTimer: 0,
    MAP_SIZE: 140
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
    tripleShotTimer: 0
};

// Global Arrays
export const obstacles = []; 
export const bullets = [];
export const enemies = [];
export const particles = [];
export const loots = []; 