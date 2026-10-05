// The Hollow Claim as a run mode (MINE_PLAN.md). Rules with no rendering are in src/mine.js, the caves in src/mineMap.js, the monsters in
// src/mineMonsters.js and the scenery in src/mineScene.js. The flow that used to live in src/gameLoop.js is here: a floor begins, a
// pursuit that never ends tops up monsters, chests open, the shaft leads down and the lift brings you back.
import * as THREE from 'three';
import { gameState, playerStats, enemies, loots } from '../state.js';
import { heatSpawnMultiplier } from '../heat.js';
import { playSound } from '../audio.js';
import { floatText } from '../feedback.js';
import { clearBullets } from '../bulletSystem.js';
import { clearHazards } from '../enemySystem.js';
import { clearParticles } from '../particleSystem.js';
import { clearDecals } from '../decals.js';
import { disposeBaked } from '../meshMerge.js';
import { chooseWeightedType } from '../weighted.js';
import { mine, endMineRun, nextFloor, floorStage, floorWave, floorBanner, descentScore, chestReward, resultText, shaftHint, liftHint, MINE_ATMOSPHERE_ID, PRACTICE_NOTE } from '../mine.js';
import { showMineFloor, openMineChest, updateMineScene } from '../mineScene.js';
import { activeFloor, shaftReached, liftReached, chestWithin, LIFT_ARM_DISTANCE } from '../mineMap.js';
import { MINE_MONSTERS, mineWave, newOn, isMineMonster, monsterDef, monsterCost } from '../mineMonsters.js';

// Going down: the last floor's monsters, pickups, footprints and flying things stay behind.
function leaveFloorBehind(scene) {
    for(const e of enemies) { scene.remove(e); disposeBaked(e); }
    enemies.length = 0;
    for(const l of loots) scene.remove(l);
    loots.length = 0;
    clearBullets(scene);
    clearHazards(scene);
    clearParticles(scene);
    clearDecals();
}

// A mine floor (src/mine.js): its cave (src/mineMap.js), then a pursuit that never ends and gets stranger with depth (src/mineMonsters.js).
// There is nothing to clear: the shaft down is always open, and the lift you came on is always a walk back. Every floor starts with the
// marshal standing on its lift.
function beginFloor(ctx, floor) {
    if(floor > 1) {
        leaveFloorBehind(ctx.scene);
        ctx.playerSystem.playerGroup.position.set(0, 0, 0);
        ctx.camera.position.copy(ctx.cameraOffset());
    }
    showMineFloor(ctx.scene, floor);
    mine.floor = floor;
    mine.liftArmed = false;
    mine.opened = [];
    gameState.outlawIndex = floorStage(floor);
    gameState.waveNumber = floorWave(floor);
    gameState.waveDuration = 1;
    gameState.waveTimer = 0;
    gameState.isIntermission = false;
    gameState.intermissionTimer = 0;
    gameState.waveBossSpawned = false;
    gameState.enemySpawnTimer = 1.5; // a breath on the lift before the first one comes
    gameState.runStats.waveReached = Math.max(gameState.runStats.waveReached, floor);
    // Each floor says what is new on it. A monster of the Wanted Road shows its own NEW ENEMY card when it first appears.
    const fresh = newOn(floor).filter(isMineMonster).map(id => `\nNEW: ${MINE_MONSTERS[id].name}`).join('');
    ctx.ui.showWaveBanner(`${floorBanner(floor)}${fresh}`, floor === 1 ? 2800 : 2400);
}

// A pursuit with no waves: the cave keeps a measure of danger around the marshal and tops it up (mineWave).
function spawnTick(ctx, dt) {
    gameState.enemySpawnTimer -= dt;
    if(gameState.enemySpawnTimer > 0) return;
    const wave = mineWave(mine.floor);
    gameState.enemySpawnTimer = wave.interval / heatSpawnMultiplier(gameState.heat.level);
    const at = ctx.playerSystem.playerGroup.position;
    let threat = 0;
    const active = {};
    for(const e of enemies) {
        if(Math.hypot(e.position.x - at.x, e.position.z - at.z) < 110) threat += monsterCost(e.userData.type);
        active[e.userData.type] = (active[e.userData.type] || 0) + 1;
    }
    const room = wave.threatCap - threat;
    const candidates = [];
    for(const type of Object.keys(wave.weights)) {
        if((active[type] || 0) >= wave.caps[type] || monsterCost(type) > room) continue;
        const danger = monsterDef(type)?.danger ?? 1;
        candidates.push({ type, weight: wave.weights[type] * (danger >= 2 ? 1 + gameState.heat.level * 0.2 : 1) });
    }
    const chosen = chooseWeightedType(candidates);
    if(chosen) ctx.spawn(chosen);
}

// A chest: it opens when the marshal walks up to it, for score and either a heart or a spell of triple shot.
function openChest(ctx, index, cave) {
    mine.opened.push(index);
    openMineChest(index);
    const reward = chestReward(mine.floor, playerStats.hp, playerStats.maxHp);
    gameState.score += reward.score;
    if(reward.heal) playerStats.hp = Math.min(playerStats.maxHp, playerStats.hp + 1);
    else playerStats.tripleShotTimer = 10;
    const [x, z] = cave.chests[index];
    floatText(`+${reward.score}${reward.heal ? ' +1 HEART' : ' TRIPLE SHOT'}`, new THREE.Vector3(x, 2.5, z), 'hot');
    playSound('powerup');
    ctx.ui.updateHUD();
}

function updateFlow(ctx, dt) {
    const cave = activeFloor();
    const at = ctx.playerSystem.playerGroup.position;
    mine.shaftDx = cave.shaft[0] - at.x;
    mine.shaftDz = cave.shaft[1] - at.z;
    mine.liftDx = -at.x;
    mine.liftDz = -at.z;
    // The way down is always open: walk into the shaft and the next floor begins.
    if(shaftReached(cave, at.x, at.z)) {
        gameState.score += descentScore(mine.floor);
        beginFloor(ctx, nextFloor());
        return;
    }
    // The lift brings the marshal back up, once he has walked away from it.
    if(!mine.liftArmed && Math.hypot(at.x, at.z) > LIFT_ARM_DISTANCE) mine.liftArmed = true;
    if(mine.liftArmed && liftReached(at.x, at.z)) {
        ctx.finishRun('mine-win');
        return;
    }
    const chest = chestWithin(cave, at.x, at.z, mine.opened);
    if(chest >= 0) openChest(ctx, chest, cave);
    spawnTick(ctx, dt);
}

export const mineMode = {
    id: 'mine',
    isActive: () => mine.enabled,
    practice: { note: PRACTICE_NOTE },
    usesEvent: false,
    lengthensPursuit: false, // a floor is a fixed budget, so a hot streak cannot make it go on forever
    hud: {
        waveLabel: 'DEPTH:',
        wave: () => mine.floor,
        timer: () => shaftHint(mine.shaftDx, mine.shaftDz),
        status: () => liftHint(mine.liftDx, mine.liftDz)
    },
    previewOutlaw: () => floorStage(1),
    runOutlaw: () => floorStage(1),
    atmosphereId: () => MINE_ATMOSPHERE_ID,
    previewScene: ctx => showMineFloor(ctx.scene, mine.floor), // the cave is there from the first frame
    begin: ctx => beginFloor(ctx, 1),
    update: updateFlow,
    updateScene: (ctx, t) => updateMineScene(t),
    resultText: result => resultText(result, mine.floor),
    reset: () => { endMineRun(); }
};
