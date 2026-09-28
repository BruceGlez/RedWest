// Mobile aiming helpers, modelled on Brawl Stars / Archero: tap to fire at the nearest enemy,
// drag to aim with a gentle snap, or (optional) fire automatically while standing still.

export const AUTO_AIM_RANGE = 42;
const ASSIST_ANGLE = 0.24; // radians (~14 degrees) either side of the stick direction

// origin: {x, z}; enemies: objects with .position {x, z}.
// Without a direction: the nearest enemy in range. With a direction: the nearest enemy inside
// the assist cone around it (so manual aim is helped, never overridden).
export function pickTarget(origin, enemies, { range = AUTO_AIM_RANGE, dirX = null, dirZ = null, maxAngle = ASSIST_ANGLE } = {}) {
    const useCone = dirX !== null && dirZ !== null && (dirX !== 0 || dirZ !== 0);
    const aimAngle = useCone ? Math.atan2(dirZ, dirX) : 0;
    let best = null;
    let bestDistance = range;
    for(const enemy of enemies) {
        if(enemy.userData?.untargetable) continue;
        const dx = enemy.position.x - origin.x;
        const dz = enemy.position.z - origin.z;
        const distance = Math.hypot(dx, dz);
        if(distance > bestDistance) continue;
        if(useCone) {
            let delta = Math.abs(Math.atan2(dz, dx) - aimAngle);
            if(delta > Math.PI) delta = (2 * Math.PI) - delta;
            if(delta > maxAngle) continue;
        }
        best = enemy;
        bestDistance = distance;
    }
    return best;
}

// Where to draw an off-screen indicator. nx/ny: the target's normalized device coordinates
// (-1..1 on screen). Returns null when the target is on screen.
export function edgeIndicator(nx, ny, width, height, margin = 28) {
    if(Math.abs(nx) <= 1 && Math.abs(ny) <= 1) return null;
    const dx = nx;
    const dy = 0 - ny; // screen y grows downward (0 - ny avoids -0)
    const scale = 1 / Math.max(Math.abs(dx), Math.abs(dy));
    return {
        x: (width / 2) + (dx * scale * ((width / 2) - margin)),
        y: (height / 2) + (dy * scale * ((height / 2) - margin)),
        angle: Math.atan2(dy, dx)
    };
}
