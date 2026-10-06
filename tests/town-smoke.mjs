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
    // A prompt is worded in the walk's per-frame update (src/townWalk.js), so after the marshal is put somewhere the prompt is still the one
    // for where he was until a frame has been drawn. On a slow runner (6 frames a second) that is long enough for the test to see the old
    // door's prompt ("EMPTY PLOT" belongs to every empty plot), press E and plant in the wrong plot. So: wait for two frames after standing.
    const drawn = async (page, frames = 2) => {
        const from = await page.evaluate(() => window.__redWestRenderer?.info.render.frame ?? 0);
        await page.waitForFunction(({ from, frames }) => (window.__redWestRenderer?.info.render.frame ?? 0) >= from + frames, { from, frames });
    };
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

    {
        // Nothing beaten: the train runs to Main Street only, and the other stops are greyed and name the outlaw to beat.
        const { page, errors, context } = await open();
        await goTo(page, 'platform');
        await page.locator('.walk-prompt').filter({ hasText: 'THE TOWN TRAIN' }).waitFor({ state: 'visible' });
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-travel]').count(), 1);
        assert.equal(await page.locator('.farm-crop[disabled]').count(), 10);
        assert.equal(await page.locator('.town-label.train').count(), 1, 'the town station has its own sign, so the train can be found');
        const station = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'platform'));
        assert.ok(station.z > 15, 'the station is on the south road, near the middle of town');
        assert.match(await page.locator('#town-grid').textContent(), /Beat IRON JACK HARLAN/);
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
        // Try to stand inside the shut Foundry Yard: the marshal is held at its fence (the sign is read 1.6 inside the town).
        const held = await page.evaluate(() => {
            const gate = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'gate-foundry');
            window.__redWestTown.walk.place(gate.x, gate.z - 12);
            return { z: window.__redWestTown.walk.position.z, fence: gate.z - 1.6 };
        });
        assert.ok(held.z > held.fence, `a shut district cannot be entered (z = ${held.z}, fence at ${held.fence})`);
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // Beaten: the Calloways, Iron Jack and Mesa Morgan open the farm, the foundry yard and the channel.
        const seed = () => localStorage.setItem('redWestProfile.v1', JSON.stringify({ stats: { stageStars: [0, 0, 0, 7, 7, 7, 0, 0, 0, 0] } }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        await page.waitForFunction(() => window.__redWestTown.town3d.walkMap().areas.length === 2); // the town and the foundry yard: the farm, the Channel and the Crossing are places of their own, not ground in the town
        const at = (id) => page.evaluate(id => {
            const door = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === id);
            window.__redWestTown.walk.place(door.x, door.z);
            return window.__redWestTown.walk.position;
        }, id);
        for(const [id, label, pattern] of [['furnace', 'THE FURNACE', /Ezra Stone opened the armour/]]) {
            const p = await at(id);
            assert.ok(p.x !== 0 || p.z !== 0);
            // Wait for this door's own prompt: the one from the card just closed can show for a frame.
            await page.locator('.walk-prompt').filter({ hasText: label }).waitFor({ state: 'visible' });
            await page.keyboard.press('e');
            await page.locator('#town-sheet').waitFor({ state: 'visible' });
            assert.match(await page.locator('#town-grid').textContent(), pattern);
            await page.locator('#town-sheet-close').click();
        }
        // The farm has a way in, not ground: there is no kennel in the town any more, and the gate reads as an entrance.
        const doors = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.map(d => d.id));
        assert.ok(doors.includes('enter-ranch') && !doors.includes('kennel') && !doors.includes('gate-ranch'));
        const pos = await page.evaluate(() => {
            const gate = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'enter-ranch');
            window.__redWestTown.walk.place(gate.x - 14, gate.z);
            return { x: window.__redWestTown.walk.position.x, edge: gate.x + 1.6 };
        });
        assert.ok(pos.x > pos.edge - 3.3, `the farm is not ground in the town: the marshal cannot walk into it (x = ${pos.x}, edge at ${pos.edge})`);
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
        await page.evaluate(() => { const a = window.__redWestTown.town3d.walkMap().areas[0]; window.__redWestTown.walk.place(a.maxX - 1, a.maxZ - 1); }); // the far corner of the town
        await page.locator('.walk-bubble').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.__redWestTown.town3d.folk.some(f => f.walker.talking)), false, 'and goes on when the marshal leaves');
        assert.deepEqual(errors, []);
        await context.close();
    }

    // Ten districts, the day, and a town that reacts. All ten outlaws beaten opens everything.
    {
        const seed = () => localStorage.setItem('redWestProfile.v1', JSON.stringify({ stats: { stageStars: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7] } }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        await page.waitForFunction(() => window.__redWestTown.town3d.walkMap().areas.length === 7); // the town and six districts: the farm, the Crossing, the Channel and Copper Bit are places of their own

        // You are told once, with a banner, and what was announced is remembered.
        await page.locator('#town-news').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-news-title').textContent(), /^NEW: .* IS OPEN$/);
        assert.match(await page.locator('#town-news-text').textContent(), /edge of town/);
        assert.equal(await page.evaluate(() => window.__redWestTown.news.seen.length), 10, 'all ten announced');
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
        assert.match(await page.locator('.walk-bubble').textContent(), /Hollow Hill is open/, `${folk} talks of the newest district`);

        // The places of the districts that are ground in the town can each be reached and read.
        for(const [id, label, pattern] of [['grave', 'THE OLD STONE', /struck out/], ['landing', 'THE GANGWAY', /played straight/], ['gatling', 'THE GATLING', /one page is missing/], ['den', 'THE DEN', /wolf pups/], ['bell', 'THE CHAPEL BELL', /bell rings once at dusk/]]) {
            const door = await page.evaluate(id => {
                const d = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === id);
                window.__redWestTown.walk.place(d.x, d.z);
                return { x: d.x, z: d.z, at: window.__redWestTown.walk.position };
            }, id);
            assert.ok(Math.hypot(door.at.x - door.x, door.at.z - door.z) < 0.01, `${id}: the marshal can stand at its door (open ground)`);
            await page.locator('.walk-prompt').filter({ hasText: label }).waitFor({ state: 'visible' }); // this door's own prompt, not the last one's
            await page.keyboard.press('e');
            await page.locator('#town-sheet').waitFor({ state: 'visible' });
            assert.match(await page.locator('#town-grid').textContent(), pattern);
            await page.locator('#town-sheet-close').click();
        }
        // Having walked into all of them, the talk dies down and the usual lines return.
        for(const [door, district] of [['furnace', 'foundry']]) {
            await page.evaluate(id => { const d = window.__redWestTown.town3d.walkMap().doors.find(d => d.id === id); window.__redWestTown.walk.place(d.x, d.z); }, door);
            await page.waitForFunction(id => window.__redWestTown.news.visited.includes(id), district); // a frame has to see him there
        }
        // The farm counts as walked into once he has stepped inside it.
        await page.evaluate(() => { window.__redWestTown.enterPlace('ranch'); });
        await page.waitForFunction(() => window.__redWestTown.place === 'ranch');
        await page.evaluate(() => window.__redWestTown.leavePlace());
        // So do the Crossing, the Channel and Copper Bit.
        for(const id of ['crossing', 'canal', 'copper']) {
            await page.evaluate(id => { window.__redWestTown.enterPlace(id); }, id);
            await page.waitForFunction(id => window.__redWestTown.place === id, id);
            await page.evaluate(() => window.__redWestTown.leavePlace());
        }
        await page.waitForFunction(() => window.__redWestTown.news.visited.length === 10);
        await talk();
        await page.locator('.walk-bubble').waitFor({ state: 'visible' });
        assert.doesNotMatch(await page.locator('.walk-bubble').textContent(), / is open/, 'back to the usual line');

        // The town train: the districts are a real walk apart, so the platform beside the depot has a train to every stop.
        const stopsOpen = await page.evaluate(async () => (await import('/src/townTravel.js')).stops(window.__redWestTown.town3d.openDistricts));
        assert.equal(stopsOpen.length, 11, 'Main Street and ten districts');
        const toPlatform = async () => {
            await goTo(page, 'platform');
            await page.locator('.walk-prompt').filter({ hasText: 'THE TOWN TRAIN' }).waitFor({ state: 'visible' });
            await page.keyboard.press('e');
            await page.locator('#town-sheet').waitFor({ state: 'visible' });
        };
        for(const stop of stopsOpen) {
            await toPlatform();
            assert.equal(await page.locator('[data-travel]').count(), 11, 'every stop is open with everything beaten');
            await page.locator(`[data-travel="${stop.id}"]`).click();
            await page.waitForFunction(name => document.getElementById('town-toast').textContent.includes(`Off the train at ${name}`), stop.name);
            const at = await page.evaluate(() => window.__redWestTown.walk.position);
            assert.ok(Math.hypot(at.x - stop.at[0], at.z - stop.at[1]) < 0.7, `${stop.id}: stepped off at the stop (${at.x.toFixed(1)}, ${at.z.toFixed(1)} for ${stop.at.map(n => n.toFixed(1))})`);
        }

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
        // (It may already have stepped down since: slow headless frames make AUTO do that after a few seconds. What matters is where it started.)
        assert.deepEqual(await page.evaluate(() => ({ started: window.__redWestTown.look.initialQuality, auto: window.__redWestTown.look.auto })), { started: 'medium', auto: true });
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

    // The Arena (src/arena.js): a place in town. Boss fights are an option; a boss opens once beaten on the Wanted Road.
    {
        // Nothing beaten: every boss is locked. The overview (?walk=off) opens it by tapping its sign.
        const { page, errors, context } = await open('?walk=off');
        await page.locator('.town-label', { hasText: 'ARENA' }).click();
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /BOSS FIGHTS/, 'boss fights are one of the options');
        assert.equal(await page.locator('[data-arena-fight]').count(), 10, 'all ten outlaws are listed');
        assert.equal(await page.locator('[data-arena-fight]:not([disabled])').count(), 0, 'none beaten, none open');
        assert.equal(await page.locator('.arena-row.locked').count(), 10);
        assert.match(await page.locator('.arena-row').first().textContent(), /Beat them on the Wanted Road/);
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // Dusty Pete and Deacon Graves beaten: those two open, the rest stay locked. Walking up to the gate opens the card too.
        const seed = () => localStorage.setItem('redWestProgress.v1', JSON.stringify({ selected: 3, stars: [7, 0, 1, 0, 0, 0, 0, 0, 0, 0], best: [] }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        await goTo(page, 'arena');
        await page.locator('.walk-prompt').filter({ hasText: 'ARENA' }).waitFor({ state: 'visible' });
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-arena-fight]:not([disabled])')].map(b => b.dataset.arenaFight)), ['0', '2']);
        assert.match(await page.locator('#town-grid').textContent(), /2 \/ 10 OPEN/);
        // The options switch on and off.
        assert.match(await page.locator('[data-arena-toggle="invincible"]').textContent(), /CAN'T DIE: OFF/);
        await page.locator('[data-arena-toggle="invincible"]').click();
        assert.match(await page.locator('[data-arena-toggle="invincible"]').textContent(), /CAN'T DIE: ON/);
        // Fight Dusty Pete: the card closes, the run starts as an Arena run, and the town does not stay open behind it.
        await page.evaluate(async () => { window.__rw = { state: await import('/src/state.js'), arena: (await import('/src/arena.js')).arena }; });
        await page.locator('[data-arena-fight="0"]').click();
        await page.waitForFunction(() => window.__rw.state.gameState.isGameStarted, null, { timeout: 90000 });
        assert.deepEqual(await page.evaluate(() => ({ enabled: window.__rw.arena.enabled, fromTown: window.__rw.arena.fromTown, outlaw: window.__rw.arena.outlaw, invincible: window.__rw.arena.invincible, wave: window.__rw.state.gameState.outlawIndex })),
            { enabled: true, fromTown: true, outlaw: 0, invincible: true, wave: 0 });
        assert.equal(await page.locator('#town-screen').isVisible(), false);
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // A boss that is locked cannot be started even if asked for (the rule is in the code, not only the greyed button).
        const { page, errors, context } = await open();
        const started = await page.evaluate(async () => {
            const { beginTownFight, arena } = await import('/src/arena.js');
            const ok = beginTownFight(5, { stars: [7, 7, 7, 7, 7, 0, 0, 0, 0, 0] });
            return { ok, enabled: arena.enabled };
        });
        assert.deepEqual(started, { ok: false, enabled: false });
        assert.deepEqual(errors, []);
        await context.close();
    }
    // Calloway Farm (src/farm.js, src/placeFarm.js): a place of its own. Shut until the Calloways are beaten; then a whole new
    // map you walk around, with crops to plant and harvest, eggs, and a stand that pays.
    {
        const { page, errors, context } = await open();
        const doors = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.map(d => d.id));
        assert.ok(doors.includes('gate-ranch') && !doors.includes('enter-ranch'), 'shut: a gate to read, not a way in');
        await page.evaluate(() => window.__redWestTown.enterPlace('ranch'));
        assert.equal(await page.evaluate(() => window.__redWestTown.place), null, 'it stays shut until the Calloways are beaten');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        const seed = () => {
            const ago = hours => new Date(Date.now() - hours * 3600000).toISOString();
            localStorage.setItem('redWestProfile.v1', JSON.stringify({
                stats: { stageStars: [0, 0, 0, 7, 0, 0, 0, 0, 0, 0] },
                town: { farm: { plots: [{ crop: 'wheat', plantedAt: ago(2) }], store: { wheat: 3, corn: 2 }, coopAt: ago(3) } }
            }));
        };
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        const dollars = async () => Number((await page.locator('#town-dollars').textContent()).replace(/,/g, ''));
        const stand = async id => {
            await page.evaluate(id => {
                const d = window.__redWestTown.farm3d.walkMap().doors.find(d => d.id === id);
                window.__redWestTown.farmWalk.place(d.x, d.z);
            }, id);
            await drawn(page);
        };
        const prompt = text => page.locator('.walk-prompt').filter({ hasText: text }).waitFor({ state: 'visible' });
        // The prompt right after an action (planting) shows a moment after the card closes. On a slow runner that has twice not come within
        // the usual wait, so: wait a fair time, and if it has not come, put the marshal back at the door (the prompt follows the nearest door)
        // and wait again. If it still does not come, fail with what the page was showing instead of a bare timeout.
        const promptAfterAction = async (text, door) => {
            try {
                await page.locator('.walk-prompt').filter({ hasText: text }).waitFor({ state: 'visible', timeout: 15000 });
                return;
            } catch {
                await stand(door);
            }
            try {
                await page.locator('.walk-prompt').filter({ hasText: text }).waitFor({ state: 'visible', timeout: 45000 });
            } catch(error) {
                // Is the page still drawing frames? (A stale prompt on a stalled loop and on stale data are different bugs.)
                const frameAt = () => page.evaluate(() => window.__redWestRenderer?.info.render.frame ?? null);
                const frameBefore = await frameAt();
                await page.waitForTimeout(1000);
                const framesInASecond = (await frameAt()) - frameBefore;
                const shown = await page.evaluate(() => {
                    const el = document.querySelector('.walk-prompt');
                    let saved = null;
                    try { saved = JSON.parse(localStorage.getItem('redWestProfile.v1')).town.farm.plots; } catch { /* unreadable */ }
                    // What the page is showing, and what was actually saved: if the corn is saved, the screen is stale; if not, the planting was lost.
                    return { prompt: el ? `${getComputedStyle(el).display}|${el.textContent}` : 'no prompt element', place: window.__redWestTown.place, sheet: getComputedStyle(document.getElementById('town-sheet')).display, hidden: document.hidden, savedPlots: saved };
                });
                shown.framesInASecond = framesInASecond;
                throw new Error(`No prompt matching ${text} at ${door} after planting: ${JSON.stringify(shown)}, page errors: ${JSON.stringify(errors)} (${error.message.split('\n')[0]})`);
            }
        };
        const toast = pattern => page.waitForFunction(p => new RegExp(p).test(document.getElementById('town-toast').textContent), pattern);

        // In through the gate: the town's walk stops, the farm's starts, and the way back shows.
        await goTo(page, 'enter-ranch');
        await prompt('CALLOWAY FARM');
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === 'ranch');
        assert.equal(await walking(page), false, 'the town waits');
        assert.equal(await page.evaluate(() => window.__redWestTown.farmWalk.active), true);
        assert.equal(await page.locator('#town-place-back').isVisible(), true);
        assert.equal(await page.locator('.town-label').first().isVisible(), false, 'the town signs are gone');
        await page.waitForTimeout(600);
        const farmCalls = await page.evaluate(() => window.__redWestRenderer?.info.render.calls ?? 0);
        assert.ok(farmCalls < 130, `the farm stays cheap to draw (${farmCalls} draw calls)`);

        // A crop that has grown is harvested by walking up to it.
        await stand('plot-0');
        await prompt('WHEAT READY');
        await page.keyboard.press('e');
        await toast('Harvested 2 wheat');
        // An empty plot offers the crops; planting starts the clock.
        await stand('plot-1');
        await prompt('EMPTY PLOT');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-plant]').count(), 3);
        await page.locator('[data-plant="corn"]').click();
        await toast('Planted corn');
        await page.locator('#town-sheet').waitFor({ state: 'hidden' });
        await promptAfterAction(/CORN: 1h/, 'plot-1'); // 1h 30m, or 1h 29m if a slow machine has taken a minute
        // The coop has laid eggs while we were away.
        await stand('coop');
        await prompt('COOP: 6 EGGS');
        await page.keyboard.press('e');
        await toast('Collected 6 eggs');
        // The barn says how far the farm has come: all three Calloway stars make it level 3.
        await stand('barn');
        await prompt('THE BARN');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /THE BARN: LEVEL 3/);
        await page.locator('#town-sheet-close').click();
        // The stand pays a fixed price: 5 wheat at $2, 2 corn at $6, 6 eggs at $2 = $34, and 20% over at level 3 (the Calloways are fully beaten): $41.
        const before = await dollars();
        await stand('stand');
        await prompt('THE FARM STAND');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /SELL ALL FOR \$41/);
        await page.locator('[data-sell="all"]').click();
        await toast('Sold for \\$41');
        assert.equal(await dollars(), before + 41, 'the money landed in the wallet');
        // The kennel is here now, and the dog comes along inside the farm.
        await stand('kennel');
        await prompt('THE KENNEL');
        await page.keyboard.press('e');
        await page.locator('[data-companion]').click();
        assert.equal(await page.evaluate(() => window.__redWestTown.farmWalk.hasDog), true, 'the dog is on the farm');
        await page.locator('#town-sheet-close').click();
        // Out again: the town is back where the marshal left it.
        await stand('leave');
        await prompt('THE ROAD TO TOWN');
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === null);
        assert.equal(await walking(page), true);
        assert.equal(await page.locator('#town-place-back').isVisible(), false);
        assert.equal(await page.evaluate(() => window.__redWestTown.walk.hasDog), true, 'the dog came back with him');
        const stayed = await page.evaluate(() => window.__redWestTown.walk.position);
        const gateAt = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.find(d => d.id === 'enter-ranch'));
        assert.ok(Math.hypot(stayed.x - gateAt.x, stayed.z - gateAt.z) < 3.5, `back at the farm gate (${stayed.x.toFixed(1)}, ${stayed.z.toFixed(1)})`);
        assert.deepEqual(errors, []);
        await context.close();
    }
    // Vane's Crossing (src/farmOrders.js, src/places/vane.js): a place of its own. Shut until Silas Vane is beaten; then the order
    // board: open the gate, read the board, fill an order from the barn, and leave.
    {
        const { page, errors, context } = await open();
        const doors = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.map(d => d.id));
        assert.ok(doors.includes('gate-crossing') && !doors.includes('enter-crossing'), 'shut: a gate to read, not a way in');
        await page.evaluate(() => window.__redWestTown.enterPlace('crossing'));
        assert.equal(await page.evaluate(() => window.__redWestTown.place), null, 'it stays shut until Silas Vane is beaten');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        // The barn holds plenty of everything, so whichever three orders today brings, the first can be filled.
        const seed = () => {
            localStorage.setItem('redWestProfile.v1', JSON.stringify({
                stats: { stageStars: [0, 0, 0, 7, 0, 0, 7, 0, 0, 0] },
                town: { farm: { plots: [], store: { wheat: 20, corn: 20, pumpkin: 20, egg: 20 } } }
            }));
        };
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        const prompt = text => page.locator('.walk-prompt').filter({ hasText: text }).waitFor({ state: 'visible' });
        await goTo(page, 'enter-crossing');
        await prompt("VANE'S CROSSING");
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === 'crossing');
        assert.equal(await walking(page), false, 'the town waits');
        assert.equal(await page.evaluate(() => window.__redWestTown.placeWalk.active), true);
        await page.waitForTimeout(600);
        const calls = await page.evaluate(() => window.__redWestRenderer?.info.render.calls ?? 0);
        assert.ok(calls < 130, `the Crossing stays cheap to draw (${calls} draw calls)`);
        // The stopped clock is read here now, inside the Crossing.
        await page.evaluate(() => {
            const d = window.__redWestTown.placeScene.walkMap().doors.find(d => d.id === 'clock');
            window.__redWestTown.placeWalk.place(d.x, d.z);
        });
        await prompt('THE STOPPED CLOCK');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /clock on the tower stopped/);
        await page.locator('#town-sheet-close').click();
        await page.evaluate(() => {
            const d = window.__redWestTown.placeScene.walkMap().doors.find(d => d.id === 'board');
            window.__redWestTown.placeWalk.place(d.x, d.z);
        });
        await prompt('THE ORDER BOARD: 3 ORDERS');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-order]').count(), 3);
        const before = Number((await page.locator('#town-dollars').textContent()).replace(/,/g, ''));
        await page.locator('[data-order]').first().click();
        await page.waitForFunction(() => /Order filled for \$/.test(document.getElementById('town-toast').textContent));
        const after = Number((await page.locator('#town-dollars').textContent()).replace(/,/g, ''));
        assert.ok(after > before, 'the order paid into the wallet');
        await page.evaluate(() => {
            const d = window.__redWestTown.placeScene.walkMap().doors.find(d => d.id === 'leave');
            window.__redWestTown.placeWalk.place(d.x, d.z);
        });
        await prompt('THE ROAD TO TOWN');
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === null);
        assert.equal(await walking(page), true);
        assert.deepEqual(errors, []);
        await context.close();
    }
    // Morgan's Channel (src/farmWater.js, src/places/channel.js): a place of its own. Shut until Mad Mesa Morgan is beaten; then the
    // sluice waters the farm, so a wheat plot planted 19 minutes ago is already ready (18 minutes watered, 20 dry).
    {
        const { page, errors, context } = await open();
        const doors = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.map(d => d.id));
        assert.ok(doors.includes('gate-canal') && !doors.includes('enter-canal'), 'shut: a gate to read, not a way in');
        await page.evaluate(() => window.__redWestTown.enterPlace('canal'));
        assert.equal(await page.evaluate(() => window.__redWestTown.place), null, 'it stays shut until Morgan is beaten');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        const seed = () => {
            const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString();
            localStorage.setItem('redWestProfile.v1', JSON.stringify({
                stats: { stageStars: [0, 0, 0, 7, 0, 7, 0, 0, 0, 0] },
                town: { farm: { plots: [{ crop: 'wheat', plantedAt: ago(19) }], store: {}, coopAt: ago(0) } }
            }));
        };
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        const prompt = text => page.locator('.walk-prompt').filter({ hasText: text }).waitFor({ state: 'visible' });
        const stand = async id => {
            await page.evaluate(id => {
                const d = window.__redWestTown.placeScene.walkMap().doors.find(d => d.id === id);
                window.__redWestTown.placeWalk.place(d.x, d.z);
            }, id);
            await drawn(page);
        };
        await goTo(page, 'enter-canal');
        await prompt("MORGAN'S CHANNEL");
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === 'canal');
        assert.equal(await walking(page), false, 'the town waits');
        await page.waitForTimeout(600);
        const calls = await page.evaluate(() => window.__redWestRenderer?.info.render.calls ?? 0);
        assert.ok(calls < 130, `the Channel stays cheap to draw (${calls} draw calls)`);
        await stand('sluice');
        await prompt('THE SLUICE: THE FARM IS WATERED');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /10% sooner/);
        await page.locator('#town-sheet-close').click();
        await stand('log');
        await prompt('THE WAREHOUSE LOG');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /no blasting after dark/);
        await page.locator('#town-sheet-close').click();
        await stand('leave');
        await prompt('THE ROAD TO TOWN');
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === null);
        // On the farm the watered wheat is ready already.
        await page.evaluate(() => window.__redWestTown.enterPlace('ranch'));
        await page.waitForFunction(() => window.__redWestTown.place === 'ranch');
        await page.evaluate(() => {
            const d = window.__redWestTown.farm3d.walkMap().doors.find(d => d.id === 'plot-0');
            window.__redWestTown.farmWalk.place(d.x, d.z);
        });
        await prompt('WHEAT READY');
        assert.deepEqual(errors, []);
        await context.close();
    }
    // Copper Bit (src/saloon.js, src/places/saloon.js): a place of its own. Shut until Dusty Pete is beaten; then the street with the bar,
    // whose card shows the night, the menu and the paid shifts left, and the broken piano.
    {
        const { page, errors, context } = await open();
        const doors = await page.evaluate(() => window.__redWestTown.town3d.walkMap().doors.map(d => d.id));
        assert.ok(doors.includes('gate-copper') && !doors.includes('enter-copper'), 'shut: a gate to read, not a way in');
        await page.evaluate(() => window.__redWestTown.enterPlace('copper'));
        assert.equal(await page.evaluate(() => window.__redWestTown.place), null, 'it stays shut until Dusty Pete is beaten');
        assert.deepEqual(errors, []);
        await context.close();
    }
    {
        const seed = () => localStorage.setItem('redWestProfile.v1', JSON.stringify({ stats: { stageStars: [7, 0, 0, 0, 0, 0, 0, 0, 0, 0] } }));
        const { page, errors, context } = await open('', { width: 1280, height: 720 }, seed);
        const prompt = text => page.locator('.walk-prompt').filter({ hasText: text }).waitFor({ state: 'visible' });
        const stand = async id => {
            await page.evaluate(id => {
                const d = window.__redWestTown.placeScene.walkMap().doors.find(d => d.id === id);
                window.__redWestTown.placeWalk.place(d.x, d.z);
            }, id);
            await drawn(page);
        };
        await goTo(page, 'enter-copper');
        await prompt('COPPER BIT');
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === 'copper');
        assert.equal(await walking(page), false, 'the town waits');
        await page.waitForTimeout(600);
        const calls = await page.evaluate(() => window.__redWestRenderer?.info.render.calls ?? 0);
        assert.ok(calls < 130, `Copper Bit stays cheap to draw (${calls} draw calls)`);
        await stand('bar');
        await prompt("DUSTY PETE'S BAR: 3 PAID SHIFTS LEFT");
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        const bar = await page.locator('#town-grid').textContent();
        assert.match(bar, /night 1 of 10/);
        assert.match(bar, /BEANS/);
        // A shift: start night 1 from the card, cook and serve until the till is counted, and the wages land in the wallet.
        const dollarsBefore = Number((await page.locator('#town-dollars').textContent()).replace(/,/g, ''));
        await page.locator('[data-shift="1"]').click();
        await page.locator('.saloon-shift').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#town-sheet').isVisible(), false, 'the card closes when the shift starts');
        await page.waitForFunction(() => {
            const layer = document.querySelector('.saloon-shift');
            if(!layer) return false;
            layer.querySelectorAll('[data-serve]').forEach(b => b.click());
            layer.querySelectorAll('[data-cook]:not([disabled])').forEach(b => b.click());
            return /Served/.test(layer.querySelector('.saloon-result').textContent);
        }, null, { polling: 100, timeout: 90000 });
        const till = await page.locator('.saloon-result').textContent();
        assert.match(till, /Served 3 of 3/);
        assert.match(till, /\$\d+ in wages and tips\. 2 paid shifts left/);
        const dollarsAfter = Number((await page.locator('#town-dollars').textContent()).replace(/,/g, ''));
        assert.ok(dollarsAfter > dollarsBefore, 'the wages landed in the wallet');
        await page.locator('[data-done]').click();
        await page.locator('.saloon-shift').waitFor({ state: 'detached' });
        await prompt("DUSTY PETE'S BAR: 2 PAID SHIFTS LEFT");
        await stand('bar');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        await page.locator('#town-sheet-close').click();
        await stand('piano');
        await prompt('THE BROKEN PIANO');
        await page.keyboard.press('e');
        await page.locator('#town-sheet').waitFor({ state: 'visible' });
        assert.match(await page.locator('#town-grid').textContent(), /sour notes/);
        await page.locator('#town-sheet-close').click();
        await stand('leave');
        await prompt('THE ROAD TO TOWN');
        await page.keyboard.press('e');
        await page.waitForFunction(() => window.__redWestTown.place === null);
        assert.equal(await walking(page), true);
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
