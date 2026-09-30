import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// Frontier Town's two independent integrations: LOOK (art direction, src/townLook.js) and WALK (the walkable
// town, src/townWalk.js). Each switch works without the other, and walking up to a door opens its card.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const base = server.resolvedUrls.local[0];
    const open = async (query = '', viewport = { width: 1280, height: 720 }, seed = null) => {
        const context = await browser.newContext({ viewport });
        await context.addInitScript(answeredPrivacy);
        if(seed) await context.addInitScript(seed);
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.**', route => route.abort());
        await page.goto(base + query, { waitUntil: 'commit' });
        await page.locator('#start-screen').waitFor({ state: 'visible', timeout: 90000 });
        await page.locator('#town-btn').click();
        await page.locator('#town-screen').waitFor({ state: 'visible' });
        await page.waitForFunction(() => window.__redWestTown);
        await page.waitForTimeout(800);
        return { page, errors, context };
    };
    const pressed = (page, id) => page.locator(id).getAttribute('aria-pressed');
    const walking = page => page.evaluate(() => window.__redWestTown.walk.active);

    // Both on by default.
    {
        const { page, errors, context } = await open();
        assert.equal(await pressed(page, '#town-walk-btn'), 'true');
        assert.equal(await pressed(page, '#town-look-btn'), 'true');
        assert.equal(await walking(page), true);

        // LOOK off leaves WALK on, and back.
        await page.locator('#town-look-btn').click();
        assert.equal(await pressed(page, '#town-look-btn'), 'false');
        assert.equal(await walking(page), true, 'turning LOOK off does not stop walking');
        await page.locator('#town-look-btn').click();
        assert.equal(await pressed(page, '#town-look-btn'), 'true');

        // WALK off leaves LOOK on; the overview returns, and the walk prompt and stick are gone.
        await page.locator('#town-walk-btn').click();
        assert.equal(await walking(page), false);
        assert.equal(await pressed(page, '#town-look-btn'), 'true', 'turning WALK off does not touch LOOK');
        assert.equal(await page.locator('.walk-prompt').isVisible(), false);
        await page.locator('#town-walk-btn').click();
        assert.equal(await walking(page), true);

        // A door: walk to the bank's door and the prompt names it; E opens its card.
        const door = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'bank'));
        await page.evaluate(d => window.__redWestTown.walk.place(d.x, d.z), door);
        await page.locator('.walk-prompt').waitFor({ state: 'visible' });
        assert.match(await page.locator('.walk-prompt').textContent(), /BANK/);
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /Bank/i);
        await page.locator('.walk-prompt').waitFor({ state: 'hidden' }); // no prompt while a card is open

        // Walls: put the marshal inside the saloon; he is moved out.
        await page.locator('#town-sheet-close').click();
        const spot = await page.evaluate(() => {
            const map = window.__redWestTown.town3d.walkMap();
            const box = map.boxes.find(b => b.maxX - b.minX > 5 && b.maxZ - b.minZ > 5);
            window.__redWestTown.walk.place((box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2);
            const p = window.__redWestTown.walk.position;
            return { p, inside: map.boxes.some(b => p.x > b.minX + 0.01 && p.x < b.maxX - 0.01 && p.z > b.minZ + 0.01 && p.z < b.maxZ - 0.01) };
        });
        assert.equal(spot.inside, false, 'the marshal is never left inside a building');
        assert.deepEqual(errors, []);
        await context.close();
    }

    // Places you walk up to (TOWN_PLAN.md, step A): the board and the jail's cash box open cards, the train starts the hunt.
    const goTo = (page, id) => page.evaluate(id => {
        const door = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === id);
        window.__redWestTown.walk.place(door.x, door.z);
    }, id);
    {
        const { page, errors, context } = await open();
        await goTo(page, 'board');
        await page.locator('.walk-prompt').filter({ hasText: 'BOUNTY BOARD' }).waitFor({ state: 'visible' });
        assert.match(await page.locator('.walk-prompt').textContent(), /READ/);
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#town-grid .job-card').count(), 3, 'the board lists the three daily jobs');
        assert.match(await page.locator('#town-grid').textContent(), /DAILY JOBS/);
        await page.locator('#town-sheet-close').click();

        // The cash box pays the jail and shows the result on the jail's card (an empty jail has nothing yet).
        await goTo(page, 'cashbox');
        await page.locator('.walk-prompt').filter({ hasText: 'CASH BOX' }).waitFor({ state: 'visible' });
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /JAIL/);
        await page.waitForFunction(() => /Nothing to collect/.test(document.getElementById('town-message').textContent));
        await page.locator('#town-sheet-close').click();
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // Three outlaws in the jail, five hours since the last collect: the cash box pays the money into the wallet.
        const seed = () => localStorage.setItem('redWestProfile.v1', JSON.stringify({
            stats: { stageStars: [7, 7, 7, 0, 0, 0, 0, 0, 0, 0] },
            town: { jailCollectedAt: new Date(Date.now() - 5 * 3600000).toISOString() }
        }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        const dollars = async () => Number((await page.locator('#town-dollars').textContent()).replace(/\D/g, ''));
        const before = await dollars();
        await goTo(page, 'cashbox');
        await page.locator('.walk-prompt').filter({ hasText: /COLLECT \$[1-9]/ }).waitFor({ state: 'visible' });
        await page.keyboard.press('e');
        await page.waitForFunction(() => /Collected \$[1-9]/.test(document.getElementById('town-message').textContent));
        assert.ok(await dollars() > before, 'the money landed in the wallet');
        await page.locator('#town-sheet-close').click();
        await page.locator('.walk-prompt').filter({ hasText: 'JAIL CASH BOX' }).waitFor({ state: 'visible' }); // emptied
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // The train: the prompt names the next outlaw, and using it starts that hunt (the town closes, the fight begins).
        const { page, errors, context } = await open();
        await goTo(page, 'train');
        await page.locator('.walk-prompt').filter({ hasText: 'RIDE OUT: DUSTY PETE' }).waitFor({ state: 'visible' });
        await page.keyboard.press('e');
        await page.locator('#town-screen').waitFor({ state: 'hidden' });
        await page.locator('#start-screen').waitFor({ state: 'hidden', timeout: 60000 });
        assert.deepEqual(errors, []);
        await context.close();
    }

    // Each off on its own from the URL.
    {
        const { page, errors, context } = await open('?walk=off');
        assert.equal(await walking(page), false);
        assert.equal(await pressed(page, '#town-look-btn'), 'true');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        const { page, errors, context } = await open('?look=off');
        assert.equal(await walking(page), true);
        assert.equal(await pressed(page, '#town-look-btn'), 'false');
        assert.deepEqual(errors, []);
        await context.close();
    }
    // Both off is the original town.
    {
        const { page, errors, context } = await open('?look=off&walk=off');
        assert.equal(await walking(page), false);
        assert.equal(await pressed(page, '#town-look-btn'), 'false');
        // Tapping a building still opens its card.
        await page.locator('.town-label', { hasText: 'BANK' }).click();
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.deepEqual(errors, []);
        await context.close();
    }
    console.log('town smoke: ok');
} finally {
    await browser?.close();
    await server.close();
}
