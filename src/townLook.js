import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY, createGovernor } from './townQuality.js';

// Art direction for Frontier Town, kept apart from how the town is built (src/townScene.js) and how the player
// moves in it (src/townWalk.js): this file only changes how the finished scene is drawn, and can be switched
// off (src/townFeatures.js, the LOOK button) without touching either.
//
// The look, in four parts:
//   1. Painted shading: every flat colour gets brush grain, siding lines, and a darker foot (a cheap stand-in
//      for ambient occlusion) so walls sit on the ground instead of floating above it.
//   2. A dusk sky that fades from deep teal overhead to a warm horizon.
//   3. Bloom, so lamps, windows and the train's headlamp glow.
//   4. A colour grade (teal shadows, amber highlights, a touch more colour) and a soft vignette.

// One palette for the whole grade, so it can be tuned in one place.
export const GRADE = {
    shadows: [0.88, 1.0, 1.04], // multiplied into the darks: a cool teal
    highlights: [1.1, 1.0, 0.86], // multiplied into the lights: warm amber
    saturation: 1.14,
    contrast: 1.08,
    gain: 1.28,
    vignette: 0.3,
    grain: 0.025
};
export const BLOOM = { strength: 0.45, radius: 0.5, threshold: 1.0 };
export const SKY = { top: '#0c1f29', middle: '#1d3640', horizon: '#6a5248' };

const SHADER_NOISE = `
float lookHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lookNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(lookHash(i), lookHash(i + vec2(1.0, 0.0)), f.x), mix(lookHash(i + vec2(0.0, 1.0)), lookHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

// Adds the painted shading to a Lambert material. `uLook` (0 off, 1 on) is shared by every patched material,
// so the whole town switches at once without rebuilding a shader.
function paint(material, uLook) {
    material.onBeforeCompile = shader => {
        shader.uniforms.uLook = uLook;
        shader.vertexShader = 'varying vec3 vLookWorld;\nvarying float vLookUp;\n'
            + shader.vertexShader.replace('#include <begin_vertex>',
                '#include <begin_vertex>\n\tvLookWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n\tvLookUp = normalize(mat3(modelMatrix) * objectNormal).y;');
        shader.fragmentShader = `uniform float uLook;\nvarying vec3 vLookWorld;\nvarying float vLookUp;\n${SHADER_NOISE}\n`
            + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    {
        float wall = 1.0 - smoothstep(0.55, 0.9, abs(vLookUp));
        vec3 p = vLookWorld;
        // Brush grain: two sizes of soft noise, in world space so neighbouring boxes agree.
        float grain = 0.93 + 0.14 * lookNoise(p.xz * 1.1 + p.y * 0.6) + 0.06 * (lookNoise(p.xz * 5.0 + p.y * 3.0) - 0.5);
        // Siding / brick courses: faint horizontal lines on walls every 0.9 units.
        float course = abs(fract(p.y / 0.9) - 0.5) * 2.0;
        float lines = 1.0 - wall * 0.1 * smoothstep(0.82, 1.0, course);
        // Darker foot and warmer top on walls: stands in for ambient occlusion and bounce light.
        float foot = mix(1.0, mix(0.6, 1.0, smoothstep(0.0, 3.2, p.y)), wall);
        vec3 warm = mix(vec3(1.0), vec3(1.07, 1.0, 0.9), wall * smoothstep(2.0, 8.0, p.y));
        diffuseColor.rgb *= mix(vec3(1.0), grain * lines * foot * warm, uLook);
    }`);
    };
    material.customProgramCacheKey = () => 'townLook';
    material.needsUpdate = true;
}

