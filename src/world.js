import * as THREE from 'three';
import { createRock, createDeadTree, createCrate, createCactus, createFence } from './scenery.js';
import { createDesertGroundTexture, createSkyTexture } from './textures.js';
import { atmosphereFor } from './atmosphere.js';
import { setSceneryTint } from './scenery.js';
import { setupAmbience, setAmbienceLook } from './ambience.js';

let sunLight = null;
let hemiLight = null;
let groundMaterial = null;
let appliedAtmosphere = null;
const SUN_OFFSET = new THREE.Vector3(-26, 44, -18);

export function setupScene(scene, camera, renderer) {
    scene.background = createSkyTexture();
    // Fog fades distant ground into the warm horizon colour.
    scene.fog = new THREE.Fog(0xf1cf9c, 45, 110);

    // Warm sky light from above, reddish bounce from the sand below.
    hemiLight = new THREE.HemisphereLight(0xfff1d8, 0xc77f45, 1.6);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xffe2b0, 2.4);
    sunLight.castShadow = true;
    // A tight shadow box that follows the player keeps shadows crisp (see updateSun).
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    sunLight.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
    sunLight.shadow.camera.left = -48; sunLight.shadow.camera.right = 48;
    sunLight.shadow.camera.top = 48; sunLight.shadow.camera.bottom = -48;
    sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 140;
    sunLight.shadow.bias = -0.0008;
    sunLight.shadow.normalBias = 0.02;
    sunLight.position.copy(SUN_OFFSET);
    scene.add(sunLight);
    scene.add(sunLight.target);

    const groundTexture = createDesertGroundTexture();
    groundTexture.repeat.set(9, 9);
    groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture });
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    setupAmbience(scene);
}

// The look of one stage (src/atmosphere.js): sky, fog, light, sand and scenery tint. Cheap to call every frame:
// nothing happens unless the outlaw changed. Only colours and numbers change, so no shader is rebuilt.
export function setAtmosphere(scene, outlawId) {
    if(appliedAtmosphere === outlawId || !sunLight) return;
    appliedAtmosphere = outlawId;
    const look = atmosphereFor(outlawId);
    scene.background?.dispose?.();
    scene.background = createSkyTexture(look.sky);
    scene.fog.color.setHex(look.fog.color);
    scene.fog.near = look.fog.near;
    scene.fog.far = look.fog.far;
    hemiLight.color.setHex(look.hemi.sky);
    hemiLight.groundColor.setHex(look.hemi.ground);
    hemiLight.intensity = look.hemi.intensity;
    sunLight.color.setHex(look.sun.color);
    sunLight.intensity = look.sun.intensity;
    SUN_OFFSET.set(...look.sun.offset);
    groundMaterial.color.setHex(look.ground);
    setSceneryTint(look.props);
    setAmbienceLook(look);
}

export function updateSun(focus) {
    if(!sunLight) return;
    sunLight.position.copy(focus).add(SUN_OFFSET);
    sunLight.target.position.copy(focus);
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