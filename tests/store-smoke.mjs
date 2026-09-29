import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/store.js';

// Store flow end to end: a run pays Bounty Dollars and advances daily jobs, the shop needs a
// confirm tap, buying + equipping recolours the player, and paid packs stay off until configured.
// Then the same against the real server (server/app.js), including a RevenueCat webhook credit.

async function playOneRunAndDie(page) {
    await page.keyboard.down('Space');
    await page.waitForFunction(() => S.gameState.isGameStarted);
    await page.keyboard.up('Space');
    // A two-minute run, so the score is plausible enough to be ranked.
    await page.evaluate(() => { S.gameState.score = 480; S.gameState.runTime = 120; S.gameState.runStats.kills = { bandit: 3 }; });
    await page.evaluate(async () => {
        const { spawnEnemy } = await import('/src/enemySystem.js');
        const p = S.enemies[0].parent.children.find(o => o.userData.type === 'player');
        S.playerStats.hp = 1; S.playerStats.invulnerabilityTimer = 0; S.playerStats.isDashing = false;
        spawnEnemy(p.parent, p.position, 'bandit');
        S.enemies.at(-1).position.copy(p.position);
    });
    await page.locator('#gameover').waitFor({ state: 'visible' });
    await page.locator('#result-earnings .earn-title b').first().waitFor();
    const earned = Number((await page.locator('#result-earnings .earn-title b').first().textContent()).replace(/\D/g, ''));
    await page.locator('#restart-msg').waitFor({ state: 'visible' });
    await page.keyboard.press('KeyR');
    await page.locator('#start-screen').waitFor({ state: 'visible' });
    return earned;
}

async function openPage(browser, url, seed) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(answeredPrivacy);
    if(seed) await context.addInitScript(seed);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
    // A fresh dev server may re-bundle dependencies on first load; allow for that.
    await page.locator('canvas').waitFor({ timeout: 90000 });
    await page.evaluate(async () => { window.S = await import('/src/state.js'); });
    return { page, errors, context };
}

