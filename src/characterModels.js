import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { toonTexturedMaterial } from './assets.js';
import { assetUrl } from './demo.js';
import { inPlace, LOCOMOTION, clipPart, withPose, BOTH_ARMS, UPPER_BODY } from './animationClips.js';

// Animated 3D characters made outside the game (Meshy / Mixamo GLB, see tools/optimize-model.mjs).
// Each file carries a skinned mesh plus animations named idle, run, runShoot and dead.

const OUTLINE_WIDTH = 0.012; // in the model's own units (a Meshy character is ~1.7 tall)
const loader = new GLTFLoader();
const cache = new Map();

const loaded = new Map();

// Phones drop downloads now and then: try three times, and forget a failure so a later call tries again
// (a failed first try used to leave that character without a picture until the app restarted).
const ATTEMPTS = 3;
async function loadWithRetry(url) {
    for(let attempt = 1; ; attempt++) {
        try {
            return await loader.loadAsync(assetUrl(url));
        } catch(error) {
            if(attempt >= ATTEMPTS) throw error;
            await new Promise(resolve => setTimeout(resolve, 800 * attempt));
        }
    }
}

export function loadCharacterModel(url) {
    if(!cache.has(url)) {
        const request = loadWithRetry(url).then(gltf => { loaded.set(url, gltf); return gltf; });
        request.catch(() => cache.delete(url));
        cache.set(url, request);
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

// The drawn gun: a small revolver in the character's own units (a Meshy character is ~1.8 tall), barrel
// along +z, grip at the origin. The models wear their revolver in the holster (it is part of the mesh);
// this one shows in the hand only while the gun is out.
const GUN_MATERIALS = {
    metal: new THREE.MeshToonMaterial({ color: 0x2b2b2e }),
    grip: new THREE.MeshToonMaterial({ color: 0x6d3b1a })
};
function createHandGun() {
    const gun = new THREE.Group();
    const part = (w, h, d, material, x, y, z, rx = 0) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        mesh.rotation.x = rx;
        mesh.castShadow = true;
        gun.add(mesh);
    };
    // Chunky, like the models: readable on a phone screen.
    part(0.05, 0.13, 0.07, GUN_MATERIALS.grip, 0, -0.05, -0.02, 0.35);
    part(0.07, 0.08, 0.12, GUN_MATERIALS.metal, 0, 0.03, 0.045);
    part(0.045, 0.045, 0.26, GUN_MATERIALS.metal, 0, 0.05, 0.21);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.05, 0.36);
    gun.add(muzzle);
    return { gun, muzzle };
}

// The quick draw inside Meshy's "Cowboy Quick Draw Shooting" clip: the hand goes to the holster at 1.9 s
// and fires from the hip at 2.7 s (sampled in tools, 2026-09-29). The aim afterwards is the two-handed
// pistol aim from "Walk Forward While Shooting", held on the arms over the idle or run legs.
const DRAW_FROM = 1.9;
const DRAW_TO = 2.7;
const AIM_POSE_AT = 0.5;
const GUN_SHOWS_AT = 0.45; // share of the draw where the gun leaves the holster
const HOLSTER_AFTER = 1.6; // seconds without aiming before the gun goes back

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
    const clips = {};
    for(const clip of gltf.animations) clips[clip.name] = clip.name === 'dead' ? clip : inPlace(clip);
    // Gun play, for models that carry the quick draw: the draw itself, and idle / run with the gun arm
    // held in the hip-fire pose (running legs, gun pointing ahead).
    if(clips.draw && clips.walkShoot && clips.idle && clips.run) {
        clips.drawOut = clipPart(clips.draw, 'drawOut', DRAW_FROM, DRAW_TO);
        clips.aimIdle = withPose(clips.idle, clips.walkShoot, AIM_POSE_AT, BOTH_ARMS, 'aimIdle');
        clips.runAim = withPose(clips.run, clips.walkShoot, AIM_POSE_AT, UPPER_BODY, 'runAim');
    }
    const actions = {};
    for(const [name, clip] of Object.entries(clips)) actions[name] = mixer.clipAction(clip);
    for(const name of ['dead', 'drawOut']) {
        if(!actions[name]) continue;
        actions[name].setLoop(THREE.LoopOnce, 1);
        actions[name].clampWhenFinished = true;
    }
    if(actions.drawOut) actions.drawOut.timeScale = 1.4; // a snappy draw: about 0.55 s

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

    // The revolver in the right hand, turned so its barrel points where the character faces in the
    // hip-fire pose.
    const hand = root.getObjectByName('RightHand');
    let gun = null;
    let muzzle = null;
    if(hand && actions.aimIdle) {
        ({ gun, muzzle } = createHandGun());
        const pose = actions.aimIdle;
        pose.play();
        mixer.setTime(0);
        root.updateMatrixWorld(true);
        const handQuat = hand.getWorldQuaternion(new THREE.Quaternion());
        const rootQuat = root.getWorldQuaternion(new THREE.Quaternion());
        const handScale = hand.getWorldScale(new THREE.Vector3());
        const rootScale = root.getWorldScale(new THREE.Vector3());
        gun.quaternion.copy(handQuat.invert().multiply(rootQuat));
        gun.scale.set(rootScale.x / handScale.x, rootScale.y / handScale.y, rootScale.z / handScale.z);
        gun.position.set(0, 0.06 * rootScale.y / handScale.y, 0); // from the wrist bone into the palm
        gun.visible = false;
        hand.add(gun);
        pose.stop();
        mixer.setTime(0);
    }
    play('idle', 0);

    // Gun state: holstered, drawing, or out (aimIdle / runAim) until HOLSTER_AFTER without aiming.
    let gunOut = false;
    let drawing = false;
    let lastAimAt = -Infinity;
    let clock = 0;
    const canDraw = !!gun;
    // Called every frame. aiming: about to shoot or shooting; quickDraw: play the draw first (outlaws),
    // else the gun is simply raised (the player, whose first shot must not wait).
    function combat(dt, { moving = false, aiming = false, quickDraw = false } = {}) {
        clock += dt;
        if(!canDraw) {
            play(moving ? (aiming && actions.runShoot ? 'runShoot' : 'run') : 'idle');
            return;
        }
        if(aiming) {
            lastAimAt = clock;
            if(!gunOut) {
                gunOut = true;
                if(quickDraw) {
                    drawing = true;
                    play('drawOut', 0.1);
                } else {
                    gun.visible = true;
                }
            }
        } else if(gunOut && !drawing && clock - lastAimAt > HOLSTER_AFTER) {
            gunOut = false;
            gun.visible = false;
        }
        if(drawing) {
            const draw = actions.drawOut;
            if(draw.time / draw.getClip().duration >= GUN_SHOWS_AT) gun.visible = true;
            if(draw.time < draw.getClip().duration - 1e-3) return;
            drawing = false;
        }
        play(gunOut ? (moving ? 'runAim' : 'aimIdle') : (moving ? 'run' : 'idle'), 0.12);
    }
    return {
        object: holder, mixer, play, combat, muzzle,
        has: name => !!actions[name],
        get gunOut() { return gunOut && !drawing; }
    };
}
