import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';

// Phone emulation (landscape, touch, coarse pointer): tap to start, drive both sticks, use the
// touch buttons, and restart by tapping. Pointer events are dispatched with pointerType "touch".
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;

try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit', timeout: 30000 });
    await page.locator('canvas').waitFor();
    await page.evaluate(async () => { window.S = await import('/src/state.js'); });

    assert.equal(await page.evaluate(() => document.body.classList.contains('touch')), true, 'touch mode is detected');
    assert.equal(await page.locator('.touch-only.blink-text').isVisible(), true, 'start screen shows TAP TO DRAW');
    assert.equal(await page.locator('#crosshair').isVisible(), false, 'no mouse crosshair on touch');

    await page.touchscreen.tap(422, 40);
    await page.waitForFunction(() => S.gameState.isGameStarted);
    await page.evaluate(() => { S.playerStats.hp = 99; });

    async function drag(zoneSelector, fromX, fromY, toX, toY, holdMs) {
        await page.locator(zoneSelector).evaluate((zone, args) => {
            const [fromX, fromY, toX, toY] = args;
            const fire = (type, x, y) => zone.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
            fire('pointerdown', fromX, fromY);
            fire('pointermove', toX, toY);
            window.__release = () => fire('pointerup', toX, toY);
        }, [fromX, fromY, toX, toY]);
        await page.waitForTimeout(holdMs);
        await page.evaluate(() => window.__release());
    }

    const player = () => page.evaluate(() => {
        const p = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
        return { x: p.position.x, z: p.position.z };
    });
    const before = await player();
    await drag('#stick-move', 150, 250, 210, 250, 600);
    const after = await player();
    assert.ok(after.x - before.x > 2, `left stick moves the player right: ${JSON.stringify({ before, after })}`);

    const shotsBefore = await page.evaluate(() => S.gameState.runStats.shotsFired);
    await drag('#stick-aim', 650, 250, 650, 190, 700);
    const shotsAfter = await page.evaluate(() => S.gameState.runStats.shotsFired);
    assert.ok(shotsAfter > shotsBefore, 'right stick pushed past the threshold fires');

    await page.locator('#btn-swap').dispatchEvent('pointerdown');
    await page.waitForFunction(() => S.playerStats.weapon === 'shotgun');
    await page.locator('#btn-pause').dispatchEvent('pointerdown');
    await page.locator('#pause-overlay').waitFor({ state: 'visible' });
    await page.locator('#pause-resume-btn').tap();
    await page.locator('#pause-overlay').waitFor({ state: 'hidden' });

    await page.evaluate(() => { S.playerStats.hp = 1; S.playerStats.invulnerabilityTimer = 0; S.playerStats.isDashing = false; });
    await page.evaluate(async () => {
        const { spawnEnemy } = await import('/src/enemySystem.js');
        const p = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
        spawnEnemy(p.parent, p.position, 'bandit');
        S.enemies.at(-1).position.copy(p.position);
    });
    await page.locator('#gameover').waitFor({ state: 'visible' });
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'playerName', 'the name field does not pop the keyboard');
    await page.locator('#skipScoreBtn').tap();
    await page.locator('.restart-tap').tap();
    await page.locator('#start-screen').waitFor({ state: 'visible' });

    assert.deepEqual(errors, []);
    console.log('Mobile smoke passed: touch mode, tap start, move + aim/fire sticks, swap, pause, tap restart.');
} finally {
    await browser?.close();
    await server.close();
}
