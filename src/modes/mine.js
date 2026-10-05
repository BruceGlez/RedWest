// The Hollow Claim as a run mode (MINE_PLAN.md). Rules with no rendering are in src/mine.js, the caves in src/mineMap.js, the monsters in
// src/mineMonsters.js and the scenery in src/mineScene.js. The flow that used to live in src/gameLoop.js is here: a floor begins, a
// chamber fills with its own monsters, chests open, the shaft leads down and the lift brings you back, and both ask first.
import * as THREE from 'three';
import { gameState, playerStats, enemies, loots } from '../state.js';
import { playSound } from '../audio.js';
import { floatText } from '../feedback.js';
import { clearBullets } from '../bulletSystem.js';
import { clearHazards } from '../enemySystem.js';
import { clearParticles } from '../particleSystem.js';
import { clearDecals } from '../decals.js';
import { disposeBaked } from '../meshMerge.js';
import { mine, endMineRun, nextFloor, floorStage, floorWave, floorBanner, descentScore, chestReward, confirmText, resultText, shaftHint, liftHint, MINE_ATMOSPHERE_ID, PRACTICE_NOTE } from '../mine.js';
import { showMineFloor, openMineChest, updateMineScene } from '../mineScene.js';
import { activeFloor, shaftReached, liftReached, chestWithin, LIFT_ARM_DISTANCE, SHAFT_REACH, LIFT_REACH } from '../mineMap.js';
import { MINE_MONSTERS, newOn, isMineMonster, planNode, WAKE_DISTANCE, LEAVE_DISTANCE } from '../mineMonsters.js';

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
    mineNodes = activeFloor().nodes.map(() => false); // no chamber has been filled yet
    minePending = [];
    mineCheckIn = 0;
    gameState.runStats.waveReached = Math.max(gameState.runStats.waveReached, floor);
    // Each floor says what is new on it. A monster of the Wanted Road shows its own NEW ENEMY card when it first appears.
    const fresh = newOn(floor).filter(isMineMonster).map(id => `\nNEW: ${MINE_MONSTERS[id].name}`).join('');
    ctx.ui.showWaveBanner(`${floorBanner(floor)}${fresh}`, floor === 1 ? 2800 : 2400);
}

// Who lives where (src/mineMonsters.js, planNode): each chamber fills when the marshal comes near, stays quiet once he has killed what is in
// it while he stays, and fills again after he has gone far away. No endless stream: a chamber's monsters are the chamber's.
let mineNodes = [];   // per chamber of the floor on show: is it full?
let minePending = []; // monsters waiting their turn to come out (a couple a frame, so a big chamber does not hitch)
let mineCheckIn = 0;
function updatePopulation(ctx, dt) {
    for(let k = 0; k < 2 && minePending.length; k++) {
        const next = minePending.shift();
        ctx.spawn(next.type, next);
        enemies.at(-1).userData.mineNode = next.node;
    }
    mineCheckIn -= dt;
    if(mineCheckIn > 0) return;
    mineCheckIn = 0.5;
    const cave = activeFloor();
    const at = ctx.playerSystem.playerGroup.position;
    cave.nodes.forEach((node, i) => {
        const edge = Math.hypot(at.x - node.x, at.z - node.z) - node.r;
        if(!mineNodes[i] && edge < WAKE_DISTANCE) {
            mineNodes[i] = true;
            for(const m of planNode(cave, i, mine.floor)) minePending.push({ ...m, node: i });
        } else if(mineNodes[i] && edge > LEAVE_DISTANCE) {
            mineNodes[i] = false; // he has gone: what is left goes back to sleep, and the chamber fills again for next time
            minePending = minePending.filter(m => m.node !== i);
            for(let n = enemies.length - 1; n >= 0; n--) {
                if(enemies[n].userData.mineNode !== i) continue;
                ctx.scene.remove(enemies[n]);
                disposeBaked(enemies[n]);
                enemies.splice(n, 1);
            }
        }
    });
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

// The shaft and the lift ask first: the game stops, and nothing happens until the answer is yes. After a no it does not ask again until the
// marshal has stepped away.
function askMine(ctx, kind) {
    mine.confirm = kind;
    ctx.ask(confirmText(kind, mine.floor), yes => {
        mine.confirm = null;
        if(!yes) { mine.blocked = kind; return; }
        if(kind === 'up') {
            ctx.finishRun('mine-win');
        } else {
            gameState.score += descentScore(mine.floor);
            beginFloor(ctx, nextFloor());
        }
    });
}

function updateFlow(ctx, dt) {
    const cave = activeFloor();
    const at = ctx.playerSystem.playerGroup.position;
    mine.shaftDx = cave.shaft[0] - at.x;
    mine.shaftDz = cave.shaft[1] - at.z;
    mine.liftDx = -at.x;
    mine.liftDz = -at.z;
    if(mine.blocked === 'down' && Math.hypot(mine.shaftDx, mine.shaftDz) > SHAFT_REACH + 3) mine.blocked = null;
    if(mine.blocked === 'up' && Math.hypot(at.x, at.z) > LIFT_REACH + 3) mine.blocked = null;
    // The lift works once the marshal has walked away from it, so he does not ride up by accident on arriving.
    if(!mine.liftArmed && Math.hypot(at.x, at.z) > LIFT_ARM_DISTANCE) mine.liftArmed = true;
    // The way down is always open, and so is the way up: walk into either and it asks.
    if(shaftReached(cave, at.x, at.z) && mine.blocked !== 'down') { askMine(ctx, 'down'); return; }
    if(mine.liftArmed && liftReached(at.x, at.z) && mine.blocked !== 'up') { askMine(ctx, 'up'); return; }
    const chest = chestWithin(cave, at.x, at.z, mine.opened);
    if(chest >= 0) openChest(ctx, chest, cave);
    updatePopulation(ctx, dt);
}

export const mineMode = {
    id: 'mine',
    isActive: () => mine.enabled,
    practice: { note: PRACTICE_NOTE },
    usesEvent: false,
    lengthensPursuit: false, // a chamber holds a fixed amount of danger, so a hot streak cannot add to it
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
