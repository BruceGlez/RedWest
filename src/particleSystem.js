import * as THREE from 'three';
import { particles } from './state.js'; // Direct access to state
import { playSound } from './audio.js';

const PARTICLE_GEOMETRY = new THREE.BoxGeometry(0.5,0.5,0.5);
const particlePool = [];

function createParticleMesh() {
    return new THREE.Mesh(PARTICLE_GEOMETRY, new THREE.MeshBasicMaterial({ color: 0xffffff }));
}

function acquireParticle() {
    return particlePool.pop() || createParticleMesh();
}

function releaseParticle(scene, particle, index) {
    scene.remove(particle);
    particle.visible = false;
    if(index >= 0) particles.splice(index, 1);
    particlePool.push(particle);
}

export function clearParticles(scene) {
    for(let i = particles.length - 1; i >= 0; i--) {
        releaseParticle(scene, particles[i], i);
    }
}

export function getParticlePoolStats() {
    return {
        active: particles.length,
        pooled: particlePool.length
    };
}

export function createExplosion(scene, pos, color) {
    playSound('boom');
    for(let i=0; i<8; i++) {
        const m = acquireParticle();
        m.visible = true;
        m.material.color.setHex(color);
        m.position.copy(pos); 
        m.position.y += 1.5;
        m.userData = { 
            vel: new THREE.Vector3((Math.random()-0.5)*10, Math.random()*10, (Math.random()-0.5)*10), 
            life: 1.0 
        };
        scene.add(m); 
        particles.push(m);
    }
}

export function updateParticles(dt, scene) {
    for(let i=particles.length-1; i>=0; i--) {
        const p = particles[i]; 
        p.userData.life -= dt; 
        p.position.addScaledVector(p.userData.vel, dt); 
        p.userData.vel.y -= 20 * dt; // Gravity
        
        if(p.userData.life <= 0 || p.position.y < 0) { 
            releaseParticle(scene, p, i);
        }
    }
}
