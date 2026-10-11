// Outlaw 1 (Dusty Pete) Open-World Bounty Pursuit Run Mode.
// A chapter of big areas played in order (src/stages/pete.js): follow the road, wake the guards, find each area's clue,
// open the gate to the next area, and at the end of the last one face Pete. Campfire checkpoints, supply crates with finite
// ammo, and a forced checkpoint on entering each area (no going back). docs/design/stage-world-framework.md.

import { gameState, playerStats, bullets } from '../state.js';
import { enemies } from '../state.js';
import { createAmmoState, lootCrate, isNearCrate } from '../ammoEconomy.js';
import {
    loadCheckpoint,
    clearCheckpoint,
    saveCheckpoint,
    activateCampfire,
    isNearCampfire
} from '../checkpoints.js';
import {
    STRONGHOLD_GATE_Z,
    canBreachStronghold,
    isNearClue
} from '../peteWorldMap.js';
import { PETE_AREAS, areaIndexForSave } from '../stages/pete.js';
import { preloadSection1 } from '../stages/section1Preload.js';
import { createAwareness, stepAwareness, dueMembers, alarmNear } from '../stages/section1/guards.js';
import { createSection1Runtime } from '../stages/section1/runtime.js';
import { dialogue, mountDialogue } from '../dialogue.js';
import { setInteractHint } from '../interactButton.js';
import { keys, touch } from '../input.js';
import { setWalkMask } from '../physics.js';
import { setGroundSize } from '../groundSize.js';
import { arena } from '../arena.js';
import { mine } from '../mine.js';
import { offerBounty, bankBounty } from '../bounty.js';
import { getOutlaw } from '../outlaws.js';
import { hasSeenComic, markComicSeen, renderComicIntroHtml } from '../comicIntro.js';
import { createPeteWorldScene } from '../placePeteWorld.js';

const DEFAULT_MAP_SIZE = gameState.MAP_SIZE; // how far the marshal may walk in the open arena; a big area sets its own, larger, limit
let peteScene = null;
const camera = { scale: 1, lookX: 0, lookZ: 0, revealUntil: 0, clock: 0 }; // the stage's camera director, eased in cameraBias()

export const peteWorldRun = {
    active: false,
    outlawId: 'dusty-pete',
    ammoState: null,
    campfires: [],
    crates: [],
    collectedClues: [],
    areaIndex: 0,
    areaId: null,
    area: PETE_AREAS[0],
    walk: null,
    exitOpen: false,
    exitWarnedAt: -99,
    currentZone: null,
    lastCheckpointId: null,
    bossSpawned: false,
    gateBreached: false,
    triggeredEncounters: [],
    clearedEncounters: [],       // guard groups that were woken and beaten (an area's exit may need them: exit.clears)
    encounterWokeAt: {},
    announcedZones: [],
    prompt: null,
    guards: null,                // Section 1's guard awareness per group (src/stages/section1/guards.js)
    s1: null                     // Section 1's doors, lever and hiding (src/stages/section1/runtime.js), null elsewhere
};

export function startPeteWorldRun(options = {}, storage = globalThis.localStorage) {
    // A saved run resumes in the area it was saved in. Saves from before the areas existed have no area, so they start fresh.
    const saved = loadCheckpoint(storage);
    const savedIndex = saved && saved.outlawId === 'dusty-pete' ? areaIndexForSave(saved) : -1;
    const resumes = savedIndex >= 0;
    const area = PETE_AREAS[resumes ? savedIndex : 0];

    peteWorldRun.active = true;
    peteWorldRun.areaIndex = area.index;
    peteWorldRun.areaId = area.id;
    peteWorldRun.area = area;
    peteWorldRun.walk = area.createWalk();
    peteWorldRun.campfires = area.campfires.map(c => ({ ...c }));
    peteWorldRun.crates = area.crates.map(c => ({ ...c }));
    peteWorldRun.collectedClues = [];
    peteWorldRun.bossSpawned = false;
    peteWorldRun.gateBreached = false;
    peteWorldRun.exitOpen = false;
    peteWorldRun.exitWarnedAt = -99;
    peteWorldRun.triggeredEncounters = [];
    peteWorldRun.clearedEncounters = [];
    peteWorldRun.encounterWokeAt = {};
    peteWorldRun.announcedZones = [];
    peteWorldRun.prompt = null;
    peteWorldRun.s1 = area.isSection ? createSection1Runtime(area.markers) : null;
    peteWorldRun.guards = area.isSection ? { aware: area.encounters.map(createAwareness), spawned: {} } : null;
    if(playerStats) playerStats.speedMult = 1;
    dialogue.reset();

    if(resumes) {
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
        const p = saved.position;
        peteWorldRun.startPosition = p && peteWorldRun.walk(p.x, p.z) ? { x: p.x, z: p.z } : { ...area.start };
    } else {
        peteWorldRun.lastCheckpointId = `${area.id}-start`;
        peteWorldRun.ammoState = createAmmoState(30);
        peteWorldRun.startPosition = { ...area.start };
    }
    peteWorldRun.exitOpen = !!area.exit && area.exit.requires.every(id => peteWorldRun.collectedClues.includes(id));
    peteWorldRun.gateBreached = !!area.boss && canBreachStronghold(peteWorldRun.collectedClues);

    peteWorldRun.currentZone = area.zoneAt(peteWorldRun.startPosition.x, peteWorldRun.startPosition.z);
    // A run resumed part-way does not send back the guards already left behind.
    const here = area.progressAt(peteWorldRun.startPosition.x, peteWorldRun.startPosition.z);
    for(const group of area.encounters) {
        if(group.progress < here - area.progressMargin) { peteWorldRun.triggeredEncounters.push(group.id); peteWorldRun.clearedEncounters.push(group.id); }
    }

    return peteWorldRun;
}