// Vertical dusk gradient, used as the scene background.
function skyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const g = canvas.getContext('2d');
    const gradient = g.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, SKY.top);
    gradient.addColorStop(0.55, SKY.middle);
    gradient.addColorStop(1, SKY.horizon);
    g.fillStyle = gradient;
    g.fillRect(0, 0, 4, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        shadows: { value: new THREE.Vector3(...GRADE.shadows) },
        highlights: { value: new THREE.Vector3(...GRADE.highlights) },
        saturation: { value: GRADE.saturation },
        contrast: { value: GRADE.contrast },
        gain: { value: GRADE.gain },
        vignette: { value: GRADE.vignette },
        grain: { value: GRADE.grain },
        time: { value: 0 }
    },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 shadows, highlights;
        uniform float saturation, contrast, gain, vignette, grain, time;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 c = texel.rgb;
            float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
            // Split toning: cool the darks, warm the lights.
            c *= mix(shadows, highlights, smoothstep(0.05, 0.9, luma));
            c *= gain;
            c = mix(vec3(luma), c, saturation);
            c = (c - 0.18) * contrast + 0.18;
            // Soft vignette, and a little film grain so flat colours do not band.
            vec2 d = vUv - 0.5;
            c *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
            c += (fract(sin(dot(vUv * 512.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * grain;
            gl_FragColor = vec4(max(c, 0.0), texel.a);
        }`
};

// scene / camera: the town's. options: enabled; level: 'high' | 'medium' | 'low' (src/townQuality.js); auto: step down by
// itself when the town runs slowly; onQuality(level, 'auto' | 'user'): called when the level changes.
// Returns { render(dt), resize(w, h), setEnabled(on), setQuality(level, auto), feed(dt), quality, auto, enabled }.
export function createTownLook(renderer, scene, camera, { enabled = true, level = 'high', auto = true, onQuality = () => {} } = {}) {
    const uLook = { value: enabled ? 1 : 0 };
    const patched = new WeakSet();
    const originalBackground = scene.background;
    const sky = skyTexture();
    const governor = createGovernor({ level, auto });
    let on = enabled;
    let sinceScan = Infinity;
    const size = renderer.getSize(new THREE.Vector2());
    let width = size.x, height = size.y;

    // Buildings rebuild when they are upgraded and can bring new materials: look again every half second.
    function scan() {
        scene.traverse(object => {
            const material = object.isMesh && object.material;
            if(!material || patched.has(material) || !material.isMeshLambertMaterial) return;
            if(material.transparent) return; // the smoke has its own shader and fades by alpha
            patched.add(material);
            paint(material, uLook);
        });
    }

    // The post-processing chain for the current level; none at all at 'low' (only the painted shading and the sky).
    let composer = null;
    let grade = null;
    function dropPost() {
        composer?.dispose();
        composer = grade = null;
    }
    function buildPost() {
        dropPost();
        const q = QUALITY[governor.level];
        if(!on || !q.post) return;
        composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: q.samples }));
        composer.setPixelRatio(Math.min(renderer.getPixelRatio(), q.pixelRatioCap));
        composer.setSize(width, height);
        composer.addPass(new RenderPass(scene, camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
        if(q.bloomScale !== 1) { // the composer tells every pass the full size: bloom works on a smaller picture of it
            const full = bloom.setSize.bind(bloom);
            bloom.setSize = (w, h) => full(Math.max(1, Math.round(w * q.bloomScale)), Math.max(1, Math.round(h * q.bloomScale)));
            bloom.setSize(width * composer._pixelRatio, height * composer._pixelRatio);
        }
        composer.addPass(bloom);
        grade = new ShaderPass(GradeShader);
        composer.addPass(grade);
        composer.addPass(new OutputPass());
    }

    function apply() {
        uLook.value = on ? 1 : 0;
        scene.background = on ? sky : originalBackground;
    }
    apply();
    scan();
    buildPost();

    // One frame took dt seconds: drops a level when the town has been slow for a while (never goes back up by itself).
    function feed(dt) {
        const stepped = governor.observe(dt);
        if(stepped) {
            buildPost();
            onQuality(stepped, 'auto');
        }
        return stepped;
    }

    let clock = 0;
    return {
        render(dt) {
            if(!on) {
                renderer.render(scene, camera);
                return;
            }
            clock += dt;
            sinceScan += dt;
            if(sinceScan > 0.5) {
                sinceScan = 0;
                scan();
            }
            feed(dt);
            if(!composer) {
                renderer.render(scene, camera);
                return;
            }
            grade.uniforms.time.value = clock % 10;
            // renderer.info restarts on every render() call, and the composer makes one per pass. Count the whole
            // frame (the town plus the post passes) so the draw-call guards in tests/mobile-smoke.mjs stay honest.
            const info = renderer.info;
            info.autoReset = false;
            info.reset();
            composer.render(dt);
            info.autoReset = true;
        },
        resize(w, h) {
            width = w;
            height = h;
            if(!composer) return;
            composer.setPixelRatio(Math.min(renderer.getPixelRatio(), QUALITY[governor.level].pixelRatioCap));
            composer.setSize(w, h);
        },
        setEnabled(next) {
            on = !!next;
            apply();
            buildPost(); // frees the chain while LOOK is off, builds it again when it is back on
        },
        // By hand: a level, and whether it may still step down by itself.
        setQuality(next, allowAuto = false) {
            governor.set(next);
            governor.auto = allowAuto;
            buildPost();
            onQuality(governor.level, 'user');
        },
        feed,
        get quality() { return governor.level; },
        get auto() { return governor.auto; },
        get enabled() { return on; }
    };
}
