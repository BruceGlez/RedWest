import * as THREE from 'three';
import { LANTERN_RADIUS } from './mineLight.js';

// The dark of the mine (MINE_PLAN.md, slice 5), made in code: one full-screen layer drawn over the world that is truly black outside a dim
// radius around the marshal. Every pixel is traced to the ground, and the further that spot is from the light the blacker it goes, so the
// cave floor, the rock, the props and the monsters all fall into the dark together without touching their materials (one draw call).
// Things that must stay findable are drawn AFTER it (a higher renderOrder, see `glowMaterial`) or have a hole cut in it (`holes`).
//
// How big the lit radius is belongs to the mine lane's light rules (lantern lit, a torch near, lantern out of oil = the faint ring). That
// module is not merged yet, so the radius comes through ONE hook, `setMineLightSource`, and until then a named constant stands in.

export const MIN_RADIUS = 6; // the faint ring: you can always see your own feet and a step around them, with no light at all
export { LANTERN_RADIUS }; // "lantern lit": the mine lane's number (src/mineLight.js), used until a light source is set
export const DARK_RENDER_ORDER = 5; // the dark layer; the lift and shaft glow are drawn above it
export const GLOW_RENDER_ORDER = 20;
const MAX_HOLES = 16; // the lift and the shaft, then up to 12 of the mine lane's torches (src/mineLight.js MAX_HOLES)

let lightSource = () => ({ radius: LANTERN_RADIUS, holes: [] });
// Hook for the mine lane: `fn()` returns { radius, holes? }, where radius is the marshal's own light (world units) and holes are extra
// lit places [{ x, z, r, k }] (a torch you placed, k = 0..1 how much of the dark it clears). The radius is never taken below MIN_RADIUS.
export function setMineLightSource(fn) { lightSource = typeof fn === 'function' ? fn : () => ({ radius: LANTERN_RADIUS, holes: [] }); }

// How much of the dark is left at `distance` from a light of `radius` (0 = clear, 1 = black). Mirrors the shader, for tests.
export function darkAlpha(distance, radius) {
    const r = Math.max(radius, MIN_RADIUS);
    const t = Math.min(1, Math.max(0, (distance - r * 0.2) / (r * 0.8)));
    return t * t * (3 - 2 * t);
}

const VERTEX = `
varying vec2 vNdc;
void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = `
uniform mat4 uInvProjection;
uniform mat4 uCameraWorld;
uniform vec3 uMarshal;
uniform float uRadius;
uniform int uHoleCount;
uniform vec4 uHoles[${MAX_HOLES}]; // x, z, radius, strength
varying vec2 vNdc;

float clearing(float d, float r) { return 1.0 - smoothstep(r * 0.2, r, d); }

void main() {
    vec4 view = uInvProjection * vec4(vNdc, 1.0, 1.0);
    vec3 dir = normalize((uCameraWorld * vec4(view.xyz / view.w, 0.0)).xyz);
    vec3 origin = uCameraWorld[3].xyz;
    if(dir.y > -0.001) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } // above the horizon: the roof
    vec3 hit = origin + dir * ((0.5 - origin.y) / dir.y);
    float lit = clearing(distance(hit.xz, uMarshal.xz), uRadius);
    for(int i = 0; i < ${MAX_HOLES}; i++) {
        if(i >= uHoleCount) break;
        vec4 h = uHoles[i];
        lit = max(lit, h.w * clearing(distance(hit.xz, h.xy), h.z));
    }
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - lit);
}`;

// A material for things that glow in the dark (the lift's and the shaft's lanterns and beams): drawn after the dark layer, so it shows through.
export function glowMaterial(parameters = {}) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, ...parameters });
    return material;
}

// The dark layer for the floor on show. `permanent` are the places that are always lit a little (the lift and the shaft) as [x, z, r, k].
export function createMineDark(scene, permanent = []) {
    const uniforms = {
        uInvProjection: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uMarshal: { value: new THREE.Vector3() },
        uRadius: { value: LANTERN_RADIUS },
        uHoleCount: { value: 0 },
        uHoles: { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4()) }
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthTest: false, depthWrite: false, fog: false });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); // one triangle that covers the screen
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'mine-dark';
    mesh.frustumCulled = false;
    mesh.renderOrder = DARK_RENDER_ORDER;

    const marshal = scene.children.find(o => o.userData?.muzzle) ?? null; // the marshal's group (src/playerSystem.js)
    let lastTime = 0;
    const state = { mesh, uniforms, radius: LANTERN_RADIUS, flicker: 0, enabled: true, extraHoles: [] }; // extraHoles: lit places the scene knows of (its torches)
    mesh.onBeforeRender = (renderer, _scene, camera) => {
        uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
        uniforms.uCameraWorld.value.copy(camera.matrixWorld);
        if(marshal) uniforms.uMarshal.value.copy(marshal.position);
    };

    // Called every frame: the radius eases toward what the light rules say, with a faint flicker, and the torches' holes follow.
    state.update = (timeInSeconds, dt = Math.min(0.1, Math.max(0, timeInSeconds - lastTime))) => {
        lastTime = timeInSeconds;
        const light = lightSource() ?? {};
        const target = Math.max(MIN_RADIUS, Number.isFinite(light.radius) ? light.radius : LANTERN_RADIUS);
        state.radius += (target - state.radius) * Math.min(1, dt * 4);
        state.flicker = Math.sin(timeInSeconds * 11) * 0.012 + Math.sin(timeInSeconds * 7.3 + 1) * 0.01;
        uniforms.uRadius.value = state.radius * (1 + state.flicker);
        let n = 0;
        for(const [x, z, r, k] of permanent) uniforms.uHoles.value[n++].set(x, z, r, k);
        for(const h of [...state.extraHoles, ...(light.holes ?? [])]) { if(n >= MAX_HOLES) break; uniforms.uHoles.value[n++].set(h.x, h.z, h.r, h.k ?? 1); }
        uniforms.uHoleCount.value = n;
        mesh.visible = state.enabled;
    };
    state.update(0, 1);
    state.radius = uniforms.uRadius.value;
    return state;
}
