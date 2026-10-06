import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// The Hollow Claim (MINE_PLAN.md): the undertaker's door, his parlour and the cellar stairs, then a mine with no bottom. Each depth is its
// own cave, much larger than the last, with a new monster in it. The shaft down is always open (walk into it whatever is chasing you),
// chests open when you walk up to them, and the lift brings you back up once you have walked away from it.
// SHOTS=dir saves a picture of each depth, of the shaft, a chest, the parlour and the door (for looking at the art).
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

    // The undertaker's door opens Mr. Grimsby's parlour; the cellar stairs at the back go down to the mine.
    await page.evaluate(() => {
        const door = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'undertaker');
        window.__redWestTown.walk.place(door.x, door.z);
    });
    await page.locator('.walk-prompt').filter({ hasText: 'MR. GRIMSBY, UNDERTAKER' }).waitFor({ state: 'visible' });
    assert.match(await page.locator('.walk-prompt').textContent(), /ENTER/);
    await page.waitForTimeout(1500);
    await shot('town-door');
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__redWestTown.place === 'undertaker');
    assert.match(await page.locator('#town-title').textContent(), /GRIMSBY/);
    await page.waitForTimeout(1500);
    await shot('parlour');

    // Mr. Grimsby talks, in a card.
    const goTo = id => page.evaluate(id => {
        const door = window.__redWestTown.parlour3d.walkMap().doors.find(d => d.id === id);
        window.__redWestTown.parlourWalk.place(door.x, door.z);
    }, id);
    await goTo('grimsby');
    await page.locator('.walk-prompt').filter({ hasText: 'MR. GRIMSBY, UNDERTAKER' }).waitFor({ state: 'visible' });
    assert.match(await page.locator('.walk-prompt').textContent(), /TALK/);
    await page.keyboard.press('e');
    await page.locator('#town-sheet').waitFor({ state: 'visible' });
    assert.match(await page.locator('#town-grid').textContent(), /Marshal|Company|ledger|claim|week/i);
    await page.waitForTimeout(500);
    await shot('parlour-talk');
    await page.locator('#town-sheet-close').click();

    // Out through the door and back in again: the town waits where the marshal stood.
    await goTo('leave');
    await page.locator('.walk-prompt').filter({ hasText: 'BACK TO THE STREET' }).waitFor({ state: 'visible' });
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__redWestTown.place === null);
    await page.locator('.walk-prompt').filter({ hasText: 'MR. GRIMSBY, UNDERTAKER' }).waitFor({ state: 'visible' });
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__redWestTown.place === 'undertaker');

    // The stairs at the back: the prompt names the mine, and using it closes the town and starts the descent.
    await goTo('cellar');
    await page.locator('.walk-prompt').filter({ hasText: 'HOLLOW CLAIM' }).waitFor({ state: 'visible' });
    assert.match(await page.locator('.walk-prompt').textContent(), /DESCEND/);
    await page.waitForTimeout(1200);
    await shot('parlour-stairs');
    await page.evaluate(async () => {
        window.S = await import('/src/state.js');
        window.M = await import('/src/mine.js');
        window.MM = await import('/src/mineMap.js');
        window.MMON = await import('/src/mineMonsters.js');
    });
    await page.keyboard.press('e');
    await page.locator('#town-screen').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => S.gameState.isGameStarted, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => M.mine.enabled), true, 'a mine run');
    assert.match(await page.locator('#wave-label').textContent(), /DEPTH/);
    assert.equal((await page.locator('#wave').textContent()).trim(), '1');
    // The way down and the way up are on the HUD from the first moment: nothing to clear, nothing locked.
    await page.waitForFunction(() => /SHAFT \d+ m/.test(document.getElementById('wave-timer').textContent));
    assert.match(await page.locator('#status-msg').textContent(), /LIFT UP \d+ m/);

    const here = () => page.evaluate(() => {
        const p = window.__redWest.playerGroup.position;
        const cave = MM.activeFloor();
        const b = MM.bounds(cave, 0);
        return { depth: M.mine.floor, cave: cave.id, at: [p.x, p.z], open: MM.isOpen(cave, p.x, p.z, 8), obstacles: S.obstacles.length, mapSize: S.gameState.MAP_SIZE,
            area: (b.maxX - b.minX) * (b.maxZ - b.minZ), reach: Math.max(-b.minX, b.maxX, -b.minZ, b.maxZ), shaft: Math.hypot(...cave.shaft), score: S.gameState.score };
    });
    // (The marshal is kept alive: monsters now wait in every chamber, and this test is about the cave, not the fight.)
    const put = (x, z) => page.evaluate(([x, z]) => { S.playerStats.hp = S.playerStats.maxHp; S.playerStats.invulnerabilityTimer = 60; window.__redWest.playerGroup.position.set(x, 0, z); }, [x, z]);
    const toShaft = () => page.evaluate(() => { const c = MM.activeFloor(); S.playerStats.hp = S.playerStats.maxHp; S.playerStats.invulnerabilityTimer = 60; window.__redWest.playerGroup.position.set(c.shaft[0], 0, c.shaft[1]); });

    let lastArea = 0;
    for(let depth = 1; depth <= 4; depth++) {
        await page.waitForFunction(d => M.mine.floor === d, depth, { timeout: 60000 });
        const state = await here();
        assert.equal(state.depth, depth);
        assert.ok(Math.hypot(...state.at) < 0.5, `depth ${depth}: the marshal starts on the lift`);
        assert.equal(state.open, true, `depth ${depth}: the lift stands in open ground`);
        assert.ok(state.obstacles > 300, `depth ${depth}: the walls are solid (${state.obstacles} obstacles)`);
        assert.equal(state.mapSize, Math.ceil(state.reach) + 40, `depth ${depth}: the marshal may walk the whole cave`);
        assert.ok(state.shaft >= 180, `depth ${depth}: the shaft is a real walk away (${Math.round(state.shaft)} units)`);
        assert.ok(state.area > lastArea * 1.3, `depth ${depth}: the map is a lot larger than the one above`);
        lastArea = state.area;
        if(depth > 1) assert.match(await page.locator('#wave-banner').textContent(), new RegExp(`DEPTH ${depth}`));
        if(depth === 2) assert.match(await page.locator('#wave-banner').textContent(), /NEW: CAVE BAT/, 'the new monster is announced');
        await page.waitForTimeout(2200);
        await shot(`depth-${depth}`);

        // Monsters come out of the dark, in open ground (planNode keeps them 20 units off the lift; by now they have started to close in).
        await page.waitForFunction(() => S.enemies.length > 0, null, { timeout: 60000 });
        const spawned = await page.evaluate(() => {
            const p = window.__redWest.playerGroup.position;
            return S.enemies.map(e => ({ open: MM.isOpen(MM.activeFloor(), e.position.x, e.position.z), d: Math.hypot(e.position.x - p.x, e.position.z - p.z), type: e.userData.type }));
        });
        assert.ok(spawned.every(e => e.open), `depth ${depth}: everyone stands in open ground`);
        assert.ok(await page.evaluate(() => S.enemies.every(e => e.userData.mineNode !== undefined)), `depth ${depth}: every monster belongs to a chamber`);

        if(depth === 1) {
            // Monsters sense the marshal by distance: those out of their radius stand at their post, asleep; one he walks up to wakes and hunts.
            const sensed = await page.evaluate(() => {
                const p = window.__redWest.playerGroup.position;
                return S.enemies.filter(e => e.userData.sense).map(e => { const u = e.userData; return { state: u.sense.state, d: Math.hypot(e.position.x - p.x, e.position.z - p.z), r: u.sense.radius, moved: Math.hypot(e.position.x - u.sense.home.x, e.position.z - u.sense.home.z) }; });
            });
            assert.ok(sensed.length > 0, 'the chamber monsters have a sense radius');
            for(const m of sensed.filter(m => m.d > m.r + 10)) assert.ok(m.state === 'asleep' && m.moved < 1, `a monster ${Math.round(m.d)} away (radius ${m.r}) sleeps at its post: ${JSON.stringify(m)}`);
            const sleeper = await page.evaluate(() => { const e = S.enemies.find(e => e.userData.sense?.state === 'asleep'); return e ? { x: e.userData.sense.home.x, z: e.userData.sense.home.z } : null; });
            if(sleeper) {
                await put(sleeper.x, sleeper.z);
                await page.waitForFunction(() => S.enemies.some(e => e.userData.sense?.state === 'hunting'), null, { timeout: 8000 });
                await put(0, 0);
            }
            // The four monsters that live only down here spawn, wear their own look, and run their behaviours without a fault.
            const monsters = await page.evaluate(async () => {
                const { spawnEnemy } = await import('/src/enemySystem.js');
                const out = {};
                for(const type of ['bat', 'crawler', 'stonekin', 'wraith']) {
                    spawnEnemy(window.__redWest.scene, window.__redWest.playerGroup.position, type);
                    const e = S.enemies.at(-1);
                    out[type] = { type: e.userData.type, behavior: e.userData.behavior, hp: e.userData.hp, heavy: e.userData.heavy, fade: !!e.userData.fadeMaterials?.length, open: MM.isOpen(MM.activeFloor(), e.position.x, e.position.z) };
                }
                return out;
            });
            assert.deepEqual(Object.keys(monsters), ['bat', 'crawler', 'stonekin', 'wraith']);
            assert.equal(monsters.bat.behavior, 'zigzag');
            assert.equal(monsters.crawler.behavior, 'chase');
            assert.equal(monsters.stonekin.behavior, 'charger');
            assert.ok(monsters.stonekin.heavy && monsters.stonekin.hp >= 9);
            assert.equal(monsters.wraith.behavior, 'phantom');
            assert.ok(monsters.wraith.fade, 'a wraith can fade');
            assert.ok(Object.values(monsters).every(m => m.open), 'all four came out in open ground');
            await page.evaluate(() => { // line them up in front of the marshal for a look (SHOTS), then send them back out
                const p = window.__redWest.playerGroup.position;
                const four = S.enemies.slice(-4);
                four.forEach((e, i) => { e.position.set(p.x + (i - 1.5) * 7, 0, p.z - 9); e.userData.cooldown = 99; e.userData.shootTimer = 99; });
                S.playerStats.invulnerabilityTimer = 3;
            });
            await page.waitForTimeout(700);
            await shot('monsters');
            await page.evaluate(() => { for(const e of S.enemies.splice(-4)) e.parent.remove(e); });
            await page.waitForTimeout(800); // a second of the others thinking, steering and animating
            // The lift only works once the marshal has walked away from it (he arrives standing on it).
            assert.equal(await page.evaluate(() => M.mine.liftArmed), false);
            // A chest opens when the marshal walks up to it: score and a heart or a spell of triple shot.
            const before = (await here()).score;
            await page.evaluate(() => {
                const c = MM.activeFloor();
                const [cx, cz] = c.chests[0];
                const n = c.nodes[MM.nearestNode(c, cx, cz)];
                const k = 2.4 / Math.hypot(n.x - cx, n.z - cz);
                window.__redWest.playerGroup.position.set(cx + (n.x - cx) * k, 0, cz + (n.z - cz) * k);
                S.playerStats.hp = S.playerStats.maxHp;
            });
            await page.waitForFunction(() => M.mine.opened.length === 1);
            assert.ok((await here()).score >= before + 100, 'the chest paid');
            assert.ok(await page.evaluate(() => S.playerStats.tripleShotTimer > 0), 'a healthy marshal gets triple shot');
            await page.waitForTimeout(500);
            await shot('chest');
            assert.equal(await page.evaluate(() => M.mine.liftArmed), true, 'and having walked off, the lift is ready');
            await put(10, 0);
            await page.waitForTimeout(300);
            assert.equal(await page.evaluate(() => S.gameState.isGameOver), false, 'the lift is not the way out while you are still near it');

            // Monsters are not endless: the chamber's own are the chamber's. Kill them all and nothing comes while the marshal stays ...
            await put(10, 0);
            await page.waitForTimeout(2500);
            // The chambers that have woken for him: within WAKE_DISTANCE of their edge (src/modes/mine.js). A chamber farther off may wake while
            // we wait, and that is fine; only these must stay quiet. Monsters still queued to come out (a couple a frame, slower on a slow
            // machine) are the chamber's own, so clear until a round brings none, and only then start counting.
            const woken = await page.evaluate(() => {
                const c = MM.activeFloor(), at = window.__redWest.playerGroup.position;
                return c.nodes.map((n, i) => Math.hypot(at.x - n.x, at.z - n.z) - n.r < MMON.WAKE_DISTANCE ? i : -1).filter(i => i >= 0);
            });
            const clearWoken = () => page.evaluate(ids => {
                let n = 0;
                for(let i = S.enemies.length - 1; i >= 0; i--) {
                    if(ids.includes(S.enemies[i].userData.mineNode)) { S.enemies[i].parent.remove(S.enemies[i]); S.enemies.splice(i, 1); n++; }
                }
                return n;
            }, woken);
            await clearWoken();
            for(let round = 0; round < 12; round++) {
                await page.waitForTimeout(1000);
                if(await clearWoken() === 0) break;
            }
            await page.waitForTimeout(3500);
            assert.equal(await clearWoken(), 0, 'nothing new comes out while he stays: the chamber is quiet');
            // ... but once he has gone far away, it fills again for next time.
            await page.evaluate(() => { const c = MM.activeFloor(); const n = c.nodes[c.main - 1]; window.__redWest.playerGroup.position.set(n.x - 20, 0, n.z); });
            await page.waitForTimeout(2500);
            assert.equal(await page.evaluate(() => S.enemies.some(e => e.userData.mineNode === 0)), false, 'the landing chamber is empty while he is far away');
            const around = await page.evaluate(() => ({ n: S.enemies.length, over: S.gameState.isGameOver, asking: S.gameState.isConfirming, hp: S.playerStats.hp, paused: S.gameState.isPaused }));
            assert.ok(around.n > 0, `and the chambers around him have filled (${JSON.stringify(around)})`);
            await put(22, 0);
            await page.waitForFunction(() => S.enemies.some(e => e.userData.mineNode === 0), null, { timeout: 15000 });
            await put(10, 0);
            await page.waitForTimeout(1500);
        }

        // The way down is always open: walk into the shaft, whatever is chasing.
        await put(...(await page.evaluate(() => { const c = MM.activeFloor(); const [bx, bz] = c.rails.at(-2); const k = 14 / Math.hypot(bx - c.shaft[0], bz - c.shaft[1]); return [c.shaft[0] + (bx - c.shaft[0]) * k, c.shaft[1] + (bz - c.shaft[1]) * k]; })));
        await page.waitForTimeout(1500);
        await shot(`shaft-${depth}`);
        assert.match(await page.locator('#wave-timer').textContent(), /SHAFT 1\d m/);
        const before = (await here()).score;
        await toShaft();
        // It asks first, and the game waits for the answer.
        await page.waitForFunction(() => S.gameState.isConfirming);
        assert.match(await page.locator('#mine-confirm-title').textContent(), /GO DOWN/);
        assert.match(await page.locator('#mine-confirm-text').textContent(), new RegExp(`depth ${depth + 1}`));
        assert.equal(await page.evaluate(() => M.mine.floor), depth, 'still on this floor while it asks');
        await shot(`confirm-down-${depth}`);
        if(depth === 1) {
            // No: it stays, and does not ask again while he is standing at the shaft.
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !S.gameState.isConfirming);
            assert.equal(await page.evaluate(() => M.mine.floor), depth, 'a no stays');
            assert.equal(await page.locator('#mine-confirm').isVisible(), false);
            await page.waitForTimeout(600);
            assert.equal(await page.evaluate(() => S.gameState.isConfirming), false, 'it does not ask again while he stands there');
            await page.evaluate(() => { const c = MM.activeFloor(); window.__redWest.playerGroup.position.set(c.shaft[0] - 8, 0, c.shaft[1]); });
            await page.waitForFunction(() => M.mine.blocked === null);
            await toShaft(); // stepped away and back: it asks again
            await page.waitForFunction(() => S.gameState.isConfirming);
            await page.keyboard.press('Enter');
        } else {
            await page.locator('#mine-confirm-yes').click();
        }
        await page.waitForFunction(d => M.mine.floor === d + 1, depth, { timeout: 30000 });
        assert.equal(await page.locator('#mine-confirm').isVisible(), false);
        assert.ok((await here()).score >= before + 50 * depth, `depth ${depth}: going down pays`);
    }

    // The lift: walk away from it and back, and the marshal rides up. (He is on depth 5 now.)
    assert.equal(await page.evaluate(() => M.mine.floor), 5);
    await put(22, 0);
    await page.waitForFunction(() => M.mine.liftArmed);
    await put(0, 0);
    await page.waitForFunction(() => S.gameState.isConfirming);
    assert.match(await page.locator('#mine-confirm-title').textContent(), /RIDE THE LIFT UP/);
    assert.equal(await page.evaluate(() => S.gameState.isGameOver), false, 'it asks before the run ends');
    await page.locator('#mine-confirm-no').click(); // a tap on STAY
    await page.waitForFunction(() => !S.gameState.isConfirming);
    assert.equal(await page.evaluate(() => S.gameState.isGameOver), false);
    await put(14, 0);
    await page.waitForFunction(() => M.mine.blocked === null); // (a slow frame at this depth: wait for it to notice he has stepped away)
    await put(0, 0); // stepped away and back: it asks again, and this time the answer is yes
    await page.waitForFunction(() => S.gameState.isConfirming, null, { timeout: 8000 }).catch(async error => {
        throw new Error(`the lift did not ask again: ${JSON.stringify(await page.evaluate(() => ({ blocked: M.mine.blocked, armed: M.mine.liftArmed, confirm: M.mine.confirm, over: S.gameState.isGameOver, at: [window.__redWest.playerGroup.position.x, window.__redWest.playerGroup.position.z], floor: M.mine.floor })))}`);
    });
    // (The test teleports, and the server cuts a depth no walk could reach in the time: say the descent took five minutes.)
    await page.evaluate(() => { S.gameState.runTime = 300; });
    await page.locator('#mine-confirm-yes').click();
    await page.waitForFunction(() => S.gameState.isGameOver, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => S.gameState.runWon), true);
    assert.match(await page.locator('#result-title').textContent(), /LIFT UP/);
    assert.match(await page.locator('#result-detail').textContent(), /depth 5/);
    // The run is saved: no stars and no money, but the deepest floor, the checkpoint and the ore he rode up with.
    await page.waitForFunction(() => /New deepest floor: 5\./.test(document.getElementById('result-earnings').textContent), null, { timeout: 15000 }).catch(async error => { throw new Error(`${error.message}: ${await page.locator('#result-earnings').textContent()}`); });
    const earnings = await page.locator('#result-earnings').textContent();
    assert.match(earnings, /no stars and no money/);
    assert.match(earnings, /Checkpoint: floor 5\./);
    assert.match(earnings, /\d+ ore banked\./, 'the ore from the chest he opened came up with him');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestProfile.v1')));
    assert.equal(saved.mine.deepest, 5);
    assert.equal(saved.mine.checkpoint, 5);
    assert.ok(saved.mine.ore > 0 && saved.mine.runs === 1);
    assert.deepEqual([saved.balances.dollars, saved.stats.stageStars.reduce((a, b) => a + b, 0)], [0, 0], 'the mine paid no dollars and gave no stars');

    // Back to town: the Wanted Road rules are back (no mine, no cave, the ordinary arena limit).
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('r');
    await page.waitForFunction(() => !M.mine.enabled);
    assert.equal(await page.evaluate(() => MM.activeFloor()), null, 'the cave is gone');
    assert.equal(await page.evaluate(() => S.gameState.MAP_SIZE), 140, 'the arena limit is back');

    // The stairs now offer the floors he may begin on: the top, and the checkpoint he reached.
    await page.locator('#town-btn').click();
    await page.locator('#town-screen').waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.__redWestTown && window.__redWestTown.hasProfile);
    await page.evaluate(() => { const door = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'undertaker'); window.__redWestTown.walk.place(door.x, door.z); });
    await page.locator('.walk-prompt').filter({ hasText: 'MR. GRIMSBY, UNDERTAKER' }).waitFor({ state: 'visible' });
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__redWestTown.place === 'undertaker');
    await page.evaluate(() => { const door = window.__redWestTown.parlour3d.walkMap().doors.find(d => d.id === 'cellar'); window.__redWestTown.parlourWalk.place(door.x, door.z); });
    await page.locator('.walk-prompt').filter({ hasText: 'HOLLOW CLAIM' }).waitFor({ state: 'visible' });
    await page.keyboard.press('e');
    await page.locator('#town-sheet').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('#town-grid [data-descend]').evaluateAll(buttons => buttons.map(b => b.dataset.descend)), ['1', '5']);
    assert.match(await page.locator('#town-grid').textContent(), /deepest floor is 5/);
    await shot('stairs-card');
    await page.locator('#town-grid [data-descend="5"]').click();
    await page.waitForFunction(() => S.gameState.isGameStarted && M.mine.enabled, null, { timeout: 60000 });
    assert.deepEqual(await page.evaluate(() => [M.mine.floor, M.mine.startFloor, M.mine.ore]), [5, 5, 0], 'a run from the checkpoint begins on floor 5');
    assert.match(await page.locator('#wave-label').textContent(), /DEPTH/);
    assert.equal((await page.locator('#wave').textContent()).trim(), '5');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('mine smoke: ok');
} finally {
    await browser?.close();
    await server.close();
}
