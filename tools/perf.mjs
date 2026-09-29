// Measures rendering cost on a phone-sized screen: draw calls, triangles, lights and average frame time
// in Frontier Town and in a fight with a crowd. Software rendering (SwiftShader) makes the frame times
// slower than a phone, but the comparison before/after a change is what matters.
//
//   CHROME_PATH=/path/to/chrome node tools/perf.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from '../tests/chrome-path.mjs';
import { answeredPrivacy } from '../tests/privacy-seed.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: findChrome(), args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await context.addInitScript(answeredPrivacy);
    // The same map and spawns every time, so runs before and after a change are comparable.
    await context.addInitScript(() => {
        let seed = 12345;
        Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.route('https://fonts.**', route => route.abort());
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit' });
    await page.locator('canvas').waitFor({ timeout: 90000 });
    await page.evaluate(async () => {
        window.S = await import('/src/state.js');
        window.__enemyCount = () => window.S.enemies.length;
    });

    // Frame time from requestAnimationFrame, and renderer.info from the last frame.
    // renderer.info normally resets after the shadow pass, so it would miss shadow draw calls: reset it by
    // hand once per animation frame instead, so each reading covers one whole frame.
    const sample = label => page.evaluate(async label => {
        const r = window.__redWestRenderer;
        r.info.autoReset = false;
        const times = [];
        const frames = [];
        let last = performance.now();
        await new Promise(resolve => {
            const tick = now => {
                times.push(now - last);
                last = now;
                frames.push({ calls: r.info.render.calls, triangles: r.info.render.triangles });
                r.info.reset();
                if(times.length < 60) requestAnimationFrame(tick); else resolve();
            };
            requestAnimationFrame(tick);
        });
        r.info.autoReset = true;
        const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
        const counted = frames.slice(1).filter(f => f.calls > 0);
        return {
            label,
            // Averages, since phones redraw shadows every other frame.
            calls: Math.round(counted.reduce((sum, f) => sum + f.calls, 0) / counted.length),
            triangles: Math.round(counted.reduce((sum, f) => sum + f.triangles, 0) / counted.length),
            enemies: window.__enemyCount?.() ?? 0,
            geometries: r.info.memory.geometries,
            programs: r.info.programs?.length,
            medianMs: +median(times.slice(1)).toFixed(1),
            p90Ms: +[...times.slice(1)].sort((a, b) => a - b)[Math.floor((times.length - 1) * 0.9)].toFixed(1)
        };
    }, label);

    const results = [];
    await page.locator('#town-btn').tap();
    await page.locator('#town-screen').waitFor({ state: 'visible' });
    await page.waitForTimeout(3000); // let smoke build up
    results.push(await sample('town'));
    await page.locator('#town-screen .panel-back').first().tap();
    await page.locator('#start-screen').waitFor({ state: 'visible' });

    await page.locator('#play-btn').tap({ force: true });
    await page.waitForFunction(() => S.gameState.isGameStarted);
    // A repeatable crowd: 14 bandits in a ring around the player, then paused so nothing moves.
    await page.evaluate(async () => {
        S.playerStats.hp = 999;
        const { spawnEnemy } = await import('/src/enemySystem.js');
        const p = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
        for(let i = 0; i < 14; i++) spawnEnemy(p.parent, p.position, 'bandit');
        S.enemies.forEach((e, i) => e.position.set(p.position.x + Math.cos(i) * 12, 0, p.position.z + Math.sin(i) * 9));
        S.gameState.isPaused = true;
    });
    await page.waitForTimeout(1500);
    results.push(await sample('fight (paused, 15+ enemies)'));
    // --detail: what the fight draws, by kind of object (visible meshes in view, or never culled).
    if(process.argv.includes('--detail')) console.log(await page.evaluate(async () => {
        const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => null);
        const scene = S.enemies[0].parent;
        const camera = window.__redWestCamera;
        const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const counts = {};
        for(const top of scene.children) {
            const key = top.userData.type || top.type;
            (function walk(o, visible) {
                visible = visible && o.visible;
                if(!visible) return;
                if(o.isMesh && (!o.frustumCulled || frustum.intersectsObject(o))) {
                    const kind = o.userData.isOutline ? 'outline' : o.isInstancedMesh ? 'instanced' : 'mesh';
                    counts[`${key} ${kind}`] = (counts[`${key} ${kind}`] || 0) + 1;
                }
                for(const c of o.children) walk(c, visible);
            })(top, true);
        }
        return counts;
    }));
    console.table(results);
} finally {
    await browser.close();
    await server.close();
}
