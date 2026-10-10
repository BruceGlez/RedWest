import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// Pete's default pursuit must exercise the real loop, without the legacy-road smoke flag.
async function checkPetePursuit(browser, url) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
        await context.addInitScript(answeredPrivacy);
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.route('https://fonts.gstatic.com/**', route => route.abort());
        await page.goto(url, { waitUntil: 'commit' });
        console.log('Pete pursuit: loading default mode.');
        await page.evaluate(async () => {
            window.S = await import('/src/state.js');
            window.P = await import('/src/modes/peteWorld.js');
            window.M = await import('/src/modes/index.js');
            window.W = await import('/src/peteWorldMap.js');
        });
        await page.waitForFunction(() => window.__redWest && S.gameState.loading === false && !S.gameState.startBlocked);
        await page.locator('#play-btn').click({ force: true }); // animated PLAY never becomes geometrically stable
        await page.waitForFunction(() => P.peteWorldRun.active).catch(error => {
            throw new Error(`Pete failed to start: ${error.message}; page errors: ${errors.join(' | ')}`);
        });
        await page.locator('#comic-start-btn').click();
        console.log('Pete pursuit: canyon started.');
        assert.equal(await page.evaluate(() => M.activeMode().id), 'pete-world');
        assert.equal(await page.evaluate(() => S.obstacles.length), 0, 'random road props cannot obstruct canyon objectives');

        // Real player input consumes the last two rounds and then dry-fires.
        await page.evaluate(() => { P.peteWorldRun.ammoState.current = 2; });
        await page.keyboard.down('Space');
        await page.waitForFunction(() => P.peteWorldRun.ammoState.current === 0);
        const shots = await page.evaluate(() => S.gameState.runStats.shotsFired);
        const dryFireUntil = await page.evaluate(() => S.gameState.runTime + 0.5);
        await page.waitForFunction(until => S.gameState.runTime >= until, dryFireUntil);
        assert.equal(await page.evaluate(() => S.gameState.runStats.shotsFired), shots, 'dry fire creates no extra shots');
        await page.keyboard.up('Space');
        console.log('Pete pursuit: finite ammo checked.');

        // Collect a clue through the mode's normal frame update, then save a meaningful retry point.
        await page.evaluate(() => {
            const c = W.INVESTIGATION_CLUES[0];
            window.__redWest.playerGroup.position.set(c.x, 0, c.z);
        });
        await page.waitForFunction(() => P.peteWorldRun.collectedClues.length === 1);
        await page.evaluate(() => {
            S.playerStats.hp = 3;
            P.peteWorldRun.ammoState.current = 17;
            window.__redWest.playerGroup.position.set(-5, 0, -20);
        });
        await page.waitForFunction(() => P.peteWorldRun.lastCheckpointId === 'camp-depot');
        const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestCheckpoint.v1')));
        assert.deepEqual(checkpoint.stats, { hp: 3, ammo: 17 });
        assert.ok(checkpoint.activeCampfires.includes('camp-depot'));

        // A real enemy bullet causes failure; returning and starting again restores the checkpoint.
        await page.evaluate(async () => {
            const { spawnBullet } = await import('/src/bulletSystem.js');
            const { scene, playerGroup } = window.__redWest;
            S.playerStats.hp = 1;
            S.playerStats.invulnerabilityTimer = 0;
            spawnBullet(scene, 'enemy', playerGroup.position.clone().setY(2), playerGroup.position.clone().set(0, 0, 0));
        });
        await page.locator('#result-title').getByText('WASTED', { exact: true }).waitFor();
        assert.ok(await page.evaluate(() => localStorage.getItem('redWestCheckpoint.v1')));
        await page.locator('#restart-msg').waitFor({ state: 'visible' });
        await page.keyboard.press('KeyR');
        await page.waitForFunction(() => !S.gameState.isGameStarted && !P.peteWorldRun.active);
        await page.locator('#play-btn').click({ force: true });
        await page.waitForFunction(() => P.peteWorldRun.active);
        const restored = await page.evaluate(() => ({
            hp: S.playerStats.hp, ammo: P.peteWorldRun.ammoState.current,
            clues: P.peteWorldRun.collectedClues,
            x: window.__redWest.playerGroup.position.x, z: window.__redWest.playerGroup.position.z
        }));
        assert.deepEqual(restored, { hp: 3, ammo: 17, clues: ['clue-manifest'], x: -5, z: -20 });
        console.log('Pete pursuit: death and checkpoint retry checked.');

        for(let index = 1; index < 3; index++) {
            await page.evaluate(index => {
                const c = W.INVESTIGATION_CLUES[index];
                window.__redWest.playerGroup.position.set(c.x, 0, c.z);
            }, index);
            await page.waitForFunction(count => P.peteWorldRun.collectedClues.length === count, index + 1);
        }
        await page.evaluate(() => { window.__redWest.playerGroup.position.set(0, 0, 74); });
        await page.waitForFunction(() => P.peteWorldRun.bossSpawned && S.enemies.length === 1);
        const spawned = await page.evaluate(() => {
            const e = S.enemies[0];
            // Pause after the spawn frame to inspect the contract before Pete moves.
            S.gameState.isPaused = true;
            return { type: e.userData.type, hp: e.userData.hp, style: e.userData.bossStyle, x: e.position.x, z: e.position.z };
        });
        assert.equal(spawned.type, 'boss');
        assert.equal(spawned.hp, 22);
        assert.equal(spawned.style, 'brawler');
        assert.ok(Math.hypot(spawned.x, spawned.z - 100) < 2, `Pete spawns at the stronghold: ${JSON.stringify(spawned)}`);
        await page.evaluate(async () => {
            const { spawnBullet } = await import('/src/bulletSystem.js');
            window.__pete = S.enemies[0];
            const at = window.__pete.position.clone().setY(2);
            spawnBullet(window.__redWest.scene, 'player', at, at.clone().set(0, 0, 0));
            S.gameState.isPaused = false;
        });
        await page.waitForFunction(() => window.__pete.userData.hp === 21);
        await page.evaluate(async () => {
            const { spawnBullet } = await import('/src/bulletSystem.js');
            for(let i = 0; i < 21; i++) {
                const at = window.__pete.position.clone().setY(2);
                spawnBullet(window.__redWest.scene, 'player', at, at.clone().set(0, 0, 0));
            }
        });
        await page.locator('#result-title').getByText('BOUNTY CLAIMED', { exact: true }).waitFor();
        const won = await page.evaluate(() => ({
            won: S.gameState.runWon, bounty: S.gameState.bounty.status,
            checkpoint: localStorage.getItem('redWestCheckpoint.v1'),
            progress: JSON.parse(localStorage.getItem('redWestProgress.v1')),
            kills: S.gameState.runStats.bossesKilled, active: P.peteWorldRun.active,
            scene: !!window.__redWest.scene.getObjectByName('pete-world-scene')
        }));
        assert.equal(won.won, true);
        assert.equal(won.bounty, 'banked');
        assert.equal(won.checkpoint, null);
        assert.ok(won.progress.stars[0] & 1);
        assert.equal(won.progress.selected, 1);
        assert.equal(won.kills, 1);
        assert.equal(won.active, false);
        assert.equal(won.scene, false);
        await page.locator('#restart-msg').waitFor({ state: 'visible' });
        await page.keyboard.press('KeyR');
        await page.waitForFunction(() => !S.gameState.isGameStarted && S.gameState.outlawIndex === 1);
        assert.equal(await page.evaluate(() => M.activeMode().id), 'road', 'the next outlaw does not restart Pete');
        assert.equal(await page.evaluate(() => S.enemies.length), 0);
        assert.equal(await page.evaluate(() => S.bullets.length), 0);
        assert.deepEqual(errors, [], `Pete pursuit errors: ${errors.join(' | ')}`);
        console.log('Pete pursuit smoke passed: ammo, clues, checkpoint death/retry, boss damage, victory, unlock and clean exit.');
    } finally {
        await context.close();
    }
}

