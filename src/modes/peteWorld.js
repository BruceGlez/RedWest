// Outlaw 1 (Dusty Pete) Open-World Bounty Pursuit Run Mode.
// Replaces endless horde survival waves with an open-world exploration pursuit:
// 4 distinct canyon zones, campfire checkpoints, supply crates with finite ammo,
// 3 investigation clues to track Pete, and a 3-phase Magicka-style boss confrontation.

import { gameState, playerStats } from '../state.js';
import { createAmmoState, consumeAmmo, lootCrate, isNearCrate } from '../ammoEconomy.js';
import {
    saveCheckpoint,
    loadCheckpoint,
    hasActiveCheckpoint,
    clearCheckpoint,
    activateCampfire,
    isNearCampfire
} from '../checkpoints.js';
import {
    PETE_WORLD_ZONES,
    INVESTIGATION_CLUES,
    WORLD_CAMPFIRES,
    WORLD_CRATES,
    STRONGHOLD_GATE_Z,
    zoneAt,
    canBreachStronghold,
    isNearClue
} from '../peteWorldMap.js';
import { createPeteBossState, damagePeteBoss, updateBossPete } from '../bossPete.js';
import { hasSeenComic, markComicSeen, renderComicIntroHtml } from '../comicIntro.js';
import { createPeteWorldScene } from '../placePeteWorld.js';

let peteScene = null;

export const peteWorldRun = {
    active: false,
    outlawId: 'dusty-pete',
    ammoState: null,
    campfires: [],
    crates: [],
    collectedClues: [],
    currentZone: PETE_WORLD_ZONES.mineCamp,
    lastCheckpointId: null,
    bossState: null,
    bossSpawned: false,
    gateBreached: false,
    prompt: null
};

export function startPeteWorldRun(options = {}, storage = globalThis.localStorage) {
    peteWorldRun.active = true;
    peteWorldRun.campfires = WORLD_CAMPFIRES.map(c => ({ ...c }));
    peteWorldRun.crates = WORLD_CRATES.map(c => ({ ...c }));
    peteWorldRun.collectedClues = [];
    peteWorldRun.bossSpawned = false;
    peteWorldRun.gateBreached = false;
    peteWorldRun.bossState = createPeteBossState(100);
    peteWorldRun.prompt = null;

    // Load saved checkpoint if one exists
    const saved = loadCheckpoint(storage);
    if(saved && saved.outlawId === 'dusty-pete') {
        peteWorldRun.lastCheckpointId = saved.lastCheckpointId;
        peteWorldRun.ammoState = createAmmoState(saved.stats?.ammo ?? 30);
        peteWorldRun.collectedClues = Array.isArray(saved.completedMissions) ? [...saved.completedMissions] : [];
        if(Array.isArray(saved.openedCrates)) {
            for(const crate of peteWorldRun.crates) {
                if(saved.openedCrates.includes(crate.id)) crate.opened = true;
            }
        }
        if(Array.isArray(saved.activeCampfires)) {
            for(const fire of peteWorldRun.campfires) {
                if(saved.activeCampfires.includes(fire.id)) fire.active = true;
            }
        }
        if(playerStats && saved.stats?.hp) playerStats.hp = saved.stats.hp;
        peteWorldRun.startPosition = saved.position || { x: 0, z: -75 };
    } else {
        peteWorldRun.lastCheckpointId = 'camp-mine';
        peteWorldRun.ammoState = createAmmoState(30);
        peteWorldRun.startPosition = { x: 0, z: -75 };
    }

    return peteWorldRun;
}

export function endPeteWorldRun(victory = false, storage = globalThis.localStorage) {
    peteWorldRun.active = false;
    if(victory) {
        clearCheckpoint(storage);
    }
}

