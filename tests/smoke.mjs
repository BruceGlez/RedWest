import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome-path.mjs';
import { createServer } from 'vite';

const chromePath = findChrome();
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;

try {
    await server.listen();
    browser = await chromium.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server', '--proxy-bypass-list=*']
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(15000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if(message.type() === 'error') pageErrors.push(message.text()); });
    page.on('requestfailed', request => pageErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    const url = server.resolvedUrls.local[0];
    const response = await fetch(url);
    assert.equal(response.status, 200, 'Vite serves the game');
    await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(1000);
    const relevantErrors = () => pageErrors.filter(error => !error.includes('fonts.googleapis.com') && !error.includes('fonts.gstatic.com') && !error.includes('Failed to load resource'));
    if(relevantErrors().length) throw new Error(`Page initialization: ${relevantErrors().join(', ')}`);
    try {
        await page.locator('canvas').waitFor();
    } catch {
        throw new Error(`Vite page did not create a canvas: ${pageErrors.join('; ')}`);
    }
    await page.evaluate(async () => { window.__rwTestState = await import('/src/state.js'); });
    // First launch: a neutral birth-year question must be answered before anything starts.
    await page.locator('#welcome-modal').waitFor({ state: 'visible' });
    assert.ok(await page.locator('#welcome-continue').isDisabled(), 'no year chosen, no continue');
    assert.equal(await page.locator('#welcome-stats').isChecked(), false, 'statistics are opt-in');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__rwTestState.gameState.isGameStarted), false, 'the question blocks starting a run');
    await page.locator('#welcome-year').selectOption(String(new Date().getFullYear() - 30));
    await page.locator('#welcome-stats').check();
    await page.locator('#welcome-continue').click();
    await page.locator('#welcome-modal').waitFor({ state: 'hidden' });
    const answers = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestPrivacy.v1')));
    assert.equal(answers.ageBand, 'adult');
    assert.equal(answers.statsConsent, true);
    assert.equal(answers.birthYear, undefined, 'only the age band is kept');
    await page.keyboard.down('Space');
    await page.waitForFunction(() => window.__rwTestState.gameState.isGameStarted);
    await page.keyboard.up('Space');
    await page.locator('#start-screen').waitFor({ state: 'hidden' });
    // The default character is the imported, animated Marshal (a skinned GLB model).
    await page.waitForFunction(() => {
        const scene = window.__rwTestState.obstacles[0]?.mesh.parent;
        const player = scene?.children.find(object => object.userData.type === 'player');
        return !!player?.getObjectByProperty('isSkinnedMesh', true);
    }, null, { timeout: 60000 });
    await page.keyboard.press('KeyP');
    await page.locator('#pause-overlay').waitFor({ state: 'visible' });
    await page.locator('#pause-resume-btn').click();
    await page.locator('#pause-overlay').waitFor({ state: 'hidden' });

    // Skip elapsed time to exercise the real phase transitions without a minute-long test.
    async function advanceToOutlaw() {
        for(const targetWave of [2, 3]) {
            await page.evaluate(async () => {
                const { gameState } = await import('/src/state.js');
                gameState.waveTimer = 0.01;
            });
            await page.waitForFunction(() => window.__rwTestState.gameState.isIntermission);
            await page.evaluate(async () => {
                const { gameState } = await import('/src/state.js');
                gameState.intermissionTimer = 0.01;
            });
            await page.waitForFunction(wave => window.__rwTestState.gameState.waveNumber === wave, targetWave);
        }
        const bossState = await page.evaluate(async () => {
            const { enemies, gameState } = await import('/src/state.js');
            return { types: enemies.map(enemy => enemy.userData.type), wave: gameState.waveNumber, bossSpawned: gameState.waveBossSpawned, over: gameState.isGameOver };
        });
        assert.equal(bossState.types.includes('boss'), true, `final pursuit spawns the outlaw: ${JSON.stringify(bossState)}`);
        // Hold the outlaw still: this test covers Heat and the bounty choice, and a charge landing
        // mid-check would reset Heat. Each outlaw's attack is covered by boss-smoke.mjs.
        await page.evaluate(async () => {
            const { enemies } = await import('/src/state.js');
            for(const boss of enemies.filter(enemy => enemy.userData.type === 'boss')) {
                Object.assign(boss.userData, { speed: 0, cooldown: 999, shootTimer: 999, special: 999, state: 'move' });
            }
        });
    }

    // Give the boss one HP and place a player bullet on it to exercise the normal hit path.
    async function shootOutlaw() {
        await page.evaluate(async () => {
            const [{ enemies }, { spawnBullet }, { checkCollision }] = await Promise.all([
                import('/src/state.js'), import('/src/bulletSystem.js'), import('/src/physics.js')
            ]);
            const boss = enemies.find(enemy => enemy.userData.type === 'boss');
            boss.userData.hp = 1;
            // The map is random: move the outlaw somewhere clear so the shot cannot hit a rock instead.
            const player = boss.parent.children.find(object => object.userData.type === 'player');
            for(let step = 0; step < 24; step++) {
                const angle = step * Math.PI / 12;
                const x = player.position.x + Math.cos(angle) * 10;
                const z = player.position.z + Math.sin(angle) * 10;
                if(!checkCollision(x, z, 3)) { boss.position.set(x, 0, z); break; }
            }
            const bulletPosition = boss.position.clone().setY(2);
            spawnBullet(boss.parent, 'player', bulletPosition, bulletPosition.clone().set(0, 0, 0));
        });
        await page.locator('#bounty-choice').waitFor({ state: 'visible' });
    }

    async function startRun() {
        await page.keyboard.down('Space');
        await page.waitForFunction(() => window.__rwTestState.gameState.isGameStarted);
        await page.keyboard.up('Space');
        await page.locator('#start-screen').waitFor({ state: 'hidden' });
    }

    await advanceToOutlaw();

    await page.evaluate(async () => {
        const [{ enemies }, { spawnEnemy }, { spawnBullet }, { checkCollision }] = await Promise.all([
            import('/src/state.js'), import('/src/enemySystem.js'),
            import('/src/bulletSystem.js'), import('/src/physics.js')
        ]);
        const scene = enemies.find(enemy => enemy.userData.type === 'boss').parent;
        const player = scene.children.find(object => object.userData.type === 'player');
        for(let i = 0; i < 2; i++) {
            spawnEnemy(scene, player.position, 'bandit');
            const target = enemies.at(-1);
            let placed = false;
            for(let angleStep = 0; angleStep < 24; angleStep++) {
                const angle = (angleStep + i * 12) * Math.PI / 12;
                const x = player.position.x + Math.cos(angle) * 12;
                const z = player.position.z + Math.sin(angle) * 12;
                if(checkCollision(x, z, 2)) continue;
                target.position.set(x, 0, z);
                placed = true;
                break;
            }
            if(!placed) throw new Error('No clear test position for bandit');
            target.userData.hp = 1;
            const bulletPosition = target.position.clone().setY(2);
            spawnBullet(scene, 'player', bulletPosition, bulletPosition.clone().set(0, 0, 0));
        }
    });
    await page.waitForFunction(() => window.__rwTestState.gameState.heat.level >= 1);
    assert.equal(await page.locator('#heat-multiplier').textContent(), 'x1.5');
    assert.ok(await page.locator('.float-text').count() > 0, 'kills pop floating score text');
    assert.equal(await page.locator('#heat-chain').evaluate(el => el.classList.contains('active')), true, 'the chain timer shows while a chain is live');

    // Run 1: ride on into the bonus pursuit and escape with the bounty.
    const scoreBeforeOutlaw = await page.evaluate(() => window.__rwTestState.gameState.score);
    await shootOutlaw();
    const offered = await page.evaluate(() => ({ ...window.__rwTestState.gameState.bounty, score: window.__rwTestState.gameState.score }));
    assert.equal(offered.status, 'offered');
    assert.equal(offered.score, scoreBeforeOutlaw, 'the bounty is not paid until the player leaves');
    assert.equal(Number(await page.locator('#bounty-amount').textContent()), offered.amount);
    // The choice spells out both outcomes in points and stars.
    assert.equal(Number((await page.locator('#bank-total').textContent()).replace(/\D/g, '')), offered.score + offered.amount);
    assert.equal(Number((await page.locator('#ride-keep').textContent()).replace(/\D/g, '')), offered.score);
    assert.match(await page.locator('#ride-stars').textContent(), /new stars/, 'first escape from this outlaw earns stars');
    await page.locator('#rideOnBtn').click();
    await page.locator('#bounty-choice').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.getElementById('wave').textContent === 'BONUS');
    await page.locator('#bonus-hud').getByText('BOUNTY AT STAKE').waitFor();
    assert.equal(await page.evaluate(() => window.__rwTestState.gameState.heat.level >= 1), true, 'Heat carries into the bonus pursuit');
    await page.evaluate(async () => {
        const { gameState, playerStats } = await import('/src/state.js');
        playerStats.hp = 99;
        gameState.waveTimer = 0.01;
    });
    await page.locator('#result-title').getByText('ESCAPED').waitFor();
    // Wanted Road: beating the first outlaw earns stars and unlocks the next stage.
    assert.match(await page.locator('#result-road').textContent(), /NEW OUTLAW ON THE ROAD: RATTLESNAKE ROSA/);
    const escapedScore = Number(await page.locator('#finalScore').textContent());
    assert.ok(escapedScore >= scoreBeforeOutlaw + offered.amount, 'escaping pays the Heat-scaled bounty');
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('KeyR');
    await page.locator('#start-screen').waitFor({ state: 'visible' });

    // Run 2: bank the bounty with the keyboard as soon as the outlaw falls.
    await startRun();
    await advanceToOutlaw();
    const scoreBeforeBank = await page.evaluate(() => window.__rwTestState.gameState.score);
    await shootOutlaw();
    await page.keyboard.press('KeyB');
    await page.locator('#result-title').getByText('BOUNTY CLAIMED').waitFor();
    const bankedBounty = await page.evaluate(() => window.__rwTestState.gameState.bounty);
    assert.equal(bankedBounty.status, 'banked');
    assert.equal(Number(await page.locator('#finalScore').textContent()), scoreBeforeBank + bankedBounty.amount);
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('KeyR');
    await page.locator('#start-screen').waitFor({ state: 'visible' });
    await startRun();

    // Run 3: ride on and die in the bonus pursuit; the bounty and bonus earnings are forfeited.
    await advanceToOutlaw();
    const scoreBeforeForfeit = await page.evaluate(() => window.__rwTestState.gameState.score);
    await shootOutlaw();
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => window.__rwTestState.gameState.bounty.status === 'riding');
    await page.evaluate(async () => {
        const { gameState, playerStats, enemies } = await import('/src/state.js');
        gameState.score += 500;
        playerStats.hp = 1;
        playerStats.invulnerabilityTimer = 0;
        playerStats.isDashing = false;
        const player = enemies[0].parent.children.find(object => object.userData.type === 'player');
        enemies[0].position.copy(player.position);
    });
    await page.locator('#result-title').getByText('WASTED').waitFor();
    assert.equal(Number(await page.locator('#finalScore').textContent()), scoreBeforeForfeit);
    assert.equal(await page.evaluate(() => window.__rwTestState.gameState.bounty.status), 'forfeited');
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('KeyR');
    await page.locator('#start-screen').waitFor({ state: 'visible' });
    // The playtest log recorded one row per finished run, in order, with the bounty decision.
    const runLog = await page.evaluate(async () => (await import('/src/runLog.js')).loadRunLog());
    assert.deepEqual(runLog.map(run => [run.sessionRun, run.outlaw, run.result, run.bountyChoice]),
        [[1, 'dusty-pete', 'escaped', 'ride on'], [2, 'rattlesnake-rosa', 'banked', 'bank'], [3, 'deacon-graves', 'died', 'ride on']]);

    // Progress persists; the road lets the player go back to an earlier outlaw.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestProgress.v1')));
    assert.deepEqual(saved.stars.slice(0, 3), [5, 1, 1], 'defeat+escape, defeat, defeat');
    assert.equal(await page.locator('#home-stars').textContent(), '4');
    assert.match(await page.locator('#home-poster').textContent(), /THE CALLOWAYS/, 'beating stage 3 selects stage 4');
    await page.locator('#road-btn').click();
    await page.locator('#road-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.road-node.locked').count(), 4, 'stages 5-8 are still locked');
    await page.locator('.road-node[data-index="0"]').click();
    await page.locator('#road-screen').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#home-poster').textContent(), /DUSTY PETE/);
    assert.equal(await page.locator('#run-log-count').textContent(), '3 runs');

    // Frontier Town: beaten outlaws sit in the jail and pay each hour; three hours later there is money to collect.
    // (These test runs are too short to count as account records, so come back later like a player would:
    // on load the device's stars are copied into the account.)
    await page.reload({ waitUntil: 'commit' });
    await page.locator('canvas').waitFor();
    await page.evaluate(async () => { window.__rwTestState = await import('/src/state.js'); });
    await page.locator('#town-btn').click();
    await page.locator('#town-screen').waitFor({ state: 'visible' });
    const jailText = await page.locator('[data-building="jail"]').textContent();
    assert.match(jailText, /3 of 8 outlaws jailed/, jailText);
    const townDollars = async () => Number((await page.locator('#town-dollars').textContent()).replace(/\D/g, ''));
    const dollarsBefore = await townDollars();
    await page.evaluate(() => {
        const Real = Date;
        const shift = 3 * 3600000;
        window.__RealDate = Real;
        window.Date = class extends Real {
            constructor(...args) { super(...(args.length ? args : [Real.now() + shift])); }
            static now() { return Real.now() + shift; }
        };
    });
    await page.locator('#town-screen .panel-back').click();
    await page.locator('#town-badge').waitFor({ state: 'visible', timeout: 35000 }); // the badge refreshes every 30 s
    await page.locator('#town-btn').click();
    // Stand in for the phone's notification system (the reminders exist only in the app).
    await page.evaluate(() => {
        window.__redWestNotifications = {
            requestPermissions: async () => ({ display: 'granted' }),
            cancel: async () => {},
            schedule: async request => { window.__scheduled = request; }
        };
    });
    const collect = page.locator('[data-collect]');
    assert.match(await collect.textContent(), /COLLECT \$[1-9]/);
    await collect.click();
    await page.locator('#town-message').getByText('Collected').waitFor();
    // The first collect offers reminders; accepting schedules one for when the jail is full, never at night.
    await page.locator('#town-reminder').waitFor({ state: 'visible' });
    await page.locator('#town-reminder-yes').click();
    await page.waitForFunction(() => window.__scheduled);
    const reminder = await page.evaluate(() => {
        const n = window.__scheduled.notifications[0];
        return { title: n.title, hour: new Date(n.schedule.at).getHours() };
    });
    assert.equal(reminder.title, 'Your jail is full');
    assert.ok(reminder.hour >= 9 && reminder.hour < 21, `reminder at ${reminder.hour}:00`);
    assert.equal(await page.locator('#settings-reminders-btn').textContent(), 'Jail reminders: ON');
    assert.ok(await townDollars() > dollarsBefore, 'collected dollars land in the wallet');
    assert.equal(await page.locator('[data-collect]').isDisabled(), true, 'nothing left to collect');
    await page.evaluate(() => { window.Date = window.__RealDate; });
    await page.locator('#town-screen .panel-back').click();

    // Settings: statistics can be switched off, and "Delete my data" takes two taps, then starts over.
    await page.locator('#home-settings-btn').click();
    await page.locator('#settings-stats-btn').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('redWestPrivacy.v1')).statsConsent), false);
    const oldAccount = await page.evaluate(() => localStorage.getItem('redWestAccount.v1'));
    await page.locator('#settings-delete-btn').click();
    await page.locator('#settings-delete-note').waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => localStorage.getItem('redWestProgress.v1')), 'one tap deletes nothing');
    await Promise.all([page.waitForEvent('load'), page.locator('#settings-delete-btn').click()]);
    await page.evaluate(async () => { window.__rwTestState = await import('/src/state.js'); });
    await page.locator('#welcome-modal').waitFor({ state: 'visible' });
    // Everything saved is gone; the new session starts a blank profile under a new id.
    const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('redWest')).map(k => [k, localStorage.getItem(k)])));
    for(const key of ['redWestProgress.v1', 'redWestRunLog.v1', 'redWestPrivacy.v1']) assert.equal(after[key], undefined, `${key} deleted`);
    assert.notEqual(after['redWestAccount.v1'], oldAccount, 'a new local id');
    assert.equal(JSON.parse(after['redWestProfile.v1'] || '{"stats":{"runs":0}}').stats.runs, 0, 'a blank profile');

    // A player under 13: statistics stay off even if ticked, no real-money packs, and a generated name.
    await page.locator('#welcome-year').selectOption(String(new Date().getFullYear() - 9));
    await page.locator('#welcome-stats').check();
    await page.locator('#welcome-continue').click();
    await page.locator('#welcome-modal').waitFor({ state: 'hidden' });
    const childAnswers = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestPrivacy.v1')));
    assert.deepEqual([childAnswers.ageBand, childAnswers.statsConsent], ['under13', false]);
    await page.locator('#shop-btn').click();
    await page.locator('#shop-tabs [data-tab="nuggets"]').click();
    assert.match(await page.locator('#shop-grid').textContent(), /not sold to players under 13/);
    assert.equal(await page.locator('#shop-grid [data-product]').count(), 0);
    await page.locator('#shop-screen .panel-back').click();
    await page.locator('#records-btn').click();
    await page.waitForFunction(() => /^[A-Z]+ [0-9]{4}$/.test(document.getElementById('records-name-value').textContent));
    assert.equal(await page.locator('#records-name-edit').isVisible(), false, 'no typed names under 13');
    await page.locator('#records-screen .panel-back').click();
    await startRun();

    assert.deepEqual(relevantErrors(), [], `browser errors: ${pageErrors.join(', ')}`);
    console.log('Browser smoke passed: first-launch question, start, pause, Heat, outlaw, ride on + escape, bank, ride on + forfeit, run log, restarts, Frontier Town jail collect and reminder, statistics switch, delete my data, under-13 rules.');
} finally {
    await browser?.close();
    await server.close();
}
