import * as THREE from 'three';
import { loots, playerStats } from './state.js';
import { createAmmoMesh, createWhiskeyMesh } from './assets.js';
import { playSound } from './audio.js';

export function spawnLoot(scene, x, z) {
    const r = Math.random();
    let loot;
    // 20% Ammo, 30% Whiskey, 50% Nothing
    if(r > 0.8) loot = createAmmoMesh(); 
    else if (r > 0.5) loot = createWhiskeyMesh(); 
    else return;
    
    loot.position.set(x, 0, z); 
    scene.add(loot); 
    loots.push(loot);
}

// Returns true if HUD needs update
export function updateLoots(dt, scene, playerGroup) {
    let needsHudUpdate = false;
    const time = Date.now() / 1000;

    for(let i=loots.length-1; i>=0; i--) {
        const l = loots[i]; 
        l.rotation.y += dt; 
        l.position.y = 0.5 + Math.sin(time * 3 + l.userData.floatOffset) * 0.2;
        
        if(l.position.distanceTo(playerGroup.position) < 2.0) {
            if(l.userData.type === 'ammo') { 
                playerStats.tripleShotTimer = 10.0; 
                playSound('powerup'); 
                needsHudUpdate = true;
            } else if (playerStats.hp < playerStats.maxHp) { 
                playerStats.hp++; 
                playSound('powerup'); 
                needsHudUpdate = true;
            }
            scene.remove(l); 
            loots.splice(i,1); 
        }
    }
    return needsHudUpdate;
}