import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// Weekly Most Wanted event: Frontier Town shows this week's outlaw and twist; RIDE OUT fights them with
// the twist, even if they are not unlocked on the Wanted Road; a good score pays the targets and the
// first collectible, and the Wanted Road does not move.
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
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit', timeout: 60000 });
    await page.locator('canvas').waitFor();
    await page.evaluate(async () => {
        window.S = await import('/src/state.js');
        const { eventForWeek } = await import('/src/events.js');
        const { weekKey } = await import('/src/profile.js');
        const { OUTLAWS } = await import('/src/outlaws.js');
        window.EVENT = eventForWeek(weekKey());
        window.EVENT_NAME = OUTLAWS[window.EVENT.outlaw].name;
    });
    const event = await page.evaluate(() => ({ ...window.EVENT, name: window.EVENT_NAME }));

    await page.locator('#town-btn').click();
    const card = page.locator('.event-card');
    await card.waitFor();
    const text = await card.textContent();
    assert.match(text, new RegExp(event.name));
    assert.match(text, new RegExp(event.twist.name));
    assert.match(text, /Free to enter/);

    await card.locator('[data-ride]').click();
    await page.waitForFunction(() => S.gameState.isGameStarted, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => S.gameState.outlawIndex), event.outlaw, 'the event outlaw, even if locked on the road');
    assert.equal(await page.evaluate(() => S.gameState.event.twist.id), event.twist.id);
    await page.locator('#wave-banner').getByText('MOST WANTED').waitFor();

    // A plausible top score, then the run ends.
    await page.evaluate(top => { S.gameState.score = top; S.gameState.runTime = 600; S.gameState.runStats.kills = { bandit: 3 }; }, event.targets.at(-1));
    await page.evaluate(async () => {
        const { spawnEnemy } = await import('/src/enemySystem.js');
        const p = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
        S.playerStats.hp = 1; S.playerStats.invulnerabilityTimer = 0; S.playerStats.isDashing = false;
        spawnEnemy(p.parent, p.position, 'bandit');
        S.enemies.at(-1).position.copy(p.position);
    });
    await page.locator('#gameover').waitFor({ state: 'visible' });
    await page.locator('#result-earnings .earn-lines').getByText('Most Wanted target 3').waitFor();
    assert.match(await page.locator('#result-earnings').textContent(), /Prize: Most Wanted hat/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestProfile.v1')));
    assert.equal(saved.event.tiers, 3);
    assert.ok(saved.owned.includes('hat-most-wanted'));
    const road = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestProgress.v1') || '{"stars":[]}'));
    assert.equal(road.stars?.[event.outlaw] ?? 0, 0, 'the Wanted Road did not move');

    // Home again: the next run is a normal one.
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('KeyR');
    await page.locator('#start-screen').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => S.gameState.event), null);
    await page.locator('#town-btn').click();
    assert.equal(await page.locator('.event-targets li.done').count(), 3);
    assert.deepEqual(errors, [], `browser errors: ${errors.join(', ')}`);
    console.log(`Event smoke passed: ${event.name} (${event.twist.name}) from Frontier Town, all three targets and the first prize, no Wanted Road change.`);
} finally {
    await browser?.close();
    await server.close();
}
