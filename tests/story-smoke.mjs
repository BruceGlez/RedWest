import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { findChrome } from './chrome-path.mjs';
import { answeredPrivacy } from './privacy-seed.mjs';

// The Bounty Book's story: a card opens from an outlaw's entry, locked cards say which star opens them, the
// Case File fills with ledger pages as the second star is earned, and the chapter ending waits for all ten.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server'] });
    const open = async stars => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        await context.addInitScript(stars => localStorage.setItem('redWestProgress.v1', JSON.stringify({ selected: 2, stars, best: [] })), stars);
        await context.addInitScript(answeredPrivacy);
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.**', route => route.abort());
        await page.goto(server.resolvedUrls.local[0], { waitUntil: 'commit' });
        await page.locator('#start-screen').waitFor({ state: 'visible', timeout: 90000 });
        await page.locator('#book-btn').click();
        await page.locator('#book-screen').waitFor({ state: 'visible' });
        return { page, errors, context };
    };

    // Two outlaws done: Pete with all three stars, Rosa with only the first (no ledger page yet).
    {
        const { page, errors, context } = await open([7, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert.equal((await page.locator('#case-count').textContent()).trim(), '1 / 10 PAGES');
        assert.equal(await page.locator('#book-case .ledger-page:not(.locked):not(.case-end)').count(), 1);
        assert.equal(await page.locator('#book-case .case-end.locked').count(), 1, 'the chapter ending waits for all ten pages');
        await page.locator('[data-story="0"]').first().click();
        await page.locator('#story-content h3', { hasText: 'The Tin Cup' }).waitFor();
        await page.locator('[data-nav="1"]').click();
        await page.locator('#story-content h3', { hasText: 'A Receipt' }).waitFor();
        await page.locator('[data-close]').click();
        await page.locator('#story-modal').waitFor({ state: 'hidden' });
        // Rosa's second card is still locked and names its star.
        await page.locator('button[data-story="1"]').click();
        await page.locator('[data-nav="1"]').click();
        await page.locator('#story-content').getByText('Collect the bounty at Heat 2+').waitFor();
        assert.deepEqual(errors, []);
        await context.close();
    }
    // The opening reads in four panels and is remembered, so the Bounty Book stops calling it new.
    {
        const { page, errors, context } = await open([7, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
        await page.locator('#book-case [data-seq="opening"]').getByText('NEW').waitFor();
        await page.locator('#book-case [data-seq="opening"]').click();
        await page.locator('#story-content h3', { hasText: 'Red West' }).waitFor();
        for(const title of ['Cinder Creek', 'The Star', 'Lantern Rock']) {
            await page.locator('[data-seq-nav]').last().click();
            await page.locator('#story-content h3', { hasText: title }).waitFor();
        }
        await page.locator('[data-close]').getByText('DONE').click();
        await page.locator('#story-modal').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => localStorage.getItem('redWestIntroSeen.v1')), '1');
        assert.equal(await page.locator('#book-case [data-seq="ending"]').count(), 0, 'the ending waits for all ten pages');
        assert.deepEqual(errors, []);
        await context.close();
    }
    // All ten pages: the ending opens.
    {
        const { page, errors, context } = await open(Array(10).fill(7));
        assert.equal((await page.locator('#case-count').textContent()).trim(), '10 / 10 PAGES');
        await page.locator('#book-case .case-end').getByText('The Ledger, Complete').waitFor();
        await page.locator('#book-case [data-seq="ending"]').click();
        await page.locator('#story-content h3', { hasText: 'The Court' }).waitFor();
        await page.locator('[data-close]').click();
        assert.deepEqual(errors, []);
        await context.close();
    }
    console.log('Story smoke passed: story cards open and page through, locked cards name their star, the Case File fills with pages, and the chapter ending opens with all ten.');
} finally {
    await browser?.close();
    await server.close();
}