// The banner a zone gets the first time the marshal reaches it.
function announceZone(ctx, zone) {
    if(!zone || peteWorldRun.announcedZones.includes(zone.id)) return;
    peteWorldRun.announcedZones.push(zone.id);
    const story = peteWorldRun.area.story?.[zone.id];
    if(story) ctx?.ui?.showWaveBanner?.(`${story.title}: ${story.line}`, 4200);
    const place = peteWorldRun.area.places?.find(p => p.id === zone.id);
    if(place?.camera === 'reveal') camera.revealUntil = camera.clock + 2.6; // a wide look at the place, then back to the marshal
}

// Wake each guard group the marshal walks up to. Returns the banner line of a group that woke this frame, or null.
function wakeEncounters(ctx, playerPos) {
    let line = null;
    for(const group of peteWorldRun.area.encounters) {
        if(peteWorldRun.triggeredEncounters.includes(group.id)) continue;
        if(Math.hypot(group.x - playerPos.x, group.z - playerPos.z) > group.radius) continue;
        peteWorldRun.triggeredEncounters.push(group.id);
        peteWorldRun.encounterWokeAt[group.id] = camera.clock;
        for(const enemy of group.enemies) ctx?.spawn?.(enemy.type, { x: group.x + enemy.dx, z: group.z + enemy.dz });
        line = group.line;
    }
    return line;
}

// The blast and fire effects touch the scene and the sound (src/stages/section1/effects.js), so they load when the browser needs them, not in a node test.
let effects = null;
function withEffects(use) {
    if(effects) use(effects);
    else import('../stages/section1/effects.js').then(m => { effects = m; use(m); });
}

// Section 1: groups notice the marshal in steps (idle, suspicious, alerted) instead of all waking at a line, and a flank comes later.
function stepGuards(ctx, playerPos, dt, hidden, shot) {
    const g = peteWorldRun.guards;
    const groups = peteWorldRun.area.encounters;
    let line = null;
    groups.forEach((group, i) => {
        const a = g.aware[i];
        if(peteWorldRun.triggeredEncounters.includes(group.id) && a.state === 'idle') { a.state = 'alerted'; a.sinceAlert = 99; }
        const dist = Math.hypot(group.x - playerPos.x, group.z - playerPos.z);
        const event = stepAwareness(a, group, dt, { dist, hidden, shot, alarmNear: alarmNear(g.aware, groups, group) });
        if(event === 'suspicious') line = line ?? 'They have noticed something...';
        if(event === 'alerted') {
            if(!peteWorldRun.triggeredEncounters.includes(group.id)) peteWorldRun.triggeredEncounters.push(group.id);
            peteWorldRun.encounterWokeAt[group.id] = camera.clock;
            line = group.line;
        }
        const done = g.spawned[group.id] ?? (g.spawned[group.id] = new Set());
        for(const k of dueMembers(a, group)) {
            if(done.has(k)) continue;
            done.add(k);
            const m = group.enemies[k];
            ctx?.spawn?.(m.type, { x: group.x + m.dx, z: group.z + m.dz });
        }
    });
    return line;
}

// What this area needs from the world: its own size, its own rock, its own sand.
function applyArea() {
    const area = peteWorldRun.area;
    gameState.MAP_SIZE = area.mapSize;
    setWalkMask(peteWorldRun.walk);
    setGroundSize(area.groundSize);
}

