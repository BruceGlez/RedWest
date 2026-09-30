import * as THREE from 'three';
import { toonVertexColorMaterial } from './assets.js';
import { DEFAULT_ATMOSPHERE } from './atmosphere.js';

// Life in the desert: dry grass tufts that sway in the wind, tumbleweeds that roll through, and motes in the air
// (dust, ash, embers, mist or snow, chosen per stage in atmosphere.js). Three draw calls in all: one instanced
// mesh of tufts, one of tumbleweeds, one set of points. Nothing here touches collision or the fight.

const WIND = new THREE.Vector3(1, 0, 0.35).normalize(); // the wind always blows from the same side
const TUFTS = 700;
const SPREAD = 125; // tufts cover the map; the fog hides the rest
const WEED_RADIUS = 0.9;
const WEED_RANGE = 70; // weeds and motes wrap around the player inside this distance
const MOTES = 120;

const uniforms = { uTime: { value: 0 }, uWind: { value: 0.3 } };
let tufts = null;
let weeds = null;
let motes = null;
let look = DEFAULT_ATMOSPHERE;
const weedState = Array.from({ length: 4 }, () => ({ x: 0, z: 0, spin: 0, phase: 0, speed: 0 }));
const moteState = Array.from({ length: MOTES }, () => ({ x: 0, y: 0, z: 0, phase: 0 }));
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), axis: new THREE.Vector3(), euler: new THREE.Euler() };

