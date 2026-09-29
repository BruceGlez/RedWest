import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome-path.mjs';

// The playable ad: build it, serve ONLY the single HTML file (every other request fails), tap to play,
// and check it reaches the end card, whose button opens the store through the ad network (MRAID).
execSync('npm run -s build:demo', { stdio: 'inherit' });
const file = 'dist-demo/red-west-playable.html';
assert.ok(statSync(file).size < 5 * 1024 * 1024, 'under the usual 5 MB playable-ad limit');
const html = readFileSync(file);
const server = createServer((req, res) => {
    if(req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    res.writeHead(404); res.end();
});
let browser;
try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
        executablePath: findChrome(),
        headless: true,
        args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--no-proxy-server', '--proxy-bypass-list=*', '--autoplay-policy=no-user-gesture-required']
    });
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    // An ad network's MRAID object, recording what the ad asks it to open.
    await context.addInitScript(() => { window.mraid = { opened: [], open(url) { this.opened.push(url); } }; });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    const outside = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if(!/^(data|blob):/.test(request.url()) && !request.url().endsWith(`:${server.address().port}/`)) outside.push(request.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'commit', timeout: 60000 });
    await page.locator('#demo-start').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#start-screen').isVisible(), false, 'no home screen');
    assert.equal(await page.locator('#welcome-modal').isVisible(), false, 'no first-launch question in the ad');
    await page.locator('#demo-play').tap({ force: true }); // it pulses, so never "stable"
    await page.locator('#demo-start').waitFor({ state: 'hidden' });
    // Stand still: the gang and Dusty Pete end the run (or the 45-second limit does).
    await page.locator('#demo-end').waitFor({ state: 'visible', timeout: 90000 });
    assert.match(await page.locator('#demo-end-title').textContent(), /SHOT DOWN|OUTLAW DOWN|HUNT GOES ON/);
    await page.locator('#demo-store').tap({ force: true });
    assert.deepEqual(await page.evaluate(() => window.mraid.opened), ['https://bruceglez.github.io/RedWest/']);
    assert.deepEqual(outside, [], 'the ad loads nothing from the network');
    assert.deepEqual(errors, [], `browser errors: ${errors.join(', ')}`);
    console.log(`Demo smoke passed: single ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB file, no network, tap to play, end card opens the store through MRAID.`);
} finally {
    await browser?.close();
    server.close();
}
