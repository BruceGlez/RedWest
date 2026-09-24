export const MAX_HEAT = 4;
const CHAIN_WINDOW = 4;
const DECAY_INTERVAL = 5;

export function createHeatState() {
    return { level: 0, streak: 0, chainTimer: 0, decayTimer: 0, peak: 0 };
}

export function heatMultiplier(level) {
    return 1 + (Math.max(0, Math.min(MAX_HEAT, level)) * 0.5);
}

export function heatSpawnMultiplier(level) {
    return 1 + (Math.max(0, Math.min(MAX_HEAT, level)) * 0.18);
}

export function recordKill(heat) {
    heat.streak = heat.chainTimer > 0 ? heat.streak + 1 : 1;
    heat.chainTimer = CHAIN_WINDOW;
    heat.decayTimer = DECAY_INTERVAL;
    heat.level = Math.min(MAX_HEAT, Math.floor(heat.streak / 2));
    heat.peak = Math.max(heat.peak, heat.level);
    return heatMultiplier(heat.level);
}

export function recordDamage(heat) {
    heat.level = 0;
    heat.streak = 0;
    heat.chainTimer = 0;
    heat.decayTimer = 0;
}

export function advanceHeat(heat, dt) {
    if(heat.chainTimer > 0) {
        heat.chainTimer = Math.max(0, heat.chainTimer - dt);
        if(heat.chainTimer === 0) heat.streak = 0;
    }
    if(heat.level === 0 || heat.chainTimer > 0) return;
    heat.decayTimer -= dt;
    while(heat.decayTimer <= 0 && heat.level > 0) {
        heat.level--;
        heat.decayTimer += DECAY_INTERVAL;
    }
}
