// Finite Ammo & Loot Economy for Open-World Runs (Minecraft / PUBG inspired).
// In open-world runs, ammo is strictly finite. The Marshal begins with limited ammo,
// collects ammo and provisions from supply crates scattered throughout the canyon,
// and can purchase reserve ammo boxes at the General Store in town.

export const STARTING_AMMO = 30;
export const MAX_AMMO_CAPACITY = 120;
export const CRATE_INTERACT_DISTANCE = 2.8;

export const AMMO_STORE_ITEM = {
    id: 'ammo-box',
    name: 'AMMO BOX (30 RDS)',
    price: 15,
    currency: 'dollars',
    rounds: 30
};

// Create a new ammo state object.
export function createAmmoState(initialAmmo = STARTING_AMMO, maxCapacity = MAX_AMMO_CAPACITY) {
    return {
        current: Math.min(Math.max(0, initialAmmo), maxCapacity),
        max: maxCapacity,
        shotsFired: 0,
        cratesLooted: 0
    };
}

// Attempt to consume ammo (e.g. firing revolver / rifle).
// Returns true if bullet was available and consumed; false if empty (dry fire).
export function consumeAmmo(ammoState, count = 1) {
    if(!ammoState || ammoState.current < count) {
        return false;
    }
    ammoState.current -= count;
    ammoState.shotsFired += count;
    return true;
}

// Add ammo up to maximum capacity. Returns actual count added.
export function addAmmo(ammoState, count) {
    if(!ammoState || count <= 0) return 0;
    const before = ammoState.current;
    ammoState.current = Math.min(ammoState.max, ammoState.current + count);
    return ammoState.current - before;
}

// Check if player has ammo remaining.
export function hasAmmo(ammoState) {
    return !!(ammoState && ammoState.current > 0);
}

// Create a supply crate definition for placement in the open world map.
export function createLootCrate(id, x, z, loot = { type: 'ammo', amount: 20 }) {
    return {
        id,
        x,
        z,
        opened: false,
        loot: { ...loot }
    };
}

// Check if player is close enough to interact with a crate.
export function isNearCrate(crate, playerX, playerZ, reach = CRATE_INTERACT_DISTANCE) {
    if(!crate) return false;
    const dx = crate.x - playerX;
    const dz = crate.z - playerZ;
    return Math.hypot(dx, dz) <= reach;
}

// Open a loot crate and apply its contents to playerState (ammoState, playerStats).
export function lootCrate(crate, ammoState, playerStats = null) {
    if(!crate || crate.opened) {
        return { success: false, reason: 'already-opened' };
    }

    crate.opened = true;
    if(ammoState) ammoState.cratesLooted++;

    const result = {
        success: true,
        type: crate.loot.type,
        amount: crate.loot.amount,
        text: ''
    };

    if(crate.loot.type === 'ammo') {
        const added = addAmmo(ammoState, crate.loot.amount);
        result.text = `+${added} AMMO`;
    } else if(crate.loot.type === 'health') {
        if(playerStats) {
            const before = playerStats.hp || 0;
            const maxHp = playerStats.maxHp || 5;
            playerStats.hp = Math.min(maxHp, before + crate.loot.amount);
            result.text = `+${playerStats.hp - before} HEALTH`;
        }
    } else if(crate.loot.type === 'clue') {
        result.text = `INVESTIGATION CLUE: ${crate.loot.name || 'LEDGER'}`;
    }

    return result;
}

// Store purchase handler for buying ammo in town.
export function buyStoreAmmo(wallet, ammoReserve = 0) {
    if(!wallet || typeof wallet.balance !== 'function') return { success: false, reserve: ammoReserve };
    if(wallet.balance('dollars') < AMMO_STORE_ITEM.price) {
        return { success: false, reason: 'insufficient-funds', reserve: ammoReserve };
    }
    const paid = wallet.pay({ dollars: AMMO_STORE_ITEM.price });
    if(!paid) return { success: false, reason: 'payment-failed', reserve: ammoReserve };
    return { success: true, reserve: ammoReserve + AMMO_STORE_ITEM.rounds };
}