function releaseArea() {
    gameState.MAP_SIZE = DEFAULT_MAP_SIZE;
    setWalkMask(null);
    setGroundSize(300);
}

function unmountScene() {
    if(!peteScene) return;
    peteScene.group?.parent?.remove(peteScene.group);
    peteScene.dispose?.();
    peteScene = null;
}

function mountScene(ctx) {
    if(!ctx?.scene) return;
    unmountScene();
    peteScene = createPeteWorldScene(peteWorldRun.area.sceneParts(peteWorldRun.walk));
    ctx.scene.add(peteScene.group);
}

// The forced checkpoint on arriving in an area: no campfire needed, and nobody goes back past it.
function saveAreaStart(storage) {
    saveCheckpoint({
        outlawId: 'dusty-pete',
        lastCheckpointId: `${peteWorldRun.area.id}-start`,
        playerPos: peteWorldRun.area.start,
        hp: playerStats?.hp ?? 5,
        ammoState: peteWorldRun.ammoState,
        completedMissions: peteWorldRun.collectedClues,
        openedCrates: [],
        activeCampfires: [],
        areaIndex: peteWorldRun.areaIndex,
        areaId: peteWorldRun.areaId
    }, storage);
    peteWorldRun.lastCheckpointId = `${peteWorldRun.area.id}-start`;
}

function placeMarshal(ctx, at) {
    const position = ctx?.playerSystem?.playerGroup?.position;
    if(!position) return;
    position.x = at.x; position.y = 0; position.z = at.z;
}

// Through the gate and into the next big area.
function enterArea(ctx, index, storage) {
    const area = PETE_AREAS[index];
    if(!area) return;
    peteWorldRun.areaIndex = area.index;
    peteWorldRun.areaId = area.id;
    peteWorldRun.area = area;
    peteWorldRun.walk = area.createWalk();
    peteWorldRun.campfires = area.campfires.map(c => ({ ...c }));
    peteWorldRun.crates = area.crates.map(c => ({ ...c }));
    peteWorldRun.exitOpen = false;
    peteWorldRun.gateBreached = false;
    peteWorldRun.startPosition = { ...area.start };
    peteWorldRun.currentZone = area.zoneAt(area.start.x, area.start.z);
    applyArea();
    ctx?.clearSceneCollections?.();
    mountScene(ctx);
    placeMarshal(ctx, area.start);
    saveAreaStart(storage);
    ctx?.ui?.showWaveBanner?.(area.enterBanner ?? `AREA ${area.index + 1}: ${area.name.toUpperCase()}`, 3600);
    if(peteWorldRun.currentZone) peteWorldRun.announcedZones.push(peteWorldRun.currentZone.id);
    camera.revealUntil = camera.clock + 2.6;
}

export function endPeteWorldRun(victory = false, storage = globalThis.localStorage) {
    peteWorldRun.active = false;
    peteWorldRun.s1 = null;
    peteWorldRun.guards = null;
    if(playerStats) { playerStats.speedMult = 1; playerStats.hiddenFor = 0; }
    dialogue.reset();
    setInteractHint(null);
    releaseArea();
    if(victory) {
        clearCheckpoint(storage);
    }
}

