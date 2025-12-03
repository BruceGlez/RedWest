import * as THREE from 'three';
import { createRock, createDeadTree, createCrate, createCactus, createFence } from './assets.js';

export function setupScene(scene, camera, renderer) {
    const skyColor = 0xffdcb3; 
    scene.background = new THREE.Color(skyColor); 
    scene.fog = new THREE.Fog(skyColor, 20, 80);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffaa00, 1.5);
    sunLight.position.set(-30, 40, -30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -100; sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100; sunLight.shadow.camera.bottom = -100;
    scene.add(sunLight);

    const groundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300), 
        new THREE.MeshStandardMaterial({ color: 0xe6c288, roughness: 1 })
    );
    groundMesh.rotation.x = -Math.PI / 2; 
    groundMesh.receiveShadow = true; 
    scene.add(groundMesh);
}

function getRandomPos(minDist) {
    let x, z;
    do { 
        x = (Math.random()-0.5)*240; 
        z = (Math.random()-0.5)*240; 
    } while (Math.abs(x) < minDist && Math.abs(z) < minDist);
    return { x, z };
}

export function generateMap(scene) {
    for(let i=0; i<60; i++) { const p = getRandomPos(5); createRock(scene, p.x, p.z); }
    for(let i=0; i<15; i++) { const p = getRandomPos(15); createDeadTree(scene, p.x, p.z); }
    for(let i=0; i<15; i++) { const p = getRandomPos(10); createCrate(scene, p.x, p.z); }
    for(let i=0; i<20; i++) { const p = getRandomPos(10); createCactus(scene, p.x, p.z); }
    for(let i=0; i<5; i++) {
        const p = getRandomPos(20); const angle = Math.random() * Math.PI;
        for(let j=0; j<3; j++) {
            const offsetX = Math.cos(angle) * (j * 3.2); 
            const offsetZ = Math.sin(angle) * (j * 3.2);
            createFence(scene, p.x + offsetX, p.z + offsetZ, angle);
        }
    }
}