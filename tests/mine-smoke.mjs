import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// The Hollow Claim (MINE_PLAN.md): walk to the undertaker's cellar hatch and go down. Each floor is its own cave. Clear a floor (every
// enemy down, the budget spent) and the shaft opens; walk to it to go down. Clearing floor 5 and walking to its shaft is the lift up.
// SHOTS=dir saves a picture of each floor, of the open shaft and of the town hatch (for looking at the art).
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
    const shot = async name => { if(process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };

    // The hatch: the prompt names the mine and the verb, and using it closes the town and starts the descent.
    await page.evaluate(() => {
        const door = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'hatch');
        window.__redWestTown.walk.place(door.x, door.z);
    });
    await page.locator('.walk-prompt').filter({ hasText: 'THE HOLLOW CLAIM' }).waitFor({ state: 'visible' });
    assert.match(await page.locator('.walk-prompt').textContent(), /DESCEND/);
    await page.waitForTimeout(1500);
    await shot('town-hatch');
    await page.evaluate(async () => {
        window.S = await import('/src/state.js');
        window.M = await import('/src/mine.js');
        window.MM = await import('/src/mineMap.js');
    });
    await page.keyboard.press('e');
    await page.locator('#town-screen').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => S.gameState.isGameStarted, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => M.mine.enabled), true, 'a mine run');
    assert.match(await page.locator('#wave-label').textContent(), /FLOOR/);
    assert.match(await page.locator('#wave').textContent(), /1 \/ 5/);

    for(let floor = 1; floor <= 5; floor++) {
        await page.waitForFunction(f => M.mine.floor === f && !S.gameState.isIntermission && S.enemies.length > 0, floor, { timeout: 60000 });
        const state = await page.evaluate(() => {
            const p = window.__redWest.playerGroup.position;
            const cave = MM.activeFloor();
            return { stage: S.gameState.outlawIndex, cave: cave?.id, start: [p.x, p.z], open: MM.isOpen(cave, p.x, p.z, 8), obstacles: S.obstacles.length };
        });
        assert.equal(state.stage, floor - 1, `floor ${floor} uses stage ${floor - 1}`);
        assert.ok(state.cave, `floor ${floor} has a cave`);
        assert.ok(Math.hypot(...state.start) < 0.5, `floor ${floor}: the marshal starts on the lift`);
        assert.equal(state.open, true, `floor ${floor}: the lift stands in open ground`);
        assert.ok(state.obstacles > 100, `floor ${floor}: the walls are solid (${state.obstacles} obstacles)`);
        await page.waitForTimeout(2500);
        await shot(`floor-${floor}`);

        // Enemies come out of the tunnel mouths, and never in the rock.
        const spawned = await page.evaluate(() => S.enemies.map(e => MM.isOpen(MM.activeFloor(), e.position.x, e.position.z)));
        assert.ok(spawned.length > 0 && spawned.every(Boolean), `floor ${floor}: everyone stands in open ground`);

        // The marshal cannot walk into the rock: push him at the wall and he stops.
        const stayed = await page.evaluate(async () => {
            const player = window.__redWest.playerGroup;
            const cave = MM.activeFloor();
            const { checkCollision } = await import('/src/physics.js');
            let blockedEverywhereInRock = true;
            for(let a = 0; a < 6.28; a += 0.4) for(let r = 5; r < 160; r += 5) {
                const x = Math.cos(a) * r, z = Math.sin(a) * r;
                if(!MM.isOpen(cave, x, z) && !checkCollision(x, z, 1.5)) blockedEverywhereInRock = false;
            }
            return blockedEverywhereInRock;
        });
        assert.equal(stayed, true, `floor ${floor}: the rock is solid everywhere`);

        // Clear the floor the way a player would: every enemy down, the budget spent.
        await page.evaluate(() => {
            for(const e of [...S.enemies]) e.parent.remove(e);
            S.enemies.length = 0;
            S.gameState.waveBudgetRemaining = 0;
            S.playerStats.hp = S.playerStats.maxHp;
        });
        await page.waitForFunction(() => S.gameState.isIntermission, null, { timeout: 30000 });
        assert.match(await page.locator('#wave-timer').textContent(), /SHAFT \d+ m/);
        assert.match(await page.locator('#status-msg').textContent(), /WALK TO IT/);
        assert.equal(await page.evaluate(() => M.mine.floor), floor, 'the next floor waits until the marshal walks to the shaft');
        await page.waitForTimeout(600);
        // Stand the marshal on the rails 14 units back from the shaft, where he can really walk.
        await page.evaluate(() => {
            const c = MM.activeFloor();
            const [bx, bz] = c.rails.at(-2);
            const k = 14 / Math.hypot(bx - c.shaft[0], bz - c.shaft[1]);
            window.__redWest.playerGroup.position.set(c.shaft[0] + (bx - c.shaft[0]) * k, 0, c.shaft[1] + (bz - c.shaft[1]) * k);
        });
        await page.waitForTimeout(1500);
        await shot(`shaft-${floor}`);
        // Walk the last stretch: put the marshal at the shaft's edge and the next floor begins.
        await page.evaluate(() => { const c = MM.activeFloor(); window.__redWest.playerGroup.position.set(c.shaft[0], 0, c.shaft[1]); });
        if(floor < 5) await page.waitForFunction(f => M.mine.floor === f + 1, floor, { timeout: 30000 });
    }
    await page.waitForFunction(() => S.gameState.isGameOver, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => S.gameState.runWon), true);
    assert.match(await page.locator('#result-title').textContent(), /LIFT UP/);
    assert.match(await page.locator('#result-earnings').textContent(), /practice only/);

    // Back to town: the Wanted Road rules are back (no mine, no cave).
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('r');
    await page.waitForFunction(() => !M.mine.enabled);
    assert.equal(await page.evaluate(() => MM.activeFloor()), null, 'the cave is gone');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('mine smoke: ok');
} finally {
    await browser?.close();
    await server.close();
}
