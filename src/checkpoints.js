// Campfire Checkpoint System for Open-World Runs.
// Players can save progress at campfires scattered across the open world map,
// allowing them to leave the run and resume from their latest checkpoint later.

export const CHECKPOINT_STORAGE_KEY = 'redWestCheckpoint.v1';
export const CAMPFIRE_INTERACTION_RADIUS = 3.0;

// Create a campfire entity definition.
export function createCampfire(id, name, zone, x, z) {
    return {
        id,
        name,
        zone,
        x,
        z,
        active: false,
        litAt: null
    };
}

// Check proximity to campfire.
export function isNearCampfire(campfire, playerX, playerZ, radius = CAMPFIRE_INTERACTION_RADIUS) {
    if(!campfire) return false;
    return Math.hypot(campfire.x - playerX, campfire.z - playerZ) <= radius;
}

// Light and activate a campfire checkpoint.
export function activateCampfire(campfire, runState, storage = globalThis.localStorage) {
    if(!campfire) return false;
    campfire.active = true;
    campfire.litAt = new Date().toISOString();

    if(runState) {
        runState.lastCheckpointId = campfire.id;
        runState.lastCampfire = {
            id: campfire.id,
            name: campfire.name,
            zone: campfire.zone,
            x: campfire.x,
            z: campfire.z
        };
        saveCheckpoint(runState, storage);
    }
    return true;
}

// Save current open-world run state to localStorage.
export function saveCheckpoint(runState, storage = globalThis.localStorage) {
    if(!storage || !runState) return false;
    try {
        const payload = {
            version: 1,
            outlawId: runState.outlawId || 'dusty-pete',
            lastCheckpointId: runState.lastCheckpointId || null,
            position: {
                x: runState.playerPos ? runState.playerPos.x : (runState.lastCampfire?.x || 0),
                z: runState.playerPos ? runState.playerPos.z : (runState.lastCampfire?.z || 0)
            },
            stats: {
                hp: runState.hp ?? 5,
                ammo: runState.ammoState ? runState.ammoState.current : 30
            },
            completedMissions: Array.isArray(runState.completedMissions) ? [...runState.completedMissions] : [],
            openedCrates: Array.isArray(runState.openedCrates) ? [...runState.openedCrates] : [],
            activeCampfires: Array.isArray(runState.activeCampfires) ? [...runState.activeCampfires] : [],
            savedAt: new Date().toISOString()
        };
        storage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(payload));
        return true;
    } catch {
        return false;
    }
}

// Load saved open-world checkpoint from localStorage.
export function loadCheckpoint(storage = globalThis.localStorage) {
    if(!storage) return null;
    try {
        const raw = storage.getItem(CHECKPOINT_STORAGE_KEY);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        if(!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
        return parsed;
    } catch {
        return null;
    }
}

// Check if a valid checkpoint save exists.
export function hasActiveCheckpoint(storage = globalThis.localStorage) {
    return loadCheckpoint(storage) !== null;
}

// Remove saved checkpoint (upon run completion, victory, or forfeit).
export function clearCheckpoint(storage = globalThis.localStorage) {
    if(!storage) return false;
    try {
        storage.removeItem(CHECKPOINT_STORAGE_KEY);
        return true;
    } catch {
        return false;
    }
}
