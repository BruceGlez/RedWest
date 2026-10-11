// Turns the events of src/stages/section1/runtime.js (blast, burn, puddle, fire...) into what the player sees and takes: damage to the enemies in
// reach, a hit on the marshal who stands too near his own blast, particles, a scorch mark and a sound. The rules stay in elements.js and
// breakables.js; this is the only file of the slice that touches the scene.

import * as THREE from 'three';
import { enemies, playerStats, gameState } from '../../state.js';
import { killEnemy } from '../../bulletSystem.js';
import { createExplosion } from '../../particleSystem.js';
import { addScorch } from '../../decals.js';
import { playSound } from '../../audio.js';

const SELF_SHARE = 0.5;            // the marshal is hurt by a blast only inside this share of its radius
const BLAST_COLOURS = { dynamite: 0xff6f00, stack: 0xff6f00, barrel: 0xc0842a };

// Damage every enemy within `radius` of (x, z). Returns how many were hit.
export function damageEnemiesIn(scene, x, z, radius, amount, callbacks = {}) {
    let hit = 0;
    for(let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if(e.userData.untargetable) continue;
        if(Math.hypot(e.position.x - x, e.position.z - z) > radius) continue;
        e.userData.hp -= amount;
        e.userData.alerted = true;
        hit++;
        if(e.userData.hp <= 0) killEnemy(scene, e, i, callbacks);
    }
    return hit;
}

function hurtMarshal(ctx, x, z, radius, amount, share = SELF_SHARE) {
    const p = ctx?.playerSystem?.playerGroup?.position;
    if(!p || playerStats.isDashing || playerStats.invulnerabilityTimer > 0 || gameState.isGameOver) return;
    if(Math.hypot(p.x - x, p.z - z) > radius * share) return;
    playerStats.hp -= amount;
    playerStats.invulnerabilityTimer = 0.6;
    gameState.runStats.damageTaken += amount;
    if(playerStats.hp <= 0) ctx?.finishRun?.('died');
}

export function applyEvents(ctx, events) {
    const scene = ctx?.scene;
    if(!scene) return;
    for(const e of events) {
        switch(e.kind) {
        case 'blast': {
            const colour = BLAST_COLOURS[e.source] ?? 0xff6f00;
            createExplosion(scene, new THREE.Vector3(e.x, 0, e.z), colour);      // plays the boom itself
            addScorch(scene, e.x, e.z, Math.min(6, e.radius * 0.25));
            damageEnemiesIn(scene, e.x, e.z, e.radius, e.damage);
            hurtMarshal(ctx, e.x, e.z, e.radius, 1);
            break;
        }
        case 'burn':
            damageEnemiesIn(scene, e.x, e.z, e.radius, e.damage);
            hurtMarshal(ctx, e.x, e.z, e.radius, 1, 0.8);
            break;
        case 'fire':
            addScorch(scene, e.x, e.z, 6);
            break;
        case 'throw':
            playSound('fuse');
            break;
        case 'break':
            playSound('break');
            break;
        default:
            break;
        }
    }
}
