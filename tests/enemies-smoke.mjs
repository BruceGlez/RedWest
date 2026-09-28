import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';

// Every enemy type: spawn next to the player on the last stage, let its behaviour run
// (lasers, dynamite, charges, fading), confirm it can hurt the player, then kill it with a
// normal player bullet. Also checks the NEW ENEMY card and the Bounty Book.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    // All stages unlocked so the last outlaw's full roster is in play.
    await context.addInitScript(() => localStorage.setItem('redWestProgress.v1', JSON.stringify({ selected: 7, stars: [1, 1, 1, 1, 1, 1, 1, 0], best: [0, 0, 0, 0, 0, 0, 0, 0] })));
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit', timeout: 30000 });
    await page.locator('canvas').waitFor();
    await page.evaluate(async () => { window.S = await import('/src/state.js'); window.T = await import('/src/enemyTypes.js'); });

    await page.keyboard.down('Space');
    await page.waitForFunction(() => S.gameState.isGameStarted);
    await page.keyboard.up('Space');
    await page.evaluate(() => {
        S.playerStats.hp = 99;
        window.__player = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
    });
    assert.equal(await page.evaluate(() => S.gameState.outlawIndex), 7);
    // Stage 8 features the ghost in its opening pursuit, with a NEW ENEMY card.
    await page.locator('#new-enemy-card').getByText('GHOST').waitFor();

    const types = await page.evaluate(() => T.ENEMY_ORDER);
    const hurtBy = [];
    for(const type of types) {
        const result = await page.evaluate(async type => {
            const [{ spawnEnemy }, { spawnBullet }] = await Promise.all([import('/src/enemySystem.js'), import('/src/bulletSystem.js')]);
            const player = window.__player;
            if(S.gameState.isGameOver) throw new Error('run ended early');
            for(const e of [...S.enemies]) { e.parent.remove(e); S.enemies.splice(S.enemies.indexOf(e), 1); }
            S.gameState.waveTimer = 999;
            S.gameState.waveBudgetRemaining = 0;
            S.playerStats.hp = 50;
            const hpBefore = S.playerStats.hp;
            spawnEnemy(player.parent, player.position, type);
            const enemy = S.enemies.at(-1);
            enemy.position.set(player.position.x + 12, 0, player.position.z + 6);
            enemy.userData.shootTimer = 0.5;
            enemy.userData.cooldown = 0;
            enemy.userData.stateTimer = Math.min(enemy.userData.stateTimer, 0.5);
            // Wait on game time, not wall time: software rendering in CI can run at a few FPS.
            const start = S.gameState.runTime;
            const deadline = Date.now() + 60000;
            while(S.gameState.runTime - start < 7 && S.playerStats.hp === hpBefore && Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 100));
            }
            const hurt = S.playerStats.hp < hpBefore;
            // Kill it through the normal hit path (make a faded ghost visible first).
            enemy.userData.untargetable = false;
            enemy.userData.faded = false;
            enemy.userData.hp = 1;
            enemy.position.set(player.position.x + 4, 0, player.position.z);
            const at = enemy.position.clone().setY(2);
            spawnBullet(player.parent, 'player', at, at.clone().set(0, 0, 0));
            await new Promise(r => setTimeout(r, 300));
            return { hurt, dead: !S.enemies.includes(enemy), kills: S.gameState.runStats.kills[type] || 0 };
        }, type);
        assert.ok(result.dead && result.kills >= 1, `${type} can be killed: ${JSON.stringify(result)} errors: ${errors.slice(0, 3).join(" | ")}`);
        if(result.hurt) hurtBy.push(type);
    }
    // Every attacker should land a hit within 7s of game time on a stationary player.
    for(const type of ['rattler', 'rifleman', 'dynamiter', 'brute', 'rider', 'duelist', 'ghost']) {
        assert.ok(hurtBy.includes(type), `${type} damages the player (hurt by: ${hurtBy.join(', ')})`);
    }

    // Finish the run and check the Bounty Book fills in.
    await page.evaluate(() => { S.playerStats.hp = 1; S.playerStats.invulnerabilityTimer = 0; S.playerStats.isDashing = false; });
    await page.evaluate(async () => {
        const { spawnEnemy } = await import('/src/enemySystem.js');
        const player = window.__player;
        spawnEnemy(player.parent, player.position, 'bandit');
        S.enemies.at(-1).position.copy(player.position);
    });
    await page.locator('#gameover').waitFor({ state: 'visible' });
    await page.locator('#skipScoreBtn').click();
    await page.keyboard.press('KeyR');
    await page.locator('#book-btn').click();
    await page.locator('#book-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#book-enemies .book-card:not(.locked)').count(), types.length, 'every enemy met is in the book');
    assert.match(await page.locator('#book-enemies').textContent(), /BAGGED: 1/);
    assert.equal(await page.locator('#book-outlaws .book-card').count(), 8);
    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    console.log(`Enemy smoke passed: ${types.length} enemy types spawn, attack (${hurtBy.length} landed hits), die, and fill the Bounty Book.`);
} finally {
    await browser?.close();
    await server.close();
}
