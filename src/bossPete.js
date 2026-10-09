// Dusty Pete Magicka-style 3-Phase Boss Battle Mechanics.
// Phase 1 (100% - 50% HP): Revolver Duel & Fan-Fire Burst.
// Phase 2 (50% - 25% HP): Stick of Dynamite Volley (delayed cluster area-of-effect).
// Phase 3 (25% - 0% HP): Fortified Gatling & Barrel Cover behind barricades.

export const PETE_PHASES = {
    DUEL: 1,
    DYNAMITE: 2,
    GATLING: 3
};

export const PETE_BARKS = {
    start: "You should've stayed in Lantern Rock, Marshal!",
    phase2: "Catch this, lawman! Let's see you dodge blasting powder!",
    phase3: "I built this canyon! You won't take me alive!",
    defeated: "The Company... won't let you... keep that ledger..."
};

export function createPeteBossState(maxHp = 100) {
    return {
        hp: maxHp,
        maxHp,
        phase: PETE_PHASES.DUEL,
        lastPhase: PETE_PHASES.DUEL,
        attackCooldown: 1.0,
        dynamiteCooldown: 3.5,
        strafeTimer: 0,
        isShielded: false,
        activeDynamite: [],
        currentBark: PETE_BARKS.start,
        barkTimer: 3.0,
        defeated: false
    };
}

// Apply damage to Pete, handle phase transitions and barks.
export function damagePeteBoss(bossState, damage) {
    if(!bossState || bossState.defeated) return { hp: 0, phaseTransition: false };

    // In phase 3, armored barrel cover absorbs 30% of incoming damage
    const actualDamage = bossState.phase === PETE_PHASES.GATLING ? Math.max(1, Math.round(damage * 0.7)) : damage;
    bossState.hp = Math.max(0, bossState.hp - actualDamage);

    let phaseTransition = false;
    const hpPercent = (bossState.hp / bossState.maxHp) * 100;

    if(bossState.hp <= 0) {
        bossState.defeated = true;
        bossState.currentBark = PETE_BARKS.defeated;
        bossState.barkTimer = 4.0;
        return { hp: 0, defeated: true, phaseTransition: true };
    }

    if(hpPercent <= 25 && bossState.phase < PETE_PHASES.GATLING) {
        bossState.phase = PETE_PHASES.GATLING;
        bossState.currentBark = PETE_BARKS.phase3;
        bossState.barkTimer = 3.5;
        bossState.isShielded = true;
        phaseTransition = true;
    } else if(hpPercent <= 50 && bossState.phase < PETE_PHASES.DYNAMITE) {
        bossState.phase = PETE_PHASES.DYNAMITE;
        bossState.currentBark = PETE_BARKS.phase2;
        bossState.barkTimer = 3.5;
        phaseTransition = true;
    }

    return { hp: bossState.hp, phase: bossState.phase, phaseTransition, defeated: false };
}

// Update boss attack timers, dynamite timers, and return action descriptors.
export function updateBossPete(bossState, bossPos, playerPos, dt) {
    if(!bossState || bossState.defeated) return { actions: [] };

    const actions = [];
    if(bossState.barkTimer > 0) bossState.barkTimer -= dt;

    bossState.attackCooldown -= dt;
    bossState.dynamiteCooldown -= dt;
    bossState.strafeTimer += dt;

    // Phase 1: Revolver Duel (Fan-fire bursts every 1.4s)
    if(bossState.phase === PETE_PHASES.DUEL) {
        if(bossState.attackCooldown <= 0) {
            bossState.attackCooldown = 1.4;
            actions.push({
                type: 'fan-fire',
                burstCount: 3,
                spread: 0.22,
                origin: { ...bossPos },
                target: { ...playerPos }
            });
        }
    }

    // Phase 2: Dynamite Volley (Throws 3 sticks of dynamite every 3.2s)
    else if(bossState.phase === PETE_PHASES.DYNAMITE) {
        if(bossState.dynamiteCooldown <= 0) {
            bossState.dynamiteCooldown = 3.2;
            actions.push({
                type: 'throw-dynamite',
                sticks: [
                    { x: playerPos.x, z: playerPos.z, delay: 1.2, radius: 4.5 },
                    { x: playerPos.x + 3, z: playerPos.z - 2, delay: 1.4, radius: 4.5 },
                    { x: playerPos.x - 3, z: playerPos.z + 2, delay: 1.4, radius: 4.5 }
                ]
            });
        }
        if(bossState.attackCooldown <= 0) {
            bossState.attackCooldown = 1.6;
            actions.push({
                type: 'fan-fire',
                burstCount: 2,
                spread: 0.15,
                origin: { ...bossPos },
                target: { ...playerPos }
            });
        }
    }

    // Phase 3: Gatling Barricade (Continuous sweeping fire every 0.8s)
    else if(bossState.phase === PETE_PHASES.GATLING) {
        if(bossState.attackCooldown <= 0) {
            bossState.attackCooldown = 0.8;
            actions.push({
                type: 'gatling-spray',
                shots: 5,
                spread: 0.45,
                origin: { ...bossPos },
                target: { ...playerPos }
            });
        }
    }

    return { actions, phase: bossState.phase, bark: bossState.barkTimer > 0 ? bossState.currentBark : null };
}