// Every outlaw's signature attack: spawn each one next to the player, confirm the attack lands
// (or, for Rattlesnake Rosa, that her howl brings wolves), check Iron Jack's armour only stops
// shots from the front, and that the Calloways only count as beaten when the last brother falls.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(answeredPrivacy);
    await context.addInitScript(() => { window.__rwSmokeTest = true; }); // signature checks use the legacy road
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
        const original = O.OUTLAWS[0].model;
        O.OUTLAWS[0].model = 'models/marshal.glb';
        await loadCharacterModel(O.OUTLAWS[0].model);
        window.clearField();
        S.playerStats.hp = 50;
        S.playerStats.invulnerabilityTimer = 0;
        const [pete] = await window.spawnOutlaw(0);
        // (the box figure's own baked body is a skinned mesh too, and is hidden once the model shows)
        const skinned = pete.userData.model?.object.getObjectByProperty('isSkinnedMesh', true);
        const start = S.gameState.runTime;
        const deadline = Date.now() + 90000;
        while(S.gameState.runTime - start < 8 && S.playerStats.hp === 50 && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
        const result = { model: !!skinned && skinned.visible, animating: pete.userData.model?.mixer.time > 0, hurt: S.playerStats.hp < 50 };
        O.OUTLAWS[0].model = original;
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
    await page.close(); // stop rendering this completed fight before opening another WebGL scene

    // Boss Arena (?arena): pick an outlaw, fight at once with no gang, and nothing is saved.
    const arenaPage = await context.newPage();
    arenaPage.setDefaultTimeout(30000);
    arenaPage.on('pageerror', error => errors.push(error.message));
    await arenaPage.route('https://fonts.googleapis.com/**', route => route.abort());
    await arenaPage.route('https://fonts.gstatic.com/**', route => route.abort());
    await arenaPage.goto(`${server.resolvedUrls.local[0]}?arena=all`, { waitUntil: 'commit', timeout: 60000 });
    await arenaPage.locator('#arena-screen').waitFor({ state: 'visible', timeout: 90000 });
    await arenaPage.evaluate(async () => {
        window.S = await import('/src/state.js');
    });
    await arenaPage.waitForFunction(() => S.gameState.loading === false && !S.gameState.startBlocked);
    await arenaPage.evaluate(() => localStorage.clear());
    assert.equal(await arenaPage.locator('.arena-fight').count(), 10, 'all ten outlaws can be picked');
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
    await arenaPage.close();

    // The full-screen list respects the same locks as the town's Arena: nothing beaten, nothing open; one star opens one boss.
    const lockPage = await context.newPage();
    lockPage.setDefaultTimeout(30000);
    lockPage.on('pageerror', error => errors.push(error.message));
    await lockPage.route('https://fonts.googleapis.com/**', route => route.abort());
    await lockPage.route('https://fonts.gstatic.com/**', route => route.abort());
    await lockPage.goto(`${server.resolvedUrls.local[0]}?arena`, { waitUntil: 'commit', timeout: 60000 });
    await lockPage.locator('#arena-screen').waitFor({ state: 'visible', timeout: 90000 });
    assert.equal(await lockPage.locator('.arena-fight').count(), 10);
    assert.equal(await lockPage.locator('.arena-fight:not([disabled])').count(), 0, 'nothing beaten on the Wanted Road, so every boss is locked');
    await lockPage.evaluate(() => localStorage.setItem('redWestProgress.v1', JSON.stringify({ selected: 1, stars: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], best: [] })));
    await lockPage.reload({ waitUntil: 'commit' });
    await lockPage.locator('#arena-screen').waitFor({ state: 'visible', timeout: 90000 });
    assert.equal(await lockPage.locator('.arena-fight:not([disabled])').count(), 1, 'beating Dusty Pete opens Dusty Pete');
    assert.equal(await lockPage.locator('.arena-fight:not([disabled])').getAttribute('data-arena'), '0');
    await lockPage.evaluate(() => localStorage.removeItem('redWestProgress.v1'));

    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    console.log(`Boss smoke passed: every outlaw's signature attack lands (${landed.join(', ')}), an imported outlaw model, Iron Jack's armour, the Calloways' last-brother bounty, and the Boss Arena.`);
    await context.close(); // release the legacy scenes before testing the default canyon
    await checkPetePursuit(browser, server.resolvedUrls.local[0]);
} finally {
    await browser?.close();
    await server.close();
}
