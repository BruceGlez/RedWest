// A chase camera in the style of a 3D platformer (Spyro): it hangs behind the marshal, W walks the way the camera looks, the camera swings round
// by Z and X or by dragging with the right mouse button (drag up and down to lift or lower it), and when he walks sideways it follows him round
// by itself. Pure rules (no THREE), so they test in node; src/gameLoop.js asks the active mode for the offset and src/playerSystem.js turns the
// walk keys by `yaw`. A mode turns it on while it wants it (Section 1) and off again after.

export const CHASE = { DIST: 24, HEIGHT_DEFAULT: 13, HEIGHT_MIN: 6, HEIGHT_MAX: 30, ORBIT_SPEED: 2.2, DRAG_YAW: 0.006, DRAG_HEIGHT: 0.08, RECENTER: 0.9, RECENTER_DELAY: 0.8, LOOK_AHEAD: 8 };

export const chase = { enabled: false, yaw: 0, height: CHASE.HEIGHT_DEFAULT, idle: 0 };

export function resetChase(c = chase) { c.yaw = 0; c.height = CHASE.HEIGHT_DEFAULT; c.idle = 0; return c; }
export function setChase(on, c = chase) { c.enabled = !!on; resetChase(c); return c; }

// One frame. `orbit`: -1 (Z) to 1 (X). `dragX`/`dragY`: pixels dragged with the right button since last frame. `lateral`: -1 (A) to 1 (D) of the walk keys.
export function stepChase(c, dt, { orbit = 0, dragX = 0, dragY = 0, lateral = 0 } = {}) {
    const manual = orbit !== 0 || dragX !== 0 || dragY !== 0;
    if(manual) c.idle = 0; else c.idle += dt;
    c.yaw += orbit * CHASE.ORBIT_SPEED * dt + dragX * CHASE.DRAG_YAW;
    c.height = Math.max(CHASE.HEIGHT_MIN, Math.min(CHASE.HEIGHT_MAX, c.height + dragY * CHASE.DRAG_HEIGHT));
    // Walking sideways swings the camera round with him, once the player has let go of it.
    if(!manual && lateral !== 0 && c.idle > CHASE.RECENTER_DELAY) c.yaw += lateral * CHASE.RECENTER * dt;
    // Keep the angle small so it never winds up.
    if(c.yaw > Math.PI) c.yaw -= Math.PI * 2;
    if(c.yaw < -Math.PI) c.yaw += Math.PI * 2;
    return c;
}

// Where the camera hangs, relative to the marshal.
export function chaseOffset(c = chase) {
    return { x: Math.sin(c.yaw) * CHASE.DIST, y: c.height, z: Math.cos(c.yaw) * CHASE.DIST };
}

// The way the camera looks across the ground (a unit vector): what W walks toward.
export function chaseForward(c = chase) { return { x: -Math.sin(c.yaw), z: -Math.cos(c.yaw) }; }

// Turn a walk or aim vector from camera space (up the screen is -z) into the world.
export function rotateToWorld(x, z, c = chase) {
    if(!c.enabled) return { x, z };
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    return { x: x * co + z * s, z: -x * s + z * co };
}
