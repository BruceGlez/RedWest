import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// Playable outlaws: an outlaw with all three stars can be picked in the shop, others show how to earn
// them; the pick brings its perk into the run (Iron Jack's extra hearts, Silas Vane's reload pause).
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({
        executablePath: findChrome(),
        headless: true,
        args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server', '--proxy-bypass-list=*']
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(answeredPrivacy);
    // Iron Jack (stage 5) and Silas Vane (stage 7) three-starred; Rosa (stage 2) only beaten.
    await context.addInitScript(() => localStorage.setItem('redWestProgress.v1', JSON.stringify({ selected: 0, stars: [1, 1, 1, 1, 7, 1, 7, 0], best: [0, 0, 0, 0, 0, 0, 0, 0] })));
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit', timeout: 60000 });
    await page.locator('canvas').waitFor();
    await page.evaluate(async () => { window.__rw = await import('/src/state.js'); });

    await page.locator('#shop-btn').click();
    await page.locator('#shop-tabs [data-tab="character"]').click();
    const card = name => page.locator('.shop-card', { hasText: name });
    assert.match(await card('RATTLESNAKE ROSA').locator('button').textContent(), /EARN ★★★ ON STAGE 2/);
    assert.ok(await card('RATTLESNAKE ROSA').locator('button').isDisabled(), 'locked outlaws cannot be picked or bought');
    assert.match(await card('RATTLESNAKE ROSA').textContent(), /Fast As A Snake/, 'the perk is shown before it is earned');

    // Silas Vane: fires faster, then pauses to reload after every six shots.
    await card('SILAS VANE').locator('button').click();
    await page.waitForFunction(() => window.__rw.playerStats.perk?.magazine?.shots === 6);
    await page.locator('#shop-screen .panel-back').click();
    const startRun = async () => {
        await page.keyboard.down('Space');
        await page.waitForFunction(() => window.__rw.gameState.isGameStarted);
        await page.keyboard.up('Space');
    };
    await startRun();
    await page.mouse.move(640, 200);
    await page.mouse.down();
    await page.waitForFunction(() => window.__rw.playerStats.shotsFired >= 6 && window.__rw.playerStats.shootCooldown > 0.9, null, { timeout: 15000 });
    await page.mouse.up();

    // Iron Jack, picked on a later visit: two extra hearts, slower feet.
    await page.reload({ waitUntil: 'commit' });
    await page.locator('canvas').waitFor();
    await page.evaluate(async () => { window.__rw = await import('/src/state.js'); });
    await page.locator('#shop-btn').click();
    await page.locator('#shop-tabs [data-tab="character"]').click();
    assert.equal(await card('SILAS VANE').locator('button').textContent(), 'EQUIPPED', 'the pick is saved');
    await card('IRON JACK HARLAN').locator('button').click();
    await page.waitForFunction(() => window.__rw.playerStats.maxHp === 7);
    await page.locator('#shop-screen .panel-back').click();
    await startRun();
    assert.equal(await page.evaluate(() => window.__rw.playerStats.hp), 7, 'Iron Jack starts with two extra hearts');
    assert.equal(await page.locator('#health-container').evaluate(el => el.textContent.length), 7);
    assert.equal(await page.evaluate(() => window.__rw.playerStats.speed), 15 * 0.8, 'and moves slower');
    assert.deepEqual(errors, [], `browser errors: ${errors.join(', ')}`);
    console.log('Characters smoke passed: locked and unlocked outlaw cards, Silas Vane reloads after six shots, Iron Jack has 7 hearts and moves slower, the pick is saved.');
} finally {
    await browser?.close();
    await server.close();
}
