import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// The Hollow Claim (MINE_PLAN.md, slice 1): walk to the undertaker's cellar hatch, go down, clear floors 1 to 5 (each floor brings
// its enemy and opens the shaft down when it is cleared), and come back up on the lift with nothing saved.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(answeredPrivacy);
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.**', route => route.abort());
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit' });
    await page.locator('#start-screen').waitFor({ state: 'visible', timeout: 90000 });
    await page.locator('#town-btn').click();
    await page.locator('#town-screen').waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.__redWestTown && window.__redWestTown.hasProfile);
    await page.waitForTimeout(800);

    // The hatch: the prompt names the mine and the verb, and using it closes the town and starts the descent.
    await page.evaluate(() => {
        const door = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'hatch');
        window.__redWestTown.walk.place(door.x, door.z);
    });
    await page.locator('.walk-prompt').filter({ hasText: 'THE HOLLOW CLAIM' }).waitFor({ state: 'visible' });
    assert.match(await page.locator('.walk-prompt').textContent(), /DESCEND/);
    await page.evaluate(async () => {
        window.S = await import('/src/state.js');
        window.M = await import('/src/mine.js');
    });
    await page.keyboard.press('e');
    await page.locator('#town-screen').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => S.gameState.isGameStarted, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => M.mine.enabled), true, 'a mine run');
    assert.equal(await page.evaluate(() => M.mine.floor), 1);
    assert.match(await page.locator('#wave-label').textContent(), /FLOOR/);
    assert.match(await page.locator('#wave').textContent(), /1 \/ 5/);
    assert.ok(await page.evaluate(() => S.enemies.length) > 0, 'floor 1 opens with enemies');

    // Clear each floor the way a player would (every enemy down, the budget spent): the shaft opens, the next floor begins.
    for(let floor = 1; floor <= 5; floor++) {
        await page.waitForFunction(f => M.mine.floor === f && !S.gameState.isIntermission && S.enemies.length > 0, floor, { timeout: 60000 });
        const stage = await page.evaluate(() => S.gameState.outlawIndex);
        assert.equal(stage, floor - 1, `floor ${floor} uses stage ${floor - 1}`);
        await page.evaluate(() => {
            for(const e of [...S.enemies]) e.parent.remove(e);
            S.enemies.length = 0;
            S.gameState.waveBudgetRemaining = 0;
            S.playerStats.hp = S.playerStats.maxHp;
        });
        if(floor < 5) {
            await page.waitForFunction(() => S.gameState.isIntermission, null, { timeout: 30000 });
            assert.match(await page.locator('#wave-timer').textContent(), /BREAK/);
            await page.evaluate(() => { S.gameState.intermissionTimer = 0.05; }); // do not wait out the break
        }
    }
    await page.waitForFunction(() => S.gameState.isGameOver, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => S.gameState.runWon), true);
    assert.match(await page.locator('#result-title').textContent(), /LIFT UP/);
    assert.match(await page.locator('#result-earnings').textContent(), /practice only/);

    // Back to town: the Wanted Road rules are back (no mine, no floor label).
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('r');
    await page.waitForFunction(() => !M.mine.enabled);
    assert.equal(await page.evaluate(() => M.mine.floor), 1);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('mine smoke: ok');
} finally {
    await browser?.close();
    await server.close();
}
