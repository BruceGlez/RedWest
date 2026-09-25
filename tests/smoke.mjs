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
    await page.keyboard.down('Space');
    await page.waitForFunction(() => window.__rwTestState.gameState.isGameStarted);
    await page.keyboard.up('Space');
    await page.locator('#start-screen').waitFor({ state: 'hidden' });
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
    }

    // Give the boss one HP and place a player bullet on it to exercise the normal hit path.
    async function shootOutlaw() {
        await page.evaluate(async () => {
            const [{ enemies }, { spawnBullet }] = await Promise.all([
                import('/src/state.js'), import('/src/bulletSystem.js')
            ]);
            const boss = enemies.find(enemy => enemy.userData.type === 'boss');
            boss.userData.hp = 1;
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
    assert.equal(await page.locator('#heat-chain').evaluate(el => el.classList.contains('active')), true, 'the chain timer shows while a chain is live');

    // Run 1: ride on into the bonus pursuit and escape with the bounty.
    const scoreBeforeOutlaw = await page.evaluate(() => window.__rwTestState.gameState.score);
    await shootOutlaw();
    const offered = await page.evaluate(() => ({ ...window.__rwTestState.gameState.bounty, score: window.__rwTestState.gameState.score }));
    assert.equal(offered.status, 'offered');
    assert.equal(offered.score, scoreBeforeOutlaw, 'the bounty is not paid until the player leaves');
    assert.equal(Number(await page.locator('#bounty-amount').textContent()), offered.amount);
    await page.locator('#rideOnBtn').click();
    await page.locator('#bounty-choice').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.getElementById('wave').textContent === 'BONUS');
    assert.equal(await page.evaluate(() => window.__rwTestState.gameState.heat.level >= 1), true, 'Heat carries into the bonus pursuit');
    await page.evaluate(async () => {
        const { gameState, playerStats } = await import('/src/state.js');
        playerStats.hp = 99;
        gameState.waveTimer = 0.01;
    });
    await page.locator('#result-title').getByText('ESCAPED').waitFor();
    const escapedScore = Number(await page.locator('#finalScore').textContent());
    assert.ok(escapedScore >= scoreBeforeOutlaw + offered.amount, 'escaping pays the Heat-scaled bounty');
    await page.locator('#skipScoreBtn').click();
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
    await page.locator('#skipScoreBtn').click();
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
    await page.locator('#skipScoreBtn').click();
    await page.keyboard.press('KeyR');
    await page.locator('#start-screen').waitFor({ state: 'visible' });
    // The playtest log recorded one row per finished run, in order, with the bounty decision.
    const runLog = await page.evaluate(async () => (await import('/src/runLog.js')).loadRunLog());
    assert.deepEqual(runLog.map(run => [run.sessionRun, run.result, run.bountyChoice]),
        [[1, 'escaped', 'ride on'], [2, 'banked', 'bank'], [3, 'died', 'ride on']]);
    assert.equal(await page.locator('#run-log-count').textContent(), '3 runs');
    await startRun();

    assert.deepEqual(relevantErrors(), [], `browser errors: ${pageErrors.join(', ')}`);
    console.log('Browser smoke passed: start, pause, Heat, outlaw, ride on + escape, bank, ride on + forfeit, run log, restarts.');
} finally {
    await browser?.close();
    await server.close();
}
