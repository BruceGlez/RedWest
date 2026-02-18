import { obstacles } from './state.js';

const CELL_SIZE = 12;
const OBSTACLE_QUERY_PADDING = 4;
const obstacleGrid = new Map();
const enemyGrid = new Map();
let obstacleGridDirty = true;

function toCell(v) {
    return Math.floor(v / CELL_SIZE);
}

function cellKey(cx, cz) {
    return `${cx},${cz}`;
}

function addToGrid(grid, cx, cz, item) {
    const key = cellKey(cx, cz);
    let bucket = grid.get(key);
    if(!bucket) {
        bucket = new Set();
        grid.set(key, bucket);
    }
    bucket.add(item);
}

function queryGrid(grid, x, z, radius) {
    const minX = toCell(x - radius);
    const maxX = toCell(x + radius);
    const minZ = toCell(z - radius);
    const maxZ = toCell(z + radius);
    const results = new Set();

    for(let cx = minX; cx <= maxX; cx++) {
        for(let cz = minZ; cz <= maxZ; cz++) {
            const bucket = grid.get(cellKey(cx, cz));
            if(!bucket) continue;
            for(const item of bucket) results.add(item);
        }
    }
    return results;
}

function rebuildObstacleGrid() {
    obstacleGrid.clear();
    for(const obs of obstacles) {
        const minX = toCell(obs.x - obs.radius);
        const maxX = toCell(obs.x + obs.radius);
        const minZ = toCell(obs.z - obs.radius);
        const maxZ = toCell(obs.z + obs.radius);
        for(let cx = minX; cx <= maxX; cx++) {
            for(let cz = minZ; cz <= maxZ; cz++) {
                addToGrid(obstacleGrid, cx, cz, obs);
            }
        }
    }
    obstacleGridDirty = false;
}

function ensureObstacleGrid() {
    if(obstacleGridDirty) rebuildObstacleGrid();
}

export function markObstacleGridDirty() {
    obstacleGridDirty = true;
}

export function checkCollision(x, z, radius) {
    ensureObstacleGrid();
    const near = queryGrid(obstacleGrid, x, z, radius + OBSTACLE_QUERY_PADDING);
    for(const obs of near) {
        const dx = x - obs.x;
        const dz = z - obs.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if(dist < (obs.radius + radius)) return true;
    }
    return false;
}

// [NEW] Returns the actual object hit, so we can destroy it
export function getObstacleAt(x, z, radius) {
    ensureObstacleGrid();
    const near = queryGrid(obstacleGrid, x, z, radius + OBSTACLE_QUERY_PADDING);
    for(const obs of near) {
        const dx = x - obs.x;
        const dz = z - obs.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if(dist < (obs.radius + radius)) return obs;
    }
    return null;
}

export function rebuildEnemyGrid(enemies) {
    enemyGrid.clear();
    for(const enemy of enemies) {
        addToGrid(enemyGrid, toCell(enemy.position.x), toCell(enemy.position.z), enemy);
    }
}

export function getNearbyEnemies(x, z, radius) {
    return queryGrid(enemyGrid, x, z, radius);
}

export function getGridStats() {
    return {
        obstacleCells: obstacleGrid.size,
        enemyCells: enemyGrid.size,
        obstacleGridDirty
    };
}
