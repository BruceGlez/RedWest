// Mobile aiming helpers, modelled on Brawl Stars / Archero: tap to fire at the nearest enemy,
// drag to aim with a gentle snap, or (optional) fire automatically while standing still.

export const AUTO_AIM_RANGE = 42;
const ASSIST_ANGLE = 0.35; // radians (~20 degrees) either side of the stick direction

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

// Where to shoot so the bullet meets a moving target: its position plus where it will have walked by the
// time the bullet arrives. from/target: {x, z}; velocity: the target's {x, z} in units per second.
// Two passes are enough at bullet speeds of 60 or more; the lead is capped so a knocked-back or turning enemy
// never sends the shot far off.
export function leadPoint(from, target, velocity, bulletSpeed, maxSeconds = 0.6) {
    let x = target.x;
    let z = target.z;
    for(let pass = 0; pass < 2; pass++) {
        const seconds = Math.min(maxSeconds, Math.hypot(x - from.x, z - from.z) / Math.max(1, bulletSpeed));
        x = target.x + velocity.x * seconds;
        z = target.z + velocity.z * seconds;
    }
    return { x, z };
}

// The flat direction (unit x/z) from the gun's muzzle to the aim point. The bullet leaves from the hand, to
// one side of the body, so aiming along the body's facing would send it past the target by that offset.
// Returns null when the point is too close to the muzzle for a direction to mean anything.
export function directionTo(muzzle, point, minDistance = 1.5) {
    const dx = point.x - muzzle.x;
    const dz = point.z - muzzle.z;
    const length = Math.hypot(dx, dz);
    return length < minDistance ? null : { x: dx / length, z: dz / length };
}

// Where the shot really leaves the character: the muzzle's sideways/forward offset from the body, smoothed over
// frames. The hand swings while walking, so the raw muzzle wobbles off to either side; its average doesn't, and
// that keeps the bullet's path straight and steady. body: {x, z}; facing: unit {x, z}; offset: {side, forward}.
export function steadyMuzzle(body, facing, offset) {
    const rightX = -facing.z;
    const rightZ = facing.x;
    return {
        x: body.x + facing.x * offset.forward + rightX * offset.side,
        z: body.z + facing.z * offset.forward + rightZ * offset.side,
    };
}

// The muzzle's offset from the body in the body's own frame (side = to the right of where it faces).
export function muzzleOffset(body, facing, muzzle) {
    const dx = muzzle.x - body.x;
    const dz = muzzle.z - body.z;
    return { forward: dx * facing.x + dz * facing.z, side: dx * -facing.z + dz * facing.x };
}