let browser;
const viteServers = [];
let apiServer;
try {
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });

    // ---- 1. Local playtest wallet ----
    delete process.env.VITE_API_BASE;
    const localVite = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    viteServers.push(localVite);
    await localVite.listen();
    {
        const { page, errors } = await openPage(browser, localVite.resolvedUrls.local[0]);
        assert.equal(await page.locator('#home-dollars').textContent(), '0');
        const earned = await playOneRunAndDie(page);
        assert.ok(earned >= 120, `a 480-point run pays at least $120 (got ${earned})`);
        assert.equal(Number(await page.locator('#home-dollars').textContent().then(t => t.replace(/\D/g, ''))), earned);
        await page.evaluate(async () => {
            // Top up for the purchase test through the same local profile store the game uses.
            const raw = JSON.parse(localStorage.getItem('redWestProfile.v1'));
            raw.balances.dollars = 1000;
            localStorage.setItem('redWestProfile.v1', JSON.stringify(raw));
        });
        await page.reload({ waitUntil: 'commit', timeout: 60000 });
        await page.locator('canvas').waitFor();
        await page.evaluate(async () => { window.S = await import('/src/state.js'); });
        await page.locator('#shop-btn').click();
        await page.locator('#shop-screen').waitFor({ state: 'visible' });
        assert.ok((await page.locator('#shop-preview-img').getAttribute('src'))?.startsWith('data:image/png'), 'outfit preview renders');
        await page.locator('[data-tab="nuggets"]').click();
        assert.equal(await page.locator('[data-product]:not([disabled])').count(), 0, 'real-money packs are off without a server');
        await page.locator('[data-tab="hat"]').click();
        const buy = page.locator('[data-item="hat-black"]');
        await buy.click();
        assert.match(await buy.textContent(), /CONFIRM/, 'first tap only arms the purchase');
        await buy.click({ force: true }); // the CONFIRM button pulses, so it is never "stable"
        await page.waitForFunction(() => document.querySelector('[data-item="hat-black"]').textContent === 'EQUIP');
        assert.equal(await page.locator('#shop-dollars').textContent(), '850');
        await page.locator('[data-item="hat-black"]').click();
        await page.waitForFunction(() => document.querySelector('[data-item="hat-black"]').textContent === 'EQUIPPED');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestProfile.v1')).loadout.hat);
        assert.equal(saved, 'hat-black');
        // Guns: bought with Bounty Dollars, equipped into the run's SWAP slot.
        await page.locator('[data-tab="secondary"]').click();
        assert.equal(await page.locator('.gun-card').count(), 3);
        const gun = page.locator('[data-item="gun-sawedoff"]');
        await gun.click();
        await gun.click({ force: true });
        await page.waitForFunction(() => document.querySelector('[data-item="gun-sawedoff"]').textContent === 'EQUIP');
        assert.equal(await page.locator('#shop-dollars').textContent(), '400');
        await gun.click();
        await page.waitForFunction(() => S.playerStats.guns.secondary === 'gun-sawedoff');
        await page.locator('#shop-screen .panel-back').click();
        await page.locator('#jobs-btn').click();
        assert.equal(await page.locator('.job-card').count(), 3);

        // Records belong to the account: offline they are personal records, with a name set once.
        await page.locator('#jobs-screen .panel-back').click();
        await page.locator('#records-btn').click();
        await page.locator('#records-screen').waitFor({ state: 'visible' });
        assert.match(await page.locator('#records-totals').textContent(), /480BEST RUN/);
        assert.match(await page.locator('#records-stages li').first().textContent(), /DUSTY PETE.*480/);
        await page.locator('#records-name-edit').click();
        await page.locator('#records-name-input').fill('x');
        await page.locator('#records-name-save').click();
        await page.locator('#records-name-msg').getByText('At least 3').waitFor();
        await page.locator('#records-name-input').fill('trail boss');
        await page.locator('#records-name-save').click();
        await page.locator('#records-name-value').getByText('TRAIL BOSS').waitFor();
        await page.locator('[data-tab="boards"]').click();
        await page.locator('#records-board-detail').getByText('Leaderboards go live').waitFor();
        assert.deepEqual(errors, [], errors.join(' | '));
    }
    // Two dev servers share the dependency cache; stop the first before starting the second.
    await localVite.close();
    viteServers.length = 0;

    // ---- 2. Real server wallet ----
    const store = createMemoryStore();
    apiServer = createHttpServer(createApp({ store, env: { REVENUECAT_WEBHOOK_AUTH: 'Bearer rc-test', ALLOWED_ORIGIN: '*' } }));
    await new Promise(r => apiServer.listen(0, '127.0.0.1', r));
    const apiBase = `http://127.0.0.1:${apiServer.address().port}`;
    process.env.VITE_API_BASE = apiBase;
    const remoteVite = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    viteServers.push(remoteVite);
    await remoteVite.listen();
    {
        // A rival already on the boards.
        const post = async (path, token, body) => (await fetch(apiBase + path, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })).json();
        const rival = await post('/api/account');
        await post('/api/name', rival.token, { name: 'Rival Rosa' });
        await post('/api/run', rival.token, { score: 2000, seconds: 200, outlawIndex: 0, bounty: 'banked', heatAtOutlaw: 2 });

        const { page, errors } = await openPage(browser, remoteVite.resolvedUrls.local[0]);
        await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('redWestAccount.v1') || 'null')?.token);
        const userId = await page.evaluate(() => JSON.parse(localStorage.getItem('redWestAccount.v1')).userId);
        const earned = await playOneRunAndDie(page);
        const serverDollars = store.getUser(userId).profile.balances.dollars;
        assert.equal(serverDollars, earned, 'the server, not the browser, holds the balance');
        assert.equal(store.getUser(userId).ageBand, 'adult', 'the first-launch answer reaches the server');
        assert.equal(store.getUser(userId).statsConsent, false);

        // Online leaderboards rank accounts; my row is highlighted once I have a name.
        await page.locator('#records-btn').click();
        await page.locator('#records-name-edit').click();
        await page.locator('#records-name-input').fill('rival rosa');
        await page.locator('#records-name-save').click();
        await page.locator('#records-name-msg').getByText('taken').waitFor();
        await page.locator('#records-name-input').fill('smoke kid');
        await page.locator('#records-name-save').click();
        await page.locator('#records-name-value').getByText('SMOKE KID').waitFor();
        assert.equal(store.getUser(userId).profile.name, 'SMOKE KID');
        await page.locator('[data-tab="boards"]').click();
        await page.locator('#records-board-list li.me').waitFor();
        const rows = await page.locator('#records-board-list li').evaluateAll(items => items.map(li =>
            [...li.querySelectorAll('span')].map(span => span.textContent).join('')));
        assert.deepEqual(rows, ['#1RIVAL ROSA2,000', '#2SMOKE KID480']);
        // Other players' names can be reported (two taps); my own row has no report button.
        assert.equal(await page.locator('#records-board-list li.me .records-report').count(), 0);
        const report = page.locator('#records-board-list li', { hasText: 'RIVAL ROSA' }).locator('.records-report');
        await report.click();
        assert.equal(await report.textContent(), 'REPORT?');
        assert.deepEqual(store.getUser(rival.userId).reportedBy ?? [], [], 'one tap sends nothing');
        const [reportResponse] = await Promise.all([
            page.waitForResponse(response => response.url().endsWith('/api/report')),
            report.click()
        ]);
        assert.equal(reportResponse.status(), 200);
        assert.equal(await report.textContent(), 'REPORTED');
        assert.deepEqual(store.getUser(rival.userId).reportedBy, [userId]);
        await page.locator('#records-board').selectOption('stars');
        await page.locator('#records-board-list li').getByText('RIVAL ROSA').waitFor();
        assert.equal(await page.locator('#records-board-list li.me').count(), 0, 'no stars yet, so not on the stars board');
        await page.locator('#records-screen .panel-back').click();

        // A paid purchase: RevenueCat calls the server, and the game shows it after a refresh.
        const response = await fetch(`${apiBase}/webhooks/revenuecat`, {
            method: 'POST',
            headers: { Authorization: 'Bearer rc-test', 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: { type: 'NON_RENEWING_PURCHASE', app_user_id: userId, product_id: 'nuggets_100', transaction_id: 'smoke-1' } })
        });
        assert.equal(response.status, 200);
        await page.reload({ waitUntil: 'commit', timeout: 60000 });
        await page.locator('canvas').waitFor({ timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('home-nuggets').textContent === '100');
        assert.deepEqual(errors, [], errors.join(' | '));
    }
    console.log('Store smoke passed: run earnings, daily jobs, confirm-to-buy, equip, gated paid packs, account records and name, server wallet, online leaderboards and webhook credit.');
} finally {
    await browser?.close();
    for(const server of viteServers) await server.close();
    if(apiServer) await new Promise(r => apiServer.close(r));
}
