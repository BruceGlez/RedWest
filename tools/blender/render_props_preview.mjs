import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from '../tests/chrome-path.mjs';
import { answeredPrivacy } from '../tests/privacy-seed.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: findChrome(), args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });

try {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    await context.addInitScript(answeredPrivacy);
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit' });
    await page.locator('canvas').waitFor({ timeout: 120000 });

    const shots = await page.evaluate(async () => {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const renderer = window.__redWestRenderer;
        const THREE = await import('three');

        const SIZE = 512;
        const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
        target.texture.colorSpace = THREE.SRGBColorSpace;
        const pixels = new Uint8Array(SIZE * SIZE * 4);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(SIZE, SIZE);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf4f1ea);
        scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb07a45, 2.2));
        const key = new THREE.DirectionalLight(0xffe6c0, 2.6);
        key.position.set(6, 12, 10);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xfff0dc, 1.4);
        fill.position.set(-6, 6, 8);
        scene.add(fill);

        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
        const loader = new GLTFLoader();

        function captureView(camPos, lookAtPos) {
            camera.position.copy(camPos);
            camera.lookAt(lookAtPos);
            renderer.setRenderTarget(target);
            renderer.render(scene, camera);
            renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
            renderer.setRenderTarget(null);

            for (let y = 0; y < SIZE; y++) {
                const from = (SIZE - 1 - y) * SIZE * 4;
                imgData.data.set(pixels.subarray(from, from + (SIZE * 4)), y * SIZE * 4);
            }
            ctx.putImageData(imgData, 0, 0);
            return canvas.toDataURL('image/png');
        }

        const results = {};
        const models = [
            { name: 'house', path: 'models/house.glb', cam: [8.5, 6.0, 14.5], target: [0, 3.5, 0] },
            { name: 'tree', path: 'models/tree.glb', cam: [6, 5, 8], target: [0, 2.8, 0] },
            { name: 'rock', path: 'models/rock.glb', cam: [3.5, 3.2, 4.5], target: [0, 0.9, 0] },
            { name: 'mine_chest', path: 'models/mine_chest.glb', cam: [2.4, 2.2, 3.2], target: [0, 0.6, 0] },
            { name: 'mine_mushroom', path: 'models/mine_mushroom.glb', cam: [3.2, 2.4, 3.6], target: [0, 0.8, 0] }
        ];

        for (const item of models) {
            const gltf = await new Promise((resolve, reject) => loader.load(item.path, resolve, undefined, reject));
            scene.add(gltf.scene);
            results[item.name] = captureView(new THREE.Vector3(...item.cam), new THREE.Vector3(...item.target));
            scene.remove(gltf.scene);
        }

        target.dispose();
        return results;
    });

    const outDir = 'art/props';
    await mkdir(outDir, { recursive: true });
    for (const [name, dataUrl] of Object.entries(shots)) {
        const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
        const file = `${outDir}/${name}.png`;
        await writeFile(file, buf);
        console.log(`Saved ${file}`);
    }
} finally {
    await browser.close();
    await server.close();
}
