import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { toonTexturedMaterial } from './assets.js';
import { assetUrl } from './demo.js';
import { inPlace, LOCOMOTION } from './animationClips.js';

// Animated 3D characters made outside the game (Meshy / Mixamo GLB, see tools/optimize-model.mjs).
// Each file carries a skinned mesh plus animations named idle, run, runShoot and dead.

const OUTLINE_WIDTH = 0.012; // in the model's own units (a Meshy character is ~1.7 tall)
const loader = new GLTFLoader();
const cache = new Map();

const loaded = new Map();

export function loadCharacterModel(url) {
    if(!cache.has(url)) {
        cache.set(url, loader.loadAsync(assetUrl(url)).then(gltf => { loaded.set(url, gltf); return gltf; }));
    }
    return cache.get(url);
}

// The model if it has finished loading, else null (enemies spawn mid-fight and cannot wait).
export function loadedCharacterModel(url) {
    return loaded.get(url) ?? null;
}

// Inverted-hull outline that follows the skeleton: the same skinned mesh drawn back-faces only,
// pushed out along the skinned normals, in the dark brown the box characters use.
function skinnedOutlineMaterial() {
    const material = new THREE.MeshBasicMaterial({ color: 0x1a0d05, side: THREE.BackSide });
    material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace(
            '#include <skinning_vertex>',
            `#include <skinning_vertex>\n    transformed += normalize(objectNormal) * ${OUTLINE_WIDTH.toFixed(4)};`
        );
    };
    return material;
}

// A ready-to-add copy of the character, scaled so it stands `height` units tall, with an animation mixer.
export function createCharacterInstance(gltf, height) {
    const root = cloneSkinned(gltf.scene);
    const outlines = [];
    root.traverse(object => {
        if(!object.isMesh) return;
        object.castShadow = true;
        object.frustumCulled = false; // skinned bounds do not follow the animation
        const source = Array.isArray(object.material) ? object.material[0] : object.material;
        object.material = toonTexturedMaterial(source.map);
        if(object.isSkinnedMesh) {
            const outline = new THREE.SkinnedMesh(object.geometry, skinnedOutlineMaterial());
            outline.bind(object.skeleton, object.bindMatrix);
            outline.frustumCulled = false;
            outline.userData.isOutline = true;
            outlines.push([object.parent, outline]);
        }
    });
    for(const [parent, outline] of outlines) parent.add(outline);

    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true); // posed vertices: stored skinned bounds can be far off
    const scale = height / Math.max(0.01, box.max.y - box.min.y);
    const holder = new THREE.Group();
    root.scale.setScalar(scale);
    holder.add(root);

    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for(const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip.name === 'dead' ? clip : inPlace(clip));
    if(actions.dead) {
        actions.dead.setLoop(THREE.LoopOnce, 1);
        actions.dead.clampWhenFinished = true;
    }
    let current = null;
    function play(name, fade = 0.15) {
        const next = actions[name] || actions.idle;
        if(!next || next === current) return;
        const phase = current && LOCOMOTION.has(current.getClip().name) && LOCOMOTION.has(next.getClip().name)
            ? current.time / current.getClip().duration : 0;
        next.reset().play();
        // Run <-> run-and-shoot keeps the stride where it was, so the legs never restart mid-step.
        next.time = phase * next.getClip().duration;
        if(current) current.crossFadeTo(next, fade, false);
        current = next;
    }
    play('idle', 0);
    return { object: holder, mixer, play, has: name => !!actions[name] };
}
