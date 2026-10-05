import * as THREE from 'three';
import { createRock, createDeadTree, createCrate, createCactus, createFence, createBarrel, createTombstone, createHaystack, createSpire, createWall, clearScenery } from './scenery.js';
import { createGroundTexture, createSkyTexture } from './textures.js';
import { atmosphereFor, soundFor, DEFAULT_ATMOSPHERE, FENCE_GROUP } from './atmosphere.js';
import { setBed } from './audio.js';
import { bedFor } from './soundscape.js';
import { setSceneryTint } from './scenery.js';
import { setupAmbience, setAmbienceLook } from './ambience.js';
import { setDecalColor } from './decals.js';
import { setHorizon, updateHorizon } from './horizon.js';
import { createHero } from './heroProps.js';
import { mine, MINE_ATMOSPHERE_ID } from './mine.js';
import { clearMineFloor } from './mineScene.js';

let sunLight = null;
let hemiLight = null;
let groundMaterial = null;
let appliedAtmosphere = null;
let currentSurface = 'sand';
let currentHero = DEFAULT_ATMOSPHERE.hero;
let currentKit = DEFAULT_ATMOSPHERE.kit; // what generateMap builds: the current stage's props
let currentIsMine = false; // the look is the mine's: its floors are built one at a time by src/gameLoop.js (showMineFloor), not scattered
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

    groundMaterial = new THREE.MeshLambertMaterial({ map: groundTextureFor(DEFAULT_ATMOSPHERE.terrain) });
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    setupAmbience(scene);
}

// The look of one stage (src/atmosphere.js): sky, fog, light, sand and scenery tint. Cheap to call every frame:
// nothing happens unless the outlaw changed. Only colours and numbers change, so no shader is rebuilt.
function groundTextureFor(terrain) {
    const texture = createGroundTexture(terrain);
    texture.repeat.set(9, 9);
    return texture;
}

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
    groundMaterial.map.dispose(); // one ground texture at a time
    groundMaterial.map = groundTextureFor(look.terrain);
    groundMaterial.needsUpdate = true;
    setSceneryTint(look.props, look.palette);
    setAmbienceLook(look);
    setHorizon(scene, look);
    setDecalColor(new THREE.Color(look.terrain.base).multiplyScalar(0.45).getHex());
    // A new home ground gets its own map of props. This only happens on the start screen, never mid-run.
    currentKit = look.kit;
    const sound = soundFor(outlawId);
    currentSurface = sound.surface;
    setBed(bedFor(sound, look.wind));
    currentHero = look.hero;
    currentIsMine = outlawId === MINE_ATMOSPHERE_ID;
    clearMineFloor(scene);
    clearScenery(scene);
    generateMap(scene);
}

// What the ground sounds like here (SURFACES in soundscape.js), for footsteps.
export function groundSurface() {
    return currentSurface;
}

export function updateSun(focus) {
    updateHorizon(focus);
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

// The map for the current stage: how many of each prop (its `kit` in atmosphere.js), scattered over 240 x 240.
export function generateMap(scene) {
    // The mine has no scattered props: a floor is built when a run reaches it. Anything left from the last run goes.
    if(currentIsMine) {
        if(!mine.enabled) clearMineFloor(scene);
        return;
    }
    const kit = currentKit;
    if(currentHero) createHero(scene, currentHero.id, ...currentHero.at);
    const scatter = (count, minDist, create) => { for(let i = 0; i < count; i++) { const p = getRandomPos(minDist); create(scene, p.x, p.z); } };
    scatter(kit.rock, 5, createRock);
    scatter(kit.tree, 15, createDeadTree);
    scatter(kit.crate, 10, createCrate);
    scatter(kit.cactus, 10, createCactus);
    scatter(kit.barrel, 8, createBarrel);
    scatter(kit.tombstone, 12, createTombstone);
    scatter(kit.haystack, 12, createHaystack);
    scatter(kit.spire, 20, createSpire);
    scatter(kit.wall, 12, createWall);
    // Fences and walls stand in lines: kit.fence is a count of pieces, laid out in lines of FENCE_GROUP.
    for(let i = 0; i < Math.round(kit.fence / FENCE_GROUP); i++) {
        const p = getRandomPos(20); const angle = Math.random() * Math.PI;
        for(let j = 0; j < FENCE_GROUP; j++) {
            createFence(scene, p.x + Math.cos(angle) * (j * 3.2), p.z + Math.sin(angle) * (j * 3.2), angle);
        }
    }
}
