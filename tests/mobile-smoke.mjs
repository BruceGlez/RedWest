import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// Phone emulation (landscape, touch, coarse pointer): tap to start, drive both sticks, use the
// touch buttons, and restart by tapping. Pointer events are dispatched with pointerType "touch".
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;

try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await context.addInitScript(answeredPrivacy);
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
    assert.equal(await page.locator('#play-btn').isVisible(), true, 'home screen shows PLAY');
    assert.match(await page.locator('#home-poster').textContent(), /WANTED.*DUSTY PETE/);
    assert.equal(await page.locator('#crosshair').isVisible(), false, 'no mouse crosshair on touch');

    await page.locator('#play-btn').tap({ force: true }); // it pulses, so never "stable"
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
        // Hold for game time, not wall time: software rendering in CI can run at a few FPS.
        await page.evaluate(async seconds => {
            const start = S.gameState.runTime;
            const deadline = Date.now() + 30000;
            while(S.gameState.runTime - start < seconds && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
        }, holdMs / 1000);
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

    // Off-screen enemies get edge arrows (the phone camera is closer than desktop).
    await page.waitForFunction(() => [...document.querySelectorAll('.edge-arrow')].some(a => a.style.display === 'block'));

    // Tap the aim side: Brawl Stars-style quick fire turns toward the nearest enemy and shoots.
    await page.evaluate(async () => {
        const { spawnEnemy } = await import('/src/enemySystem.js');
        const p = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
        for(const e of S.enemies) e.position.set(p.position.x + 60, 0, p.position.z + 60);
        spawnEnemy(p.parent, p.position, 'bandit');
        window.__target = S.enemies.at(-1);
        Object.assign(window.__target.userData, { speed: 0, hp: 50, maxHp: 50 });
        window.__target.position.set(p.position.x - 10, 0, p.position.z + 6);
        window.__player = p;
    });
    const shotsBeforeTap = await page.evaluate(() => S.gameState.runStats.shotsFired);
    await page.locator('#stick-aim').evaluate(zone => {
        const fire = type => zone.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', clientX: 650, clientY: 250, bubbles: true, cancelable: true, isPrimary: true }));
        fire('pointerdown');
        fire('pointerup');
    });
    // Wait in game time; on failure, report the state that decides whether a tap fires.
    const tapResult = await page.evaluate(async before => {
        const { touch } = await import('/src/input.js');
        const start = S.gameState.runTime;
        const deadline = Date.now() + 30000;
        while(S.gameState.runStats.shotsFired <= before && S.gameState.runTime - start < 3 && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 50));
        }
        return {
            fired: S.gameState.runStats.shotsFired > before,
            quickFireAt: touch.quickFireAt, aiming: touch.aiming, firing: touch.firing,
            cooldown: S.playerStats.shootCooldown, gameSeconds: +(S.gameState.runTime - start).toFixed(2),
            over: S.gameState.isGameOver, paused: S.gameState.isPaused, choosing: S.gameState.isChoosingBounty,
            enemies: S.enemies.length
        };
    }, shotsBeforeTap);
    assert.ok(tapResult.fired, `a tap on the aim side quick-fires: ${JSON.stringify(tapResult)}`);
    const facing = await page.evaluate(() => {
        const p = window.__player;
        const forward = p.getWorldDirection(p.position.clone());
        const to = window.__target.position.clone().sub(p.position).setY(0).normalize();
        return forward.setY(0).normalize().dot(to);
    });
    assert.ok(facing > 0.95, `quick fire faces the nearest enemy (dot ${facing.toFixed(3)})`);

    // Archero-style auto-fire: turn it on in settings, stand still, and it shoots by itself.
    await page.locator('#btn-pause').dispatchEvent('pointerdown');
    await page.locator('#pause-settings-btn').tap();
    await page.locator('#settings-autofire-btn').tap();
    assert.equal(await page.locator('#settings-autofire-btn').textContent(), 'Auto-fire when still: ON');
    await page.locator('#settings-resume-btn').tap();
    const shotsBeforeAuto = await page.evaluate(() => S.gameState.runStats.shotsFired);
    await page.waitForFunction(before => S.gameState.runStats.shotsFired > before + 2, shotsBeforeAuto);
    await page.locator('#btn-pause').dispatchEvent('pointerdown');
    await page.locator('#pause-settings-btn').tap();
    await page.locator('#settings-autofire-btn').tap();
    await page.locator('#settings-resume-btn').tap();

    await page.locator('#btn-swap').dispatchEvent('pointerdown');
    await page.waitForFunction(() => S.playerStats.weapon === 'secondary');
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
    await page.locator('.restart-tap').tap();
    await page.locator('#start-screen').waitFor({ state: 'visible' });

    assert.deepEqual(errors, []);

    // Upright phone: every screen fits the width (no sideways scroll), the panels open, and the game plays.
    await context.close();
    const upright = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await upright.addInitScript(answeredPrivacy);
    const tall = await upright.newPage();
    tall.setDefaultTimeout(15000);
    const tallErrors = [];
    tall.on('pageerror', error => tallErrors.push(error.message));
    await tall.route('https://fonts.googleapis.com/**', route => route.abort());
    await tall.route('https://fonts.gstatic.com/**', route => route.abort());
    await tall.goto(server.resolvedUrls.local[0], { waitUntil: 'commit', timeout: 30000 });
    await tall.locator('canvas').waitFor({ timeout: 30000 });
    await tall.evaluate(async () => { window.S = await import('/src/state.js'); });
    const fits = async what => {
        const overflow = await tall.evaluate(() => [...document.querySelectorAll('button, .panel-screen, .wanted-poster')]
            .filter(el => el.offsetParent && el.getBoundingClientRect().width > 0)
            .map(el => ({ id: el.id || el.className, right: Math.round(el.getBoundingClientRect().right) }))
            .filter(el => el.right > window.innerWidth + 1));
        assert.deepEqual(overflow, [], `${what}: nothing runs off the right edge`);
    };
    assert.equal(await tall.locator('#play-btn').isVisible(), true, 'upright home shows PLAY');
    await fits('home');
    for(const [button, screen] of [['#road-btn', '#road-screen'], ['#records-btn', '#records-screen'], ['#jobs-btn', '#jobs-screen'], ['#shop-btn', '#shop-screen']]) {
        await tall.locator(button).tap();
        await tall.locator(screen).waitFor({ state: 'visible' });
        await fits(screen);
        await tall.locator(`${screen} .panel-back`).first().tap();
        await tall.locator('#start-screen').waitFor({ state: 'visible' });
    }
    await tall.locator('#play-btn').tap({ force: true });
    await tall.waitForFunction(() => S.gameState.isGameStarted);
    await tall.evaluate(() => { S.playerStats.hp = 99; });
    const tallPlayer = () => tall.evaluate(() => {
        const p = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
        return { x: p.position.x, z: p.position.z };
    });
    const tallBefore = await tallPlayer();
    await tall.locator('#stick-move').evaluate(zone => {
        const fire = (type, x, y) => zone.dispatchEvent(new PointerEvent(type, { pointerId: 3, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
        fire('pointerdown', 90, 700);
        fire('pointermove', 90, 640);
        window.__release = () => fire('pointerup', 90, 640);
    });
    await tall.evaluate(async () => {
        const start = S.gameState.runTime;
        const deadline = Date.now() + 30000;
        while(S.gameState.runTime - start < 0.6 && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
        window.__release();
    });
    const tallAfter = await tallPlayer();
    assert.ok(tallBefore.z - tallAfter.z > 2, `upright, the left stick moves the player up the screen: ${JSON.stringify({ tallBefore, tallAfter })}`);
    for(const id of ['#btn-pause', '#btn-dash', '#btn-swap']) {
        const box = await tall.locator(id).boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, `${id} is on screen upright`);
    }
    await upright.close();
    assert.deepEqual(tallErrors, []);
    console.log('Mobile smoke passed: touch mode, tap start, move + aim/fire sticks, edge arrows, tap quick-fire auto-aim, auto-fire setting, swap, pause, tap restart, upright screens and play.');
} finally {
    await browser?.close();
    await server.close();
}
