import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';

// Every outlaw's signature attack: spawn each one next to the player, confirm the attack lands
// (or, for Rattlesnake Rosa, that her howl brings wolves), check Iron Jack's armour only stops
// shots from the front, and that the Calloways only count as beaten when the last brother falls.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit', timeout: 60000 });
    await page.locator('canvas').waitFor({ timeout: 90000 });
    await page.evaluate(async () => {
        window.S = await import('/src/state.js');
        window.O = await import('/src/outlaws.js');
    });
    await page.keyboard.down('Space');
    await page.waitForFunction(() => S.gameState.isGameStarted);
    await page.keyboard.up('Space');
    await page.evaluate(async () => {
        const { markObstacleGridDirty } = await import('/src/physics.js');
        window.__player = S.obstacles[0].mesh.parent.children.find(o => o.userData.type === 'player');
        const p = window.__player.position;
        for(let i = S.obstacles.length - 1; i >= 0; i--) {
            const o = S.obstacles[i];
            if(Math.hypot(o.x - p.x, o.z - p.z) < 35) { o.mesh.parent?.remove(o.mesh); S.obstacles.splice(i, 1); }
        }
        markObstacleGridDirty();
        // Helpers shared by the checks below.
        window.clearField = () => {
            for(const e of [...S.enemies]) e.parent.remove(e);
            S.enemies.length = 0;
            S.gameState.waveTimer = 999;
            S.gameState.waveBudgetRemaining = 0;
        };
        window.spawnOutlaw = async (index, count = 1) => {
            const { spawnEnemy } = await import('/src/enemySystem.js');
            S.gameState.outlawIndex = index;
            const player = window.__player;
            const bosses = [];
            for(let i = 0; i < count; i++) {
                spawnEnemy(player.parent, player.position, 'boss');
                const boss = S.enemies.at(-1);
                const angle = i * 0.8;
                boss.position.set(player.position.x + Math.cos(angle) * 14, 0, player.position.z + Math.sin(angle) * 14);
                Object.assign(boss.userData, { shootTimer: 0.4, special: 0.4, cooldown: 0 });
                if(boss.userData.bossStyle === 'specter') boss.userData.stateTimer = 0.3;
                bosses.push(boss);
            }
            return bosses;
        };
    });

    const styles = await page.evaluate(() => O.OUTLAWS.map(o => o.signature.style));
    const landed = [];
    for(let index = 0; index < styles.length; index++) {
        const result = await page.evaluate(async index => {
            if(S.gameState.isGameOver) throw new Error('run ended early');
            window.clearField();
            S.playerStats.hp = 50;
            S.playerStats.invulnerabilityTimer = 0;
            const hpBefore = S.playerStats.hp;
            const bosses = await window.spawnOutlaw(index);
            const style = bosses[0].userData.bossStyle;
            const wolves = () => S.enemies.filter(e => e.userData.type === 'wolf').length;
            // Wait on game time, not wall time: software rendering in CI can run at a few FPS.
            const start = S.gameState.runTime;
            const deadline = Date.now() + 90000;
            while(S.gameState.runTime - start < 8 && S.playerStats.hp === hpBefore && wolves() === 0 && Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 100));
            }
            return { style, hurt: S.playerStats.hp < hpBefore, wolves: wolves(), seconds: +(S.gameState.runTime - start).toFixed(1) };
        }, index);
        const worked = result.style === 'packleader' ? result.wolves > 0 || result.hurt : result.hurt;
        assert.ok(worked, `${styles[index]} lands its signature attack: ${JSON.stringify(result)}`);
        landed.push(`${result.style} (${result.seconds}s)`);
    }

    // An outlaw with an imported 3D model (the Marshal's file stands in) shows the model, animates
    // and still fights the same way.
    const modelled = await page.evaluate(async () => {
        const { loadCharacterModel } = await import('/src/characterModels.js');
        O.OUTLAWS[0].model = 'models/marshal.glb';
        await loadCharacterModel(O.OUTLAWS[0].model);
        window.clearField();
        S.playerStats.hp = 50;
        S.playerStats.invulnerabilityTimer = 0;
        const [pete] = await window.spawnOutlaw(0);
        const skinned = pete.getObjectByProperty('isSkinnedMesh', true);
        const start = S.gameState.runTime;
        const deadline = Date.now() + 90000;
        while(S.gameState.runTime - start < 8 && S.playerStats.hp === 50 && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
        const result = { model: !!skinned && skinned.visible, animating: pete.userData.model?.mixer.time > 0, hurt: S.playerStats.hp < 50 };
        O.OUTLAWS[0].model = undefined;
        return result;
    });
    assert.deepEqual(modelled, { model: true, animating: true, hurt: true }, 'an imported outlaw model is shown, animated, and still charges');

    // Iron Jack: a shot at his face bounces off, a shot in the back hurts.
    const armour = await page.evaluate(async () => {
        const { spawnBullet } = await import('/src/bulletSystem.js');
        window.clearField();
        S.playerStats.hp = 50;
        const [jack] = await window.spawnOutlaw(4);
        Object.assign(jack.userData, { speed: 0, shootTimer: 999, cooldown: 999, hp: 20, maxHp: 20 });
        const wait = async () => { const t = S.gameState.runTime; while(S.gameState.runTime - t < 0.5) await new Promise(r => setTimeout(r, 50)); };
        await wait(); // let him turn toward the player
        const facing = jack.getWorldDirection(jack.position.clone()).setY(0).normalize();
        const shoot = side => {
            const from = jack.position.clone().addScaledVector(facing, side * 2).setY(2);
            spawnBullet(jack.parent, 'player', from, facing.clone().multiplyScalar(-side * 60));
        };
        shoot(1);
        await wait();
        const afterFront = jack.userData.hp;
        shoot(-1);
        await wait();
        return { afterFront, afterBack: jack.userData.hp };
    });
    assert.equal(armour.afterFront, 20, `a frontal shot bounces off Iron Jack: ${JSON.stringify(armour)}`);
    assert.ok(armour.afterBack < 20, `a shot in the back hurts Iron Jack: ${JSON.stringify(armour)}`);

    // The Calloways: beating one brother is not beating the outlaw.
    await page.evaluate(async () => {
        const { spawnBullet } = await import('/src/bulletSystem.js');
        window.clearField();
        S.playerStats.hp = 50;
        const brothers = await window.spawnOutlaw(3, 2);
        for(const b of brothers) Object.assign(b.userData, { speed: 0, shootTimer: 999, hp: 1 });
        window.__brothers = brothers;
        const at = brothers[0].position.clone().setY(2);
        spawnBullet(brothers[0].parent, 'player', at, at.clone().set(0, 0, 0));
    });
    await page.waitForFunction(() => !S.enemies.includes(window.__brothers[0]));
    await page.evaluate(async () => { const t = S.gameState.runTime; while(S.gameState.runTime - t < 1) await new Promise(r => setTimeout(r, 50)); });
    assert.equal(await page.evaluate(() => S.gameState.bounty.status), 'none', 'one brother down: no bounty yet');
    await page.evaluate(async () => {
        const { spawnBullet } = await import('/src/bulletSystem.js');
        const at = window.__brothers[1].position.clone().setY(2);
        spawnBullet(window.__brothers[1].parent, 'player', at, at.clone().set(0, 0, 0));
    });
    await page.locator('#bounty-choice').waitFor({ state: 'visible', timeout: 60000 });

    // Boss Arena (?arena): pick an outlaw, fight at once with no gang, and nothing is saved.
    const arenaPage = await context.newPage();
    arenaPage.setDefaultTimeout(30000);
    arenaPage.on('pageerror', error => errors.push(error.message));
    await arenaPage.route('https://fonts.googleapis.com/**', route => route.abort());
    await arenaPage.route('https://fonts.gstatic.com/**', route => route.abort());
    await arenaPage.goto(`${server.resolvedUrls.local[0]}?arena`, { waitUntil: 'commit', timeout: 60000 });
    await arenaPage.locator('#arena-screen').waitFor({ state: 'visible', timeout: 90000 });
    await arenaPage.evaluate(async () => {
        window.S = await import('/src/state.js');
        localStorage.clear();
    });
    assert.equal(await arenaPage.locator('.arena-fight').count(), 8, 'all eight outlaws can be picked');
    assert.equal(await arenaPage.locator('#start-screen').isVisible(), false, 'the arena replaces the home screen');
    await arenaPage.locator('#arena-invincible').click();
    await arenaPage.locator('[data-arena="4"]').click(); // Iron Jack
    await arenaPage.waitForFunction(() => S.gameState.isGameStarted);
    const fight = await arenaPage.evaluate(async () => {
        const t = S.gameState.runTime;
        while(S.gameState.runTime - t < 3) await new Promise(r => setTimeout(r, 50));
        return { outlaw: S.gameState.outlawIndex, wave: S.gameState.waveNumber, types: S.enemies.map(e => e.userData.type), hp: S.playerStats.hp };
    });
    assert.equal(fight.outlaw, 4);
    assert.deepEqual(fight.types, ['boss'], `only the outlaw, no gang: ${JSON.stringify(fight)}`);
    assert.equal(fight.hp, 5, "can't die keeps the hearts full");
    await arenaPage.evaluate(async () => {
        const { spawnBullet } = await import('/src/bulletSystem.js');
        const jack = S.enemies[0];
        jack.userData.hp = 1;
        const back = jack.getWorldDirection(jack.position.clone()).setY(0).normalize().negate();
        const from = jack.position.clone().addScaledVector(back, 2).setY(2);
        spawnBullet(jack.parent, 'player', from, back.clone().multiplyScalar(-60));
    });
    await arenaPage.locator('#result-title').getByText('OUTLAW DOWN').waitFor({ timeout: 60000 });
    const saved = await arenaPage.evaluate(() => ({ progress: localStorage.getItem('redWestProgress.v1'), log: localStorage.getItem('redWestRunLog.v1') }));
    assert.deepEqual(saved, { progress: null, log: null }, 'practice fights save nothing');
    await arenaPage.locator('#restart-msg').waitFor({ state: 'visible' });
    await arenaPage.keyboard.press('KeyR');
    await arenaPage.locator('#arena-screen').waitFor({ state: 'visible' });

    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    console.log(`Boss smoke passed: every outlaw's signature attack lands (${landed.join(', ')}), an imported outlaw model, Iron Jack's armour, the Calloways' last-brother bounty, and the Boss Arena.`);
} finally {
    await browser?.close();
    await server.close();
}
