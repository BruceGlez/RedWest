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
        // The profile (stars, jail, jobs) arrives a moment after the town opens; everything below depends on it.
        await page.waitForFunction(() => window.__redWestTown.hasProfile);
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

    // Step B: districts open with a star. Shut, the gate holds the marshal back and says which outlaw opens it.
    {
        const { page, errors, context } = await open();
        assert.equal(await page.evaluate(() => window.__redWestTown.town3d.walkMap().areas.length), 1, 'only the town is open');
        await goTo(page, 'gate-foundry');
        await page.locator('.walk-prompt').filter({ hasText: 'FOUNDRY YARD: SHUT' }).waitFor({ state: 'visible' });
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /Beat IRON JACK HARLAN/);
        const z = await page.evaluate(() => { window.__redWestTown.walk.place(16, -27.4); return window.__redWestTown.walk.position.z; });
        assert.ok(z > -21, `a shut district cannot be entered (z = ${z})`);
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // Beaten: the Calloways, Iron Jack and Mesa Morgan open the farm, the foundry yard and the channel.
        const seed = () => localStorage.setItem('redWestProfile.v1', JSON.stringify({ stats: { stageStars: [7, 7, 7, 7, 7, 7, 0, 0, 0, 0] } }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        await page.waitForFunction(() => window.__redWestTown.town3d.walkMap().areas.length === 4); // the town and three districts
        const at = (id) => page.evaluate(id => {
            const door = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === id);
            window.__redWestTown.walk.place(door.x, door.z);
            return window.__redWestTown.walk.position;
        }, id);
        for(const [id, pattern] of [['furnace', /Ezra Stone opened the armour/], ['channel', /no blasting after dark/], ['kennel', /one dog more than they can feed/]]) {
            const p = await at(id);
            assert.ok(p.x !== 0 || p.z !== 0);
            await page.locator('.walk-prompt').waitFor({ state: 'visible' });
            await page.keyboard.press('e');
            await page.locator('#town-sheet').waitFor({ state: 'visible' });
            assert.match(await page.locator('#town-grid').textContent(), pattern);
            if(id === 'kennel') {
                // The dog: take it, it comes along and is remembered; send it home.
                assert.equal(await page.evaluate(() => window.__redWestTown.walk.hasDog), false);
                await page.locator('[data-companion]').click();
                assert.match(await page.locator('[data-companion]').textContent(), /SEND THE DOG HOME/);
                assert.equal(await page.evaluate(() => window.__redWestTown.walk.hasDog), true, 'the dog is in the town');
                assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('redWestCompanion.v1')).following), true, 'remembered on the device');
                await page.locator('[data-companion]').click();
                assert.match(await page.locator('[data-companion]').textContent(), /CALL THE DOG/);
                assert.equal(await page.evaluate(() => window.__redWestTown.walk.hasDog), false);
                await page.locator('[data-companion]').click();
            }
            await page.locator('#town-sheet-close').click();
        }
        // In a district the marshal can stand; the dog follows him there.
        const pos = await page.evaluate(() => { window.__redWestTown.walk.place(-50, 0); return window.__redWestTown.walk.position; });
        assert.ok(pos.x < -40, 'the farm is open ground');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // Step C: townsfolk follow routes that never cut through a wall, and the marshal can stop one for a word.
        const { page, errors, context } = await open();
        const bad = await page.evaluate(() => {
            const t = window.__redWestTown.town3d;
            const map = t.walkMap();
            const problems = [];
            for(const f of t.folk) {
                const r = f.walker.route;
                for(let i = 0; i < r.length; i++) {
                    const [x1, z1] = r[i], [x2, z2] = r[(i + 1) % r.length];
                    for(let k = 0; k <= 40; k++) {
                        const x = x1 + (x2 - x1) * k / 40, z = z1 + (z2 - z1) * k / 40;
                        if(map.boxes.some(b => x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5)) { problems.push(`${f.id} segment ${i} at ${x.toFixed(1)}, ${z.toFixed(1)}`); break; }
                    }
                }
            }
            return problems;
        });
        assert.deepEqual(bad, [], 'no townsperson walks through a building');
        const person = await page.evaluate(() => {
            const f = window.__redWestTown.town3d.folk[0];
            window.__redWestTown.walk.place(f.walker.x + 1.6, f.walker.z);
            return { id: f.id, name: f.name };
        });
        await page.locator('.walk-bubble').waitFor({ state: 'visible' });
        assert.ok((await page.locator('.walk-bubble').textContent()).includes(person.name), 'the bubble names who is speaking');
        const frozen = await page.evaluate(() => window.__redWestTown.town3d.folk[0].walker.talking);
        assert.equal(frozen, true, 'the one being spoken to stands still');
        await page.evaluate(() => window.__redWestTown.walk.place(0, 13));
        await page.locator('.walk-bubble').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.__redWestTown.town3d.folk.some(f => f.walker.talking)), false, 'and goes on when the marshal leaves');
        assert.deepEqual(errors, []);
        await context.close();
    }

    // Seven districts, the day, and a town that reacts. All ten outlaws beaten opens everything.
    {
        const seed = () => localStorage.setItem('redWestProfile.v1', JSON.stringify({ stats: { stageStars: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7] } }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        await page.waitForFunction(() => window.__redWestTown.town3d.walkMap().areas.length === 8); // the town and seven districts

        // You are told once, with a banner, and what was announced is remembered.
        await page.locator('#town-news').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-news-title').textContent(), /^NEW: .* IS OPEN$/);
        assert.match(await page.locator('#town-news-text').textContent(), /edge of town/);
        assert.equal(await page.evaluate(() => window.__redWestTown.news.seen.length), 7, 'all seven announced');
        await page.locator('#town-news').click();
        await page.locator('#town-news').waitFor({ state: 'hidden' });

        // Until the marshal has walked into the districts, the townsfolk talk about the newest one.
        const talk = () => page.evaluate(() => {
            const f = window.__redWestTown.town3d.folk[0];
            window.__redWestTown.walk.place(f.walker.x + 1.6, f.walker.z);
            return f.name;
        });
        const folk = await talk();
        await page.locator('.walk-bubble').waitFor({ state: 'visible' });
        assert.match(await page.locator('.walk-bubble').textContent(), /Fort Pell is open/, `${folk} talks of the newest district`);

        // The four new places can each be reached and read.
        for(const [id, pattern] of [['clock', /clock on the tower stopped/], ['grave', /struck out/], ['landing', /played straight/], ['gatling', /one page is missing/]]) {
            const door = await page.evaluate(id => {
                const d = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === id);
                window.__redWestTown.walk.place(d.x, d.z);
                return { x: d.x, z: d.z, at: window.__redWestTown.walk.position };
            }, id);
            assert.ok(Math.hypot(door.at.x - door.x, door.at.z - door.z) < 0.01, `${id}: the marshal can stand at its door (open ground)`);
            await page.locator('.walk-prompt').waitFor({ state: 'visible' });
            await page.keyboard.press('e');
            await page.locator('#town-sheet').waitFor({ state: 'visible' });
            assert.match(await page.locator('#town-grid').textContent(), pattern);
            await page.locator('#town-sheet-close').click();
        }
        // Having walked into all of them, the talk dies down and the usual lines return.
        for(const [door, district] of [['kennel', 'ranch'], ['furnace', 'foundry'], ['channel', 'canal']]) {
            await page.evaluate(id => { const d = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === id); window.__redWestTown.walk.place(d.x, d.z); }, door);
            await page.waitForFunction(id => window.__redWestTown.news.visited.includes(id), district); // a frame has to see him there
        }
        await page.waitForFunction(() => window.__redWestTown.news.visited.length === 7);
        await talk();
        await page.locator('.walk-bubble').waitFor({ state: 'visible' });
        assert.doesNotMatch(await page.locator('.walk-bubble').textContent(), / is open/, 'back to the usual line');

        // The day: it starts at dusk, goes to night when asked, and stays there while the clock runs on.
        assert.equal(await page.evaluate(() => window.__redWestTown.town3d.timeOfDay), 'dusk');
        const night = await page.evaluate(() => { window.__redWestTown.town3d.setTimeOfDay(180); return window.__redWestTown.town3d.timeOfDay; });
        assert.equal(night, 'night');
        await page.waitForTimeout(700);
        assert.equal(await page.evaluate(() => window.__redWestTown.town3d.timeOfDay), 'night');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // ?time=off keeps it at dusk however long you wait.
        const { page, errors, context } = await open('?time=off');
        await page.waitForTimeout(1500);
        assert.equal(await page.evaluate(() => window.__redWestTown.town3d.timeOfDay), 'dusk');
        assert.deepEqual(errors, []);
        await context.close();
    }

    // LOOK's quality (src/townQuality.js): a button that goes round auto, high, medium, low; auto steps down on a slow device
    // and remembers where it ended up.
    {
        const { page, errors, context } = await open();
        const label = () => page.locator('#town-quality-btn').textContent();
        const look = () => page.evaluate(() => ({ quality: window.__redWestTown.look.quality, auto: window.__redWestTown.look.auto }));
        await page.waitForFunction(() => window.__redWestTown.look);
        assert.match(await label(), /^QUALITY: AUTO \((HIGH|MED|LOW)\)$/);
        for(const [text, quality, auto] of [['QUALITY: HIGH', 'high', false], ['QUALITY: MED', 'medium', false], ['QUALITY: LOW', 'low', false]]) {
            await page.locator('#town-quality-btn').click();
            assert.equal(await label(), text);
            assert.deepEqual(await look(), { quality, auto });
            await page.waitForTimeout(400); // the town draws a few frames at this level
        }
        await page.locator('#town-quality-btn').click();
        assert.match(await label(), /^QUALITY: AUTO \(HIGH\)$/, 'back to auto starts again at the best look');
        assert.deepEqual(await look(), { quality: 'high', auto: true });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('redWestTownQuality.v1')).choice), 'auto');

        // A slow device: feed slow frames (the real ones only add to this) and auto steps down, one level at a time.
        await page.evaluate(() => { for(let i = 0; i < 150; i++) window.__redWestTown.look.feed(0.1); }); // fifteen seconds at ten frames a second
        assert.equal((await look()).quality, 'low', 'steps down to low');
        assert.match(await label(), /^QUALITY: AUTO \(LOW\)$/);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('redWestTownQuality.v1')).floor), 'low', 'remembers where it ended up');
        await page.waitForTimeout(500);

        // LOOK off takes the quality button away.
        await page.locator('#town-look-btn').click();
        assert.equal(await page.locator('#town-quality-btn').isVisible(), false);
        await page.locator('#town-look-btn').click();
        assert.equal(await page.locator('#town-quality-btn').isVisible(), true);
        assert.equal((await look()).quality, 'low', 'LOOK back on keeps the level');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // The next visit starts from where the device ended up, not from the top.
        const seed = () => localStorage.setItem('redWestTownQuality.v1', JSON.stringify({ choice: 'auto', floor: 'medium' }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        await page.waitForFunction(() => window.__redWestTown.look);
        assert.deepEqual(await page.evaluate(() => ({ quality: window.__redWestTown.look.quality, auto: window.__redWestTown.look.auto })), { quality: 'medium', auto: true });
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // ?quality=low is for that page load only: low, and by hand (it never changes by itself).
        const { page, errors, context } = await open('?quality=low');
        await page.waitForFunction(() => window.__redWestTown.look);
        assert.deepEqual(await page.evaluate(() => ({ quality: window.__redWestTown.look.quality, auto: window.__redWestTown.look.auto })), { quality: 'low', auto: false });
        assert.equal(await page.locator('#town-quality-btn').textContent(), 'QUALITY: LOW');
        await page.evaluate(() => { for(let i = 0; i < 150; i++) window.__redWestTown.look.feed(0.1); });
        assert.equal(await page.evaluate(() => window.__redWestTown.look.quality), 'low');
        assert.equal(await page.evaluate(() => localStorage.getItem('redWestTownQuality.v1')), null, 'the URL choice is not saved');
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
