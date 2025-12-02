import { obstacles } from './state.js';

export function checkCollision(x, z, radius) {
    for(let obs of obstacles) {
        const dx = x - obs.x;
        const dz = z - obs.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if(dist < (obs.radius + radius)) return true;
    }
    return false;
}

// [NEW] Returns the actual object hit, so we can destroy it
export function getObstacleAt(x, z, radius) {
    for(let obs of obstacles) {
        const dx = x - obs.x;
        const dz = z - obs.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if(dist < (obs.radius + radius)) return obs;
    }
    return null;
}