import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
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

    // Give the boss one HP and place a player bullet on it to exercise the normal hit path.
    await page.evaluate(async () => {
        const [{ enemies }, { spawnBullet }] = await Promise.all([
            import('/src/state.js'), import('/src/bulletSystem.js')
        ]);
        const boss = enemies.find(enemy => enemy.userData.type === 'boss');
        boss.userData.hp = 1;
        const bulletPosition = boss.position.clone().setY(2);
        spawnBullet(boss.parent, 'player', bulletPosition, bulletPosition.clone().set(0, 0, 0));
    });
    await page.locator('#result-title').getByText('BOUNTY CLAIMED').waitFor();
    const finalScore = Number(await page.locator('#finalScore').textContent());
    assert.ok(finalScore >= 50, 'the outlaw kill awards Heat-based score');
    await page.locator('#skipScoreBtn').click();
    await page.keyboard.press('KeyR');
    await page.locator('#start-screen').waitFor({ state: 'visible' });
    await page.keyboard.down('Space');
    await page.waitForFunction(() => window.__rwTestState.gameState.isGameStarted);
    await page.keyboard.up('Space');
    await page.locator('#start-screen').waitFor({ state: 'hidden' });

    assert.deepEqual(relevantErrors(), [], `browser errors: ${pageErrors.join(', ')}`);
    console.log('Browser smoke passed: start, pause, Heat, boss, win, restart, second run.');
} finally {
    await browser?.close();
    await server.close();
}