// Mode definition conforming to src/modes/registry.js hooks
export const peteWorldMode = {
    id: 'pete-world',

    isActive: () => {
        if(typeof window !== 'undefined' && window.__rwSmokeTest) return false;
        if(arena.enabled || mine.enabled) return false;
        return peteWorldRun.active || (!gameState.isGameStarted && gameState.outlawIndex === 0 && !gameState.pendingEvent);
    },

    practice: null,
    usesEvent: false,
    runOutlaw: () => 0,

    hud: {
        waveLabel: 'ZONE',
        wave: () => peteWorldRun.currentZone ? peteWorldRun.currentZone.name.split(':')[0] : 'CANYON',
        timer: () => null,
        status: () => {
            const ammo = peteWorldRun.ammoState ? peteWorldRun.ammoState.current : 0;
            const clues = peteWorldRun.collectedClues.length;
            const prompt = peteWorldRun.prompt ? ` | [ ${peteWorldRun.prompt} ]` : '';
            const goal = peteWorldRun.prompt ? '' : ` | ${peteWorldRun.area.objective(peteWorldRun.collectedClues, peteWorldRun.bossSpawned)}`;
            const found = peteWorldRun.s1?.summary() ? ` | ${peteWorldRun.s1.summary()}` : '';
            return peteWorldRun.area.isSection ? `AMMO ${ammo}${found}${prompt}${goal}` : `CLUES ${clues}/3 | AMMO ${ammo}${prompt}${goal}`;
        }
    },

    begin: (ctx, storage = globalThis.localStorage) => {
        // The area supplies its own layout; random road props must not obstruct its clues or its road.
        ctx?.clearSceneCollections?.();
        startPeteWorldRun({}, storage);
        applyArea();
        mountScene(ctx);
        placeMarshal(ctx, peteWorldRun.startPosition);
        camera.scale = 1; camera.lookX = 0; camera.lookZ = 0;
        announceZone(ctx, peteWorldRun.currentZone);
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

    // Stop endless hordes from spawning; encounters are place-based
    reinforcements: () => false,

    update: (ctx, dt, storage = globalThis.localStorage) => {
        if(!peteWorldRun.active) return;
        const area = peteWorldRun.area;
        const playerPos = ctx?.playerSystem?.playerGroup?.position || { x: 0, z: 0 };
        let activePrompt = null;

        // 1. Update current place, and tell its story the first time
        peteWorldRun.currentZone = area.zoneAt(playerPos.x, playerPos.z) ?? peteWorldRun.currentZone;
        announceZone(ctx, peteWorldRun.currentZone);

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
                    activeCampfires: [...peteWorldRun.campfires.filter(c => c.active).map(c => c.id), fire.id],
                    areaIndex: peteWorldRun.areaIndex,
                    areaId: peteWorldRun.areaId
                }, storage);
                peteWorldRun.lastCheckpointId = fire.id;
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
        for(const clue of area.clues) {
            if(!peteWorldRun.collectedClues.includes(clue.id) && isNearClue(clue, playerPos.x, playerPos.z)) {
                peteWorldRun.collectedClues.push(clue.id);
                activePrompt = `FOUND ${clue.title.toUpperCase()}`;
                ctx?.ui?.showWaveBanner?.(`${clue.title}: ${clue.detail}`, 5200);
            }
        }

        // 4a. Section 1: E / ACT opens doors, pulls the lever, hides, reads notices (src/stages/section1/runtime.js)
        if(peteWorldRun.s1) {
            mountDialogue();
            const pressed = keys.interactRequested;
            keys.interactRequested = false;
            const r = peteWorldRun.s1.step({
                x: playerPos.x, z: playerPos.z, dt, pressed, dialogue,
                fired: !!(keys.mouse || keys.space || touch.firing),
                banner: text => ctx?.ui?.showWaveBanner?.(text, 2600)
            });
            if(playerStats) playerStats.speedMult = r.speedMult;
            // breakables, found elements and what they do to the enemies
            const throwPressed = keys.throwRequested, cyclePressed = keys.cycleRequested;
            keys.throwRequested = false; keys.cycleRequested = false;
            const yaw = ctx?.playerSystem?.playerGroup?.rotation?.y ?? 0;
            const events = peteWorldRun.s1.tick({
                dt, x: playerPos.x, z: playerPos.z, throwPressed, cyclePressed,
                bullets: bullets.filter(b => b.userData?.owner === 'player').map(b => ({ x: b.position.x, z: b.position.z })),
                facing: { x: Math.sin(yaw), z: Math.cos(yaw) },
                banner: text => ctx?.ui?.showWaveBanner?.(text, 2600)
            });
            if(events.length) withEffects(m => m.applyEvents(ctx, events));
            for(const e of enemies) if(e.userData) e.userData.slowMult = peteWorldRun.s1.slowAt(e.position.x, e.position.z);
            setInteractHint(r.prompt ? r.prompt.replace(/^E: /, '') : null);
            if(r.prompt) activePrompt = activePrompt ?? r.prompt;
        }

        // 4b. Guards wake as the marshal nears them
        const alarm = peteWorldRun.guards
            ? stepGuards(ctx, playerPos, dt, peteWorldRun.s1.state.hiding.hidden, !!(keys.mouse || keys.space || touch.firing))
            : wakeEncounters(ctx, playerPos);
        if(playerStats) playerStats.hiddenFor = peteWorldRun.s1?.state.hiding.hiddenFor ?? 0;
        if(alarm) {
            activePrompt = alarm.toUpperCase();
            ctx?.ui?.showWaveBanner?.(alarm, 2200);
        }

        // 4c. A guard group counts as beaten once it has been woken for a moment and nobody of it is left standing around its place
        for(const id of area.exit?.clears ?? []) {
            const group = area.encounters.find(g => g.id === id);
            if(!group || peteWorldRun.clearedEncounters.includes(id) || !peteWorldRun.triggeredEncounters.includes(id)) continue;
            if(camera.clock - (peteWorldRun.encounterWokeAt[id] ?? camera.clock) < 1.5) continue;
            if(!enemies.some(e => Math.hypot(e.position.x - group.x, e.position.z - group.z) < group.radius * 1.6)) peteWorldRun.clearedEncounters.push(id);
        }

        // 5. The gate at the end of the area opens for its clue, and stepping through it starts the next area
        if(area.exit) {
            const exit = area.exit;
            const open = exit.requires.every(id => peteWorldRun.collectedClues.includes(id)) && (exit.clears ?? []).every(id => peteWorldRun.clearedEncounters.includes(id));
            if(open && !peteWorldRun.exitOpen) {
                peteWorldRun.exitOpen = true;
                activePrompt = 'GATE UNLOCKED';
                ctx?.ui?.showWaveBanner?.(exit.opened, 3600);
            }
            if(Math.hypot(exit.x - playerPos.x, exit.z - playerPos.z) <= exit.r) {
                if(open) {
                    enterArea(ctx, exit.next, storage);
                    return;
                }
                activePrompt = 'GATE LOCKED';
                if(peteWorldRun.exitWarnedAt < camera.clock - 6) {
                    peteWorldRun.exitWarnedAt = camera.clock;
                    ctx?.ui?.showWaveBanner?.(exit.locked, 3200);
                }
            }
        }

        // 6. Stronghold gate breach check (the last area)
        if(area.boss) {
            if(!peteWorldRun.gateBreached && canBreachStronghold(peteWorldRun.collectedClues)) {
                peteWorldRun.gateBreached = true;
                activePrompt = 'STRONGHOLD UNLOCKED';
                ctx?.ui?.showWaveBanner?.('You have the receipt, the ledger and the key. The stronghold gate is open.', 4200);
            }
            // 7. Boss arena encounter trigger
            if(peteWorldRun.gateBreached && playerPos.z >= STRONGHOLD_GATE_Z && !peteWorldRun.bossSpawned) {
                if(ctx?.spawn) {
                    ctx.spawn('boss', { x: 0, z: 100 });
                    peteWorldRun.bossSpawned = true;
                }
            }
        }

        peteWorldRun.prompt = activePrompt;
    },

    updateScene: (ctx, timeInSeconds) => {
        if(peteScene && peteWorldRun.active) {
            peteScene.update(peteWorldRun, timeInSeconds);
        }
    },

    // The camera director (docs/design/stage-world-framework.md, 2.3): look ahead down the road, stand back in wide places,
    // take a wide look at a place the first time it is reached, and lean in on a narrow bridge. Always eased, never a cut.
    cameraBias: (playerPos, dt = 0.016) => {
        if(!peteWorldRun.active) return null;
        camera.clock += dt;
        const area = peteWorldRun.area;
        const place = area.places?.find(p => Math.hypot(p.x - playerPos.x, p.z - playerPos.z) <= p.r + 8);
        let scale = 1;
        if(camera.clock < camera.revealUntil) scale = 1.6;
        else if(place?.camera === 'pullback') scale = 1.3;
        else if(place?.camera === 'narrow') scale = 0.88;
        const heading = area.headingAt(playerPos.x, playerPos.z);
        const ease = 1 - Math.exp(-2.2 * dt);
        camera.scale += (scale - camera.scale) * ease;
        camera.lookX += (heading.tx * 6 - camera.lookX) * ease;
        camera.lookZ += (heading.tz * 6 - camera.lookZ) * ease;
        return { scale: camera.scale, lookX: camera.lookX, lookZ: camera.lookZ };
    },

    afterOutlawDown: (ctx, storage = globalThis.localStorage) => {
        if(!peteWorldRun.active || !peteWorldRun.bossSpawned || gameState.isGameOver) return;
        // Settle through the shared bounty contract so progress, earnings and result text agree.
        offerBounty(gameState.bounty, gameState.heat.level, getOutlaw(0).bounty);
        gameState.score = bankBounty(gameState.bounty, gameState.score);
        ctx.finishRun('banked');
        unmountScene();
        endPeteWorldRun(true, storage);
    },

    reset: (storage = globalThis.localStorage) => {
        if(typeof document !== 'undefined') document.getElementById('comic-intro-modal')?.remove();
        unmountScene();
        endPeteWorldRun(false, storage);
    }
};

// Section 1 is behind a switch while it is finished (src/stages/section1Preload.js): this starts fetching its data at start-up when it is on.
preloadSection1();
if(typeof window !== 'undefined') withEffects(() => {});         // fetch the effects early in a browser
