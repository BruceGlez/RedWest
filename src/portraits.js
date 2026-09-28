import * as THREE from 'three';
import { createBossMesh } from './assets.js';
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