// Mode definition conforming to src/modes/registry.js hooks
export const peteWorldMode = {
    id: 'pete-world',

    isActive: () => {
        if(typeof window !== 'undefined' && window.__rwSmokeTest) return false;
        return peteWorldRun.active || (gameState?.outlawIndex === 0 && !gameState?.isTown && !gameState?.isArena);
    },

    practice: null,
    usesEvent: false,

    hud: {
        waveLabel: 'ZONE',
        wave: () => peteWorldRun.currentZone ? peteWorldRun.currentZone.name.split(':')[0] : 'CANYON',
        timer: () => null,
        status: () => {
            const ammo = peteWorldRun.ammoState ? peteWorldRun.ammoState.current : 0;
            const clues = peteWorldRun.collectedClues.length;
            const prompt = peteWorldRun.prompt ? ` | [ ${peteWorldRun.prompt} ]` : '';
            return `CLUES ${clues}/3 | AMMO ${ammo}${prompt}`;
        }
    },

    begin: (ctx, storage = globalThis.localStorage) => {
        startPeteWorldRun({}, storage);
        if(ctx?.scene) {
            if(!peteScene) {
                peteScene = createPeteWorldScene();
            }
            if(!ctx.scene.children.includes(peteScene.group)) {
                ctx.scene.add(peteScene.group);
            }
        }
        if(ctx?.playerSystem?.playerGroup) {
            ctx.playerSystem.playerGroup.position.set(peteWorldRun.startPosition.x, 0, peteWorldRun.startPosition.z);
        }
        // Show prologue comic if not seen yet
        if(!hasSeenComic('dusty-pete', storage) && typeof document !== 'undefined') {
            const existing = document.getElementById('comic-intro-modal');
            if(!existing) {
                const div = document.createElement('div');
                div.innerHTML = renderComicIntroHtml('dusty-pete');
                document.body.appendChild(div.firstElementChild);
                const btn = document.getElementById('comic-start-btn');
                if(btn) {
                    btn.addEventListener('click', () => {
                        markComicSeen('dusty-pete', storage);
                        document.getElementById('comic-intro-modal')?.remove();
                    });
                }
            }
        }
    },

    // Stop endless hordes from spawning; encounters are zone-based
    reinforcements: () => false,

    update: (ctx, dt, storage = globalThis.localStorage) => {
        if(!peteWorldRun.active) return;
        const playerPos = ctx?.playerSystem?.playerGroup?.position || { x: 0, z: 0 };

        // 1. Update current zone
        peteWorldRun.currentZone = zoneAt(playerPos.z);
        let activePrompt = null;

        // 2. Check campfires (auto-save checkpoint on reach)
        for(const fire of peteWorldRun.campfires) {
            if(!fire.active && isNearCampfire(fire, playerPos.x, playerPos.z)) {
                activateCampfire(fire, {
                    outlawId: 'dusty-pete',
                    playerPos,
                    hp: playerStats?.hp ?? 5,
                    ammoState: peteWorldRun.ammoState,
                    completedMissions: peteWorldRun.collectedClues,
                    openedCrates: peteWorldRun.crates.filter(c => c.opened).map(c => c.id),
                    activeCampfires: peteWorldRun.campfires.filter(c => c.active).map(c => c.id)
                }, storage);
                activePrompt = 'CAMPFIRE SAVED';
            } else if(fire.active && isNearCampfire(fire, playerPos.x, playerPos.z, 2.0)) {
                activePrompt = 'CAMPFIRE RESTED';
            }
        }

        // 3. Check crates looting
        for(const crate of peteWorldRun.crates) {
            if(!crate.opened && isNearCrate(crate, playerPos.x, playerPos.z)) {
                const lootRes = lootCrate(crate, peteWorldRun.ammoState, playerStats);
                activePrompt = lootRes.text || 'LOOTED CRATE';
            }
        }

        // 4. Check investigation clues collection
        for(const clue of INVESTIGATION_CLUES) {
            if(!peteWorldRun.collectedClues.includes(clue.id) && isNearClue(clue, playerPos.x, playerPos.z)) {
                peteWorldRun.collectedClues.push(clue.id);
                activePrompt = `FOUND ${clue.name.toUpperCase()}`;
            }
        }

        // 5. Stronghold gate breach check
        if(!peteWorldRun.gateBreached && canBreachStronghold(peteWorldRun.collectedClues)) {
            peteWorldRun.gateBreached = true;
            activePrompt = 'STRONGHOLD UNLOCKED';
        }

        // 6. Boss arena encounter trigger
        if(peteWorldRun.gateBreached && playerPos.z >= STRONGHOLD_GATE_Z && !peteWorldRun.bossSpawned) {
            peteWorldRun.bossSpawned = true;
            if(ctx?.spawn) {
                ctx.spawn('boss', 0, 100);
            }
        }

        // 7. Update boss if engaged
        if(peteWorldRun.bossSpawned && peteWorldRun.bossState && !peteWorldRun.bossState.defeated) {
            const bossPos = { x: 0, z: 100 };
            updateBossPete(peteWorldRun.bossState, bossPos, playerPos, dt);
        }

        peteWorldRun.prompt = activePrompt;
    },

    updateScene: (ctx, timeInSeconds) => {
        if(peteScene && peteWorldRun.active) {
            peteScene.update(peteWorldRun, timeInSeconds);
        }
    },

    afterOutlawDown: (ctx, storage = globalThis.localStorage) => {
        if(peteScene) {
            peteScene.group?.parent?.remove(peteScene.group);
            peteScene.dispose?.();
            peteScene = null;
        }
        endPeteWorldRun(true, storage);
        ctx?.finishRun?.('outlaw-defeated');
    },

    reset: (storage = globalThis.localStorage) => {
        if(peteScene) {
            peteScene.group?.parent?.remove(peteScene.group);
            peteScene.dispose?.();
            peteScene = null;
        }
        endPeteWorldRun(false, storage);
    }
};