// Three thin blades crossed at the base, dark at the root and pale at the tip.
function tuftGeometry() {
    const positions = [];
    const colors = [];
    const root = new THREE.Color(0x6a642a);
    const tip = new THREE.Color(0xc2b25a);
    [[0, 1.5, 0.2], [2.1, 1.1, 0.18], [4.2, 1.3, 0.2]].forEach(([angle, height, lean]) => {
        const x = Math.cos(angle) * 0.2;
        const z = Math.sin(angle) * 0.2;
        // One tapered blade: a triangle from a wide root to a leaning tip.
        positions.push(-x, 0, -z, x, 0, z, Math.sin(angle) * lean, height, -Math.cos(angle) * lean);
        colors.push(...root.toArray(), ...root.toArray(), ...tip.toArray());
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function softDotTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
}

export function setupAmbience(scene) {
    // Grass: sways more toward the tip (position.y), out of step from tuft to tuft by where it stands.
    const grass = toonVertexColorMaterial();
    grass.side = THREE.DoubleSide;
    grass.onBeforeCompile = shader => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uWind = uniforms.uWind;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
            float gust = sin(uTime * 1.9 + instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23) + 0.5 * sin(uTime * 4.3 + instanceMatrix[3].z * 0.7);
            transformed.x += gust * uWind * 0.16 * position.y;
            transformed.z += gust * uWind * 0.06 * position.y;`);
    };
    tufts = new THREE.InstancedMesh(tuftGeometry(), grass, TUFTS);
    const { matrix, position, quaternion, scale, euler } = scratch;
    for(let i = 0; i < TUFTS; i++) {
        position.set((Math.random() - 0.5) * SPREAD * 2, 0, (Math.random() - 0.5) * SPREAD * 2);
        quaternion.setFromEuler(euler.set(0, Math.random() * Math.PI * 2, 0));
        const size = 0.7 + Math.random() * 0.9;
        scale.set(size, size * (0.8 + Math.random() * 0.6), size);
        tufts.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    tufts.frustumCulled = false;
    scene.add(tufts);

    weeds = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(WEED_RADIUS, 1),
        new THREE.MeshToonMaterial({ color: 0x9a7a45, flatShading: true }),
        weedState.length
    );
    weeds.frustumCulled = false;
    weeds.count = 0;
    weedState.forEach(w => { w.phase = Math.random() * 6; w.speed = 0.7 + Math.random() * 0.6; w.x = (Math.random() - 0.5) * WEED_RANGE * 2; w.z = (Math.random() - 0.5) * WEED_RANGE * 2; });
    scene.add(weeds);

    moteState.forEach(m => {
        m.x = (Math.random() - 0.5) * WEED_RANGE * 2; m.z = (Math.random() - 0.5) * WEED_RANGE * 2; m.y = Math.random() * 16; m.phase = Math.random() * 6;
    });
    const points = new THREE.BufferGeometry();
    points.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MOTES * 3), 3));
    motes = new THREE.Points(points, new THREE.PointsMaterial({
        map: softDotTexture(), size: 0.4, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0.4
    }));
    motes.frustumCulled = false;
    scene.add(motes);
    setAmbienceLook(look);
}

// Called with the stage's atmosphere (world.js setAtmosphere).
export function setAmbienceLook(next) {
    look = next;
    uniforms.uWind.value = next.wind;
    if(!tufts) return;
    tufts.material.color.setHex(next.props);
    weeds.count = Math.min(weedState.length, next.weeds);
    weeds.material.color.setHex(next.props).multiply(new THREE.Color(0x9a7a45));
    motes.material.color.setHex(next.motes.color);
    motes.material.size = next.motes.size;
    motes.material.opacity = next.motes.opacity;
    motes.geometry.setDrawRange(0, Math.min(MOTES, next.motes.count));
}

// time: seconds of wall clock; focus: where the player is (weeds and motes stay around them).
export function updateAmbience(dt, time, focus) {
    if(!tufts) return;
    dt = Math.min(dt, 0.1);
    uniforms.uTime.value = time;
    const { matrix, position, quaternion, scale, axis } = scratch;

    // Tumbleweeds roll downwind, bouncing a little, and reappear on the upwind side when they leave the area.
    for(let i = 0; i < weeds.count; i++) {
        const w = weedState[i];
        const speed = (2 + look.wind * 9) * w.speed;
        w.x += WIND.x * speed * dt;
        w.z += WIND.z * speed * dt;
        w.spin += speed * dt / WEED_RADIUS;
        if(w.x - focus.x > WEED_RANGE) { w.x -= WEED_RANGE * 2; w.z = focus.z + (Math.random() - 0.5) * WEED_RANGE * 1.6; }
        else if(w.x - focus.x < -WEED_RANGE) w.x += WEED_RANGE * 2;
        if(Math.abs(w.z - focus.z) > WEED_RANGE) w.z -= Math.sign(w.z - focus.z) * WEED_RANGE * 2;
        const hop = Math.abs(Math.sin(time * 2.2 * w.speed + w.phase));
        position.set(w.x, WEED_RADIUS * 0.75 + hop * 0.7, w.z);
        quaternion.setFromAxisAngle(axis.set(-WIND.z, 0, WIND.x), w.spin);
        weeds.setMatrixAt(i, matrix.compose(position, quaternion, scale.set(1, 0.85, 1)));
    }
    if(weeds.count) weeds.instanceMatrix.needsUpdate = true;

    // Motes drift with the wind, fall or rise, wobble, and wrap around the player.
    const { speed, fall, count } = look.motes;
    const array = motes.geometry.attributes.position.array;
    for(let i = 0; i < Math.min(MOTES, count); i++) {
        const m = moteState[i];
        m.x += (WIND.x * speed + Math.sin(time * 0.7 + m.phase) * 0.4) * dt;
        m.z += (WIND.z * speed + Math.cos(time * 0.6 + m.phase) * 0.4) * dt;
        m.y -= fall * dt;
        if(m.y < 0.2) m.y += 16;
        else if(m.y > 16) m.y -= 16;
        if(m.x - focus.x > WEED_RANGE * 0.6) m.x -= WEED_RANGE * 1.2;
        else if(m.x - focus.x < -WEED_RANGE * 0.6) m.x += WEED_RANGE * 1.2;
        if(m.z - focus.z > WEED_RANGE * 0.6) m.z -= WEED_RANGE * 1.2;
        else if(m.z - focus.z < -WEED_RANGE * 0.6) m.z += WEED_RANGE * 1.2;
        array[i * 3] = m.x; array[i * 3 + 1] = m.y; array[i * 3 + 2] = m.z;
    }
    motes.geometry.attributes.position.needsUpdate = true;
}
