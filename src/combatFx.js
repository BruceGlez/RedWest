import * as THREE from 'three';
import { disposeBaked } from './meshMerge.js';
import { deathPose, deathLength, MAX_CLIP_SECONDS } from './combatMath.js';

// Two things that happen to an enemy that is shot: a quick white flash when it is hit, and, when it is defeated, a
// stylised fall (a box-built enemy tips over and hops, an imported model plays its own fall clip) before it pops
// away. Nobody is shown dying: the fall is a cartoon tumble and a puff. Presentation only. A defeated enemy has
// already left `enemies`, so it can no longer be hit, aimed at, counted or shoot: only this module holds it.

const FLASH_SECONDS = 0.09;
const flashing = []; // { enemy, left }
const falling = []; // { enemy, age, total, baseY, clip }

// Baked enemies (one skinned mesh of vertex colours each) flash by writing white into their own colour buffer and
// writing the colours back. Imported models flash through their own material's glow. No material is cloned.
function setFlash(enemy, on) {
    enemy.traverse(o => {
        if(!o.isMesh || o.userData.isOutline) return;
        if(o.userData.ownGeometry) {
            const attribute = o.geometry.attributes.color;
            if(!attribute) return;
            o.userData.baseColors ??= attribute.array.slice();
            if(on) attribute.array.fill(1); else attribute.array.set(o.userData.baseColors);
            attribute.needsUpdate = true;
        } else if(o.isSkinnedMesh && o.material?.emissive) {
            o.material.emissive.setHex(on ? 0x9a9a9a : 0x000000);
        }
    });
}

export function flashEnemy(enemy) {
    if(enemy.userData.disposed) return;
    const entry = flashing.find(f => f.enemy === enemy);
    if(entry) { entry.left = FLASH_SECONDS; return; }
    setFlash(enemy, true);
    flashing.push({ enemy, left: FLASH_SECONDS });
}

// The enemy leaves the fight now (the caller has already taken it out of `enemies`); this plays its fall.
export function startFall(scene, enemy) {
    const u = enemy.userData;
    if(u.laser) u.laser.visible = false;
    const model = u.model;
    let clip = 0;
    if(model?.has('dead')) {
        clip = model.clipSeconds?.('dead') ?? MAX_CLIP_SECONDS;
        model.play('dead', 0.05);
    }
    falling.push({ enemy, age: 0, total: deathLength(clip), baseY: enemy.position.y, clip, scene });
}

export function updateCombatFx(dt) {
    for(let i = flashing.length - 1; i >= 0; i--) {
        const f = flashing[i];
        f.left -= dt;
        if(f.left > 0) continue;
        if(!f.enemy.userData.disposed) setFlash(f.enemy, false);
        flashing.splice(i, 1);
    }
    for(let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        f.age += dt;
        const { enemy } = f;
        if(f.age >= f.total) {
            finish(f);
            falling.splice(i, 1);
            continue;
        }
        const pose = deathPose(f.age, f.total);
        if(f.clip > 0) {
            // The model's own fall clip does the tumbling; only the final pop is ours.
            enemy.userData.model.mixer.update(dt);
            enemy.scale.setScalar((enemy.userData.baseScale ??= enemy.scale.x) * pose.scale);
        } else {
            const body = enemy.children[0] ?? enemy;
            body.rotation.x = -pose.tip;
            enemy.position.y = f.baseY + pose.hop;
            enemy.scale.setScalar((enemy.userData.baseScale ??= enemy.scale.x) * pose.scale);
        }
    }
}

function finish({ enemy, scene }) {
    scene.remove(enemy);
    enemy.userData.disposed = true;
    disposeBaked(enemy);
    const flash = flashing.findIndex(f => f.enemy === enemy);
    if(flash >= 0) flashing.splice(flash, 1);
}

// A new run, or a restart: nothing is left lying around.
export function clearCombatFx() {
    for(const f of falling) finish(f);
    falling.length = 0;
    flashing.length = 0;
}

export function fallingCount() {
    return falling.length;
}
