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