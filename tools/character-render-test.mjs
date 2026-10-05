import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from '../tests/chrome-path.mjs';
import { answeredPrivacy } from '../tests/privacy-seed.mjs';

const modelName = process.argv[2] || 'bandit';
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

    const shots = await page.evaluate(async (name) => {
        const { loadCharacterModel, createCharacterInstance } = await import('/src/characterModels.js');
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
        scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb07a45, 2.4));
        const key = new THREE.DirectionalLight(0xffe6c0, 2.4);
        key.position.set(4, 8, 8);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xfff0dc, 1.2);
        fill.position.set(-4, 4, 6);
        scene.add(fill);

        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

        function captureView(instance, camPos, lookAtPos) {
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

        const gltf = await loadCharacterModel(`models/${name}.glb`);
        const instance = createCharacterInstance(gltf, 6);
        scene.add(instance.object);

        const results = {};

        // 1. Full body front view, idle
        instance.mixer.update(0.3);
        instance.object.rotation.y = 0;
        results[`${name}_front`] = captureView(instance, new THREE.Vector3(0, 3.2, 11), new THREE.Vector3(0, 3.0, 0));

        // 2. Three-quarter view, idle
        instance.object.rotation.y = -0.45;
        results[`${name}_three_quarter`] = captureView(instance, new THREE.Vector3(0, 3.2, 11), new THREE.Vector3(0, 3.0, 0));

        // 3. Side view, idle
        instance.object.rotation.y = Math.PI / 2;
        results[`${name}_side_idle`] = captureView(instance, new THREE.Vector3(0, 3.2, 11), new THREE.Vector3(0, 3.0, 0));

        // 4. Side view, run
        instance.play('run');
        instance.mixer.update(0.3);
        results[`${name}_side_run`] = captureView(instance, new THREE.Vector3(0, 3.2, 11), new THREE.Vector3(0, 3.0, 0));

        target.dispose();
        return results;
    }, modelName);

    const outDir = 'art/characters';
    await mkdir(outDir, { recursive: true });
    for (const [shotName, dataUrl] of Object.entries(shots)) {
        const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
        const file = `${outDir}/${shotName}.png`;
        await writeFile(file, buf);
        console.log(`Saved ${file}`);
    }
} finally {
    await browser.close();
    await server.close();
}
