import * as THREE from 'three';
import { createBossMesh, createPlayerMesh, applyPlayerLoadout, createEnemyMesh, createWolfMesh, createGunslingerMesh, createRattlerMesh, createRiflemanMesh,
    createDynamiterMesh, createBruteMesh, createRiderMesh, createDuelistMesh, createGhostMesh } from './assets.js';
import { OUTLAWS } from './outlaws.js';

// Renders each outlaw's in-game 3D model into a small image for the WANTED posters and the road,
// so the menus show the same characters players fight. Runs once at startup on the game renderer.
const SIZE = 256;

export function renderOutlawPortraits(renderer) {
    const portraits = {};
    const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const pixels = new Uint8Array(SIZE * SIZE * 4);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(SIZE, SIZE);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7cf9c);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb07a45, 2.2));
    const key = new THREE.DirectionalLight(0xffe6c0, 2.2);
    key.position.set(4, 6, 8);
    scene.add(key);
    // Head-and-shoulders framing (the boss model is 1.5x inside, 1.2x here: hat top sits near y 10).
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(1.8, 8.4, 11);
    camera.lookAt(0, 7.7, 0);

    const previousTarget = renderer.getRenderTarget();
    try {
        for(const outlaw of OUTLAWS) {
            const boss = createBossMesh(outlaw.colors);
            boss.userData.hpBar.parent.visible = false;
            boss.scale.setScalar(1.2);
            boss.rotation.y = -0.35; // a three-quarter view reads better than straight on
            scene.add(boss);
            renderer.setRenderTarget(target);
            renderer.render(scene, camera);
            renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
            scene.remove(boss);

            // WebGL rows run bottom-up; canvas rows run top-down.
            for(let y = 0; y < SIZE; y++) {
                const from = (SIZE - 1 - y) * SIZE * 4;
                image.data.set(pixels.subarray(from, from + (SIZE * 4)), y * SIZE * 4);
            }
            ctx.putImageData(image, 0, 0);
            portraits[outlaw.id] = canvas.toDataURL('image/png');
        }
    } catch {
        return {}; // The CSS-drawn portraits remain as a fallback.
    } finally {
        renderer.setRenderTarget(previousTarget);
        target.dispose();
    }
    return portraits;
}

const ENEMY_MESHES = {
    bandit: createEnemyMesh, wolf: createWolfMesh, gunslinger: createGunslingerMesh, rattler: createRattlerMesh,
    rifleman: createRiflemanMesh, dynamiter: createDynamiterMesh, brute: createBruteMesh, rider: createRiderMesh,
    duelist: createDuelistMesh, ghost: createGhostMesh
};

// A small off-screen photo studio: frames any model from its bounding box and returns a PNG URL.
function createStudio(renderer) {
    const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const pixels = new Uint8Array(SIZE * SIZE * 4);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(SIZE, SIZE);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7cf9c);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb07a45, 2.2));
    const key = new THREE.DirectionalLight(0xffe6c0, 2.2);
    key.position.set(4, 8, 8);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    const bounds = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    const viewDir = new THREE.Vector3(0.55, 0.45, 1).normalize();
    // Soft front fill so faces under wide hat brims are not lost in shadow.
    const fill = new THREE.DirectionalLight(0xfff0dc, 0.9);
    fill.position.set(0, 1, 6);
    scene.add(fill);
    return {
        // view: direction from the model to the camera (default: a little above, three-quarter).
        capture(model, zoom = 1.25, view = viewDir) {
            scene.add(model);
            model.updateMatrixWorld(true);
            bounds.setFromObject(model);
            bounds.getCenter(center);
            bounds.getSize(size);
            const radius = Math.max(size.x, size.y, size.z) * 0.5;
            camera.position.copy(center).addScaledVector(view, (radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * zoom);
            camera.lookAt(center);
            const previous = renderer.getRenderTarget();
            renderer.setRenderTarget(target);
            renderer.render(scene, camera);
            renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
            renderer.setRenderTarget(previous);
            scene.remove(model);
            for(let y = 0; y < SIZE; y++) {
                const from = (SIZE - 1 - y) * SIZE * 4;
                image.data.set(pixels.subarray(from, from + (SIZE * 4)), y * SIZE * 4);
            }
            ctx.putImageData(image, 0, 0);
            return canvas.toDataURL('image/png');
        },
        dispose() { target.dispose(); }
    };
}

// Bounty Book pictures: each regular enemy, framed automatically from its bounding box.
export function renderEnemyPortraits(renderer) {
    const portraits = {};
    let studio = null;
    try {
        studio = createStudio(renderer);
        for(const [id, create] of Object.entries(ENEMY_MESHES)) {
            const model = create();
            model.rotation.y = -0.5;
            portraits[id] = studio.capture(model);
        }
    } catch {
        return {};
    } finally {
        studio?.dispose();
    }
    return portraits;
}

// Shop preview: the player in a given outfit. The studio and model are reused between calls.
let previewStudio = null;
let previewModel = null;
const CHARACTER_VIEW = new THREE.Vector3(0.3, -0.14, 1).normalize();

// characterModel: an imported character (src/characterModels.js) to show instead of the Drifter.
export function renderPlayerPreview(renderer, colors, characterModel = null) {
    try {
        previewStudio ??= createStudio(renderer);
        // Eye level for imported characters: from above, a wide hat brim hides the face.
        if(characterModel) return previewStudio.capture(characterModel, 1.1, CHARACTER_VIEW);
        if(!previewModel) {
            previewModel = createPlayerMesh();
            previewModel.rotation.y = -0.5;
        }
        applyPlayerLoadout(previewModel, colors);
        return previewStudio.capture(previewModel, 1.15);
    } catch {
        return '';
    }
}
